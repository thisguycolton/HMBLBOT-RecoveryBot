import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { callPlugin, hasPluginMethod, nativePlatform } from "../../lib/nativeApp";
import { milestoneStatus } from "../../lib/milestones";
import { DEFAULT_WIDGET_STYLE, WIDGET_STYLES, widgetLook } from "../../lib/widgetStyles";
import { Card, ErrorNote, Tray } from "../groups/ui";

// Account settings > Widgets, in the iPhone app: pick the style the Home Screen widgets (day count
// and favorite chip) are drawn in, from little copies of them. The app keeps it in the App Group
// the widgets share and has them redraw (WidgetBridgePlugin widgetStyle / setWidgetStyle in
// mobile/ios/App/App/AppDelegate.swift). A widget can still have its own style from touch and
// hold > Edit Widget; left on "Same as the app" it follows this.
// Hidden in a browser, on Android (its widgets pick a look when placed) and in iPhone app builds
// from before the picker.
export default function WidgetSettings() {
  const shown = nativePlatform() === "ios" && hasPluginMethod("WidgetBridge", "setWidgetStyle");
  const [style, setStyle] = useState(null);
  const [error, setError] = useState(null);
  const dark = useDarkMode();

  useEffect(() => {
    if (!shown) return;
    callPlugin("WidgetBridge", "widgetStyle").then((r) => setStyle(r?.style || DEFAULT_WIDGET_STYLE), () => setStyle(DEFAULT_WIDGET_STYLE));
  }, [shown]);

  if (!shown || !style) return null;

  // Moves right away; put back if the app couldn't keep it
  const pick = async (key) => {
    if (key === style) return;
    const before = style;
    setStyle(key);
    setError(null);
    try {
      await callPlugin("WidgetBridge", "setWidgetStyle", { style: key });
    } catch (e) {
      setStyle(before);
      setError(e.message || "The widgets couldn't be changed.");
    }
  };

  const count = sampleCount();
  const chosen = widgetLook(WIDGET_STYLES.find((s) => s.key === style) || WIDGET_STYLES[0], dark);

  return (
    <section id="widgets" className="scroll-mt-20">
      <Tray label="Widgets">
        <Card className="space-y-4 p-4">
          <div className="flex items-end justify-center gap-3" aria-hidden="true">
            <DayWidget look={chosen} count={count} size="medium" />
            <ChipWidget look={chosen} />
          </div>
          <p className="text-sm text-slate-600 dark:text-neutral-400">
            How your day count and favorite chip look on your Home Screen. To add one, touch and hold an empty spot on the Home Screen,
            tap Edit, then Add Widget, and find RecoveryBot. To give one widget its own style, touch and hold it and tap Edit Widget.
          </p>
          <div role="radiogroup" aria-label="Widget style" className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
            {WIDGET_STYLES.map((s) => {
              const selected = s.key === style;
              return (
                <button key={s.key} type="button" role="radio" aria-checked={selected} onClick={() => pick(s.key)}
                  className="group flex flex-col items-center gap-1.5 rounded-2xl !bg-transparent p-0 text-center focus:outline-none">
                  <span className={`relative block w-full rounded-[22%] p-0.5 transition ${selected ? "ring-[3px] ring-accent" : "ring-1 ring-transparent group-hover:ring-neutral-300 dark:group-hover:ring-neutral-600"}`}>
                    <DayWidget look={widgetLook(s, dark)} count={count} size="small" />
                    {selected && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white shadow">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-medium leading-tight text-slate-800 dark:text-neutral-200">{s.name}</span>
                  {s.note && <span className="-mt-1 text-[10px] leading-tight text-slate-500 dark:text-neutral-400">{s.note}</span>}
                </button>
              );
            })}
          </div>
          <ErrorNote error={error} />
        </Card>
      </Tray>
    </section>
  );
}

// The phone's Light/Dark Mode, which Paper follows on the widget
function useDarkMode() {
  const query = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const [dark, setDark] = useState(() => Boolean(query?.matches));
  useEffect(() => {
    if (!query) return undefined;
    const change = (e) => setDark(e.matches);
    query.addEventListener?.("change", change);
    return () => query.removeEventListener?.("change", change);
  }, []);
  return dark;
}

// Their own count when they have a sobriety date (from the page, NativeAppRequest#native_widget_key), else a sample
function sampleCount() {
  const since = (document.body?.dataset.widget || "").split("|")[1] || "";
  const status = since ? milestoneStatus(since) : null;
  if (!status) return { days: 127, next: "6 months", inDays: 55, progress: 0.6 };
  const next = status.next;
  return { days: status.days, today: status.today?.label, next: next?.label, inDays: next?.inDays ?? 0, progress: next ? Math.max(0.08, 1 - next.inDays / Math.max(30, next.inDays + 30)) : 1 };
}

const numberStyle = (look, px) => ({
  fontFamily: look.font,
  fontWeight: look.weight,
  fontSize: px,
  lineHeight: 1,
  letterSpacing: look.condensed ? "-0.04em" : look.weight <= 300 ? "-0.02em" : "-0.01em",
  fontStretch: look.condensed ? "62.5%" : undefined,
  ...(look.condensed ? { transform: "scaleX(0.82)", transformOrigin: "left" } : null),
});

// A small (square) or medium (wide) day count widget, laid out like DayCountView
function DayWidget({ look, count, size }) {
  const medium = size === "medium";
  const unit = count.days === 1 ? "day" : "days";
  const line = count.today ? `Today: ${count.today}` : count.next ? `${count.next} in ${count.inDays} ${count.inDays === 1 ? "day" : "days"}` : null;
  return (
    <span className={`flex flex-col overflow-hidden text-left shadow-md ${medium ? "h-[120px] w-[250px] rounded-[26px] p-4" : "aspect-square w-full rounded-[20%] p-[11%]"}`}
      style={{ background: look.background, color: look.ink, fontFamily: look.font, containerType: medium ? undefined : "inline-size" }}>
      <span className="truncate" style={numberStyle(look, medium ? 46 : "clamp(20px, 30cqw, 40px)")}>{count.days.toLocaleString()}</span>
      <span className="font-semibold opacity-90" style={{ fontSize: medium ? 15 : "clamp(9px, 9cqw, 13px)" }}>{unit}</span>
      <span className="flex-1" />
      {line && <span className="truncate font-medium opacity-90" style={{ fontSize: medium ? 12 : "clamp(7px, 7cqw, 10px)" }}>{line}</span>}
      {count.next && !count.today && (
        <span className="mt-1 block h-[3px] w-full overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, currentColor 25%, transparent)" }}>
          <span className="block h-full rounded-full" style={{ width: `${Math.round(count.progress * 100)}%`, background: look.accent }} />
        </span>
      )}
    </span>
  );
}

// The favorite chip widget, small, with the plain brass coin the widget gallery shows
function ChipWidget({ look }) {
  return (
    <span className="flex h-[120px] w-[120px] items-center justify-center rounded-[26px] shadow-md" style={{ background: look.background }}>
      <span className="relative flex h-[78px] w-[78px] items-center justify-center rounded-full"
        style={{ background: "linear-gradient(135deg, rgb(237 204 120), rgb(158 120 51))", boxShadow: "0 3px 0 rgb(99 75 32), 0 8px 14px rgb(0 0 0 / 0.4)" }}>
        <span className="absolute inset-[6px] rounded-full border-2 border-white/35" />
        <span className="font-serif text-3xl font-bold" style={{ color: "rgb(92 66 20)" }}>I</span>
      </span>
    </span>
  );
}
