package com.hmblbot.recoverybot;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Copy buttons: the web clipboard (navigator.clipboard) is unreliable in a web view, so the site
// calls this instead (entrypoints/native_app.js). Keeps formatting (HTML) when it's given.
@CapacitorPlugin(name = "AppClipboard")
public class AppClipboardPlugin extends Plugin {
    @PluginMethod
    public void write(PluginCall call) {
        String text = call.getString("text", "");
        String html = call.getString("html");
        ClipboardManager clipboard = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard == null) {
            call.reject("This phone has no clipboard");
            return;
        }
        ClipData clip = (html != null && !html.isEmpty())
            ? ClipData.newHtmlText("RecoveryBot", text, html)
            : ClipData.newPlainText("RecoveryBot", text);
        clipboard.setPrimaryClip(clip);
        call.resolve();
    }
}
