package com.hmblbot.recoverybot;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.widget.RemoteViews;

import java.util.Arrays;

// The widgets' styles, the same for the day count and the chip, and the same list as the
// iPhone app (WidgetStyle in mobile/ios/App/RecoveryBotWidgets/RecoveryBotWidgets.swift) and the
// app's picker (lib/widgetStyles.js on the site): change them together. Each has a background
// (res/drawable/widget_bg_*) and a day count layout (res/layout/widget_day_count_*); Paper
// follows Light/Dark Mode through res/values-night.
//
// Each style also has its own fonts (the site's, in res/font, set in its layout) and a drawing
// in its background (res/drawable/widget_orn_*, the same shapes as the iPhone widgets).
//
// The style is picked in the app (This phone > Widgets, WidgetBridgePlugin.setWidgetStyle), for
// every widget or for one placed widget (WidgetBridgePlugin.placedWidgets lists them). A widget's
// own Edit (WidgetSettingsActivity) sets the same per-widget pick.
final class WidgetStyles {
    private WidgetStyles() {}

    static final String APP = "app";
    static final String DEFAULT = "classic";
    static final String[] KEYS = {"classic", "night", "ocean", "forest", "sunrise", "midnight", "black", "light", "paper", "paperLight", "paperDark"};
    static final String[] NAMES = {"Classic blue", "Night", "Ocean", "Forest", "Sunrise", "Midnight", "Charcoal", "Light", "Paper (follows Light/Dark)", "Paper, light", "Paper, dark"};

    static boolean known(String key) {
        return key != null && Arrays.asList(KEYS).contains(key);
    }

    // Kept apart from what the site hands over, so signing out (which clears that) leaves them.
    // "app" holds the app's pick for both, "app.day" / "app.chip" one kind's own when the app has
    // "Same style for both" off; "style.day.<id>" and "style.chip.<id>" a placed widget's own. (Before the
    // app had a picker, picks were kept as "day.<id>" / "chip.<id>"; those are left behind, so every
    // widget placed before starts on Same as the app.)
    static SharedPreferences prefs(Context context) {
        return WidgetData.looks(context);
    }

    // The app's pick for both kinds of widget
    static String appStyle(Context context) {
        String key = prefs(context).getString(APP, DEFAULT);
        return known(key) ? key : DEFAULT;
    }

    // One kind's own pick ("day" or "chip"), or "" while it follows the one for both
    static String appStyleOwn(Context context, String widget) {
        String key = prefs(context).getString(APP + "." + widget, "");
        return known(key) ? key : "";
    }

    // The app's pick for a kind of widget
    static String appStyle(Context context, String widget) {
        String own = appStyleOwn(context, widget);
        return own.isEmpty() ? appStyle(context) : own;
    }

    // For every widget (which drops each kind's own and every placed widget's own), or with
    // widget "day" / "chip" for that kind only
    static void setAppStyle(Context context, String key, String widget) {
        SharedPreferences.Editor edit = prefs(context).edit();
        if ("day".equals(widget) || "chip".equals(widget)) {
            edit.putString(APP + "." + widget, key);
        } else {
            edit.putString(APP, key).remove(APP + ".day").remove(APP + ".chip");
            for (String name : prefs(context).getAll().keySet()) {
                if (name.startsWith("style.")) edit.remove(name);
            }
        }
        edit.apply();
    }

    // A widget's own setting: a style, or "app"
    static String own(Context context, String widget, int id) {
        String key = prefs(context).getString("style." + widget + "." + id, APP);
        return known(key) ? key : APP;
    }

    static void setOwn(Context context, String widget, int id, String key) {
        prefs(context).edit().putString("style." + widget + "." + id, key).apply();
    }

    // The style a widget draws in
    static String of(Context context, String widget, int id) {
        String key = own(context, widget, id);
        return APP.equals(key) ? appStyle(context, widget) : key;
    }

    static int background(String key) {
        switch (key) {
            case "night": return R.drawable.widget_bg_night;
            case "ocean": return R.drawable.widget_bg_ocean;
            case "forest": return R.drawable.widget_bg_forest;
            case "sunrise": return R.drawable.widget_bg_sunrise;
            case "midnight": return R.drawable.widget_bg_midnight;
            case "black": return R.drawable.widget_bg_black;
            case "light": return R.drawable.widget_bg_light;
            case "paper": return R.drawable.widget_bg_paper;
            case "paperLight": return R.drawable.widget_bg_paper_light;
            case "paperDark": return R.drawable.widget_bg_paper_dark;
            default: return R.drawable.widget_bg_classic;
        }
    }

    static int dayLayout(String key) {
        switch (key) {
            case "night": return R.layout.widget_day_count_night;
            case "ocean": return R.layout.widget_day_count_ocean;
            case "forest": return R.layout.widget_day_count_forest;
            case "sunrise": return R.layout.widget_day_count_sunrise;
            case "midnight": return R.layout.widget_day_count_midnight;
            case "black": return R.layout.widget_day_count_black;
            case "light": return R.layout.widget_day_count_light;
            case "paper": return R.layout.widget_day_count_paper;
            case "paperLight": return R.layout.widget_day_count_paper_light;
            case "paperDark": return R.layout.widget_day_count_paper_dark;
            default: return R.layout.widget_day_count;
        }
    }

    // A text's color on a style's background (the chip's label and empty note)
    static void ink(Context context, RemoteViews views, int viewId, String key) {
        switch (key) {
            case "light": views.setTextColor(viewId, 0xFF1F2433); break;
            case "paperLight": views.setTextColor(viewId, 0xFF3B2E21); break;
            case "paperDark": views.setTextColor(viewId, 0xFFF2E8D4); break;
            case "paper":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    // the Home Screen picks light or dark itself, so it follows a change without a redraw
                    views.setColorInt(viewId, "setTextColor", 0xFF3B2E21, 0xFFF2E8D4);
                } else {
                    views.setTextColor(viewId, context.getResources().getColor(R.color.widget_paper_ink, context.getTheme()));
                }
                break;
            default: views.setTextColor(viewId, 0xFFFFFFFF);
        }
    }
}
