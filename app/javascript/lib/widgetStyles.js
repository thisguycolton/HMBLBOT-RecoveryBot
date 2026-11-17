// The Home Screen widgets' styles in the iPhone and Android apps, for the picker in This phone >
// Widgets (components/profile/WidgetSettings.jsx). The same list, colors, fonts and drawings as
// WidgetStyle, WidgetTheme and OrnamentView in mobile/ios/App/RecoveryBotWidgets/RecoveryBotWidgets.swift
// and mobile/android/.../WidgetStyles.java (with res/drawable/widget_bg_*, widget_orn_* and the
// fonts in each res/layout/widget_day_count_*): change them together.
// The key is what the app keeps (WidgetBridgePlugin setWidgetStyle).
//
// Each style has its own of the site's fonts (bundled into the apps' widgets; FONTS_URL loads
// them here for the preview) and its own drawing behind the count (ornament).

const rgb = (r, g, b) => `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
// SwiftUI's RadialGradient(startRadius: 5, endRadius: 220) on a widget about 170pt wide
const radial = (a, b) => `radial-gradient(circle at center, ${a} 3%, ${b} 100%)`;

// The faces the widgets use, from Google Fonts like the rest of the site
export const FONTS_URL = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400&family=Figtree:wght@300;500&family=Gentium+Book+Plus:ital,wght@0,400;0,700;1,400&family=Inter:wght@200;500&family=Montserrat:wght@600;900&family=Public+Sans:wght@600;800&family=TikTok+Sans:opsz,wdth,wght@12..36,75..150,600..900&display=swap";

const face = (family, weight, extra = {}) => ({ family: `"${family}", system-ui, sans-serif`, weight, ...extra });
const PUBLIC = { number: face("Public Sans", 800), text: face("Public Sans", 600), tracking: "-0.02em" };
const GENTIUM = {
  number: face("Gentium Book Plus", 700),
  text: face("Gentium Book Plus", 400),
  unit: face("Gentium Book Plus", 400, { style: "italic" }),
  ornament: "ruled",
};

const PAPER_LIGHT = { background: rgb(0.96, 0.94, 0.89), ink: rgb(0.23, 0.18, 0.13), accent: rgb(0.72, 0.42, 0.16), ...GENTIUM };
const PAPER_DARK = { background: rgb(0.16, 0.14, 0.12), ink: rgb(0.95, 0.91, 0.83), accent: rgb(0.87, 0.6, 0.3), ...GENTIUM };

export const WIDGET_STYLES = [
  { key: "classic", name: "Classic blue", background: `linear-gradient(135deg, ${rgb(0.36, 0.55, 0.73)}, ${rgb(0.17, 0.31, 0.47)})`, ink: "#fff", accent: "#fff", ...PUBLIC, ornament: "glow" },
  { key: "night", name: "Night", background: radial(rgb(0.2, 0.25, 0.36), rgb(0.06, 0.09, 0.16)), ink: "#fff", accent: rgb(0.6, 0.76, 1),
    number: face("Figtree", 300), text: face("Figtree", 500), tracking: "-0.02em", ornament: "stars" },
  { key: "ocean", name: "Ocean", background: radial(rgb(0.16, 0.5, 0.85), rgb(0.03, 0.2, 0.43)), ink: "#fff", accent: rgb(0.62, 0.86, 1),
    number: face("Montserrat", 900), text: face("Montserrat", 600), ornament: "waves" },
  { key: "forest", name: "Forest", background: radial(rgb(0.2, 0.5, 0.36), rgb(0.04, 0.2, 0.13)), ink: "#fff", accent: rgb(0.6, 0.9, 0.68),
    number: face("TikTok Sans", 800), text: face("TikTok Sans", 600), ornament: "pines" },
  { key: "sunrise", name: "Sunrise", background: `linear-gradient(135deg, ${rgb(0.98, 0.45, 0.09)}, ${rgb(0.86, 0.15, 0.47)})`, ink: "#fff", accent: "#fff",
    number: face("TikTok Sans", 900, { stretch: "75%" }), text: face("TikTok Sans", 600), ornament: "sun" },
  { key: "midnight", name: "Midnight", background: rgb(0.04, 0.04, 0.06), ink: "#fff", accent: rgb(0.96, 0.62, 0.04), numberInk: rgb(0.96, 0.62, 0.04),
    number: face("DM Mono", 300), text: face("DM Mono", 400), tracking: "-0.04em", ornament: "grid" },
  { key: "black", name: "Charcoal", background: radial(rgb(0.2, 0.2, 0.22), rgb(0.09, 0.09, 0.1)), ink: "#fff", accent: rgb(0.82, 0.82, 0.85),
    number: face("Inter", 200), text: face("Inter", 500), tracking: "-0.04em", ornament: "rings" },
  { key: "light", name: "Light", background: radial("#fff", rgb(0.89, 0.89, 0.87)), ink: rgb(0.12, 0.14, 0.2), accent: rgb(0.23, 0.44, 0.65),
    numberInk: rgb(0.23, 0.44, 0.65), ...PUBLIC, ornament: "stripe" },
  { key: "paper", name: "Paper", note: "Follows Light/Dark Mode", light: PAPER_LIGHT, dark: PAPER_DARK },
  { key: "paperLight", name: "Paper, light", ...PAPER_LIGHT },
  { key: "paperDark", name: "Paper, dark", ...PAPER_DARK },
];

export const DEFAULT_WIDGET_STYLE = "classic";

// A style's colors and type as drawn now: Paper takes the phone's Light/Dark Mode
export function widgetLook(style, dark = false) {
  if (style.light) return { ...style, ...(dark ? style.dark : style.light) };
  return style;
}

// The drawings, the same shapes as OrnamentShapes in RecoveryBotWidgets.swift and widget_orn_*.xml
// stars: x %, y %, radius pt
export const STARS = [
  [12, 18, 1.2], [28, 10, 0.8], [44, 22, 1], [63, 12, 1.4], [80, 30, 0.9], [70, 44, 0.7], [22, 40, 0.8],
  [52, 50, 0.6], [88, 56, 1], [36, 62, 0.7], [8, 64, 0.9], [60, 72, 0.6], [92, 82, 0.8], [16, 86, 0.7],
];
// pines: x %, height and width in % of the band along the bottom 28%
export const PINES = [
  [5, 60, 7], [13, 88, 9], [21, 52, 6], [32, 74, 8], [44, 96, 9], [54, 56, 6], [65, 82, 8], [75, 64, 7], [86, 92, 9], [95, 58, 6],
];
