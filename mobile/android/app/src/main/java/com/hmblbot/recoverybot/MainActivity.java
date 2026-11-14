package com.hmblbot.recoverybot;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import androidx.activity.EdgeToEdge;

import com.getcapacitor.BridgeActivity;

// The web view that shows recoverybot.hmblbot.com, with the app's own plugins added
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrinterPlugin.class);
        registerPlugin(AppClipboardPlugin.class);
        registerPlugin(WidgetBridgePlugin.class);
        registerPlugin(NativeAuthPlugin.class);
        registerPlugin(AppBarsPlugin.class);
        openTappedNotification(getIntent());
        // Edge to edge on every Android version, the way Android 15 and up already draw apps
        // that target them. The SystemBars plugin (insetsHandling "css") keeps the page clear of
        // the status and navigation bars and the keyboard; AppBarsPlugin colors what's behind them.
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
        // Server errors (a deploy restarting the server) get the app's own page, not nginx's
        getBridge().setWebViewClient(new AppWebViewClient(getBridge()));
    }

    // A notification tapped while the app wasn't running starts it with the message's data as
    // extras, which the FirebaseMessaging plugin only reads for a running app. Its page
    // (FcmSender puts it in data.url) becomes recoverybot://open/<path>, the address the widgets
    // use, so native_app.js goes there as the app starts.
    private void openTappedNotification(Intent intent) {
        if (intent == null || intent.getData() != null || intent.getExtras() == null) return;
        if (!intent.getExtras().containsKey("google.message_id")) return;
        String url = intent.getStringExtra("url");
        if (url == null || !url.startsWith("/") || url.startsWith("//")) return;
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse("recoverybot://open" + url));
    }
}
