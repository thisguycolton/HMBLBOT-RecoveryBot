package com.hmblbot.recoverybot;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;

import java.io.File;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

// What the widgets show, kept by WidgetBridgePlugin, and the day count worked out from it: the
// same milestones as the site (lib/milestones.js), 24 hours, 30, 60 and 90 days, 6, 9 and 18
// months, then every year, counted on the phone's own calendar.
final class WidgetData {
    private WidgetData() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences("recoverybot_widgets", Context.MODE_PRIVATE);
    }

    static File chipFile(Context context) {
        return new File(context.getFilesDir(), "widget-chip.png");
    }

    static boolean signedIn(Context context) {
        return prefs(context).getBoolean("signedIn", false);
    }

    static String chipLabel(Context context) {
        return prefs(context).getString("chipLabel", "");
    }

    // The chip, at most `max` pixels across (a widget's picture has to stay small)
    static Bitmap chip(Context context, int max) {
        if (!prefs(context).getBoolean("hasChip", false)) return null;
        File file = chipFile(context);
        if (!file.exists()) return null;
        Bitmap full = BitmapFactory.decodeFile(file.getPath());
        if (full == null || full.getWidth() <= max) return full;
        int h = Math.round(full.getHeight() * (max / (float) full.getWidth()));
        return Bitmap.createScaledBitmap(full, max, h, true);
    }

    // Tapping a widget opens the app on the Chips page (native_app.js follows the link)
    static PendingIntent openChips(Context context) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("recoverybot://open/recovery"), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void redrawAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        redraw(context, manager, DayCountWidget.class);
        redraw(context, manager, ChipWidget.class);
    }

    private static void redraw(Context context, AppWidgetManager manager, Class<?> widget) {
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, widget));
        if (ids.length == 0) return;
        Intent intent = new Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE, null, context, widget);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        context.sendBroadcast(intent);
    }

    static final class Count {
        int days;
        String today; // a milestone reached today
        String next;
        int nextIn;
        int progress; // 0 to 100, from the last milestone (or the start) to the next
    }

    private static final class Milestone {
        final String label;
        final Calendar on;
        Milestone(String label, Calendar on) { this.label = label; this.on = on; }
    }

    private static Calendar day(Calendar c) {
        Calendar d = (Calendar) c.clone();
        d.set(Calendar.HOUR_OF_DAY, 0);
        d.set(Calendar.MINUTE, 0);
        d.set(Calendar.SECOND, 0);
        d.set(Calendar.MILLISECOND, 0);
        return d;
    }

    // Whole days from one midnight to another, safe across daylight saving changes
    private static int daysBetween(Calendar from, Calendar to) {
        long ms = to.getTimeInMillis() - from.getTimeInMillis();
        return (int) Math.round(ms / 86400000.0);
    }

    private static Calendar plus(Calendar start, int field, int amount) {
        Calendar c = (Calendar) start.clone();
        c.add(field, amount); // a 31st lands on a shorter month's last day, as on the site
        return c;
    }

    // Null without a sobriety date, or for one in the future
    static Count count(Context context, Calendar now) {
        String iso = prefs(context).getString("soberSince", "");
        if (iso == null || !iso.matches("\\d{4}-\\d{2}-\\d{2}.*")) return null;
        Calendar start = Calendar.getInstance();
        start.clear();
        start.set(Integer.parseInt(iso.substring(0, 4)), Integer.parseInt(iso.substring(5, 7)) - 1, Integer.parseInt(iso.substring(8, 10)));
        Calendar today = day(now);
        int days = daysBetween(start, today);
        if (days < 0) return null;

        List<Milestone> list = new ArrayList<>();
        list.add(new Milestone("24 hours", plus(start, Calendar.DAY_OF_MONTH, 1)));
        for (int n : new int[] {30, 60, 90}) list.add(new Milestone(n + " days", plus(start, Calendar.DAY_OF_MONTH, n)));
        for (int n : new int[] {6, 9, 18}) list.add(new Milestone(n + " months", plus(start, Calendar.MONTH, n)));
        for (int y = 1; y <= days / 365 + 2; y++) list.add(new Milestone(y == 1 ? "1 year" : y + " years", plus(start, Calendar.YEAR, y)));
        list.sort((a, b) -> a.on.compareTo(b.on));

        Count count = new Count();
        count.days = days;
        Calendar last = start;
        Milestone next = null;
        for (Milestone m : list) {
            int d = daysBetween(today, m.on);
            if (d == 0) count.today = m.label;
            if (d <= 0) last = m.on;
            else if (next == null) next = m;
        }
        if (next != null) {
            count.next = next.label;
            count.nextIn = daysBetween(today, next.on);
            int span = Math.max(1, daysBetween(last, next.on));
            count.progress = Math.round(100f * (span - count.nextIn) / span);
        }
        return count;
    }
}
