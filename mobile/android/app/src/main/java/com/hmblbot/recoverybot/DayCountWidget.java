package com.hmblbot.recoverybot;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.widget.RemoteViews;

import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;

// The day count widget: how many days since their sobriety date, and the next milestone. It
// says only the number ("127 days"), never what the days are of. Counted here on the phone, and
// redrawn just after each midnight so it turns over without the app being opened. Tapping it
// opens Today. Drawn by WidgetPainter from its layout for the style picked in the app, or its
// own (WidgetStyles), and its size: the larger sizes also show the next fun fact (or today's).
public class DayCountWidget extends AppWidgetProvider {
    static final String MIDNIGHT = "com.hmblbot.recoverybot.MIDNIGHT";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, draw(context, id));
        wakeAtMidnight(context);
    }

    // Resized: drawn again at the new size (and with the layout for it)
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        manager.updateAppWidget(id, draw(context, id));
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        WidgetData.forget(context, "day", ids);
    }

    // Just after midnight: the chip's and the Daily Reflection's widgets turn over too (their
    // providers set the same alarm, so it rings even with no day count placed)
    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent.getBooleanExtra(MIDNIGHT, false)) {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            WidgetData.redraw(context, manager, ChipWidget.class);
            WidgetData.redraw(context, manager, ReflectionWidget.class);
            wakeAtMidnight(context);
        }
    }

    @Override
    public void onDisabled(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        boolean others = manager.getAppWidgetIds(new ComponentName(context, ChipWidget.class)).length > 0
            || manager.getAppWidgetIds(new ComponentName(context, ReflectionWidget.class)).length > 0;
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms != null && !others) alarms.cancel(midnightIntent(context));
    }

    static RemoteViews draw(Context context, int id) {
        String style = WidgetStyles.of(context, "day", id);
        PendingIntent open = WidgetData.openToday(context);
        if (!WidgetData.signedIn(context)) {
            return WidgetPainter.views(context, WidgetPainter.paintMessage(context, id, style, "day", "Sign in to RecoveryBot to see your day count."), "Day count", open);
        }
        WidgetData.Count count = WidgetData.count(context, Calendar.getInstance());
        if (count == null) {
            return WidgetPainter.views(context, WidgetPainter.paintMessage(context, id, style, "day", "Add your sobriety date in RecoveryBot to start your count."), "Day count", open);
        }
        Map<String, Double> progress = new HashMap<>();
        Map<String, String> values = WidgetData.dayValues(context, count, progress);
        String said = count.days + (count.days == 1 ? " day" : " days")
            + (count.today != null ? ". Today: " + count.today : count.next != null ? ". " + count.next + " in " + count.nextIn + (count.nextIn == 1 ? " day" : " days") : "");
        return WidgetPainter.views(context, WidgetPainter.paint(context, id, style, "day", values, progress, null), said, open);
    }

    private static PendingIntent midnightIntent(Context context) {
        Intent intent = new Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE, null, context, DayCountWidget.class);
        int[] ids = AppWidgetManager.getInstance(context).getAppWidgetIds(new ComponentName(context, DayCountWidget.class));
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        intent.putExtra(MIDNIGHT, true);
        return PendingIntent.getBroadcast(context, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // A minute past the next midnight (inexact, so it needs no special permission)
    static void wakeAtMidnight(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        Calendar next = Calendar.getInstance();
        next.add(Calendar.DAY_OF_MONTH, 1);
        next.set(Calendar.HOUR_OF_DAY, 0);
        next.set(Calendar.MINUTE, 1);
        next.set(Calendar.SECOND, 0);
        alarms.set(AlarmManager.RTC, next.getTimeInMillis(), midnightIntent(context));
    }
}
