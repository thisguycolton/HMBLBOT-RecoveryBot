package com.hmblbot.recoverybot;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.graphics.Bitmap;
import android.view.View;
import android.widget.RemoteViews;

// The favorite chip widget: their first favorite chip (else their newest sobriety chip), drawn
// by the site and handed over by WidgetBridgePlugin
public class ChipWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        RemoteViews views = draw(context);
        for (int id : ids) manager.updateAppWidget(id, views);
    }

    static RemoteViews draw(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_chip);
        views.setOnClickPendingIntent(R.id.widget_root, WidgetData.openChips(context));
        Bitmap chip = WidgetData.signedIn(context) ? WidgetData.chip(context, 480) : null;
        if (chip == null) {
            views.setViewVisibility(R.id.chip_image, View.GONE);
            views.setViewVisibility(R.id.chip_label, View.GONE);
            views.setViewVisibility(R.id.chip_empty, View.VISIBLE);
            views.setTextViewText(R.id.chip_empty, WidgetData.signedIn(context)
                ? "Star a chip on your Chips page to show it here."
                : "Sign in to RecoveryBot to show your chip here.");
            return views;
        }
        views.setViewVisibility(R.id.chip_empty, View.GONE);
        views.setViewVisibility(R.id.chip_image, View.VISIBLE);
        views.setImageViewBitmap(R.id.chip_image, chip);
        String label = WidgetData.chipLabel(context);
        views.setContentDescription(R.id.chip_image, label.isEmpty() ? "Favorite chip" : label + " chip");
        views.setViewVisibility(R.id.chip_label, label.isEmpty() ? View.GONE : View.VISIBLE);
        views.setTextViewText(R.id.chip_label, label);
        return views;
    }
}
