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

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

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

    // Its back, drawn by the site beside the front (lib/appWidgets.js)
    static File chipBackFile(Context context) {
        return new File(context.getFilesDir(), "widget-chip-back.png");
    }

    static boolean signedIn(Context context) {
        return prefs(context).getBoolean("signedIn", false);
    }

    static String chipLabel(Context context) {
        return prefs(context).getString("chipLabel", "");
    }

    // The chip, at most `max` pixels across (a widget's picture has to stay small)
    static Bitmap chip(Context context, int max) {
        return picture(context, chipFile(context), max);
    }

    static Bitmap chipBack(Context context, int max) {
        return picture(context, chipBackFile(context), max);
    }

    private static Bitmap picture(Context context, File file, int max) {
        if (!prefs(context).getBoolean("hasChip", false)) return null;
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

    // Tapping the chip widget opens that chip full size on the Chips page, where it spins in 3D
    static PendingIntent openChip(Context context) {
        String id = prefs(context).getString("chipId", "");
        String to = id == null || id.isEmpty() ? "/recovery" : "/recovery?chip=" + Uri.encode(id) + "&from=widget";
        return openPath(context, to, 0);
    }

    // Tapping the Daily Reflection opens the day's page (path from the site), else the book
    static PendingIntent openPath(Context context, String path, int request) {
        String to = path == null || path.isEmpty() ? "/books/daily-reflections" : path;
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("recoverybot://open" + to), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, request, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // Tapping the day count opens the Today panel on whatever page the app is on (native_app.js)
    static PendingIntent openToday(Context context) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("recoverybot://open/#today"), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, 2, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // The widgets' styles (WidgetStyles): the app's pick and each widget's own
    static SharedPreferences looks(Context context) {
        return context.getSharedPreferences("recoverybot_widget_looks", Context.MODE_PRIVATE);
    }

    static void forget(Context context, String widget, int[] ids) {
        SharedPreferences.Editor edit = looks(context).edit();
        for (int id : ids) {
            edit.remove("style." + widget + "." + id);
            edit.remove(widget + "." + id); // from before the app's picker
        }
        edit.apply();
    }

    static void redrawAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        redraw(context, manager, DayCountWidget.class);
        redraw(context, manager, ChipWidget.class);
        redraw(context, manager, ReflectionWidget.class);
    }

    static void redraw(Context context, AppWidgetManager manager, Class<?> widget) {
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, widget));
        if (ids.length == 0) return;
        Intent intent = new Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE, null, context, widget);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        context.sendBroadcast(intent);
    }

    static final class Count {
        Calendar start;
        int days;
        String today; // a milestone reached today
        String next;
        int nextIn;
        int progress; // 0 to 100, from the last milestone (or the start) to the next
    }

    // Today's fun fact (lib/dayFacts.json), else the next one: "🪐 In 12 days: a whole year on
    // Mars". Null without one (or from a site that hasn't sent them).
    static String factLine(Context context, int days) {
        String json = prefs(context).getString("funFacts", "");
        if (json == null || json.isEmpty()) return null;
        try {
            JSONArray list = new JSONArray(json);
            JSONObject pick = null;
            for (int i = 0; i < list.length(); i++) {
                JSONObject f = list.getJSONObject(i);
                int d = f.optInt("d", -1);
                if (d == days) { pick = f; break; }
                if (d > days && (pick == null || d < pick.optInt("d"))) pick = f;
            }
            if (pick == null) return null;
            int away = pick.optInt("d") - days;
            String title = pick.optString("t", "");
            if (title.isEmpty()) return null;
            String when = away == 0 ? "Today" : away == 1 ? "Tomorrow" : String.format(java.util.Locale.getDefault(), "In %,d days", away);
            String lowered = Character.toLowerCase(title.charAt(0)) + title.substring(1);
            return pick.optString("e", "✨") + " " + when + ": " + lowered;
        } catch (Exception e) {
            return null;
        }
    }

    // ---- What the layouts fill in (SAMPLE_VALUES in the site's lib/widgetLayouts.js lists them all)

    static String mediumDate(Calendar c) {
        return DateFormat.getDateInstance(DateFormat.MEDIUM).format(c.getTime());
    }

    static Calendar isoDay(String iso) {
        if (iso == null || !iso.matches("\\d{4}-\\d{2}-\\d{2}.*")) return null;
        Calendar c = Calendar.getInstance();
        c.clear();
        c.set(Integer.parseInt(iso.substring(0, 4)), Integer.parseInt(iso.substring(5, 7)) - 1, Integer.parseInt(iso.substring(8, 10)));
        return c;
    }

    static String iso(Calendar c) {
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    // "6 months" -> "6 MO", "1 year" -> "1 YR", for the small chip's line
    static String shortLabel(String label) {
        return label.replace("months", "mo").replace("month", "mo").replace("years", "yrs").replace("year", "yr").toUpperCase(Locale.getDefault());
    }

    private static String days(int n) {
        return String.format(Locale.getDefault(), "%,d", n) + (n == 1 ? " day" : " days");
    }

    // The day count's values; progress (0-1) goes in progress["progress"] when there's one
    static Map<String, String> dayValues(Context context, Count c, Map<String, Double> progress) {
        Map<String, String> v = new HashMap<>();
        String unit = c.days == 1 ? "DAY" : "DAYS";
        v.put("days", String.format(Locale.getDefault(), "%,d", c.days));
        v.put("daysCaps", unit);
        v.put("daysSober", unit + " SOBER");
        String since = mediumDate(c.start);
        v.put("since", "Since " + since);
        v.put("sinceCaps", "SOBER SINCE " + since.toUpperCase(Locale.getDefault()));
        if (c.today != null) {
            v.put("nextHead", "Today");
            v.put("nextName", c.today);
            v.put("nextIn", "today");
            v.put("nextLine", "Today: " + c.today);
            v.put("nextShort", shortLabel(c.today) + " TODAY");
            v.put("nextBoth", c.today + " today");
            v.put("nextChip", "Today: your " + c.today + " chip");
            v.put("nextDaysUnit", "today");
            v.put("nextTo", c.today);
            v.put("percent", "100%");
            progress.put("progress", 1.0);
        } else if (c.next != null) {
            String d = days(c.nextIn);
            v.put("nextHead", "Next chip");
            v.put("nextName", c.next);
            v.put("nextIn", "in " + d);
            v.put("nextLine", d + " to " + c.next);
            v.put("nextShort", shortLabel(c.next) + " IN " + d.toUpperCase(Locale.getDefault()));
            v.put("nextBoth", c.next + " in " + d);
            v.put("nextChip", "Next chip: " + c.next);
            v.put("nextDays", String.format(Locale.getDefault(), "%,d", c.nextIn));
            v.put("nextDaysUnit", c.nextIn == 1 ? "day" : "days");
            v.put("nextTo", "to " + c.next);
            v.put("percent", c.progress + "%");
            v.put("chipNext", "Next: " + c.next + " · " + d);
            progress.put("progress", c.progress / 100.0);
        }
        String fact = factLine(context, c.days);
        if (fact != null) v.put("fact", fact);
        return v;
    }

    static Map<String, String> chipValues(Context context) {
        Map<String, String> v = new HashMap<>();
        v.put("chipName", chipLabel(context));
        Calendar on = isoDay(prefs(context).getString("chipOn", ""));
        if (on != null) v.put("chipEarned", "Earned " + mediumDate(on));
        return v;
    }

    // Today's Daily Reflection from the two weeks the site sent, or null
    static JSONObject reflection(Context context, Calendar now) {
        String json = prefs(context).getString("reflections", "");
        if (json == null || json.isEmpty()) return null;
        String today = iso(now);
        try {
            JSONArray list = new JSONArray(json);
            for (int i = 0; i < list.length(); i++) {
                JSONObject r = list.getJSONObject(i);
                if (today.equals(r.optString("date"))) return r;
            }
        } catch (Exception ignored) {
            return null;
        }
        return null;
    }

    static Map<String, String> reflectionValues(JSONObject r, Calendar now, Map<String, Double> progress) {
        Map<String, String> v = new HashMap<>();
        int dayOfYear = now.get(Calendar.DAY_OF_YEAR);
        int daysInYear = now.getActualMaximum(Calendar.DAY_OF_YEAR);
        String shortDate = new SimpleDateFormat("MMM d", Locale.getDefault()).format(now.getTime());
        String read = "~" + Math.max(1, r.optInt("minutes", 1)) + " min read";
        String source = r.optString("source", "");
        v.put("rDate", shortDate);
        v.put("rDay", shortDate + " · " + dayOfYear + "/" + daysInYear);
        v.put("rTitle", r.optString("title", ""));
        v.put("rQuote", r.optString("quote", ""));
        v.put("rSource", source);
        v.put("rSourceCaps", source.toUpperCase(Locale.getDefault()));
        v.put("rRead", read);
        v.put("rBand", shortDate + " · " + read);
        progress.put("year", dayOfYear / (double) daysInYear);
        return v;
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
        count.start = start;
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
