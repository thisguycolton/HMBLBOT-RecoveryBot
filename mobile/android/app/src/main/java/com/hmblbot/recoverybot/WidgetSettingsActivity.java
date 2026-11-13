package com.hmblbot.recoverybot;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.Intent;
import android.graphics.Typeface;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

// Picking a widget's look: opened when one is placed and from the widget's Edit (Android 12
// and up; widgetFeatures reconfigurable|configuration_optional). The day count gets one of four
// styles (DayCountWidget.STYLES), the chip one of six backgrounds (ChipWidget.BACKGROUNDS).
// Leaving without picking keeps the widget as it is.
public class WidgetSettingsActivity extends Activity {
    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Bundle extras = getIntent().getExtras();
        if (extras != null) widgetId = extras.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }
        // Backing out still places the widget, with the default look
        setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));

        AppWidgetProviderInfo info = AppWidgetManager.getInstance(this).getAppWidgetInfo(widgetId);
        boolean chip = info != null && info.provider.getClassName().endsWith(".ChipWidget");

        LinearLayout list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(20);
        list.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText(chip ? "Chip background" : "Day count style");
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setPadding(0, 0, 0, dp(12));
        list.addView(title);

        String[] keys = chip ? ChipWidget.BACKGROUNDS : DayCountWidget.STYLES;
        String[] names = chip ? ChipWidget.BACKGROUND_NAMES : DayCountWidget.STYLE_NAMES;
        String current = WidgetData.look(this, chip ? "chip" : "day", widgetId, keys[0]);
        for (int i = 0; i < keys.length; i++) {
            String key = keys[i];
            list.addView(option(names[i], key.equals(current), chip ? ChipWidget.background(key) : dayBackground(key), v -> pick(chip, key)));
        }

        ScrollView scroll = new ScrollView(this);
        scroll.addView(list);
        setContentView(scroll);
    }

    private View option(String name, boolean selected, int swatch, View.OnClickListener onClick) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(0, dp(8), 0, dp(8));
        row.setClickable(true);
        row.setFocusable(true);
        row.setOnClickListener(onClick);
        row.setContentDescription(name + (selected ? ", selected" : ""));

        View chipSwatch = new View(this);
        chipSwatch.setBackgroundResource(swatch);
        LinearLayout.LayoutParams size = new LinearLayout.LayoutParams(dp(56), dp(56));
        size.setMarginEnd(dp(16));
        row.addView(chipSwatch, size);

        TextView label = new TextView(this);
        label.setText(selected ? name + "  ✓" : name);
        label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        if (selected) label.setTypeface(Typeface.DEFAULT_BOLD);
        row.addView(label);
        return row;
    }

    private static int dayBackground(String style) {
        switch (style) {
            case "paper": return R.drawable.widget_day_bg_paper;
            case "midnight": return R.drawable.widget_day_bg_midnight;
            case "sunrise": return R.drawable.widget_day_bg_sunrise;
            default: return R.drawable.widget_day_bg;
        }
    }

    private void pick(boolean chip, String key) {
        WidgetData.looks(this).edit().putString((chip ? "chip." : "day.") + widgetId, key).apply();
        AppWidgetManager manager = AppWidgetManager.getInstance(this);
        manager.updateAppWidget(widgetId, chip ? ChipWidget.draw(this, widgetId) : DayCountWidget.draw(this, widgetId));
        finish();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
