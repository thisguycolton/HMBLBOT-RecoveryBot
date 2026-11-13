package com.hmblbot.recoverybot;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.WebViewListener;

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

    @Override
    public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
        if (bridge.getWebViewListeners() != null) {
            for (WebViewListener listener : bridge.getWebViewListeners()) listener.onReceivedHttpError(view);
        }
        String errorUrl = bridge.getErrorUrl();
        if (errorUrl == null || !request.isForMainFrame() || errorResponse.getStatusCode() < 500) return;
        view.loadUrl(Uri.parse(errorUrl).buildUpon()
            .appendQueryParameter("reason", "server")
            .appendQueryParameter("from", request.getUrl().toString())
            .build().toString());
    }
}
