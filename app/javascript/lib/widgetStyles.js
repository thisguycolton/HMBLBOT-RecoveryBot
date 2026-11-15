// The Home Screen widgets' styles in the iPhone app, for the picker in Account settings > Widgets
// (components/profile/WidgetSettings.jsx). The same list, colors and type as WidgetStyle and
// WidgetTheme in mobile/ios/App/RecoveryBotWidgets/RecoveryBotWidgets.swift: change both together.
// The key is what the app keeps (WidgetBridgePlugin setWidgetStyle); every widget left on
// "Same as the app" (touch and hold > Edit Widget) draws in it.

const rgb = (r, g, b) => `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
// SwiftUI's RadialGradient(startRadius: 5, endRadius: 220) on a widget about 170pt wide
const radial = (a, b) => `radial-gradient(circle at center, ${a} 3%, ${b} 100%)`;

const ROUNDED = { font: 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif', weight: 700 };
const SERIF = { font: 'ui-serif, "New York", Georgia, serif', weight: 600 };
const MONO = { font: 'ui-monospace, "SF Mono", Menlo, monospace', weight: 300 };
const CONDENSED = { font: 'system-ui, -apple-system, sans-serif', weight: 900, condensed: true };

const PAPER_LIGHT = { background: rgb(0.96, 0.94, 0.89), ink: rgb(0.23, 0.18, 0.13), accent: rgb(0.72, 0.42, 0.16), ...SERIF };
const PAPER_DARK = { background: rgb(0.16, 0.14, 0.12), ink: rgb(0.95, 0.91, 0.83), accent: rgb(0.87, 0.6, 0.3), ...SERIF };

export const WIDGET_STYLES = [
  { key: "classic", name: "Classic blue", background: `linear-gradient(135deg, ${rgb(0.36, 0.55, 0.73)}, ${rgb(0.17, 0.31, 0.47)})`, ink: "#fff", accent: "#fff", ...ROUNDED },
  { key: "night", name: "Night", background: radial(rgb(0.2, 0.25, 0.36), rgb(0.06, 0.09, 0.16)), ink: "#fff", accent: rgb(0.6, 0.76, 1), ...ROUNDED },
  { key: "ocean", name: "Ocean", background: radial(rgb(0.16, 0.5, 0.85), rgb(0.03, 0.2, 0.43)), ink: "#fff", accent: rgb(0.62, 0.86, 1), ...ROUNDED },
  { key: "forest", name: "Forest", background: radial(rgb(0.2, 0.5, 0.36), rgb(0.04, 0.2, 0.13)), ink: "#fff", accent: rgb(0.6, 0.9, 0.68), ...ROUNDED },
  { key: "sunrise", name: "Sunrise", background: `linear-gradient(135deg, ${rgb(0.98, 0.45, 0.09)}, ${rgb(0.86, 0.15, 0.47)})`, ink: "#fff", accent: "#fff", ...CONDENSED },
  { key: "midnight", name: "Midnight", background: rgb(0.04, 0.04, 0.06), ink: "#fff", accent: rgb(0.96, 0.62, 0.04), ...MONO },
  { key: "black", name: "Charcoal", background: radial(rgb(0.2, 0.2, 0.22), rgb(0.09, 0.09, 0.1)), ink: "#fff", accent: rgb(0.82, 0.82, 0.85), ...ROUNDED },
  { key: "light", name: "Light", background: radial("#fff", rgb(0.89, 0.89, 0.87)), ink: rgb(0.12, 0.14, 0.2), accent: rgb(0.23, 0.44, 0.65), ...ROUNDED },
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
