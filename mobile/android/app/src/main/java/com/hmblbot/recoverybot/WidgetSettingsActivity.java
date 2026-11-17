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

// Giving one widget its own style: opened when one is placed and from the widget's Edit (Android
// 12 and up; widgetFeatures reconfigurable|configuration_optional). The same styles for the day
// count, the chip and the Daily Reflection (WidgetStyles), and first "Same as the app", which follows the style picked
// in the app (its settings, Widgets). Leaving without picking keeps the widget as it is.
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
        String cls = info == null ? "" : info.provider.getClassName();
        String widget = cls.endsWith(".ChipWidget") ? "chip" : cls.endsWith(".ReflectionWidget") ? "reflection" : "day";

        LinearLayout list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(20);
        list.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText("chip".equals(widget) ? "Chip style" : "reflection".equals(widget) ? "Daily Reflection style" : "Day count style");
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setPadding(0, 0, 0, dp(12));
        list.addView(title);

        TextView note = new TextView(this);
        note.setText("Pick the style for all your widgets in RecoveryBot, in its settings under Widgets, or give this one its own.");
        note.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        note.setPadding(0, 0, 0, dp(12));
        list.addView(note);

        String current = WidgetStyles.own(this, widget, widgetId);
        String appStyle = WidgetStyles.appStyle(this, widget);
        list.addView(option("Same as the app", WidgetStyles.APP.equals(current), WidgetStyles.background(appStyle), v -> pick(widget, WidgetStyles.APP)));
        for (int i = 0; i < WidgetStyles.KEYS.length; i++) {
            String key = WidgetStyles.KEYS[i];
            list.addView(option(WidgetStyles.NAMES[i], key.equals(current), WidgetStyles.background(key), v -> pick(widget, key)));
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

    private void pick(String widget, String key) {
        WidgetStyles.setOwn(this, widget, widgetId, key);
        AppWidgetManager manager = AppWidgetManager.getInstance(this);
        manager.updateAppWidget(widgetId, "chip".equals(widget) ? ChipWidget.draw(this, widgetId)
            : "reflection".equals(widget) ? ReflectionWidget.draw(this, widgetId) : DayCountWidget.draw(this, widgetId));
        finish();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
