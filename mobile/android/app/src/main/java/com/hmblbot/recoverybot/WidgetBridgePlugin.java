package com.hmblbot.recoverybot;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Bundle;
import android.content.SharedPreferences;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;

// The Home Screen widgets (DayCountWidget, ChipWidget): the site hands them what they show
// (lib/appWidgets.js), and this keeps it in the app's own storage, then has them redraw.
// soberSince "YYYY-MM-DD" (the widget counts the days itself), the chip and its back as PNGs,
// its name, and the fun day-count facts still ahead.
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        Context context = getContext();
        String chipId = call.getString("chipId", "");
        // A new chip starts face up
        boolean sameChip = chipId.equals(WidgetData.prefs(context).getString("chipId", ""));
        SharedPreferences.Editor prefs = WidgetData.prefs(context).edit()
            .putBoolean("signedIn", true)
            .putString("soberSince", call.getString("soberSince", ""))
            .putString("chipLabel", call.getString("chipLabel", ""))
            .putString("chipId", chipId);
        // The fun day-count facts still ahead (JSON, lib/appWidgets.js); a site from before them sends none
        String facts = call.getString("funFacts", null);
        if (facts != null) prefs.putString("funFacts", facts);
        if (!sameChip) prefs.putBoolean("chipFlipped", false);
        File file = WidgetData.chipFile(context);
        String image = call.getString("chipImage", "");
        boolean hasChip = false;
        if (image != null && !image.isEmpty()) {
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(Base64.decode(image, Base64.DEFAULT));
                hasChip = true;
            } catch (Exception e) {
                file.delete();
            }
        } else {
            file.delete();
        }
        save(WidgetData.chipBackFile(context), hasChip ? call.getString("chipBackImage", "") : "");
        prefs.putBoolean("hasChip", hasChip).apply();
        WidgetData.redrawAll(context);
        call.resolve();
    }

    // The styles picked in the app (its settings, Widgets), which every widget left on
    // "Same as the app" draws in (WidgetStyles): one for both, and the day count's and chip's own
    // when "Same style for both" is off ("" while they follow the one for both). They belong to
    // the phone, so signing out keeps them.
    @PluginMethod
    public void widgetStyle(PluginCall call) {
        Context context = getContext();
        JSObject answer = new JSObject();
        answer.put("style", WidgetStyles.appStyle(context));
        answer.put("day", WidgetStyles.appStyleOwn(context, "day"));
        answer.put("chip", WidgetStyles.appStyleOwn(context, "chip"));
        call.resolve(answer);
    }

    // { style } sets the one for every widget and drops all the others; { style, widget: "day" |
    // "chip" } a kind's own (older pages); { style, widget: "day.<id>" } one placed widget's own
    // (from placedWidgets), and with style "" it goes back to the one for every widget
    @PluginMethod
    public void setWidgetStyle(PluginCall call) {
        String style = call.getString("style", "");
        String widget = call.getString("widget", "");
        String[] placed = widget.split("\\.", 2);
        if (placed.length == 2 && ("day".equals(placed[0]) || "chip".equals(placed[0]))) {
            int id;
            try {
                id = Integer.parseInt(placed[1]);
            } catch (NumberFormatException e) {
                call.reject("Unknown widget");
                return;
            }
            if (!style.isEmpty() && !WidgetStyles.known(style)) {
                call.reject("Unknown widget style");
                return;
            }
            WidgetStyles.setOwn(getContext(), placed[0], id, style.isEmpty() ? WidgetStyles.APP : style);
            WidgetData.redrawAll(getContext());
            JSObject answer = new JSObject();
            answer.put("style", style);
            call.resolve(answer);
            return;
        }
        if (!WidgetStyles.known(style)) {
            call.reject("Unknown widget style");
            return;
        }
        if (!widget.isEmpty() && !"both".equals(widget) && !"all".equals(widget) && !"day".equals(widget) && !"chip".equals(widget)) {
            call.reject("Unknown widget");
            return;
        }
        WidgetStyles.setAppStyle(getContext(), style, widget);
        WidgetData.redrawAll(getContext());
        JSObject answer = new JSObject();
        answer.put("style", style);
        call.resolve(answer);
    }

    // The widgets on their Home Screen, each on its own, with its size ("small" up to 2x2,
    // "medium" when wider, "large" when wider and taller) and the style it has of its own (""
    // while it follows the one for every widget): { widgets: [{ id: "day.12", kind: "day",
    // size: "small", style: "" }] }
    @PluginMethod
    public void placedWidgets(PluginCall call) {
        Context context = getContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        JSArray widgets = new JSArray();
        String[] kinds = {"day", "chip"};
        Class<?>[] providers = {DayCountWidget.class, ChipWidget.class};
        for (int k = 0; k < kinds.length; k++) {
            for (int id : manager.getAppWidgetIds(new ComponentName(context, providers[k]))) {
                Bundle options = manager.getAppWidgetOptions(id);
                int width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
                int height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
                String size = width >= 220 ? (height >= 220 ? "large" : "medium") : "small";
                String own = WidgetStyles.own(context, kinds[k], id);
                JSObject widget = new JSObject();
                widget.put("id", kinds[k] + "." + id);
                widget.put("kind", kinds[k]);
                widget.put("size", size);
                widget.put("style", WidgetStyles.APP.equals(own) ? "" : own);
                widgets.put(widget);
            }
        }
        JSObject answer = new JSObject();
        answer.put("widgets", widgets);
        call.resolve(answer);
    }

    @PluginMethod
    public void clear(PluginCall call) {
        Context context = getContext();
        WidgetData.prefs(context).edit().clear().apply();
        WidgetData.chipFile(context).delete();
        WidgetData.chipBackFile(context).delete();
        WidgetData.redrawAll(context);
        call.resolve();
    }

    private static void save(File file, String base64) {
        if (base64 == null || base64.isEmpty()) {
            file.delete();
            return;
        }
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(Base64.decode(base64, Base64.DEFAULT));
        } catch (Exception e) {
            file.delete();
        }
    }
}
