import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { callPlugin, hasPluginMethod, nativePlatform } from "../../lib/nativeApp";
import { countValues, drawWidget } from "../../lib/widgetDraw";
import { DEFAULT_WIDGET_STYLE, FONTS_URL, WIDGET_STYLES } from "../../lib/widgetStyles";
import { Card, ErrorNote, Tray } from "../groups/ui";

// This phone > Widgets, in the iPhone and Android apps: pick the style the Home Screen widgets
// (day count, favorite chip and Daily Reflection) are drawn in, from copies drawn the way the phone
// draws them: lib/widgetDraw.js draws the same layouts (lib/widgetLayouts.js) as
// RecoveryBotWidgets.swift and WidgetPainter.java.
// "All widgets" gives every widget one style; each widget on their Home Screen is listed beside
// it, to give that one its own. The phone keeps the picks and has the widgets redraw
// (WidgetBridgePlugin widgetStyle / setWidgetStyle / placedWidgets: in
// mobile/ios/App/App/AppDelegate.swift, in the App Group the widgets share; on Android,
// WidgetBridgePlugin.java and WidgetStyles.java).
// A pick for a widget goes to every size of it on their Home Screen (one call per placed widget);
// the phones still keep a style per placed widget (on the iPhone per kind and size, since the
// system doesn't say which one each is; on Android per widget).
// Hidden in a browser and in app builds from before the picker. App builds from before placed
// widgets (no placedWidgets) get "All widgets", "Day count" and "Favorite chip" instead.
const HOW = {
  ios: "To add one, touch and hold an empty spot on the Home Screen, tap Edit, then Add Widget, and find RecoveryBot.",
  android: "To add one, touch and hold an empty spot on the Home Screen, tap Widgets, and find RecoveryBot.",
};

const KIND_NAMES = { day: "Day count", chip: "Favorite chip", reflection: "Daily Reflection" };
const SIZE_NAMES = { small: "small", medium: "medium", large: "large" };
const SIZE_ORDER = ["small", "medium", "large"];

// A widget's size on the phone, in points (an iPhone 15's), which the copies are drawn at and scaled from
const SIZES = { small: [170, 170], medium: [364, 170], large: [364, 382] };

export default function WidgetSettings() {
  const platform = nativePlatform();
  const shown = Boolean(HOW[platform]) && hasPluginMethod("WidgetBridge", "setWidgetStyle");
  const perWidget = shown && hasPluginMethod("WidgetBridge", "placedWidgets");
  // { all, day, chip, split }: day/chip are "" while they follow all; split = the app keeps kinds apart (older builds)
  const [styles, setStyles] = useState(null);
  // The widgets on their Home Screen: [{ id, kind, size, style }], style "" while it follows all
  const [placed, setPlaced] = useState([]);
  const [target, setTarget] = useState("all");
  const [error, setError] = useState(null);
  const dark = useDarkMode();
  const count = useMemo(sampleCount, []);
  useWidgetFonts(shown);

  useEffect(() => {
    if (!shown) return undefined;
    const fallback = { all: DEFAULT_WIDGET_STYLE, day: "", chip: "", split: false };
    callPlugin("WidgetBridge", "widgetStyle").then(
      (r) => setStyles({ all: r?.style || DEFAULT_WIDGET_STYLE, day: r?.day || "", chip: r?.chip || "", split: typeof r?.day === "string" }),
      () => setStyles(fallback),
    );
    if (!perWidget) return undefined;
    // Look again when they come back from the Home Screen, where they may have added one
    const load = () => callPlugin("WidgetBridge", "placedWidgets").then((r) => setPlaced(Array.isArray(r?.widgets) ? r.widgets : []), () => {});
    load();
    const again = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", again);
    return () => document.removeEventListener("visibilitychange", again);
  }, [shown, perWidget]);

  if (!shown || !styles) return null;

  // What can be picked for: every widget, then each placed widget (or each kind, on older builds)
  const targets = [{ id: "all", label: "All widgets", kind: "day", size: "small" }];
  if (perWidget) {
    // One tile for each kind on their Home Screen: a pick there goes to every size of it
    Object.keys(KIND_NAMES).forEach((kind) => {
      const mine = placed.filter((w) => w.kind === kind);
      if (!mine.length) return;
      const sizes = [...new Set(mine.map((w) => w.size))].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
      const shown = sizes.includes("medium") ? "medium" : sizes[0];
      const own = (mine.find((w) => w.size === shown && w.style) || mine.find((w) => w.style))?.style || "";
      targets.push({ id: `kind:${kind}`, ids: mine.map((w) => w.id), label: KIND_NAMES[kind], sub: sizes.map((z) => SIZE_NAMES[z]).join(", "), kind, size: shown, own });
    });
  } else if (styles.split) {
    targets.push({ id: "day", label: "Day count", kind: "day", size: "small", own: styles.day }, { id: "chip", label: "Favorite chip", kind: "chip", size: "small", own: styles.chip });
  }
  const current = targets.find((t) => t.id === target) || targets[0];

  // The style a target draws in: its own, else (older builds) its kind's, else the one for all
  const kindStyle = (kind) => styles[kind] || styles.all;
  const styleOf = (t) => (t.id === "all" ? styles.all : t.own || kindStyle(t.kind));
  const nameOf = (key) => (WIDGET_STYLES.find((s) => s.key === key) || WIDGET_STYLES[0]).name;
  const anyOwn = placed.some((w) => w.style) || Boolean(styles.day || styles.chip);

  // Moves right away; put back if the app couldn't keep it
  const save = async (nextStyles, nextPlaced, options) => {
    const before = [styles, placed];
    setStyles(nextStyles);
    setPlaced(nextPlaced);
    setError(null);
    try {
      // one call per widget when a pick goes to every size of one
      for (const o of Array.isArray(options) ? options : [options]) await callPlugin("WidgetBridge", "setWidgetStyle", o);
    } catch (e) {
      setStyles(before[0]);
      setPlaced(before[1]);
      setError(e.message || "The widgets couldn't be changed.");
    }
  };

  // key "" puts a widget back on the style for all
  const pick = (key) => {
    if (current.id === "all") {
      if (key === styles.all && !anyOwn) return;
      save({ ...styles, all: key, day: "", chip: "" }, placed.map((w) => ({ ...w, style: "" })), { style: key });
    } else if (current.id === "day" || current.id === "chip") {
      if (key === styles[current.id]) return;
      save({ ...styles, [current.id]: key }, placed, { style: key, widget: current.id });
    } else if (key !== current.own || placed.some((w) => current.ids.includes(w.id) && (w.style || "") !== key)) {
      save(styles, placed.map((w) => (current.ids.includes(w.id) ? { ...w, style: key } : w)), current.ids.map((id) => ({ style: key, widget: id })));
    }
  };

  const selected = current.id === "all" ? styles.all : current.own || "";
  const tileKind = current.kind;
  const tileSize = current.id === "all" || current.size === "large" ? "small" : current.size;

  return (
    <section id="widgets" className="scroll-mt-20">
      <Tray label="Widgets">
        <Card className="space-y-4 p-4">
          <p className="text-sm text-slate-600 dark:text-neutral-400">
            How your day count, favorite chip and Daily Reflection look on your Home Screen. Pick one style for all of them, or tap one of your widgets to give it its own. {HOW[platform]}
          </p>

          {targets.length > 1 && (
            <div role="tablist" aria-label="Widget" className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 pt-1">
              {targets.map((t) => {
                const on = t.id === current.id;
                return (
                  <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => setTarget(t.id)}
                    className="flex shrink-0 flex-col items-center gap-1.5 !bg-transparent p-0 focus:outline-none">
                    <span className={`block rounded-[18px] p-0.5 transition ${on ? "ring-[3px] ring-accent" : "ring-1 ring-transparent"}`}>
                      {t.id === "all" ? (
                        <span className="relative block h-16 w-16">
                          <span className="absolute left-0 top-0 block w-11"><Widget kind="chip" size="small" style={styles.all} dark={dark} count={count} /></span>
                          <span className="absolute bottom-0 right-0 block w-11"><Widget kind="day" size="small" style={styles.all} dark={dark} count={count} /></span>
                        </span>
                      ) : (
                        <span className={`block ${t.size === "medium" ? "w-[8.5rem]" : "w-16"}`}>
                          <Widget kind={t.kind} size={t.size === "large" ? "small" : t.size} style={styleOf(t)} dark={dark} count={count} />
                        </span>
                      )}
                    </span>
                    <span className={`text-xs leading-tight ${on ? "font-semibold text-slate-900 dark:text-white" : "font-medium text-slate-600 dark:text-neutral-400"}`}>{t.label}</span>
                    {t.sub && <span className="-mt-1 text-[10px] leading-tight text-slate-500 dark:text-neutral-400">{t.sub}{t.own ? "" : " · same as all"}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {perWidget && placed.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-neutral-400">Your widgets show up here once they're on your Home Screen, so you can give each its own style.</p>
          )}

          <div className="flex items-end justify-center gap-3" aria-hidden="true">
            {current.id === "all" ? (
              <>
                <span className="block w-[250px] max-w-[66%]"><Widget kind="day" size="medium" style={styles.all} dark={dark} count={count} /></span>
                <span className="block w-[118px] max-w-[32%]"><Widget kind="chip" size="small" style={styles.all} dark={dark} count={count} /></span>
              </>
            ) : (
              <span className={`block ${current.size === "small" ? "w-[150px]" : "w-[300px] max-w-full"}`}>
                <Widget kind={current.kind} size={current.size} style={styleOf(current)} dark={dark} count={count} />
              </span>
            )}
          </div>

          {current.id === "all" && anyOwn && (
            <p className="text-xs text-slate-500 dark:text-neutral-400">Picking here also puts the widgets that have their own style back on this one.</p>
          )}

          <div role="radiogroup" aria-label={`${current.label} style`} className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
            {current.id !== "all" && perWidget && (
              <StyleTile name="Same as all" note={nameOf(kindStyle(current.kind))} on={selected === ""} onPick={() => pick("")}>
                <Widget kind={tileKind} size={tileSize} style={kindStyle(current.kind)} dark={dark} count={count} />
              </StyleTile>
            )}
            {WIDGET_STYLES.map((s) => (
              <StyleTile key={s.key} name={s.name} note={s.note} on={s.key === (current.id === "all" || perWidget ? selected : styleOf(current))} onPick={() => pick(s.key)}>
                <Widget kind={tileKind} size={tileSize} style={s.key} dark={dark} count={count} />
              </StyleTile>
            ))}
          </div>
          <ErrorNote error={error} />
        </Card>
      </Tray>
    </section>
  );
}

function StyleTile({ name, note, on, onPick, children }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onPick}
      className="group flex flex-col items-center gap-1.5 rounded-2xl !bg-transparent p-0 text-center focus:outline-none">
      <span className={`relative block w-full rounded-[22%] p-0.5 transition ${on ? "ring-[3px] ring-accent" : "ring-1 ring-transparent group-hover:ring-neutral-300 dark:group-hover:ring-neutral-600"}`}>
        {children}
        {on && (
          <span className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white shadow">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="text-xs font-medium leading-tight text-slate-800 dark:text-neutral-200">{name}</span>
      {note && <span className="-mt-1 text-[10px] leading-tight text-slate-500 dark:text-neutral-400">{note}</span>}
    </button>
  );
}

// The site's fonts the widgets use, loaded once for the copies
function useWidgetFonts(on) {
  useEffect(() => {
    if (!on || document.getElementById("widget-fonts")) return;
    const link = document.createElement("link");
    link.id = "widget-fonts";
    link.rel = "stylesheet";
    link.href = FONTS_URL;
    document.head.appendChild(link);
  }, [on]);
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

// Their own count when they have a sobriety date (from the page, NativeAppRequest#native_widget_key),
// else the sample in lib/widgetLayouts.js
function sampleCount() {
  const since = (document.body?.dataset.widget || "").split("|")[1] || "";
  return countValues(since) || { values: {}, progress: undefined };
}

// A widget drawn the way the phone draws it (lib/widgetDraw.js, from the layouts the apps share),
// at the width it's given
function Widget({ kind, size, style, dark, count }) {
  const [w, h] = SIZES[size];
  const box = useRef(null);
  const canvas = useRef(null);
  const [width, setWidth] = useState(0);
  const fontsReady = useFontsReady();
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const fit = () => setWidth(el.clientWidth);
    fit();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, []);
  useEffect(() => {
    if (!width || !canvas.current) return;
    drawWidget(canvas.current, width, (width * h) / w, { style, kind, size, dark, values: count.values, progress: count.progress });
  }, [width, style, kind, size, dark, count, fontsReady, w, h]);
  return (
    <span ref={box} className="relative block w-full overflow-hidden shadow-md" style={{ aspectRatio: `${w} / ${h}`, borderRadius: `${(22 / w) * 100}% / ${(22 / h) * 100}%` }}>
      <canvas ref={canvas} className="absolute inset-0 block h-full w-full" />
    </span>
  );
}

// Bumps once the widget fonts have loaded, so the copies draw again in them
function useFontsReady() {
  const [ready, setReady] = useState(0);
  useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => live && setReady((n) => n + 1));
    const again = () => live && setReady((n) => n + 1);
    document.fonts?.addEventListener?.("loadingdone", again);
    return () => { live = false; document.fonts?.removeEventListener?.("loadingdone", again); };
  }, []);
  return ready;
}
