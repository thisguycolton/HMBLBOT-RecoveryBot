package com.hmblbot.recoverybot;

import android.net.Uri;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

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

    // A whole page that couldn't be reached (no signal, or the server restarting): the offline
    // page, told which page it was (?from=) so it can go back there. Capacitor opens it without
    // that, and inside the app the page can't find the site's address by itself.
    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        String errorUrl = bridge.getErrorUrl();
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
        if (errorUrl == null || errorResponse.getStatusCode() < 500) return;
        view.loadUrl(Uri.parse(errorUrl).buildUpon()
            .appendQueryParameter("reason", "server")
            .appendQueryParameter("from", request.getUrl().toString())
            .build().toString());
    }
}
