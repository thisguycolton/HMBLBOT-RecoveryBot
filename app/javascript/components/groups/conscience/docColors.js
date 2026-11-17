// The document editor's colors, light and dark (editorKit.js, DocumentToolbar.jsx).
//
// The page keeps each color as the light value it always has (style="background-color: #dcfce7"),
// so Word, RTF, PDF and print come out as they did, and the server stores what it always stored.
// What changes is how a color shows on the dark page: every colored cell, border, word and
// highlight also gets a tone (data-fill-tone="green"), worked out from its color when the page is
// drawn, and the dark page paints that tone in its own muted, paper-like shade. Nothing is saved
// differently, so documents written before this, and colors pasted in from Word, follow along:
// a color that isn't one of the toolbar's goes to the nearest tone.

// The tones, in the order the toolbar shows them
export const TONES = ["black", "gray", "light", "red", "orange", "yellow", "green", "teal", "blue", "purple", "pink"];

// Each kind of color: what the toolbar offers (light value), and each tone on the dark page
export const PALETTES = {
  // a word's color
  text: {
    attr: "data-text-tone",
    css: "color",
    light: { black: "#0f172a", gray: "#64748b", red: "#dc2626", orange: "#ea580c", yellow: "#ca8a04", green: "#16a34a", teal: "#0d9488", blue: "#2563eb", purple: "#7c3aed", pink: "#db2777" },
    dark: { black: "#f1f5f9", gray: "#a1a1aa", light: "#d4d4d8", red: "#f87171", orange: "#fb923c", yellow: "#facc15", green: "#4ade80", teal: "#2dd4bf", blue: "#60a5fa", purple: "#a78bfa", pink: "#f472b6" },
  },
  // the highlighter behind words
  mark: {
    attr: "data-mark-tone",
    css: "background-color",
    light: { yellow: "#fef08a", green: "#bbf7d0", blue: "#bfdbfe", pink: "#fbcfe8", orange: "#fed7aa", purple: "#ddd6fe", light: "#e2e8f0" },
    dark: { black: "#3f3f46", gray: "#3f3f46", light: "#3f3f46", red: "#5c2626", orange: "#5c3a1c", yellow: "#574a14", green: "#1f4a32", teal: "#174744", blue: "#1f3a5c", purple: "#3d2f66", pink: "#5a2645" },
  },
  // a table cell's fill
  fill: {
    attr: "data-fill-tone",
    css: "background-color",
    light: { light: "#f1f5f9", yellow: "#fef9c3", green: "#dcfce7", blue: "#dbeafe", pink: "#fce7f3", orange: "#ffedd5", purple: "#ede9fe", red: "#fee2e2", teal: "#ccfbf1" },
    dark: { black: "#3a3a3f", gray: "#323236", light: "#2a2a2e", red: "#3a2424", orange: "#3a2b1f", yellow: "#36321f", green: "#20332a", teal: "#1d3332", blue: "#1f2b3b", purple: "#2b2640", pink: "#382430" },
  },
  // a table cell's border
  border: {
    attr: "data-border-tone",
    css: "border-color",
    light: { light: "#e2e8f0", gray: "#94a3b8", black: "#0f172a", blue: "#2563eb", red: "#dc2626", green: "#16a34a" },
    dark: { black: "#d4d4d8", gray: "#71717a", light: "#3f3f46", red: "#f87171", orange: "#fb923c", yellow: "#facc15", green: "#4ade80", teal: "#2dd4bf", blue: "#60a5fa", purple: "#a78bfa", pink: "#f472b6" },
  },
};

const NAMES = { black: "Black", gray: "Gray", light: "Light gray", red: "Red", orange: "Orange", yellow: "Yellow", green: "Green", teal: "Teal", blue: "Blue", purple: "Purple", pink: "Pink" };
// What the toolbar offers for a kind: [name, light value, tone]
export const swatches = (kind) => TONES.filter((t) => PALETTES[kind].light[t]).map((t) => [kind === "fill" && t === "light" ? "Gray" : NAMES[t], PALETTES[kind].light[t], t]);

// "#0f172a", "#abc", "rgb(15, 23, 42)" → [r, g, b] (0–255); anything else → null
function rgbOf(value) {
  const v = String(value || "").trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) {
    const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  m = v.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  const named = { black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255], yellow: [255, 255, 0], orange: [255, 165, 0], purple: [128, 0, 128], gray: [128, 128, 128], grey: [128, 128, 128], pink: [255, 192, 203], teal: [0, 128, 128] };
  return named[v] || null;
}

function hsl([r, g, b]) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s * 100, l * 100];
}

// Hue ranges (degrees) for each colored tone
const HUES = [[15, "red"], [40, "orange"], [65, "yellow"], [160, "green"], [190, "teal"], [250, "blue"], [295, "purple"], [340, "pink"], [360, "red"]];

const cache = new Map();
// The tone of any color: exactly one of the toolbar's, or the nearest. null when it isn't a color.
export function toneOf(value, kind) {
  if (!value) return null;
  const key = `${kind}:${value}`;
  if (cache.has(key)) return cache.get(key);
  let tone = null;
  const rgb = rgbOf(value);
  if (rgb) {
    const hex = `#${rgb.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
    tone = Object.entries(PALETTES[kind].light).find(([, v]) => v === hex)?.[0] || null;
    if (!tone) {
      const [h, s, l] = hsl(rgb);
      if (s < 18 || l > 96 || l < 6) tone = l < 30 ? "black" : l >= 75 ? "light" : "gray";
      else tone = HUES.find(([max]) => h < max)[1];
    }
  }
  cache.set(key, tone);
  return tone;
}

// The attributes a colored node gets: its tone, for the dark page
export const toneAttrs = (value, kind) => {
  const tone = toneOf(value, kind);
  return tone ? { [PALETTES[kind].attr]: tone } : {};
};

// The dark page's colors, one rule per tone. Only on screen: print stays light. Inline styles
// carry the light value, so these need !important to win.
function darkCss() {
  const rules = [];
  for (const { attr, css, dark } of Object.values(PALETTES)) {
    for (const [tone, value] of Object.entries(dark)) rules.push(`.doc-dark [${attr}="${tone}"]{${css}:${value}!important}`);
  }
  // a highlight without a color of its own is yellow
  rules.push(`.doc-dark .doc-prose mark:not([data-mark-tone]){background-color:${PALETTES.mark.dark.yellow}!important}`);
  return `@media screen{${rules.join("")}}`;
}

if (typeof document !== "undefined" && !document.getElementById("doc-dark-colors")) {
  const style = document.createElement("style");
  style.id = "doc-dark-colors";
  style.textContent = darkCss();
  document.head.appendChild(style);
}
