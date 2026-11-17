// How each Home Screen widget is laid out, for every style and size: the designs from the
// widgets' Figma file (project files widget-styles/Widgets.figcraft, page 1), as a list of
// things to draw. One copy of this drives all three places a widget is drawn:
//   - the app settings' previews (components/profile/WidgetSettings.jsx, drawWidget below)
//   - the iPhone widgets (mobile/ios/App/RecoveryBotWidgets/Layouts/widget-layouts.json)
//   - the Android widgets (mobile/android/app/src/main/assets/widget-layouts.json)
// `bin/widget-layouts` writes the two JSON copies; run it after changing anything here.
//
// Every widget is drawn in design units: small 170x170, medium 364x170, large 364x382. A phone
// scales them to the widget's real size (positions and boxes on each axis, type and round
// things by the smaller of the two), so bands and edges still reach the real edges.
//
// Things to draw (`t`), in order:
//   rect  { x, y, w, h, fill, r, mask }   a box; `mask: true` clips everything after it to its
//                                          rounded shape (and isn't drawn itself)
//   text  { x, y, s, font, weight, size, color, a, align, line, spacing, maxW, lines, fit }
//         `s` holds {names} filled in from the widget's values (WIDGET_VALUES); a text whose
//         values are all empty isn't drawn. y is the top of the first line, `line` its height
//         (default 1.2 x size). Text wider than maxW wraps, up to `lines` lines (default 1), the
//         last cut with "…"; with `fit` it shrinks to fit maxW instead (the big number).
//         font: "number" (the style's own face), "rounded", "serif", "mono" or "plain".
//   bar   { x, y, w, h, p, color, track, square }   p: "progress" (to the next chip) or "year"
//   ring  { cx, cy, r, th, p, color, track }
//   edge  { th, r, p, color, track }       progress traced around the widget's own edge,
//                                          clockwise from the top middle
//   rule  { x, y, w, color, a }            a dotted line
//   coin  { cx, cy, d }                    their chip
// Bars, rings and edges need a progress; without one (a milestone reached today, nothing ahead)
// they aren't drawn.
//
// Fills: { k: "s", c, a } solid, { k: "l", c: [...], p: [...], from, to } linear (from/to in
// the box, 0-1), { k: "r", c: [inner, outer], p } radial from the middle.

export const LAYOUT_VERSION = 1;
export const SIZES = { small: [170, 170], medium: [364, 170], large: [364, 382] };
export const KINDS = { day: ["small", "medium", "large"], chip: ["small", "medium", "large"], reflection: ["small", "medium", "large"] };

// The values a widget fills in, with sample ones for previews
export const SAMPLE_VALUES = {
  days: "127",
  daysCaps: "DAYS",
  daysSober: "DAYS SOBER",
  since: "Since Jul 13, 2026",
  sinceCaps: "SOBER SINCE JUL 13, 2026",
  nextHead: "Next chip",
  nextName: "6 months",
  nextIn: "in 55 days",
  nextLine: "55 days to 6 months",
  nextShort: "6 MO IN 55 DAYS",
  nextBoth: "6 months in 55 days",
  nextChip: "Next chip: 6 months",
  nextDays: "55",
  nextDaysUnit: "days",
  nextTo: "to 6 months",
  percent: "60%",
  fact: "🐾 In 12 days: longer than an elephant's pregnancy",
  chipName: "1 year",
  chipEarned: "Earned Jul 13, 2026",
  chipNext: "Next: 6 months · 55 days",
  rDate: "Nov 17",
  rDay: "Nov 17 · 321/365",
  rTitle: "Overcoming Loneliness",
  rQuote: "Almost without exception, alcoholics are tortured by loneliness. Even before our drinking got bad and people began to cut us off, nearly all of us suffered the feeling that we didn't quite belong.",
  rSource: "As Bill Sees It, p. 90",
  rSourceCaps: "AS BILL SEES IT, P. 90",
  rRead: "~2 min read",
  rBand: "Nov 17 · ~2 min read",
};

const hex = (h) => h.replace("#", "").toUpperCase();
const solid = (c, a = 1) => ({ k: "s", c: hex(c), a });
const linear = (a, b, from = [0, 0], to = [1, 1]) => ({ k: "l", c: [hex(a), hex(b)], p: [0, 1], from, to });
const radial = (a, b) => ({ k: "r", c: [hex(a), hex(b)], p: [0.02, 1] });
const PLUM = { k: "l", c: ["753747", "9F3751", "2C0912"], p: [0, 0.266, 1], from: [0.5, 0], to: [-0.5, 0] };

// key: background, ink, accent, number ink, number face (with its CSS weight), text face
export const STYLE_LOOKS = {
  classic: { bg: linear("5C8CBA", "2B4F78"), ink: "FFFFFF", accent: "FFFFFF", number: "PublicSans-ExtraBold", text: "rounded", progress: "bar" },
  night: { bg: radial("33405C", "0F1729"), ink: "FFFFFF", accent: "99C2FF", number: "Figtree-Light", text: "rounded", progress: "ring" },
  ocean: { bg: radial("2980D9", "08336E"), ink: "FFFFFF", accent: "9EDBFF", number: "Montserrat-Black", text: "rounded", progress: "ring" },
  forest: { bg: radial("33805C", "0A3321"), ink: "FFFFFF", accent: "99E6AD", number: "TikTokSans-ExtraBold", text: "rounded", progress: "ring" },
  sunrise: { bg: linear("F97316", "DB2777"), ink: "FFFFFF", accent: "FFFFFF", number: "TikTokSansCondensed-Black", text: "plain", progress: "band" },
  midnight: { bg: solid("0B0B10"), ink: "FFFFFF", accent: "F59E0B", numberInk: "F59E0B", number: "DMMono-Light", text: "mono", progress: "edge", edge: 9 },
  black: { bg: radial("333338", "17171A"), ink: "FFFFFF", accent: "D1D1D9", number: "Inter-ExtraLight", text: "rounded", progress: "edge", edge: 2 },
  light: { bg: radial("FFFFFF", "E3E3DE"), ink: "1F2433", accent: "3B70A6", numberInk: "3B70A6", number: "PublicSans-ExtraBold", text: "rounded", progress: "edge", edge: 3 },
  paperLight: { bg: solid("F5EFE3"), paper: "F5EFE3", ink: "3B2E21", accent: "B86B29", number: "GentiumBookPlus-Bold", text: "serif", progress: "paper" },
  paperDark: { bg: solid("29241F"), paper: "29241F", ink: "F2E8D4", accent: "DE994D", number: "GentiumBookPlus-Bold", text: "serif", progress: "paper" },
};

// The styles with layouts of their own; "paper" draws as paperLight or paperDark
export const LAYOUT_STYLES = Object.keys(STYLE_LOOKS);
export const layoutStyle = (key, dark = false) => (key === "paper" ? (dark ? "paperDark" : "paperLight") : STYLE_LOOKS[key] ? key : "classic");

const FACT_W = 160; // the fun fact beside the next chip, two lines

function build(key, kind, size) {
  const L = STYLE_LOOKS[key];
  const [W, H] = SIZES[size];
  const ops = [];
  const ink = L.ink;
  const tf = L.text;
  const hi = L.accent !== ink ? L.accent : ink;
  const nink = L.numberInk || ink;
  const track = solid(ink, 0.13);
  const edgeC = L.accent;
  const charcoal = key === "black";
  const kindOf = L.progress; // bar | ring | edge | band | paper

  const T = (x, y, s, font, weight, sz, color, a = 1, more = {}) => ops.push({ t: "text", x, y, s, font, weight, size: sz, color, a, align: "left", ...more });
  const caps = (x, y, s, a = 0.7, align = "left") => T(x, y, s, tf, 700, 11, ink, a, { align, spacing: 8 });
  const num = (x, y, sz, more = {}) => T(x, y, "{days}", "number", 400, sz, nink, 1, { line: sz * 0.95, fit: true, maxW: W - 2 * Math.max(16, x - (more.align === "center" ? W / 2 : 0)), ...more });
  const bar = (x, y, w, p, h = 5) => ops.push({ t: "bar", x, y, w, h, p, color: edgeC, track: { c: ink, a: 0.13 } });
  const ring = (cx, cy, r, th, p) => ops.push({ t: "ring", cx, cy, r, th, p, color: edgeC, track: { c: ink, a: 0.13 } });
  const edge = (p) => ops.push({ t: "edge", th: L.edge, r: 26, p, color: edgeC, track: { c: ink, a: 0.13 } });
  const rule = (x, y, w, a) => ops.push({ t: "rule", x, y, w, color: ink, a });
  const coin = (cx, cy, d) => ops.push({ t: "coin", cx, cy, d });
  const YEAR = "year";
  const PROG = "progress";

  // ---- the background, and the bottom band of Paper and Sunrise (from Colton's medium widgets)
  let band = null;
  if (kindOf === "paper") {
    ops.push({ t: "rect", x: 0, y: H - 75, w: W, h: 75, fill: solid(ink), r: 24.4 });
    ops.push({ t: "rect", x: 0, y: 0, w: W, h: H - 23, fill: L.bg, r: 26 });
    band = (s) => T(W / 2, H - 20, s, "serif", 500, 11, L.paper, 1, { align: "center", line: 16, maxW: W - 24 });
  } else if (kindOf === "band") {
    ops.push({ t: "rect", x: 0, y: 0, w: W, h: H, fill: L.bg, r: 26, mask: true });
    ops.push({ t: "rect", x: 0, y: 0, w: W, h: H, fill: PLUM, r: 0 });
    ops.push({ t: "rect", x: 0, y: 0, w: W, h: H - 30, fill: L.bg, r: 0 });
    band = (s, p) => {
      ops.push({ t: "bar", x: 0, y: H - 35, w: W, h: 5, p, color: "FFFFFF", track: { c: "FFFFFF", a: 0.13 }, square: true });
      T(W / 2, H - 24, s, "plain", 500, 12, "FFFFFF", 0.7, { align: "center", line: 16, maxW: W - 24 });
    };
  } else {
    ops.push({ t: "rect", x: 0, y: 0, w: W, h: H, fill: L.bg, r: 26 });
  }

  const paper = kindOf === "paper";
  const sunrise = kindOf === "band";

  if (paper || sunrise) {
    if (kind === "day" && size === "small") {
      if (paper) {
        caps(85, 16, "{daysCaps}", 0.7, "center");
        num(85, 30, 58, { align: "center", line: 62 });
        T(85, 96, "{nextBoth}", tf, 600, 12, ink, 0.85, { align: "center", maxW: 140 });
        bar(20, 122, 130, PROG);
        band("{since}");
      } else {
        caps(20, 18, "{daysCaps}");
        num(18, 32, 58, { line: 62 });
        T(20, 100, "{nextBoth}", tf, 600, 12, ink, 0.85, { maxW: 136 });
        band("{since}", PROG);
      }
    } else if (kind === "day" && size === "medium") {
      if (paper) {
        caps(22, 18, "{daysSober}");
        num(20, 34, 80, { line: 76, maxW: 190 });
        T(22, 116, "{since}", tf, 500, 12, ink, 0.7);
        T(340, 18, "{nextHead}", tf, 500, 12, ink, 0.75, { align: "right" });
        T(340, 34, "{nextName}", tf, 700, 22, ink, 1, { align: "right", line: 26 });
        T(340, 62, "{nextIn}", tf, 500, 13, ink, 0.8, { align: "right" });
        bar(223.8, 122, 120, PROG);
      } else {
        caps(22, 22, "{daysSober}");
        num(17, 36, 80, { line: 76, maxW: 190 });
        T(22, 114, "{since}", tf, 500, 12, ink, 0.7);
        T(340, 23, "{nextHead}", tf, 500, 12, ink, 0.75, { align: "right" });
        T(340, 37, "{nextName}", tf, 700, 22, ink, 1, { align: "right", line: 26 });
        T(340, 63, "{nextIn}", tf, 500, 13, ink, 0.8, { align: "right" });
      }
      band("{fact}", PROG);
    } else if (kind === "day" && size === "large") {
      T(182, 26, "{sinceCaps}", tf, 700, 12, ink, 0.75, { align: "center", spacing: 8 });
      rule(28, 52, 308, 0.35);
      num(182, 64, 150, { align: "center", line: 156 });
      T(182, 218, "{daysCaps}", tf, 700, 18, ink, 1, { align: "center", spacing: 40 });
      rule(28, 256, 308, 0.35);
      T(182, 274, "{nextLine}", tf, 600, 16, hi, 1, { align: "center" });
      if (paper) {
        bar(92, 304, 180, PROG);
        T(182, 322, "{nextChip}", tf, 500, 12, ink, 0.7, { align: "center" });
      } else {
        T(182, 300, "{nextChip}", tf, 500, 12, ink, 0.7, { align: "center" });
      }
      band("{fact}", PROG);
    } else if (kind === "chip" && size === "small") {
      coin(85, paper ? 64 : 62, 88);
      T(85, 114, "{nextShort}", tf, 700, 10, ink, 0.85, { align: "center", spacing: 6 });
      if (paper) bar(35, 132, 100, PROG, 4);
      band("{chipEarned}", PROG);
    } else if (kind === "chip" && size === "medium") {
      coin(88, 70, 104);
      caps(170, 20, "FAVORITE CHIP");
      T(170, 36, "{chipName}", "number", 400, 38, nink, 1, { line: 42, fit: true, maxW: 176 });
      T(170, 84, "{chipNext}", tf, 600, 12, ink, 0.9, { maxW: 176 });
      if (paper) bar(170, 116, 170, PROG);
      band("{chipEarned}", PROG);
    } else if (kind === "chip" && size === "large") {
      caps(182, 20, "FAVORITE CHIP", 0.7, "center");
      coin(182, 132, 170);
      T(182, 236, "{chipName}", "number", 400, 40, nink, 1, { align: "center", line: 44, fit: true, maxW: 300 });
      T(182, 284, "{chipNext}", tf, 600, 13, ink, 0.9, { align: "center", maxW: 300 });
      if (paper) bar(92, 314, 180, PROG);
      band("{chipEarned}", PROG);
    } else if (kind === "reflection" && size === "small") {
      const [cx, al] = paper ? [85, "center"] : [20, "left"];
      T(cx, 16, "{rDay}", tf, 600, 11, hi, 0.9, { align: al });
      T(cx, 36, "{rTitle}", "serif", 700, 19, ink, 1, { align: al, line: 22, maxW: 132, lines: 3 });
      if (paper) bar(20, 122, 130, YEAR, 4);
      band("{rRead}", YEAR);
    } else if (kind === "reflection" && size === "medium") {
      caps(22, 18, "DAILY REFLECTION");
      T(342, 16, "{rDate}", tf, 600, 12, ink, 0.7, { align: "right" });
      T(22, 36, "{rTitle}", "serif", 700, 21, ink, 1, { line: 26, maxW: 320 });
      T(22, 70, "“{rQuote}”", "serif", 400, 14, ink, 0.85, { line: 19, maxW: 320, lines: 3 });
      if (paper) bar(22, 131, 320, YEAR, 4);
      band("{rBand}", YEAR);
    } else if (kind === "reflection" && size === "large") {
      T(24, 16, "“", "serif", 700, 76, hi, 1, { line: 76 });
      T(24, 84, "{rTitle}", "serif", 600, 27, ink, 1, { line: 33, maxW: 316, fit: true });
      rule(24, 128, 316, 0.3);
      T(24, 142, "{rQuote}", "serif", 400, 15, ink, 0.75, { line: 20, maxW: 316, lines: 8 });
      caps(24, 310, "{rSourceCaps}", 0.6);
      if (paper) bar(24, 334, 316, YEAR, 4);
      band("{rBand}", YEAR);
    }
    return { w: W, h: H, ops };
  }

  // ---- Everyone else: an edge (Light, Charcoal, Midnight), a bar (Classic) or a ring (Night, Ocean, Forest)
  if (kind === "day" && size === "small") {
    if (kindOf === "edge") edge(PROG);
    else if (kindOf === "bar") bar(20, 150, 130, PROG);
    else ring(136, 136, 18, 5, PROG);
    caps(20, 22, "{daysCaps}");
    num(18, charcoal ? 34 : 38, charcoal ? 64 : 58, { line: (charcoal ? 64 : 58) + 4 });
    T(20, kindOf === "ring" ? 119 : 112, "{nextName}\n{nextIn}", tf, 600, 13, ink, 0.85, { line: 16, maxW: kindOf === "ring" ? 96 : 136, lines: 2 });
  } else if (kind === "day" && size === "medium") {
    if (kindOf === "edge") edge(PROG);
    caps(22, 22, "{daysSober}");
    if (charcoal) {
      num(20, 45, 79, { line: 76, maxW: 190 });
      T(22, 134, "{since}", tf, 500, 12, ink, 0.7);
    } else {
      num(20, 38, 72, { line: 76, maxW: 190 });
      T(22, 126, "{since}", tf, 500, 12, ink, 0.7);
    }
    if (kindOf === "ring") {
      ring(296, 80, 44, 7, PROG);
      T(296, 60, "{nextDays}", "number", 400, 26, nink, 1, { align: "center", line: 30, fit: true, maxW: 70 });
      T(296, 90, "{nextDaysUnit}", tf, 500, 11, ink, 0.75, { align: "center" });
      T(296, 132, "{nextTo}", tf, 600, 11, ink, 0.85, { align: "center", maxW: 130 });
    } else {
      const top = key === "classic" ? 21 : 26;
      T(340, top, "{nextHead}", tf, 500, 12, ink, 0.75, { align: "right" });
      T(340, top + 16, "{nextName}", tf, 700, 22, ink, 1, { align: "right", line: 26 });
      T(340, top + 44, "{nextIn}", tf, 500, 13, ink, 0.8, { align: "right" });
      if (key === "classic") {
        T(281.5, 88, "{fact}", tf, 500, 11, ink, 0.7, { align: "center", line: 16, maxW: 140, lines: 2 });
        bar(220.2, 130.5, 120, PROG);
      } else if (key === "light") {
        T(265, 93, "{fact}", tf, 500, 12, ink, 0.7, { align: "center", line: 16, maxW: FACT_W, lines: 2 });
      } else {
        T(340, key === "midnight" ? 94 : 96, "{fact}", tf, 500, 12, ink, 0.7, { align: "right", line: 16, maxW: FACT_W, lines: 2 });
      }
    }
  } else if (kind === "day" && size === "large") {
    if (kindOf === "edge") edge(PROG);
    T(182, 30, "{sinceCaps}", tf, 700, 12, ink, 0.75, { align: "center", spacing: 8 });
    rule(28, 56, 308, 0.35);
    if (charcoal) num(182, 62, 152, { align: "center", line: 160 });
    else num(182, 72, 140, { align: "center", line: 150 });
    T(182, 222, "{daysCaps}", tf, 700, 18, ink, 1, { align: "center", spacing: 40 });
    rule(28, 262, 308, 0.35);
    if (kindOf === "ring") {
      ring(70, 316, 30, 6, PROG);
      T(70, 307, "{percent}", tf, 700, 13, ink, 0.9, { align: "center" });
      T(118, 284, "{nextLine}", tf, 600, 16, hi, 1, { maxW: 222 });
      T(118, 310, "{fact}", tf, 500, 12, ink, 0.7, { line: 16, maxW: 222, lines: 2 });
    } else {
      T(182, 278, "{nextLine}", tf, 600, 16, hi, 1, { align: "center", maxW: 300 });
      const y = kindOf === "bar" ? 324 : 306;
      if (kindOf === "bar") bar(92, 306, 180, PROG);
      T(182, y, "{fact}", tf, 500, 12, ink, 0.7, { align: "center", line: 16, maxW: 220, lines: 2 });
    }
  } else if (kind === "chip" && size === "small") {
    if (kindOf === "edge") edge(PROG);
    else if (kindOf === "ring") ring(85, 74, 58, 4, PROG);
    coin(85, 74, kindOf === "ring" ? 92 : 96);
    if (kindOf === "bar") bar(35, 150, 100, PROG, 4);
    T(85, kindOf === "ring" ? 140 : 128, "{nextShort}", tf, 700, 10, ink, 0.85, { align: "center", spacing: 6, maxW: 150 });
  } else if (kind === "chip" && size === "medium") {
    if (kindOf === "edge") edge(PROG);
    else if (kindOf === "ring") ring(88, 85, 66, 5, PROG);
    coin(88, 84, kindOf === "ring" ? 106 : 116);
    if (kindOf === "bar") bar(170, 140, 170, PROG);
    caps(170, 26, "FAVORITE CHIP");
    T(170, 42, "{chipName}", "number", 400, charcoal ? 38 : 34, nink, 1, { line: charcoal ? 42 : 38, fit: true, maxW: 176 });
    T(170, charcoal ? 90 : 86, "{chipEarned}", tf, 500, 12, ink, 0.75, { maxW: 176 });
    T(170, 116, "{chipNext}", tf, 600, 12, ink, 0.9, { maxW: 176 });
  } else if (kind === "chip" && size === "large") {
    if (kindOf === "edge") edge(PROG);
    else if (kindOf === "ring") ring(182, 140, 106, 6, PROG);
    caps(182, 24, "FAVORITE CHIP", 0.7, "center");
    coin(182, 140, kindOf === "ring" ? 176 : 180);
    T(182, 258, "{chipName}", "number", 400, charcoal ? 44 : 40, nink, 1, { align: "center", line: 44, fit: true, maxW: 300 });
    T(182, 304, "{chipEarned}", tf, 500, 12, ink, 0.75, { align: "center", maxW: 300 });
    T(182, 324, "{chipNext}", tf, 600, 13, ink, 0.9, { align: "center", maxW: 300 });
    if (kindOf === "bar") bar(92, 352, 180, PROG);
  } else if (kind === "reflection" && size === "small") {
    if (kindOf === "edge") edge(YEAR);
    else if (kindOf === "bar") bar(20, 150, 130, YEAR, 4);
    else ring(142, 30, 13, 4, YEAR);
    T(20, 22, "{rDay}", tf, 600, 11, hi, 0.9, { maxW: kindOf === "ring" ? 100 : 130 });
    T(20, 44, "{rTitle}", "serif", 700, 19, ink, 1, { line: 22, maxW: 130, lines: 3 });
    T(20, 126, "{rRead}", tf, 500, 12, ink, 0.6);
  } else if (kind === "reflection" && size === "medium") {
    if (kindOf === "edge") edge(YEAR);
    else if (kindOf === "bar") bar(22, 155, 320, YEAR, 4);
    else ring(328, 28, 13, 4, YEAR);
    caps(22, 22, "DAILY REFLECTION");
    T(kindOf === "ring" ? 306 : 342, 20, "{rDate}", tf, 600, 12, ink, 0.7, { align: "right" });
    T(22, 40, "{rTitle}", "serif", 700, 21, ink, 1, { line: 26, maxW: kindOf === "ring" ? 280 : 320 });
    T(22, 76, "“{rQuote}”", "serif", 400, 14, ink, 0.85, { line: 19, maxW: 320, lines: kindOf === "bar" ? 2 : 3 });
    T(342, kindOf === "bar" ? 132 : 136, "{rRead}", tf, 500, 11, ink, 0.55, { align: "right" });
  } else if (kind === "reflection" && size === "large") {
    if (kindOf === "edge") edge(YEAR);
    else if (kindOf === "bar") bar(24, 360, 316, YEAR, 4);
    else ring(324, 50, 22, 5, YEAR);
    T(24, 16, "“", "serif", 700, 76, hi, 1, { line: 76 });
    // the title on one line (smaller when it's long), so the quote starts right under it
    T(24, 84, "{rTitle}", "serif", 600, 27, ink, 1, { line: 33, maxW: kindOf === "ring" ? 300 : 316, fit: true });
    rule(24, 128, 316, 0.3);
    T(24, 142, "{rQuote}", "serif", 400, 15, ink, 0.75, { line: 20, maxW: 316, lines: 9 });
    T(24, kindOf === "bar" ? 332 : 336, "{rSourceCaps}", tf, 700, 11, ink, 0.6, { spacing: 8, maxW: 240 });
    T(340, kindOf === "bar" ? 330 : 334, "{rDate}", "serif", 600, 13, ink, 0.6, { align: "right" });
  }
  return { w: W, h: H, ops };
}

// The layout of one widget: { w, h, ops }
export function widgetLayout(styleKey, kind, size) {
  return build(layoutStyle(styleKey), kind, size);
}

// Every layout, for the apps: { version, looks, layouts: { "<style>.<kind>.<size>": { w, h, ops } } }
export function allLayouts() {
  const layouts = {};
  for (const key of LAYOUT_STYLES) {
    for (const [kind, sizes] of Object.entries(KINDS)) {
      for (const size of sizes) layouts[`${key}.${kind}.${size}`] = build(key, kind, size);
    }
  }
  const looks = Object.fromEntries(Object.entries(STYLE_LOOKS).map(([k, v]) => [k, { number: v.number, text: v.text, ink: v.ink }]));
  return { version: LAYOUT_VERSION, looks, layouts };
}
