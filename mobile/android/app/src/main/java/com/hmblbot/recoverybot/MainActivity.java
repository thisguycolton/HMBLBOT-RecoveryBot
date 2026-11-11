package com.hmblbot.recoverybot;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

// The web view that shows recoverybot.hmblbot.com, with the app's own plugins added
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrinterPlugin.class);
        registerPlugin(AppClipboardPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
