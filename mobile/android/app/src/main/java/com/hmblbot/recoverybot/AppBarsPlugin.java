package com.hmblbot.recoverybot;

import android.graphics.Color;
import android.view.View;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// The status and navigation bars follow the site's light or dark look (native_app.js calls this
// when the page's "dark" class changes). The app draws edge to edge (MainActivity), so the bars
// are see-through and what shows behind them is the window's own background, which this colors.
// That replaces @capacitor/status-bar on Android, whose Window.setStatusBarColor is deprecated
// and does nothing from Android 15 on.
@CapacitorPlugin(name = "AppBars")
public class AppBarsPlugin extends Plugin {
    @PluginMethod
    public void set(PluginCall call) {
        boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        String color = call.getString("color");
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            View decor = window.getDecorView();
            if (color != null) {
                try {
                    decor.setBackgroundColor(Color.parseColor(color));
                } catch (IllegalArgumentException ignored) {
                    // Not a color: the background stays as it is
                }
            }
            WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(window, decor);
            // Light bars = dark icons, for a light page
            bars.setAppearanceLightStatusBars(!dark);
            bars.setAppearanceLightNavigationBars(!dark);
            call.resolve();
        });
    }
}
