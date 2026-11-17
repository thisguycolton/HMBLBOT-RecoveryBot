package com.hmblbot.recoverybot;

import android.net.Uri;
import android.util.Log;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

import java.io.InputStream;

// Capacitor sends any page with an error status to the offline page, which then says "Can't reach
// RecoveryBot" even for a missing page the site would explain itself. This keeps the site's own
// pages for 4xx, and for a server error on a whole page (nginx's "502 Error" while a deploy
// restarts the server) opens www/offline.html?reason=server, which says RecoveryBot is updating
// and tries again by itself. (iOS: ServerErrorGuard in AppDelegate.swift.)
public class AppWebViewClient extends BridgeWebViewClient {
    private final Bridge bridge;

    public AppWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    // Run once when the next whole page has loaded (AppLockPlugin, signing out from the lock)
    private static Runnable nextPageFinished;

    static void onNextPageFinished(Runnable run) {
        nextPageFinished = run;
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        Runnable run = nextPageFinished;
        nextPageFinished = null;
        if (run != null) run.run();
    }

    // Whether an address is the offline page, with or without ?from= / ?reason=
    private boolean isOfflinePage(Uri url) {
        String errorUrl = bridge.getErrorUrl();
        if (errorUrl == null || url == null) return false;
        Uri page = Uri.parse(errorUrl);
        return page.getHost() != null && page.getHost().equals(url.getHost()) && page.getPath() != null && page.getPath().equals(url.getPath());
    }

    // Capacitor serves the offline page from inside the app only at its exact address, so with
    // ?from= added it went looking for it on the internet, failed, and opened the offline page
    // for that failure, over and over: a blank screen until the app was closed, even once the
    // signal came back. This serves it from the app (www/offline.html) whatever follows the "?".
    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        if (isOfflinePage(request.getUrl())) {
            try {
                InputStream page = view.getContext().getAssets().open("public/offline.html");
                return new WebResourceResponse("text/html", "UTF-8", page);
            } catch (Exception e) {
                Log.e("AppWebViewClient", "No offline page in the app", e);
            }
        }
        return super.shouldInterceptRequest(view, request);
    }

    // A whole page that couldn't be reached (no signal, or the server restarting): the offline
    // page, told which page it was (?from=) so it can go back there. Capacitor opens it without
    // that, and inside the app the page can't find the site's address by itself. Never for the
    // offline page itself, which would only open it again.
    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        String errorUrl = bridge.getErrorUrl();
        if (isOfflinePage(request.getUrl())) return;
        if (!request.isForMainFrame() || errorUrl == null) {
            super.onReceivedError(view, request, error);
            return;
        }
        view.loadUrl(Uri.parse(errorUrl).buildUpon()
            .appendQueryParameter("from", request.getUrl().toString())
            .build().toString());
    }

    @Override
    public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
        // A file inside the page (an image, a script): Capacitor's own handling, which leaves the
        // page alone. (Its list of listeners isn't open to us, so a whole page skips them.)
        if (!request.isForMainFrame()) {
            super.onReceivedHttpError(view, request, errorResponse);
            return;
        }
        String errorUrl = bridge.getErrorUrl();
        if (errorUrl == null || errorResponse.getStatusCode() < 500 || isOfflinePage(request.getUrl())) return;
        view.loadUrl(Uri.parse(errorUrl).buildUpon()
            .appendQueryParameter("reason", "server")
            .appendQueryParameter("from", request.getUrl().toString())
            .build().toString());
    }
}
