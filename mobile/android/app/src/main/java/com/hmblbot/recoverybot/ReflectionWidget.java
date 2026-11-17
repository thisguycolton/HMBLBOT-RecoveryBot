package com.hmblbot.recoverybot;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;

// The Daily Reflection widget: today's reading (its title, opening quote and where it's from),
// from the two weeks of them the site hands over (lib/appWidgets.js, WidgetBridgePlugin), so it
// turns over by itself: DayCountWidget's midnight alarm redraws every widget, and this one also
// asks to be redrawn every few hours. Tapping it opens the day's page. Drawn by WidgetPainter
// from its layout for the style picked in the app, or its own (WidgetStyles), and its size.
public class ReflectionWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, draw(context, id));
        DayCountWidget.wakeAtMidnight(context);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        manager.updateAppWidget(id, draw(context, id));
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        WidgetData.forget(context, "reflection", ids);
    }

    static RemoteViews draw(Context context, int id) {
        String style = WidgetStyles.of(context, "reflection", id);
        Calendar now = Calendar.getInstance();
        JSONObject today = WidgetData.signedIn(context) ? WidgetData.reflection(context, now) : null;
        if (today == null) {
            String note = WidgetData.signedIn(context)
                ? "Open RecoveryBot to bring in today's Daily Reflection."
                : "Sign in to RecoveryBot to see today's Daily Reflection.";
            return WidgetPainter.views(context, WidgetPainter.paintMessage(context, id, style, "reflection", note), "Daily Reflection",
                WidgetData.openPath(context, "", 3));
        }
        Map<String, Double> progress = new HashMap<>();
        Map<String, String> values = WidgetData.reflectionValues(today, now, progress);
        return WidgetPainter.views(context, WidgetPainter.paint(context, id, style, "reflection", values, progress, null),
            "Daily Reflection: " + today.optString("title", ""), WidgetData.openPath(context, today.optString("path", ""), 3));
    }
}
