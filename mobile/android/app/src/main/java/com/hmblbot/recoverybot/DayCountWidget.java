package com.hmblbot.recoverybot;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import java.util.Calendar;

// The day count widget: how many days since their sobriety date, and the next milestone. It
// says only the number ("127 days"), never what the days are of. Counted here on the phone, and
// redrawn just after each midnight so it turns over without the app being opened. Tapping it
// opens Today. Each one has its own look (WidgetSettingsActivity): four layouts with the same
// views, differing in background, type and colors. Made bigger than its 2x2 start, it also shows
// the next fun fact (or today's) along the bottom.
public class DayCountWidget extends AppWidgetProvider {
    static final String[] STYLES = {"classic", "paper", "midnight", "sunrise"};
    static final String[] STYLE_NAMES = {"Classic blue", "Paper", "Midnight", "Sunrise"};

    static int layout(String style) {
        switch (style) {
            case "paper": return R.layout.widget_day_count_paper;
            case "midnight": return R.layout.widget_day_count_midnight;
            case "sunrise": return R.layout.widget_day_count_sunrise;
            default: return R.layout.widget_day_count;
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, draw(context, id));
        wakeAtMidnight(context);
    }

    // Resized: the fun fact comes or goes
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        manager.updateAppWidget(id, draw(context, id));
    }

    // Room for the fun fact: three rows tall, or wide enough for one line under the count
    private static int factLines(Context context, int id) {
        Bundle options = AppWidgetManager.getInstance(context).getAppWidgetOptions(id);
        if (options == null) return 0;
        int width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        if (height >= 170) return 3;
        if (width >= 250 && height >= 140) return 1;
        return 0;
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        WidgetData.forget(context, "day", ids);
    }

    @Override
    public void onDisabled(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms != null) alarms.cancel(midnightIntent(context));
    }

    static RemoteViews draw(Context context, int id) {
        RemoteViews views = new RemoteViews(context.getPackageName(), layout(WidgetData.look(context, "day", id, "classic")));
        views.setOnClickPendingIntent(R.id.widget_root, WidgetData.openToday(context));
        WidgetData.Count count = WidgetData.signedIn(context) ? WidgetData.count(context, Calendar.getInstance()) : null;
        views.setViewVisibility(R.id.day_fact, View.GONE);
        if (count == null) {
            views.setViewVisibility(R.id.day_number, View.GONE);
            views.setViewVisibility(R.id.day_unit, View.GONE);
            views.setViewVisibility(R.id.day_progress, View.GONE);
            views.setTextViewText(R.id.day_next, WidgetData.signedIn(context)
                ? "Add your sobriety date in RecoveryBot to start your count."
                : "Sign in to RecoveryBot to see your day count.");
            return views;
        }
        views.setViewVisibility(R.id.day_number, View.VISIBLE);
        views.setViewVisibility(R.id.day_unit, View.VISIBLE);
        views.setTextViewText(R.id.day_number, String.valueOf(count.days));
        views.setTextViewText(R.id.day_unit, count.days == 1 ? "day" : "days");
        if (count.today != null) {
            views.setTextViewText(R.id.day_next, "Today: " + count.today);
            views.setViewVisibility(R.id.day_progress, View.GONE);
        } else if (count.next != null) {
            views.setTextViewText(R.id.day_next, count.next + " in " + count.nextIn + (count.nextIn == 1 ? " day" : " days"));
            views.setViewVisibility(R.id.day_progress, View.VISIBLE);
            views.setProgressBar(R.id.day_progress, 100, count.progress, false);
        } else {
            views.setTextViewText(R.id.day_next, "");
            views.setViewVisibility(R.id.day_progress, View.GONE);
        }
        int lines = factLines(context, id);
        String fact = lines > 0 ? WidgetData.factLine(context, count.days) : null;
        if (fact != null) {
            views.setTextViewText(R.id.day_fact, fact);
            views.setInt(R.id.day_fact, "setMaxLines", lines);
            views.setViewVisibility(R.id.day_fact, View.VISIBLE);
        }
        return views;
    }

    private static PendingIntent midnightIntent(Context context) {
        Intent intent = new Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE, null, context, DayCountWidget.class);
        int[] ids = AppWidgetManager.getInstance(context).getAppWidgetIds(new ComponentName(context, DayCountWidget.class));
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        return PendingIntent.getBroadcast(context, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // A minute past the next midnight (inexact, so it needs no special permission)
    private static void wakeAtMidnight(Context context) {
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
