package com.hmblbot.recoverybot;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.Arrays;

// The widgets' styles, the same for every widget, and the same list as the iPhone app
// (WidgetStyle in mobile/ios/App/RecoveryBotWidgets/RecoveryBotWidgets.swift) and the app's
// picker (lib/widgetStyles.js on the site): change them together. How each style draws each
// widget is its layout (assets/widget-layouts.json, WidgetPainter); res/drawable/widget_bg_* are
// only the swatches in WidgetSettingsActivity. Paper follows Light/Dark Mode.
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

    static boolean isKind(String widget) {
        return "day".equals(widget) || "chip".equals(widget) || "reflection".equals(widget);
    }

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
    // widget "day" / "chip" / "reflection" for that kind only
    static void setAppStyle(Context context, String key, String widget) {
        SharedPreferences.Editor edit = prefs(context).edit();
        if (isKind(widget)) {
            edit.putString(APP + "." + widget, key);
        } else {
            edit.putString(APP, key).remove(APP + ".day").remove(APP + ".chip").remove(APP + ".reflection");
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
}
