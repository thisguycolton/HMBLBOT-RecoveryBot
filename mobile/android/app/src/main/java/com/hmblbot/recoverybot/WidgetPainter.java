package com.hmblbot.recoverybot;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.ColorMatrix;
import android.graphics.ColorMatrixColorFilter;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PathMeasure;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;

import androidx.core.content.res.ResourcesCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// Draws a Home Screen widget from its layout (assets/widget-layouts.json, written from the site's
// lib/widgetLayouts.js by bin/widget-layouts): one per style, kind and size, the designs from the
// widgets' Figma file. The whole widget is one picture at its real size, the same way
// lib/widgetDraw.js draws the app settings' previews and WidgetCanvas draws the iPhone widgets;
// keep the three in step. See lib/widgetLayouts.js for what each thing in a layout is.
final class WidgetPainter {
    private WidgetPainter() {}

    private static JSONObject all;
    private static final Map<String, Typeface> FACES = new HashMap<>();
    // A widget's picture is sent to the Home Screen whole, so it's kept under about 5 MB
    private static final int MAX_PIXELS = 1_300_000;

    static synchronized JSONObject layouts(Context context) {
        if (all != null) return all;
        try (InputStream in = context.getAssets().open("widget-layouts.json")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[16384];
            int n;
            while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
            all = new JSONObject(new String(out.toByteArray(), StandardCharsets.UTF_8));
        } catch (Exception e) {
            all = new JSONObject();
        }
        return all;
    }

    // Paper follows the phone's Light/Dark Mode
    static String layoutStyle(Context context, String style) {
        if (!"paper".equals(style)) return style;
        int night = context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return night == Configuration.UI_MODE_NIGHT_YES ? "paperDark" : "paperLight";
    }

    static JSONObject layout(Context context, String style, String kind, String size) {
        JSONObject list = layouts(context).optJSONObject("layouts");
        if (list == null) return null;
        JSONObject found = list.optJSONObject(style + "." + kind + "." + size);
        return found != null ? found : list.optJSONObject("classic." + kind + "." + size);
    }

    static JSONObject look(Context context, String style) {
        JSONObject looks = layouts(context).optJSONObject("looks");
        JSONObject found = looks == null ? null : looks.optJSONObject(style);
        return found != null ? found : new JSONObject();
    }

    // A placed widget's size in dp, as the Home Screen gives it (portrait: its width and its
    // tallest height), and which layout fits it
    static int[] sizeDp(Context context, int id) {
        Bundle options = AppWidgetManager.getInstance(context).getAppWidgetOptions(id);
        int w = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int h = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        if (w <= 0) w = 170;
        if (h <= 0) h = 170;
        return new int[] {w, h};
    }

    static String sizeName(int[] dp) {
        if (dp[0] >= 220) return dp[1] >= 220 ? "large" : "medium";
        return "small";
    }

    // The widget's picture: its layout at its size, with its values filled in. `progress` holds
    // "progress" (to the next chip) and "year" (the Daily Reflection's day of the year).
    static Bitmap paint(Context context, int id, String style, String kind, Map<String, String> values, Map<String, Double> progress, Bitmap chip) {
        int[] dp = sizeDp(context, id);
        String key = layoutStyle(context, style);
        JSONObject layout = layout(context, key, kind, sizeName(dp));
        float density = context.getResources().getDisplayMetrics().density;
        float scale = density;
        if (dp[0] * dp[1] * scale * scale > MAX_PIXELS) scale = (float) Math.sqrt(MAX_PIXELS / (double) (dp[0] * dp[1]));
        int w = Math.max(1, Math.round(dp[0] * scale));
        int h = Math.max(1, Math.round(dp[1] * scale));
        Bitmap bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        float corner = cornerPx(context, scale / density);
        if (layout != null) draw(context, canvas, w, h, layout, look(context, key), values, progress, chip, corner);
        return bitmap;
    }

    // Signed out, no date yet, nothing to show: the style's background and a short note
    static Bitmap paintMessage(Context context, int id, String style, String kind, String message) {
        int[] dp = sizeDp(context, id);
        String key = layoutStyle(context, style);
        JSONObject layout = layout(context, key, kind, sizeName(dp));
        JSONObject note = new JSONObject();
        try {
            double w = layout == null ? 170 : layout.optDouble("w", 170);
            double h = layout == null ? 170 : layout.optDouble("h", 170);
            JSONArray ops = new JSONArray();
            JSONArray from = layout == null ? null : layout.optJSONArray("ops");
            for (int i = 0; from != null && i < from.length(); i++) {
                JSONObject op = from.optJSONObject(i);
                if (op == null || !"rect".equals(op.optString("t"))) break;
                ops.put(op);
            }
            JSONObject look = look(context, key);
            JSONObject text = new JSONObject();
            text.put("t", "text").put("x", 18).put("y", 18).put("s", message).put("font", "rounded").put("weight", 600)
                .put("size", 14).put("color", look.optString("ink", "FFFFFF")).put("a", 1).put("line", 18)
                .put("maxW", w - 36).put("lines", Math.max(2, (int) ((h - 36) / 18)));
            ops.put(text);
            note.put("w", w).put("h", h).put("ops", ops);
        } catch (Exception ignored) {
            // an empty picture
        }
        float density = context.getResources().getDisplayMetrics().density;
        float scale = density;
        if (dp[0] * dp[1] * scale * scale > MAX_PIXELS) scale = (float) Math.sqrt(MAX_PIXELS / (double) (dp[0] * dp[1]));
        Bitmap bitmap = Bitmap.createBitmap(Math.max(1, Math.round(dp[0] * scale)), Math.max(1, Math.round(dp[1] * scale)), Bitmap.Config.ARGB_8888);
        draw(context, new Canvas(bitmap), bitmap.getWidth(), bitmap.getHeight(), note, look(context, key), new HashMap<>(), null, null, cornerPx(context, scale / density));
        return bitmap;
    }

    // The RemoteViews a widget shows: its picture, filling it, with a description for screen readers
    static android.widget.RemoteViews views(Context context, Bitmap picture, String description, android.app.PendingIntent onTap) {
        android.widget.RemoteViews views = new android.widget.RemoteViews(context.getPackageName(), R.layout.widget_canvas);
        views.setImageViewBitmap(R.id.widget_image, picture);
        views.setContentDescription(R.id.widget_image, description);
        views.setOnClickPendingIntent(R.id.widget_root, onTap);
        return views;
    }

    // The Home Screen's own widget corners (Android 12 and up), else the layouts' 26
    private static float cornerPx(Context context, float shrink) {
        float px = 0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                px = context.getResources().getDimension(android.R.dimen.system_app_widget_background_radius);
            } catch (Exception ignored) {
                px = 0;
            }
        }
        if (px <= 0) px = 26 * context.getResources().getDisplayMetrics().density;
        return px * shrink;
    }

    private static int color(String hex, double alpha) {
        int rgb = (int) Long.parseLong(hex, 16);
        int a = (int) Math.round(Math.max(0, Math.min(1, alpha)) * 255);
        return (a << 24) | (rgb & 0xFFFFFF);
    }

    private static void fillPaint(Paint p, JSONObject fill, RectF r) {
        p.setShader(null);
        String kind = fill.optString("k", "s");
        if ("s".equals(kind)) {
            p.setColor(color(fill.optString("c", "000000"), fill.optDouble("a", 1)));
            return;
        }
        JSONArray cs = fill.optJSONArray("c");
        JSONArray ps = fill.optJSONArray("p");
        int n = cs == null ? 0 : cs.length();
        int[] colors = new int[Math.max(2, n)];
        float[] stops = new float[Math.max(2, n)];
        for (int i = 0; i < n; i++) {
            colors[i] = color(cs.optString(i, "000000"), 1);
            stops[i] = (float) Math.max(0, Math.min(1, ps == null ? i : ps.optDouble(i, i)));
        }
        if (n < 2) { colors[1] = colors[0]; stops[1] = 1; }
        p.setColor(0xFFFFFFFF);
        if ("r".equals(kind)) {
            float radius = 0.8f * Math.max(r.width(), r.height());
            p.setShader(new RadialGradient(r.centerX(), r.centerY(), Math.max(1, radius), colors, stops, Shader.TileMode.CLAMP));
        } else {
            JSONArray from = fill.optJSONArray("from");
            JSONArray to = fill.optJSONArray("to");
            float x0 = r.left + (float) (from == null ? 0 : from.optDouble(0)) * r.width();
            float y0 = r.top + (float) (from == null ? 0 : from.optDouble(1)) * r.height();
            float x1 = r.left + (float) (to == null ? 1 : to.optDouble(0)) * r.width();
            float y1 = r.top + (float) (to == null ? 1 : to.optDouble(1)) * r.height();
            p.setShader(new LinearGradient(x0, y0, x1, y1, colors, stops, Shader.TileMode.CLAMP));
        }
    }

    private static final Pattern NAME = Pattern.compile("\\{(\\w+)\\}");

    // "{days} days" filled in; null when every value it names is empty
    static String fill(String template, Map<String, String> values) {
        Matcher m = NAME.matcher(template);
        StringBuffer out = new StringBuffer();
        int names = 0;
        boolean any = false;
        while (m.find()) {
            names++;
            String v = values.get(m.group(1));
            if (v != null && !v.isEmpty()) any = true;
            m.appendReplacement(out, Matcher.quoteReplacement(v == null ? "" : v));
        }
        m.appendTail(out);
        return names > 0 && !any ? null : out.toString();
    }

    // Lines no wider than max, at most `lines`, the last cut with "…" (wrap() in lib/widgetDraw.js)
    static List<String> wrap(String text, float max, int lines, Paint paint) {
        List<String> out = new ArrayList<>();
        for (String paragraph : text.split("\n", -1)) {
            String line = "";
            for (String word : paragraph.split(" ", -1)) {
                String next = line.isEmpty() ? word : line + " " + word;
                if (max <= 0 || paint.measureText(next) <= max || line.isEmpty()) line = next;
                else { out.add(line); line = word; }
            }
            out.add(line);
        }
        if (out.size() <= lines) return out;
        List<String> kept = new ArrayList<>(out.subList(0, lines));
        String last = kept.get(lines - 1);
        while (!last.isEmpty() && max > 0 && paint.measureText(last + "…") > max) {
            int space = last.lastIndexOf(' ');
            last = space < 0 ? "" : last.substring(0, space);
        }
        kept.set(lines - 1, (last.isEmpty() ? kept.get(lines - 1) : last) + "…");
        return kept;
    }

    private static Typeface numberFace(Context context, String name) {
        Typeface cached = FACES.get(name);
        if (cached != null) return cached;
        int id;
        switch (name) {
            case "Figtree-Light": id = R.font.figtree_light; break;
            case "Montserrat-Black": id = R.font.montserrat_black; break;
            case "TikTokSans-ExtraBold": id = R.font.tiktok_sans_extra_bold; break;
            case "TikTokSansCondensed-Black": id = R.font.tiktok_sans_condensed_black; break;
            case "DMMono-Light": id = R.font.dmmono_light; break;
            case "Inter-ExtraLight": id = R.font.inter_extra_light; break;
            case "GentiumBookPlus-Bold": id = R.font.gentium_book_plus_bold; break;
            default: id = R.font.public_sans_extra_bold;
        }
        Typeface face;
        try {
            face = ResourcesCompat.getFont(context, id);
        } catch (Exception e) {
            face = null;
        }
        if (face == null) face = Typeface.DEFAULT_BOLD;
        FACES.put(name, face);
        return face;
    }

    private static Typeface textFace(String font, int weight) {
        Typeface base;
        switch (font) {
            case "serif": base = Typeface.SERIF; break;
            case "mono": base = Typeface.MONOSPACE; break;
            default: base = Typeface.SANS_SERIF;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) return Typeface.create(base, Math.max(100, Math.min(900, weight)), false);
        return Typeface.create(base, weight >= 600 ? Typeface.BOLD : Typeface.NORMAL);
    }

    // The path around the edge, clockwise from the top middle, inset by `inset`
    private static Path edgePath(float w, float h, float radius, float inset) {
        float x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
        float r = Math.max(0, radius - inset);
        Path p = new Path();
        p.moveTo(w / 2, y0);
        p.lineTo(x1 - r, y0);
        p.arcTo(new RectF(x1 - 2 * r, y0, x1, y0 + 2 * r), -90, 90, false);
        p.lineTo(x1, y1 - r);
        p.arcTo(new RectF(x1 - 2 * r, y1 - 2 * r, x1, y1), 0, 90, false);
        p.lineTo(x0 + r, y1);
        p.arcTo(new RectF(x0, y1 - 2 * r, x0 + 2 * r, y1), 90, 90, false);
        p.lineTo(x0, y0 + r);
        p.arcTo(new RectF(x0, y0, x0 + 2 * r, y0 + 2 * r), 180, 90, false);
        p.lineTo(w / 2, y0);
        return p;
    }

    private static Double progressOf(JSONObject op, Map<String, Double> progress) {
        return progress == null ? null : progress.get(op.optString("p", "progress"));
    }

    private static void draw(Context context, Canvas canvas, int W, int H, JSONObject layout, JSONObject look,
                             Map<String, String> values, Map<String, Double> progress, Bitmap chip, float corner) {
        float sx = W / (float) layout.optDouble("w", 170);
        float sy = H / (float) layout.optDouble("h", 170);
        float s = Math.min(sx, sy);
        JSONArray ops = layout.optJSONArray("ops");
        if (ops == null) return;
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        int saved = 0;
        for (int i = 0; i < ops.length(); i++) {
            JSONObject op = ops.optJSONObject(i);
            if (op == null) continue;
            switch (op.optString("t")) {
                case "rect": {
                    RectF r = new RectF((float) op.optDouble("x") * sx, (float) op.optDouble("y") * sy,
                        (float) (op.optDouble("x") + op.optDouble("w")) * sx, (float) (op.optDouble("y") + op.optDouble("h")) * sy);
                    float radius = op.optDouble("r") >= 24 ? corner : (float) op.optDouble("r") * s;
                    if (op.optBoolean("mask")) {
                        Path clip = new Path();
                        clip.addRoundRect(r, radius, radius, Path.Direction.CW);
                        canvas.save();
                        canvas.clipPath(clip);
                        saved++;
                        break;
                    }
                    JSONObject fill = op.optJSONObject("fill");
                    if (fill == null) break;
                    p.setStyle(Paint.Style.FILL);
                    fillPaint(p, fill, r);
                    canvas.drawRoundRect(r, radius, radius, p);
                    p.setShader(null);
                    break;
                }
                case "text":
                    drawText(context, canvas, op, look, values, sx, sy, s);
                    break;
                case "bar": {
                    Double v = progressOf(op, progress);
                    if (v == null) break;
                    float x = (float) op.optDouble("x") * sx, y = (float) op.optDouble("y") * sy;
                    float w = (float) op.optDouble("w") * sx, h = (float) op.optDouble("h") * s;
                    boolean square = op.optBoolean("square");
                    float r = square ? 0 : h / 2;
                    JSONObject track = op.optJSONObject("track");
                    p.setStyle(Paint.Style.FILL);
                    p.setColor(color(track == null ? "FFFFFF" : track.optString("c", "FFFFFF"), track == null ? 0.13 : track.optDouble("a", 0.13)));
                    canvas.drawRoundRect(new RectF(x, y, x + w, y + h), r, r, p);
                    p.setColor(color(op.optString("color", "FFFFFF"), 1));
                    float filled = Math.max(square ? 0 : h, w * v.floatValue());
                    canvas.drawRoundRect(new RectF(x, y, x + filled, y + h), r, r, p);
                    break;
                }
                case "ring": {
                    Double v = progressOf(op, progress);
                    if (v == null) break;
                    float cx = (float) op.optDouble("cx") * sx, cy = (float) op.optDouble("cy") * sy;
                    float th = (float) op.optDouble("th") * s, r = (float) op.optDouble("r") * s - th / 2;
                    JSONObject track = op.optJSONObject("track");
                    p.setStyle(Paint.Style.STROKE);
                    p.setStrokeWidth(th);
                    p.setStrokeCap(Paint.Cap.BUTT);
                    p.setColor(color(track == null ? "FFFFFF" : track.optString("c", "FFFFFF"), track == null ? 0.13 : track.optDouble("a", 0.13)));
                    canvas.drawCircle(cx, cy, r, p);
                    p.setColor(color(op.optString("color", "FFFFFF"), 1));
                    canvas.drawArc(new RectF(cx - r, cy - r, cx + r, cy + r), -90, 360 * v.floatValue(), false, p);
                    p.setStyle(Paint.Style.FILL);
                    break;
                }
                case "edge": {
                    Double v = progressOf(op, progress);
                    if (v == null) break;
                    float th = (float) op.optDouble("th") * s;
                    Path path = edgePath(W, H, corner, th / 2);
                    JSONObject track = op.optJSONObject("track");
                    p.setStyle(Paint.Style.STROKE);
                    p.setStrokeWidth(th);
                    p.setStrokeCap(Paint.Cap.BUTT);
                    p.setColor(color(track == null ? "FFFFFF" : track.optString("c", "FFFFFF"), track == null ? 0.13 : track.optDouble("a", 0.13)));
                    canvas.drawPath(path, p);
                    PathMeasure measure = new PathMeasure(path, false);
                    Path part = new Path();
                    measure.getSegment(0, measure.getLength() * (float) Math.max(0, Math.min(1, v)), part, true);
                    p.setColor(color(op.optString("color", "FFFFFF"), 1));
                    canvas.drawPath(part, p);
                    p.setStyle(Paint.Style.FILL);
                    break;
                }
                case "rule": {
                    p.setStyle(Paint.Style.FILL);
                    p.setColor(color(op.optString("color", "FFFFFF"), op.optDouble("a", 0.35)));
                    int n = (int) (op.optDouble("w") / 7.1);
                    for (int k = 0; k < n; k++) {
                        float x = (float) (op.optDouble("x") + k * 7.1) * sx, y = (float) op.optDouble("y") * sy;
                        canvas.drawRect(x, y, x + 3 * s, y + 1.5f * s, p);
                    }
                    break;
                }
                case "coin":
                    drawCoin(canvas, (float) op.optDouble("cx") * sx, (float) op.optDouble("cy") * sy, (float) op.optDouble("d") * s, chip);
                    break;
                default:
            }
        }
        while (saved-- > 0) canvas.restore();
    }

    private static void drawText(Context context, Canvas canvas, JSONObject op, JSONObject look, Map<String, String> values, float sx, float sy, float s) {
        String text = fill(op.optString("s", ""), values);
        if (text == null || text.isEmpty()) return;
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        String font = op.optString("font", "rounded");
        p.setTypeface("number".equals(font) ? numberFace(context, look.optString("number", "PublicSans-ExtraBold")) : textFace(font, op.optInt("weight", 400)));
        p.setColor(color(op.optString("color", "FFFFFF"), op.optDouble("a", 1)));
        float base = (float) op.optDouble("size", 12) * s;
        float size = base;
        p.setTextSize(size);
        p.setLetterSpacing((float) op.optDouble("spacing", 0) / 100f);
        float max = (float) op.optDouble("maxW", 0) * sx;
        boolean fit = op.optBoolean("fit");
        if (fit && max > 0) {
            float w = p.measureText(text);
            if (w > max) {
                size = Math.max(size * 0.4f, size * max / w);
                p.setTextSize(size);
            }
        }
        List<String> lines = new ArrayList<>();
        if (fit) lines.add(text); else lines = wrap(text, max, op.optInt("lines", 1), p);
        float lineHeight = (float) op.optDouble("line", op.optDouble("size", 12) * 1.2) * s * (size / base);
        String align = op.optString("align", "left");
        p.setTextAlign("center".equals(align) ? Paint.Align.CENTER : "right".equals(align) ? Paint.Align.RIGHT : Paint.Align.LEFT);
        float x = (float) op.optDouble("x") * sx;
        for (int i = 0; i < lines.size(); i++) {
            float top = (float) op.optDouble("y") * sy + i * lineHeight;
            canvas.drawText(lines.get(i), x, top + (lineHeight - size) / 2 + size * 0.8f, p);
        }
    }

    private static void drawCoin(Canvas canvas, float cx, float cy, float d, Bitmap chip) {
        RectF rect = new RectF(cx - d / 2, cy - d / 2, cx + d / 2, cy + d / 2);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        if (chip != null) {
            // its rim: a darker copy just below, with a soft shadow under the whole chip
            ColorMatrix darker = new ColorMatrix();
            darker.setScale(0.62f, 0.62f, 0.62f, 1);
            p.setColorFilter(new ColorMatrixColorFilter(darker));
            p.setShadowLayer(d * 0.07f, 0, d * 0.06f, 0x73000000);
            RectF below = new RectF(rect);
            below.offset(0, d * 0.03f);
            canvas.drawBitmap(chip, null, below, p);
            p.setColorFilter(null);
            p.clearShadowLayer();
            canvas.drawBitmap(chip, null, rect, p);
            return;
        }
        p.setColor(0xFF634B20);
        canvas.drawOval(new RectF(rect.left, rect.top + d * 0.04f, rect.right, rect.bottom + d * 0.04f), p);
        p.setShader(new LinearGradient(rect.left, rect.top, rect.right, rect.bottom, 0xFFEDCC78, 0xFF9E7833, Shader.TileMode.CLAMP));
        canvas.drawOval(rect, p);
        p.setShader(null);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(Math.max(1, d * 0.02f));
        p.setColor(0x59FFFFFF);
        canvas.drawCircle(cx, cy, d * 0.42f, p);
        p.setStyle(Paint.Style.FILL);
        p.setColor(0xFF5C4214);
        p.setTypeface(Typeface.create(Typeface.SERIF, Typeface.BOLD));
        p.setTextSize(d * 0.38f);
        p.setTextAlign(Paint.Align.CENTER);
        canvas.drawText("I", cx, cy + d * 0.14f, p);
    }
}
