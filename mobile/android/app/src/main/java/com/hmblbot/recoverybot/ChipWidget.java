package com.hmblbot.recoverybot;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.widget.RemoteViews;

import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;

// The favorite chip widget: their first favorite chip (else their newest sobriety chip), drawn
// by the site and handed over by WidgetBridgePlugin, with when they earned it and how far it is
// to the next. Tapping it opens the chip full size on the Chips page. Drawn by WidgetPainter
// from its layout for the style picked in the app, or its own (WidgetStyles), and its size.
// DayCountWidget's midnight redraw moves its line about the next chip along too.
public class ChipWidget extends AppWidgetProvider {

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
        WidgetData.forget(context, "chip", ids);
    }

    static RemoteViews draw(Context context, int id) {
        String style = WidgetStyles.of(context, "chip", id);
        Bitmap chip = WidgetData.signedIn(context) ? WidgetData.chip(context, 480) : null;
        if (chip == null) {
            String note = WidgetData.signedIn(context)
                ? "Star a chip on your Chips page to show it here."
                : "Sign in to RecoveryBot to show your chip here.";
            return WidgetPainter.views(context, WidgetPainter.paintMessage(context, id, style, "chip", note), "Favorite chip", WidgetData.openChips(context));
        }
        Map<String, Double> progress = new HashMap<>();
        Map<String, String> values = new HashMap<>();
        WidgetData.Count count = WidgetData.count(context, Calendar.getInstance());
        if (count != null) values.putAll(WidgetData.dayValues(context, count, progress));
        values.putAll(WidgetData.chipValues(context));
        String label = WidgetData.chipLabel(context);
        return WidgetPainter.views(context, WidgetPainter.paint(context, id, style, "chip", values, progress, chip),
            label.isEmpty() ? "Favorite chip" : label + " chip", WidgetData.openChip(context));
    }
}
