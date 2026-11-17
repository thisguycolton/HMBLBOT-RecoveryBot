// Draws a widget layout (lib/widgetLayouts.js) on a <canvas>: the app settings' previews. The
// iPhone (WidgetCanvas in RecoveryBotWidgets.swift) and Android (WidgetPainter.java) widgets
// draw the same layouts the same way; keep the three in step.
import { widgetLayout, SAMPLE_VALUES, STYLE_LOOKS, layoutStyle } from "./widgetLayouts";
import { chipMilestones, milestoneStatus } from "./milestones";

// The style's number face, as the site loads it (lib/widgetStyles.js FONTS_URL)
const NUMBER_FACES = {
  "PublicSans-ExtraBold": ['"Public Sans"', 800],
  "Figtree-Light": ["Figtree", 300],
  "Montserrat-Black": ["Montserrat", 900],
  "TikTokSans-ExtraBold": ['"TikTok Sans"', 800],
  "TikTokSansCondensed-Black": ['"TikTok Sans"', 900, "condensed"],
  "DMMono-Light": ['"DM Mono"', 300],
  "Inter-ExtraLight": ["Inter", 200],
  "GentiumBookPlus-Bold": ['"Gentium Book Plus"', 700],
};
// The phone's own faces for everything else
const TEXT_FACES = {
  rounded: 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
  serif: 'ui-serif, "New York", Georgia, serif',
  mono: 'ui-monospace, "SF Mono", Menlo, monospace',
  plain: "system-ui, -apple-system, sans-serif",
};

const rgba = (hex, a = 1) => {
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// "{days} days" with the values filled in; null when every value in it is empty
export function fill(template, values) {
  let any = false;
  let names = 0;
  const out = template.replace(/\{(\w+)\}/g, (_, name) => {
    names += 1;
    const v = values[name];
    if (v) any = true;
    return v || "";
  });
  return names && !any ? null : out;
}

// Lines of text no wider than max (measure gives a width), at most `lines`, the last cut with "…"
export function wrap(text, max, lines, measure) {
  const out = [];
  const paragraphs = text.split("\n");
  for (let p = 0; p < paragraphs.length; p++) {
    const words = paragraphs[p].split(" ");
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (!max || measure(next) <= max || !line) line = next;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  if (out.length <= lines) return out;
  const kept = out.slice(0, lines);
  let last = kept[lines - 1];
  while (last && max && measure(`${last}…`) > max) last = last.replace(/\s*\S+$/, "");
  kept[lines - 1] = `${last || kept[lines - 1]}…`;
  return kept;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function paint(ctx, f, x, y, w, h) {
  if (f.k === "s") return rgba(f.c, f.a ?? 1);
  let g;
  if (f.k === "l") g = ctx.createLinearGradient(x + f.from[0] * w, y + f.from[1] * h, x + f.to[0] * w, y + f.to[1] * h);
  else g = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, 0.8 * Math.max(w, h));
  f.c.forEach((c, i) => g.addColorStop(Math.min(1, Math.max(0, f.p[i])), rgba(c)));
  return g;
}

// The path around the widget's edge, clockwise from the top middle, inset by `inset`
function edgePath(W, H, r, inset) {
  const x0 = inset, y0 = inset, x1 = W - inset, y1 = H - inset;
  const rr = Math.max(0, r - inset);
  const p = new Path2D();
  p.moveTo(W / 2, y0);
  p.lineTo(x1 - rr, y0);
  p.arc(x1 - rr, y0 + rr, rr, -Math.PI / 2, 0);
  p.lineTo(x1, y1 - rr);
  p.arc(x1 - rr, y1 - rr, rr, 0, Math.PI / 2);
  p.lineTo(x0 + rr, y1);
  p.arc(x0 + rr, y1 - rr, rr, Math.PI / 2, Math.PI);
  p.lineTo(x0, y0 + rr);
  p.arc(x0 + rr, y0 + rr, rr, Math.PI, Math.PI * 1.5);
  p.lineTo(W / 2, y0);
  const length = 2 * (x1 - x0 - 2 * rr) + 2 * (y1 - y0 - 2 * rr) + 2 * Math.PI * rr;
  return [p, length];
}

function drawCoin(ctx, cx, cy, d, chip) {
  if (chip) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = d * 0.07;
    ctx.shadowOffsetY = d * 0.06;
    ctx.filter = "brightness(0.62)";
    ctx.drawImage(chip, cx - d / 2, cy - d / 2 + d * 0.03, d, d);
    ctx.restore();
    ctx.drawImage(chip, cx - d / 2, cy - d / 2, d, d);
    return;
  }
  // a plain brass coin, for previews
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy + d * 0.04, d / 2, 0, Math.PI * 2); ctx.fillStyle = "#634B20"; ctx.fill();
  const g = ctx.createLinearGradient(cx - d / 2, cy - d / 2, cx + d / 2, cy + d / 2);
  g.addColorStop(0, "#EDCC78"); g.addColorStop(1, "#9E7833");
  ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, d * 0.42, 0, Math.PI * 2); ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = Math.max(1, d * 0.02); ctx.stroke();
  ctx.fillStyle = "#5C4214"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `700 ${d * 0.38}px ${TEXT_FACES.serif}`;
  ctx.fillText("I", cx, cy + d * 0.02);
  ctx.restore();
}

// Draws a widget into canvas, cssW x cssH on the page.
// opts: { style, kind, size, values, progress (0-1 or null), year (0-1), chip (an image), dark }
export function drawWidget(canvas, cssW, cssH, opts) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  const key = layoutStyle(opts.style, opts.dark);
  const look = STYLE_LOOKS[key];
  const layout = widgetLayout(key, opts.kind, opts.size);
  const values = { ...SAMPLE_VALUES, ...(opts.values || {}) };
  const progress = { progress: opts.progress === undefined ? 0.6 : opts.progress, year: opts.year === undefined ? 321 / 365 : opts.year };
  const sx = cssW / layout.w;
  const sy = cssH / layout.h;
  const s = Math.min(sx, sy);
  let masks = 0;
  // How far a title that took more lines than its first ("grow") pushes the ops after it that
  // "follow" it, in layout points
  let shift = 0;

  for (const op of layout.ops) {
    switch (op.t) {
      case "rect": {
        const x = op.x * sx, y = op.y * sy, w = op.w * sx, h = op.h * sy;
        if (op.mask) {
          ctx.save(); masks += 1;
          roundRect(ctx, x, y, w, h, op.r * s);
          ctx.clip();
          break;
        }
        ctx.fillStyle = paint(ctx, op.fill, x, y, w, h);
        roundRect(ctx, x, y, w, h, (op.r || 0) * s);
        ctx.fill();
        break;
      }
      case "text": {
        const text = fill(op.s, values);
        if (!text) break;
        const [family, weight, stretch] = op.font === "number" ? NUMBER_FACES[look.number] : [TEXT_FACES[op.font], op.weight];
        let size = op.size * s;
        const setFont = () => {
          ctx.font = `${weight} ${size}px ${family}`;
          ctx.fontStretch = stretch || "normal";
          ctx.letterSpacing = `${((op.spacing || 0) / 100) * size}px`;
        };
        setFont();
        const max = op.maxW ? op.maxW * sx : 0;
        if (op.fit && max && ctx.measureText(text).width > max) {
          size = Math.max(size * 0.4, size * (max / ctx.measureText(text).width));
          setFont();
        }
        const opY = op.y + (op.follow ? shift : 0);
        const designLine = op.line || op.size * 1.2;
        // "until": no line may end below this, however far it was pushed down
        const most = op.until ? Math.max(1, Math.min(op.lines || 1, Math.floor((op.until - opY) / designLine))) : op.lines || 1;
        const lines = op.fit ? [text] : wrap(text, max, most, (t) => ctx.measureText(t).width);
        if (op.grow) shift += (lines.length - 1) * designLine;
        const lh = (op.line || op.size * 1.2) * s * (size / (op.size * s));
        ctx.fillStyle = rgba(op.color, op.a ?? 1);
        ctx.textAlign = op.align || "left";
        ctx.textBaseline = "alphabetic";
        lines.forEach((line, i) => {
          const top = opY * sy + i * lh;
          ctx.fillText(line, op.x * sx, top + (lh - size) / 2 + size * 0.8);
        });
        break;
      }
      case "bar": {
        const p = progress[op.p];
        if (p == null) break;
        const x = op.x * sx, y = op.y * sy, w = op.w * sx, h = op.h * s;
        const r = op.square ? 0 : h / 2;
        ctx.fillStyle = rgba(op.track.c, op.track.a);
        roundRect(ctx, x, y, w, h, r); ctx.fill();
        ctx.fillStyle = rgba(op.color);
        roundRect(ctx, x, y, Math.max(op.square ? 0 : h, w * p), h, r); ctx.fill();
        break;
      }
      case "ring": {
        const p = progress[op.p];
        if (p == null) break;
        const cx = op.cx * sx, cy = op.cy * sy, r = op.r * s, th = op.th * s;
        ctx.lineWidth = th;
        ctx.lineCap = "butt";
        ctx.strokeStyle = rgba(op.track.c, op.track.a);
        ctx.beginPath(); ctx.arc(cx, cy, r - th / 2, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = rgba(op.color);
        ctx.beginPath(); ctx.arc(cx, cy, r - th / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke();
        break;
      }
      case "edge": {
        const p = progress[op.p];
        if (p == null) break;
        const th = op.th * s;
        const [path, length] = edgePath(cssW, cssH, op.r * s, th / 2);
        ctx.lineWidth = th;
        ctx.lineCap = "butt";
        ctx.strokeStyle = rgba(op.track.c, op.track.a);
        ctx.setLineDash([]);
        ctx.stroke(path);
        ctx.strokeStyle = rgba(op.color);
        ctx.setLineDash([length * p, length]);
        ctx.stroke(path);
        ctx.setLineDash([]);
        break;
      }
      case "rule": {
        ctx.fillStyle = rgba(op.color, op.a);
        const n = Math.floor(op.w / 7.1);
        const y = op.y + (op.follow ? shift : 0);
        for (let i = 0; i < n; i++) ctx.fillRect((op.x + i * 7.1) * sx, y * sy, 3 * s, 1.5 * s);
        break;
      }
      case "coin":
        drawCoin(ctx, op.cx * sx, op.cy * sy, op.d * s, opts.chip);
        break;
      default:
    }
  }
  while (masks-- > 0) ctx.restore();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortLabel = (label) => label.replace("months", "mo").replace("month", "mo").replace("years", "yrs").replace("year", "yr").toUpperCase();
const daysText = (n) => `${n.toLocaleString()} ${n === 1 ? "day" : "days"}`;

// A day count's values from a "YYYY-MM-DD" sobriety date, the way the phones fill them
// (WidgetData.dayValues on Android, WidgetValues.day on the iPhone): { values, progress }, or null
// without a date (or for one in the future). The milestones are the site's own (lib/milestones.js).
export function countValues(iso, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  const status = m ? milestoneStatus(iso, now) : null;
  if (!status) return null;
  const unit = status.days === 1 ? "DAY" : "DAYS";
  const since = `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
  const v = {
    days: status.days.toLocaleString(), daysCaps: unit, daysSober: `${unit} SOBER`,
    since: `Since ${since}`, sinceCaps: `SOBER SINCE ${since.toUpperCase()}`,
    nextHead: "", nextName: "", nextIn: "", nextLine: "", nextShort: "", nextBoth: "", nextChip: "",
    nextDays: "", nextDaysUnit: "", nextTo: "", percent: "", chipNext: "",
  };
  let progress = null;
  const today = status.today?.label;
  const next = status.next;
  if (today) {
    Object.assign(v, { nextHead: "Today", nextName: today, nextIn: "today", nextLine: `Today: ${today}`, nextShort: `${shortLabel(today)} TODAY`,
      nextBoth: `${today} today`, nextChip: `Today: your ${today} chip`, nextDaysUnit: "today", nextTo: today, percent: "100%" });
    progress = 1;
  } else if (next) {
    const d = daysText(next.inDays);
    // the share of the way from the last milestone (or the sobriety date) to the next
    const earned = chipMilestones(iso, now)?.earned || [];
    const from = earned.length ? earned[earned.length - 1].at : Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const span = Math.max(1, Math.round((next.at - from) / 86400000));
    const pct = Math.round((100 * (span - next.inDays)) / span);
    Object.assign(v, { nextHead: "Next chip", nextName: next.label, nextIn: `in ${d}`, nextLine: `${d} to ${next.label}`,
      nextShort: `${shortLabel(next.label)} IN ${d.toUpperCase()}`, nextBoth: `${next.label} in ${d}`, nextChip: `Next chip: ${next.label}`,
      nextDays: next.inDays.toLocaleString(), nextDaysUnit: next.inDays === 1 ? "day" : "days", nextTo: `to ${next.label}`,
      percent: `${pct}%`, chipNext: `Next: ${next.label} · ${d}` });
    progress = pct / 100;
  }
  return { values: v, progress };
}
