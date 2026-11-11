// The RecoveryBot iPhone and Android apps (mobile/, Capacitor) load this same site in a web view.
// The app adds "RecoveryBotApp/<version> (iOS|Android)" to its user agent, and Capacitor puts its
// bridge on window.Capacitor. Plugins are called straight through that bridge, so the website
// itself needs no Capacitor packages and nothing changes for people in a browser.

const AGENT = /RecoveryBotApp\/[\d.]+ \((iOS|Android)\)/;

// "ios", "android", or null in a browser
export function nativePlatform() {
  if (typeof window === "undefined") return null;
  const cap = window.Capacitor;
  if (cap?.isNativePlatform?.()) return cap.getPlatform();
  const m = navigator.userAgent.match(AGENT);
  return m ? m[1].toLowerCase() : null;
}

export const isNativeApp = () => nativePlatform() !== null;

// Whether this build of the app has a plugin (an older install may not have a newer one)
export function hasPlugin(name) {
  const cap = typeof window !== "undefined" && window.Capacitor;
  if (!cap?.isNativePlatform?.()) return false;
  return Array.isArray(cap.PluginHeaders) ? cap.PluginHeaders.some((h) => h.name === name) : false;
}

// Calls a plugin method; resolves with its answer
export function callPlugin(name, method, options = {}) {
  if (!hasPlugin(name)) return Promise.reject(new Error(`${name} isn't in this version of the app`));
  return window.Capacitor.nativePromise(name, method, options);
}

// Listens for a plugin event; returns a function that stops listening
export function onPlugin(name, event, callback) {
  if (!hasPlugin(name)) return () => {};
  const handle = window.Capacitor.addListener(name, event, callback);
  return () => handle?.remove?.();
}

// Apple only allows tips to the developer through in-app purchase, so the iPhone app has no
// Donate button (Android and the website keep theirs)
export const donationsShown = () => nativePlatform() !== "ios";
