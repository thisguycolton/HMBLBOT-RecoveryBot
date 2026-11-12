// Loaded only inside the RecoveryBot iPhone and Android apps (layouts add it when native_app?).
// The apps (mobile/) show this same site in a web view; this makes it act like an app there:
// - the status bar follows light/dark mode
// - Android's back gesture goes back a page, and only leaves the app from the first page
// - links to other sites open in an in-app browser sheet instead of replacing the app
// - Share sheets, Save and Download use the phone's own share sheet (web views can't share
//   files or download them)
// - Copy buttons use the phone's clipboard directly (the web clipboard is unreliable in a web view)
// - Print uses the phone's own print screen (window.print does nothing in a web view)
// - the Home Screen widgets get the day count and favorite chip (lib/appWidgets.js)
// Every plugin call checks the app has that plugin, so an older install just skips it.
import { callPlugin, hasPlugin, nativePlatform, onPlugin } from "../lib/nativeApp";

const platform = nativePlatform();

if (platform && !window.__nativeApp) {
  window.__nativeApp = true;
  document.documentElement.classList.add("native-app", `native-${platform}`);
  installShare();
  installClipboard();
  installDownloads();
  installPrint();
  installExternalLinks();
  installBackButton();
  installStatusBar();
  installAppLinks();
  installWidgets();
  onPlugin("App", "resume", () => window.dispatchEvent(new Event("app:resume")));
  const ready = () => hasPlugin("SplashScreen") && callPlugin("SplashScreen", "hide").catch(() => {});
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready, { once: true });
  else ready();
}

// --- Sharing --------------------------------------------------------------------------------

const abort = () => new DOMException("Share canceled", "AbortError");

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const safeName = (name, type) => {
  const ext = (type || "").split("/")[1]?.replace("jpeg", "jpg").replace(/\+.*/, "") || "bin";
  const base = String(name || `recoverybot.${ext}`).replace(/[^\w.\- ]+/g, "_").slice(-80);
  return /\.\w+$/.test(base) ? base : `${base}.${ext}`;
};

// Writes a file to the app's cache so the share sheet can hand it to other apps
async function cacheFile(blob, name) {
  const path = `share/${Date.now()}-${safeName(name, blob.type)}`;
  const data = await blobToBase64(blob);
  const { uri } = await callPlugin("Filesystem", "writeFile", { path, data, directory: "CACHE", recursive: true });
  return uri;
}

async function shareSheet({ title, text, url, files = [] }) {
  if (!hasPlugin("Share")) throw new Error("Sharing isn't in this version of the app");
  const uris = [];
  for (const file of files) uris.push(await cacheFile(file, file.name));
  const options = { dialogTitle: title || "Share" };
  if (title) options.title = title;
  if (text) options.text = text;
  if (url) options.url = url;
  if (uris.length) options.files = uris;
  try {
    await callPlugin("Share", "share", options);
  } catch (e) {
    if (/cancel/i.test(String(e?.message || e))) throw abort();
    throw e;
  }
}

// navigator.share and navigator.canShare, backed by the phone's share sheet. Android web views
// have neither, and iPhone web views can't share files.
function installShare() {
  if (!hasPlugin("Share")) return;
  const canFiles = hasPlugin("Filesystem");
  const define = (name, value) => {
    try { Object.defineProperty(navigator, name, { value, configurable: true, writable: true }); } catch { /* left as is */ }
  };
  define("canShare", (data = {}) => {
    if (data.files?.length) return canFiles;
    return Boolean(data.url || data.text || data.title);
  });
  define("share", (data = {}) => shareSheet({ ...data, files: canFiles ? Array.from(data.files || []) : [] }));
}

// --- Copying --------------------------------------------------------------------------------

// navigator.clipboard.writeText and .write, backed by the phone's clipboard (the app's own
// AppClipboard plugin). Formatted copies (text/html) keep their formatting.
function installClipboard() {
  if (!hasPlugin("AppClipboard")) return;
  const writeText = (text) => callPlugin("AppClipboard", "write", { text: String(text ?? "") });
  const write = async (items) => {
    const item = Array.from(items || [])[0];
    if (!item) return;
    const read = async (type) => (item.types?.includes(type) ? (await item.getType(type)).text() : null);
    const html = await read("text/html");
    const text = (await read("text/plain")) ?? (html ? new DOMParser().parseFromString(html, "text/html").body.textContent : "");
    await callPlugin("AppClipboard", "write", html ? { text: text || "", html } : { text: text || "" });
  };
  try {
    if (navigator.clipboard) {
      navigator.clipboard.writeText = writeText;
      navigator.clipboard.write = write;
    } else {
      Object.defineProperty(navigator, "clipboard", { value: { writeText, write }, configurable: true });
    }
  } catch { /* left as is */ }
}

// --- Downloads ------------------------------------------------------------------------------

// A link with `download` pointing at a picture, GIF or video made on the page (blob: or data:)
// does nothing in a web view, so it opens the share sheet instead, which has Save Image /
// Save Video / Save to Files.
async function saveLink(a) {
  const blob = await (await fetch(a.href)).blob();
  const name = a.getAttribute("download") || "recoverybot";
  try {
    await shareSheet({ files: [new File([blob], safeName(name, blob.type), { type: blob.type })] });
  } catch (e) {
    if (e?.name !== "AbortError") window.alert(`Couldn't save that: ${e?.message || e}`);
  }
}

const isLocalDownload = (a) => a instanceof HTMLAnchorElement && a.hasAttribute("download") && /^(blob|data):/.test(a.href);

function installDownloads() {
  if (!hasPlugin("Share") || !hasPlugin("Filesystem")) return;
  // Pages usually make a link and call .click() on it without adding it to the page
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function nativeClick() {
    if (isLocalDownload(this)) { saveLink(this); return; }
    click.call(this);
  };
  document.addEventListener("click", (e) => {
    const a = e.target instanceof Element && e.target.closest("a[download]");
    if (!a || !isLocalDownload(a)) return;
    e.preventDefault();
    saveLink(a);
  }, true);
}

// --- Printing -------------------------------------------------------------------------------

function installPrint() {
  if (!hasPlugin("Printer")) return;
  // Pages set up their print view on beforeprint and put it back on afterprint
  window.print = () => {
    window.dispatchEvent(new Event("beforeprint"));
    callPlugin("Printer", "print", { title: document.title })
      .catch(() => {})
      .finally(() => setTimeout(() => window.dispatchEvent(new Event("afterprint")), 500));
  };
}

// --- Links to other sites -------------------------------------------------------------------

const external = (href) => {
  try {
    const url = new URL(href, window.location.href);
    return /^https?:$/.test(url.protocol) && url.origin !== window.location.origin ? url : null;
  } catch { return null; }
};

const openInSheet = (url) => callPlugin("Browser", "open", { url: String(url), presentationStyle: "popover" });

function installExternalLinks() {
  if (!hasPlugin("Browser")) return;
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    const a = e.target instanceof Element && e.target.closest("a[href]");
    if (!a || a.hasAttribute("download")) return;
    const url = external(a.getAttribute("href"));
    if (url) {
      e.preventDefault();
      openInSheet(url);
    } else if (a.target === "_blank") {
      // The app has one window: our own pages opened "in a new tab" open in place
      e.preventDefault();
      window.location.href = a.href;
    }
  });
  const open = window.open;
  window.open = (href, ...rest) => {
    if (href) {
      const url = external(href);
      if (url) { openInSheet(url); return null; }
      if (typeof href === "string" && !/^(blob|data|about):/.test(href)) { window.location.href = href; return null; }
    }
    return open.call(window, href, ...rest);
  };
}

// --- Android back gesture -------------------------------------------------------------------

function installBackButton() {
  if (platform !== "android") return;
  onPlugin("App", "backButton", ({ canGoBack }) => {
    // An open sheet or dialog closes first, the way Escape closes it
    if (document.querySelector("[aria-modal='true'], [role='dialog'], dialog[open]")) {
      const esc = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      (document.activeElement || document.body).dispatchEvent(esc);
      return;
    }
    if (canGoBack) window.history.back();
    else callPlugin("App", "minimizeApp").catch(() => callPlugin("App", "exitApp"));
  });
}

// --- Status bar -----------------------------------------------------------------------------

function installStatusBar() {
  if (!hasPlugin("StatusBar")) return;
  const apply = () => {
    const dark = document.documentElement.classList.contains("dark");
    // DARK = light text, for a dark page
    callPlugin("StatusBar", "setStyle", { style: dark ? "DARK" : "LIGHT" }).catch(() => {});
    if (platform === "android") callPlugin("StatusBar", "setBackgroundColor", { color: dark ? "#0a0a0a" : "#f5f5f4" }).catch(() => {});
  };
  apply();
  new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
}

// --- Widgets --------------------------------------------------------------------------------

// Once the page has settled (drawing a chip takes a moment), and again when the app comes back
// or a page says what they show changed (a favorite chip picked)
function installWidgets() {
  if (!hasPlugin("WidgetBridge")) return;
  const run = (options) => import("../lib/appWidgets").then((m) => m.refreshWidgets(options)).catch(() => {});
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
  const later = () => idle(() => run(), { timeout: 4000 });
  if (document.readyState === "complete") later();
  else window.addEventListener("load", later, { once: true });
  window.addEventListener("app:resume", () => run());
  window.addEventListener("widgets:refresh", () => run({ force: true }));
}

// --- Links that open the app ----------------------------------------------------------------

// A recoverybot.hmblbot.com link tapped in Messages, Mail or a browser opens the app
// (Universal Links / App Links, WellKnownController); this goes to that page. A widget opens the app with
// recoverybot://open/<path> (the day count goes to /recovery).
function installAppLinks() {
  const go = (url) => {
    try {
      const target = new URL(url);
      const ours = target.host === window.location.host || (target.protocol === "recoverybot:" && target.host === "open");
      const path = target.pathname.startsWith("/") ? target.pathname : `/${target.pathname}`;
      // A sign-in callback belongs to the browser that started it (Android can't leave it out
      // of the app's links), so the app stays where it is
      if (!ours || path.startsWith("/users/auth/")) return;
      if (path + target.search !== window.location.pathname + window.location.search) window.location.href = path + target.search + target.hash;
    } catch { /* not a link we know */ }
  };
  onPlugin("App", "appUrlOpen", ({ url }) => go(url));
  // Opened from nothing by a widget or link: the app keeps that address for as long as it runs,
  // so it's followed once
  if (!sessionStorage.getItem("hb-launch-url")) {
    callPlugin("App", "getLaunchUrl").then((r) => {
      if (!r?.url) return;
      sessionStorage.setItem("hb-launch-url", "1");
      go(r.url);
    }).catch(() => {});
  }
}
