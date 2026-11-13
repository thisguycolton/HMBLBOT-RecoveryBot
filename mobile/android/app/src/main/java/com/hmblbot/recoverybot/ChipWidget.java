package com.hmblbot.recoverybot;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.view.View;
import android.widget.RemoteViews;

// The favorite chip widget: their first favorite chip (else their newest sobriety chip), drawn
// by the site and handed over by WidgetBridgePlugin. Tapping the chip turns it over to its back
// (a ViewFlipper with a squash-and-grow flip, res/anim/chip_flip_*); tapping anywhere else
// opens the Chips page.
public class ChipWidget extends AppWidgetProvider {
    static final String FLIP = "com.hmblbot.recoverybot.FLIP_CHIP";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        RemoteViews views = draw(context);
        for (int id : ids) manager.updateAppWidget(id, views);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!FLIP.equals(intent.getAction())) {
            super.onReceive(context, intent);
            return;
        }
        boolean flipped = !WidgetData.prefs(context).getBoolean("chipFlipped", false);
        WidgetData.prefs(context).edit().putBoolean("chipFlipped", flipped).apply();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, ChipWidget.class));
        // Only the face changes, so the flipper animates instead of the whole widget redrawing
        RemoteViews turn = new RemoteViews(context.getPackageName(), R.layout.widget_chip);
        turn.setDisplayedChild(R.id.chip_flipper, flipped ? 1 : 0);
        for (int id : ids) manager.partiallyUpdateAppWidget(id, turn);
    }

    static RemoteViews draw(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_chip);
        views.setOnClickPendingIntent(R.id.widget_root, WidgetData.openChips(context));
        Bitmap chip = WidgetData.signedIn(context) ? WidgetData.chip(context, 480) : null;
        if (chip == null) {
            views.setViewVisibility(R.id.chip_flipper, View.GONE);
            views.setViewVisibility(R.id.chip_label, View.GONE);
            views.setViewVisibility(R.id.chip_empty, View.VISIBLE);
            views.setTextViewText(R.id.chip_empty, WidgetData.signedIn(context)
                ? "Star a chip on your Chips page to show it here."
                : "Sign in to RecoveryBot to show your chip here.");
            return views;
        }
        views.setViewVisibility(R.id.chip_empty, View.GONE);
        views.setViewVisibility(R.id.chip_flipper, View.VISIBLE);
        views.setImageViewBitmap(R.id.chip_image, chip);
        String label = WidgetData.chipLabel(context);
        views.setContentDescription(R.id.chip_image, (label.isEmpty() ? "Favorite chip" : label + " chip") + ". Tap to turn it over.");
        Bitmap back = WidgetData.chipBack(context, 480);
        if (back != null) {
            views.setImageViewBitmap(R.id.chip_back_image, back);
            views.setContentDescription(R.id.chip_back_image, (label.isEmpty() ? "Favorite chip" : label + " chip") + ", back. Tap to turn it over.");
            views.setDisplayedChild(R.id.chip_flipper, WidgetData.prefs(context).getBoolean("chipFlipped", false) ? 1 : 0);
            views.setOnClickPendingIntent(R.id.chip_flipper, flip(context));
        } else {
            // No back drawn yet (the site redraws the widget on the next app open): the chip just opens the Chips page
            views.setDisplayedChild(R.id.chip_flipper, 0);
        }
        views.setViewVisibility(R.id.chip_label, label.isEmpty() ? View.GONE : View.VISIBLE);
        views.setTextViewText(R.id.chip_label, label);
        return views;
    }

    private static PendingIntent flip(Context context) {
        Intent intent = new Intent(FLIP, null, context, ChipWidget.class);
        return PendingIntent.getBroadcast(context, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
