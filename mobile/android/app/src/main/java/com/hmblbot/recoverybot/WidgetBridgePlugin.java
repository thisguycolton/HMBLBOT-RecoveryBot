package com.hmblbot.recoverybot;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;

// The Home Screen widgets (DayCountWidget, ChipWidget): the site hands them what they show
// (lib/appWidgets.js), and this keeps it in the app's own storage, then has them redraw.
// soberSince "YYYY-MM-DD" (the widget counts the days itself), the chip and its back as PNGs,
// its name.
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
