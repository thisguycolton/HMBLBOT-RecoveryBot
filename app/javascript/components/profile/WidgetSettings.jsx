import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { callPlugin, hasPluginMethod, nativePlatform } from "../../lib/nativeApp";
import { milestoneStatus } from "../../lib/milestones";
import { DEFAULT_WIDGET_STYLE, FONTS_URL, PINES, STARS, WIDGET_STYLES, widgetLook } from "../../lib/widgetStyles";
import { Card, ErrorNote, Tray } from "../groups/ui";

// This phone > Widgets, in the iPhone and Android apps: pick the style the Home Screen widgets
// (day count and favorite chip) are drawn in, from copies of them drawn the way the phone draws
// them (the same fonts, colors and drawings as RecoveryBotWidgets.swift and WidgetStyles.java).
// "All widgets" gives every widget one style; each widget on their Home Screen is listed beside
// it, to give that one its own. The phone keeps the picks and has the widgets redraw
// (WidgetBridgePlugin widgetStyle / setWidgetStyle / placedWidgets: in
// mobile/ios/App/App/AppDelegate.swift, in the App Group the widgets share; on Android,
// WidgetBridgePlugin.java and WidgetStyles.java).
// On the iPhone the system says which kind and size each placed widget is, not which one, so two
// small day counts share a style; on Android each placed widget is its own.
// Hidden in a browser and in app builds from before the picker. App builds from before placed
// widgets (no placedWidgets) get "All widgets", "Day count" and "Favorite chip" instead.
const HOW = {
  ios: "To add one, touch and hold an empty spot on the Home Screen, tap Edit, then Add Widget, and find RecoveryBot.",
  android: "To add one, touch and hold an empty spot on the Home Screen, tap Widgets, and find RecoveryBot.",
};

const KIND_NAMES = { day: "Day count", chip: "Favorite chip" };
const SIZE_NAMES = { small: "small", medium: "medium", large: "large" };

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
    const counts = {};
    placed.forEach((w) => { counts[`${w.kind}.${w.size}`] = (counts[`${w.kind}.${w.size}`] || 0) + 1; });
    const seen = {};
    placed.forEach((w) => {
      const same = `${w.kind}.${w.size}`;
      seen[same] = (seen[same] || 0) + 1;
      const number = counts[same] > 1 ? ` ${seen[same]}` : "";
      targets.push({ id: w.id, label: `${KIND_NAMES[w.kind]}${number}`, sub: SIZE_NAMES[w.size], kind: w.kind, size: w.size, own: w.style || "" });
    });
  } else if (styles.split) {
    targets.push({ id: "day", label: "Day count", kind: "day", size: "small", own: styles.day }, { id: "chip", label: "Favorite chip", kind: "chip", size: "small", own: styles.chip });
  }
  const current = targets.find((t) => t.id === target) || targets[0];

  // The style a target draws in: its own, else (older builds) its kind's, else the one for all
  const kindStyle = (kind) => styles[kind] || styles.all;
  const styleOf = (t) => (t.id === "all" ? styles.all : t.own || kindStyle(t.kind));
  const lookOf = (key) => widgetLook(WIDGET_STYLES.find((s) => s.key === key) || WIDGET_STYLES[0], dark);
  const anyOwn = placed.some((w) => w.style) || Boolean(styles.day || styles.chip);

  // Moves right away; put back if the app couldn't keep it
  const save = async (nextStyles, nextPlaced, options) => {
    const before = [styles, placed];
    setStyles(nextStyles);
    setPlaced(nextPlaced);
    setError(null);
    try {
      await callPlugin("WidgetBridge", "setWidgetStyle", options);
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
    } else if (key !== current.own) {
      save(styles, placed.map((w) => (w.id === current.id ? { ...w, style: key } : w)), { style: key, widget: current.id });
    }
  };

  const count = sampleCount();
  const selected = current.id === "all" ? styles.all : current.own || "";
  const tileKind = current.kind;
  const tileSize = current.id === "all" || current.size === "large" ? "small" : current.size;

  return (
    <section id="widgets" className="scroll-mt-20">
      <Tray label="Widgets">
        <Card className="space-y-4 p-4">
          <p className="text-sm text-slate-600 dark:text-neutral-400">
            How your day count and favorite chip look on your Home Screen. Pick one style for all of them, or tap one of your widgets to give it its own. {HOW[platform]}
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
                          <span className="absolute left-0 top-0 block w-11"><Widget kind="chip" size="small" look={lookOf(styles.all)} count={count} /></span>
                          <span className="absolute bottom-0 right-0 block w-11"><Widget kind="day" size="small" look={lookOf(styles.all)} count={count} /></span>
                        </span>
                      ) : (
                        <span className={`block ${t.size === "medium" ? "w-[8.5rem]" : "w-16"}`}>
                          <Widget kind={t.kind} size={t.size === "large" ? "small" : t.size} look={lookOf(styleOf(t))} count={count} />
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
                <span className="block w-[250px] max-w-[66%]"><Widget kind="day" size="medium" look={lookOf(styles.all)} count={count} /></span>
                <span className="block w-[118px] max-w-[32%]"><Widget kind="chip" size="small" look={lookOf(styles.all)} count={count} /></span>
              </>
            ) : (
              <span className={`block ${current.size === "small" ? "w-[150px]" : "w-[300px] max-w-full"}`}>
                <Widget kind={current.kind} size={current.size} look={lookOf(styleOf(current))} count={count} />
              </span>
            )}
          </div>

          {current.id === "all" && anyOwn && (
            <p className="text-xs text-slate-500 dark:text-neutral-400">Picking here also puts the widgets that have their own style back on this one.</p>
          )}

          <div role="radiogroup" aria-label={`${current.label} style`} className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
            {current.id !== "all" && perWidget && (
              <StyleTile name="Same as all" note={lookOf(kindStyle(current.kind)).name} on={selected === ""} onPick={() => pick("")}>
                <Widget kind={tileKind} size={tileSize} look={lookOf(kindStyle(current.kind))} count={count} />
              </StyleTile>
            )}
            {WIDGET_STYLES.map((s) => (
              <StyleTile key={s.key} name={s.name} note={s.note} on={s.key === (current.id === "all" || perWidget ? selected : styleOf(current))} onPick={() => pick(s.key)}>
                <Widget kind={tileKind} size={tileSize} look={widgetLook(s, dark)} count={count} />
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

// Their own count when they have a sobriety date (from the page, NativeAppRequest#native_widget_key), else a sample
function sampleCount() {
  const since = (document.body?.dataset.widget || "").split("|")[1] || "";
  const status = since ? milestoneStatus(since) : null;
  const fact = { emoji: "🐾", when: "In 12 days", title: "Longer than an elephant's pregnancy" };
  if (!status) return { days: 127, next: "6 months", inDays: 55, progress: 0.6, fact };
  const next = status.next;
  return { days: status.days, today: status.today?.label, next: next?.label, inDays: next?.inDays ?? 0, progress: next ? Math.max(0.08, 1 - next.inDays / Math.max(30, next.inDays + 30)) : 1, fact };
}

// A widget drawn at the phone's size in points, then scaled to fit the width it's given
function Widget({ kind, size, look, count }) {
  const [w, h] = SIZES[size];
  const box = useRef(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const fit = () => setScale(el.clientWidth / w);
    fit();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [w]);
  return (
    <span ref={box} className="relative block w-full overflow-hidden shadow-md" style={{ aspectRatio: `${w} / ${h}`, borderRadius: `${(22 / w) * 100}% / ${(22 / h) * 100}%` }}>
      <span className="absolute left-0 top-0 block origin-top-left overflow-hidden text-left"
        style={{ width: w, height: h, transform: `scale(${scale})`, background: look.background, color: look.ink, visibility: scale ? "visible" : "hidden" }}>
        <Ornament look={look} w={w} h={h} />
        <span className="relative flex h-full w-full flex-col p-4">
          {kind === "chip" ? <ChipFace look={look} size={size} /> : <DayFace look={look} size={size} count={count} />}
        </span>
      </span>
    </span>
  );
}

const font = (f, px, extra = {}) => ({ fontFamily: f.family, fontWeight: f.weight, fontStyle: f.style, fontStretch: f.stretch, fontSize: px, ...extra });

// Laid out like DayCountView in RecoveryBotWidgets.swift, size by size
function DayFace({ look, size, count }) {
  const unit = count.days === 1 ? "day" : "days";
  const days = (n) => `${n} ${n === 1 ? "day" : "days"}`;
  const number = (px) => (
    <span className="block truncate" style={font(look.number, px, { lineHeight: 1.05, letterSpacing: look.tracking, color: look.numberInk || look.ink })}>{count.days.toLocaleString()}</span>
  );
  const text = (px, extra) => font(look.text, px, extra);
  const progress = (
    <span className="mt-1 block h-1 w-full overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, currentColor 22%, transparent)" }}>
      <span className="block h-full rounded-full" style={{ width: `${Math.round(count.progress * 100)}%`, background: look.accent }} />
    </span>
  );
  const factLine = count.fact && (
    <span className="flex items-baseline gap-1.5 truncate" style={text(12, { opacity: 0.9 })}>
      <span>{count.fact.emoji}</span>
      <span className="truncate">{count.fact.when}: {count.fact.title.charAt(0).toLowerCase() + count.fact.title.slice(1)}</span>
    </span>
  );

  if (size === "medium") {
    return (
      <span className="flex h-full flex-col justify-center gap-2">
        <span className="flex items-center gap-4">
          <span className="flex min-w-0 flex-1 flex-col">
            {number(60)}
            <span style={font(look.unit || look.text, 20, { opacity: 0.9 })}>{unit}</span>
          </span>
          <span className="flex w-[140px] flex-col gap-1.5">
            {count.today ? (
              <>
                <span style={text(12, { opacity: 0.8 })}>Today</span>
                <span style={text(20)}>{count.today}</span>
              </>
            ) : count.next && (
              <>
                <span style={text(12, { opacity: 0.8 })}>Next</span>
                <span style={text(17)}>{count.next}</span>
                {progress}
                <span style={text(12, { opacity: 0.85 })}>in {days(count.inDays)}</span>
              </>
            )}
          </span>
        </span>
        {factLine}
      </span>
    );
  }
  if (size === "large") {
    return (
      <span className="flex h-full flex-col">
        {number(96)}
        <span style={font(look.unit || look.text, 22, { opacity: 0.9 })}>{unit}</span>
        <span className="flex-1" />
        {count.today ? <span style={text(22)}>Today: {count.today}</span> : count.next && (
          <>
            <span style={text(17)}>Next: {count.next}</span>
            {progress}
            <span className="mt-1" style={text(12, { opacity: 0.85 })}>in {days(count.inDays)}</span>
          </>
        )}
        <span className="flex-1" />
        {count.fact && (
          <span className="flex items-start gap-2.5">
            <span style={{ fontSize: 30 }}>{count.fact.emoji}</span>
            <span className="flex flex-col gap-0.5">
              <span style={text(12, { opacity: 0.8 })}>{count.fact.when}</span>
              <span style={text(15)}>{count.fact.title}</span>
            </span>
          </span>
        )}
      </span>
    );
  }
  const line = count.today ? `Today: ${count.today}` : count.next ? `${count.next} in ${days(count.inDays)}` : null;
  return (
    <span className="flex h-full flex-col">
      {number(54)}
      <span style={font(look.unit || look.text, 17, { opacity: 0.9 })}>{unit}</span>
      <span className="flex-1" />
      {line && <span className="line-clamp-2" style={text(12, { opacity: 0.9 })}>{line}</span>}
      {count.next && !count.today && progress}
    </span>
  );
}

// The favorite chip widget, with the plain brass coin the widget gallery shows
function ChipFace({ look, size }) {
  const coin = (px) => (
    <span className="relative flex shrink-0 items-center justify-center rounded-full"
      style={{ width: px, height: px, background: "linear-gradient(135deg, rgb(237 204 120), rgb(158 120 51))", boxShadow: "0 3px 0 rgb(99 75 32), 0 8px 14px rgb(0 0 0 / 0.4)" }}>
      <span className="absolute inset-[8px] rounded-full border-2 border-white/35" />
      <span className="font-serif font-bold" style={{ color: "rgb(92 66 20)", fontSize: px * 0.36 }}>I</span>
    </span>
  );
  if (size === "medium") {
    return (
      <span className="flex h-full items-center gap-3.5">
        {coin(120)}
        <span className="flex flex-col gap-1">
          <span style={font(look.text, 20)}>1 year</span>
          <span style={font(look.text, 12, { opacity: 0.75 })}>Favorite chip</span>
        </span>
      </span>
    );
  }
  return (
    <span className="flex h-full flex-col items-center justify-center gap-1">
      {coin(size === "large" ? 260 : 120)}
      {size === "large" && <span style={font(look.text, 17)}>1 year</span>}
    </span>
  );
}

// The drawing behind a style, the same as OrnamentView in RecoveryBotWidgets.swift
function Ornament({ look, w, h }) {
  const white = (a) => `rgb(255 255 255 / ${a})`;
  let shapes = null;
  switch (look.ornament) {
    case "glow":
      shapes = <><circle cx={w - 6} cy={-30} r={110} fill={white(0.07)} /><circle cx={w - 6} cy={-30} r={65} fill={white(0.07)} /></>;
      break;
    case "stars":
      shapes = (
        <>
          {STARS.map(([x, y, r]) => <circle key={`${x}-${y}`} cx={(x / 100) * w} cy={(y / 100) * h} r={r} fill={white(0.75)} />)}
          <path transform={`translate(${w - 34} 14)`} d="M8.44,0.12A10,10 0 1,0 19.43,13.32A9,9 0 0,1 8.44,0.12Z" fill="rgb(235 240 255 / 0.9)" />
        </>
      );
      break;
    case "waves": {
      const band = h * 0.34;
      const wave = (n) => {
        const p = (i) => `${(n[i] / 100) * w},${h - band + (n[i + 1] / 30) * band}`;
        return `M${p(0)} C${p(2)} ${p(4)} ${p(6)} C${p(8)} ${p(10)} ${p(12)} L${w},${h} L0,${h} Z`;
      };
      shapes = (
        <>
          <path d={wave([0, 14, 15, 6, 30, 6, 50, 14, 70, 22, 85, 22, 100, 14])} fill={white(0.13)} />
          <path d={wave([0, 20, 20, 12, 35, 26, 55, 19, 75, 12, 85, 12, 100, 20])} fill={white(0.11)} />
        </>
      );
      break;
    }
    case "pines": {
      const band = h * 0.28;
      const d = PINES.map(([x, th, tw]) => {
        const cx = (x / 100) * w, half = ((tw / 100) * w) / 2, top = h - (band * th) / 100;
        return `M${cx - half},${h} L${cx},${top} L${cx + half},${h} Z`;
      }).join(" ");
      shapes = <g fill={look.accent} opacity={0.2}><path d={d} /><rect x={0} y={h - band * 0.12} width={w} height={band * 0.12} /></g>;
      break;
    }
    case "sun":
      shapes = <>{[[95, 0.07], [70, 0.1], [45, 0.14]].map(([r, a]) => <circle key={r} cx={w - 4} cy={h - 4} r={r} fill={white(a)} />)}</>;
      break;
    case "grid": {
      const dots = [];
      for (let y = 8; y < h; y += 12) for (let x = 8; x < w; x += 12) dots.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={0.7} />);
      shapes = <><g fill={white(0.12)}>{dots}</g><rect x={w - 21.5} y={14} width={7} height={12} fill={look.accent} /></>;
      break;
    }
    case "rings":
      shapes = <><circle cx={w} cy={0} r={60} fill="none" stroke={white(0.16)} /><circle cx={w} cy={0} r={95} fill="none" stroke={white(0.09)} /></>;
      break;
    case "stripe":
      shapes = <rect x={0} y={0} width={5} height={h} fill={look.accent} />;
      break;
    case "ruled": {
      const lines = [];
      for (let y = 34; y < h - 4; y += 16) lines.push(<rect key={y} x={0} y={y} width={w} height={0.75} />);
      shapes = <><g fill={look.ink} opacity={0.08}>{lines}</g><rect x={9.5} y={0} width={1} height={h} fill={look.accent} opacity={0.45} /></>;
      break;
    }
    default:
  }
  return <svg className="pointer-events-none absolute inset-0" width={w} height={h} aria-hidden="true">{shapes}</svg>;
}
