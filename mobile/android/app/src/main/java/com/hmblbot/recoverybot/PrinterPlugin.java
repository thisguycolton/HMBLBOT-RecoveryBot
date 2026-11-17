package com.hmblbot.recoverybot;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.WebView;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// window.print() does nothing in an Android web view, so the site calls this instead
// (entrypoints/native_app.js): Android's print screen for the page as it prints (its print styles)
@CapacitorPlugin(name = "Printer")
public class PrinterPlugin extends Plugin {
    @PluginMethod
    public void print(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            WebView webView = getBridge().getWebView();
            String title = call.getString("title");
            if (title == null || title.isEmpty()) title = webView.getTitle();
            if (title == null || title.isEmpty()) title = "RecoveryBot";
            PrintManager manager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            if (manager == null) {
                call.reject("This phone can't print");
                return;
            }
            manager.print(title, webView.createPrintDocumentAdapter(title), new PrintAttributes.Builder().build());
            call.resolve();
        });
    }
}
