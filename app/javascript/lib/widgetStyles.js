// The Home Screen widgets' styles in the iPhone and Android apps, for the picker in This phone >
// Widgets (components/profile/WidgetSettings.jsx). The same list, colors, fonts and drawings as
// WidgetStyle and WidgetTheme in mobile/ios/App/RecoveryBotWidgets/RecoveryBotWidgets.swift
// and mobile/android/.../WidgetStyles.java (with res/drawable/widget_bg_* and the
// number fonts in each res/layout/widget_day_count_*): change them together.
// The key is what the app keeps (WidgetBridgePlugin setWidgetStyle).
//
// Each style's big number is one of the site's fonts (bundled into the apps' widgets; FONTS_URL
// loads them here for the preview). The smaller lines stay in the phone's own faces.

const rgb = (r, g, b) => `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
// SwiftUI's RadialGradient(startRadius: 5, endRadius: 220) on a widget about 170pt wide
const radial = (a, b) => `radial-gradient(circle at center, ${a} 3%, ${b} 100%)`;

// The faces the widgets use, from Google Fonts like the rest of the site
// Full weight ranges, so pages that use these families elsewhere (toasts use Public Sans) don't
// get every weight drawn from the one face the widgets need
export const FONTS_URL = "https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&family=Figtree:ital,wght@0,300..900;1,300..900&family=Gentium+Book+Plus:ital,wght@0,400;0,700;1,400;1,700&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Public+Sans:ital,wght@0,100..900;1,100..900&family=TikTok+Sans:opsz,wdth,wght@12..36,75..150,300..900&display=swap";

const face = (family, weight, extra = {}) => ({ family: `"${family}", system-ui, sans-serif`, weight, ...extra });
// The phone's own faces for the smaller lines (SwiftUI's rounded, serif and monospaced designs)
const ROUNDED = 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
const SERIF = 'ui-serif, "New York", Georgia, serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
const PLAIN = "system-ui, -apple-system, sans-serif";
const PUBLIC = { number: face("Public Sans", 800), text: ROUNDED, tracking: "-0.02em" };
const GENTIUM = { number: face("Gentium Book Plus", 700), text: SERIF };

const PAPER_LIGHT = { background: rgb(0.96, 0.94, 0.89), ink: rgb(0.23, 0.18, 0.13), accent: rgb(0.72, 0.42, 0.16), ...GENTIUM };
const PAPER_DARK = { background: rgb(0.16, 0.14, 0.12), ink: rgb(0.95, 0.91, 0.83), accent: rgb(0.87, 0.6, 0.3), ...GENTIUM };

export const WIDGET_STYLES = [
  { key: "classic", name: "Classic blue", background: `linear-gradient(135deg, ${rgb(0.36, 0.55, 0.73)}, ${rgb(0.17, 0.31, 0.47)})`, ink: "#fff", accent: "#fff", ...PUBLIC },
  { key: "night", name: "Night", background: radial(rgb(0.2, 0.25, 0.36), rgb(0.06, 0.09, 0.16)), ink: "#fff", accent: rgb(0.6, 0.76, 1),
    number: face("Figtree", 300), text: ROUNDED, tracking: "-0.02em" },
  { key: "ocean", name: "Ocean", background: radial(rgb(0.16, 0.5, 0.85), rgb(0.03, 0.2, 0.43)), ink: "#fff", accent: rgb(0.62, 0.86, 1),
    number: face("Montserrat", 900), text: ROUNDED },
  { key: "forest", name: "Forest", background: radial(rgb(0.2, 0.5, 0.36), rgb(0.04, 0.2, 0.13)), ink: "#fff", accent: rgb(0.6, 0.9, 0.68),
    number: face("TikTok Sans", 800), text: ROUNDED },
  { key: "sunrise", name: "Sunrise", background: `linear-gradient(135deg, ${rgb(0.98, 0.45, 0.09)}, ${rgb(0.86, 0.15, 0.47)})`, ink: "#fff", accent: "#fff",
    number: face("TikTok Sans", 900, { stretch: "75%" }), text: PLAIN },
  { key: "midnight", name: "Midnight", background: rgb(0.04, 0.04, 0.06), ink: "#fff", accent: rgb(0.96, 0.62, 0.04), numberInk: rgb(0.96, 0.62, 0.04),
    number: face("DM Mono", 300), text: MONO, tracking: "-0.04em" },
  { key: "black", name: "Charcoal", background: radial(rgb(0.2, 0.2, 0.22), rgb(0.09, 0.09, 0.1)), ink: "#fff", accent: rgb(0.82, 0.82, 0.85),
    number: face("Inter", 200), text: ROUNDED, tracking: "-0.04em" },
  { key: "light", name: "Light", background: radial("#fff", rgb(0.89, 0.89, 0.87)), ink: rgb(0.12, 0.14, 0.2), accent: rgb(0.23, 0.44, 0.65),
    numberInk: rgb(0.23, 0.44, 0.65), ...PUBLIC },
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
