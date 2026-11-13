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
// - notifications: a tap opens its page, logging out stops them (lib/nativePush.js)
// Every plugin call checks the app has that plugin, so an older install just skips it.
import { callPlugin, hasPlugin, nativePlatform, onPlugin } from "../lib/nativeApp";
import { showToast } from "../lib/toast";

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
  installPush();
  onPlugin("App", "resume", () => window.dispatchEvent(new Event("app:resume")));
  const ready = () => hasPlugin("SplashScreen") && callPlugin("SplashScreen", "hide").catch(() => {});
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready, { once: true });
  else ready();
  finishLaunch();
  installPageReady();
  installShellGhost();
  installHidingTopBar();
}

// Phones: the top bar (search, bell, account) slides up out of the way while scrolling down
// and comes back on the way up, or near the top of the page (CSS in _app_launch_head). It stays
// while something in it is in use, like the search box.
function installHidingTopBar() {
  const root = document.documentElement;
  let last = window.scrollY;
  let travelled = 0;
  const show = () => root.classList.remove("shell-top-hidden");
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    const delta = y - last;
    last = y;
    const top = document.querySelector("[data-shell-top]");
    if (!top || window.innerWidth >= 1024 || y < 80 || top.contains(document.activeElement) || top.matches("[class*='z-[2100]']")) {
      travelled = 0;
      show();
      return;
    }
    // a little way in one direction before it moves, so small jitters don't flicker it
    travelled = Math.sign(delta) === Math.sign(travelled) ? travelled + delta : delta;
    if (travelled > 24) root.classList.add("shell-top-hidden");
    else if (travelled < -12) show();
  }, { passive: true });
  window.addEventListener("pagehide", show);
}

// Keeps a copy of the shell (top bar, sidebar, bottom bar and the empty stage) as the app leaves
// a page, for the next page to show before its scripts run (layouts/_app_launch_body.html.erb),
// so moving between pages doesn't flash a blank screen where the menus were. Ids and the pull to
// refresh mark are taken off the copy so nothing finds it instead of the real thing.
function installShellGhost() {
  const ghost = document.getElementById("shell-ghost");
  if (ghost) {
    // Layout.jsx removes it as the real shell draws; pages without the shell drop it here
    const drop = () => setTimeout(() => ghost.remove(), 400);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", drop, { once: true });
    else drop();
  }
  window.addEventListener("pagehide", () => {
    try {
      const top = document.querySelector("[data-shell-top]");
      const stage = document.querySelector(".shell .stage");
      if (!top || !stage) { sessionStorage.removeItem("hb-shell"); return; }
      const parts = [top, document.querySelector(".shell .shell-side"), document.querySelector(".shell .shell-bottom")]
        .filter(Boolean).map((el) => el.cloneNode(true));
      const frame = stage.parentElement.cloneNode(false);
      frame.removeAttribute("style");
      frame.appendChild(stage.cloneNode(false));
      parts.push(frame);
      parts.forEach((el) => {
        el.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
        el.removeAttribute("id");
        el.removeAttribute("data-pull-refresh");
      });
      sessionStorage.setItem("hb-shell", parts.map((el) => el.outerHTML).join(""));
    } catch { /* storage full or private mode: the next page just draws without it */ }
  });
}

// Moving between pages in the iPhone app: the app keeps a picture of the last page over this one
// (PageCurtain in AppDelegate.swift) until this says it has drawn: the shell is up (the copy of
// the last one, #shell-ghost, is gone), or 0.8 seconds after the page's scripts ran at most. It
// doesn't wait for the page's content: skeletons stand in for what's still loading, so a tap
// answers right away instead of holding the old page. A page brought back whole from the
// browser's cache (going back) is drawn already. Older app builds don't have the plugin, so
// nothing happens there.
function installPageReady() {
  if (!hasPlugin("PageCurtain")) return;
  const send = () => callPlugin("PageCurtain", "ready").catch(() => {});
  const watch = () => {
    const start = performance.now();
    const check = () => {
      const waited = performance.now() - start;
      const drawn = !document.getElementById("shell-ghost");
      // two frames on, so what was just drawn is on screen before the picture fades
      if (drawn || waited > 800) requestAnimationFrame(() => requestAnimationFrame(send));
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch, { once: true });
  else watch();
  window.addEventListener("pageshow", (e) => { if (e.persisted) send(); });
}

// The loading screen on the first page after the app opens (layouts/_app_launch_head.html.erb):
// the app's launch screen hides as soon as the page is there (above), and the shimmering robot
// in its place fades once the page and everything it needs have loaded, or after 8 seconds
function finishLaunch() {
  const root = document.documentElement;
  if (!root.classList.contains("app-launching")) return;
  try { sessionStorage.setItem("hb-launched", "1"); } catch { /* private mode */ }
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    const cover = document.getElementById("app-launch");
    if (!cover) { root.classList.remove("app-launching"); return; }
    // a frame for the page to draw first, then fade
    requestAnimationFrame(() => requestAnimationFrame(() => cover.classList.add("app-launch-done")));
    setTimeout(() => root.classList.remove("app-launching"), 450);
  };
  if (document.readyState === "complete") done();
  else window.addEventListener("load", done, { once: true });
  setTimeout(done, 8000);
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

// --- Notifications --------------------------------------------------------------------------

// Firebase Cloud Messaging (FcmSender on the server). A tap on a notification opens its page
// (data.url, /notifications/:id/open, which marks it read). One that arrives while the app is
// open shows as a toast on Android (the iPhone shows its own banner).
function installPush() {
  if (!hasPlugin("FirebaseMessaging")) return;
  const push = () => import("../lib/nativePush");
  push().then(async (m) => {
    await m.forgetNativePushAfterSignOut();
    await m.refreshNativeToken();
  }).catch(() => {});
  onPlugin("FirebaseMessaging", "tokenReceived", ({ token }) => push().then((m) => m.refreshNativeToken(token)).catch(() => {}));
  onPlugin("FirebaseMessaging", "notificationActionPerformed", ({ notification }) => {
    const url = notification?.data?.url;
    if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) window.location.href = url;
  });
  if (platform === "android") {
    onPlugin("FirebaseMessaging", "notificationReceived", ({ notification }) => {
      const url = notification?.data?.url;
      if (notification?.title || notification?.body) showToast(notification.title || notification.body, { href: typeof url === "string" && url.startsWith("/") ? url : undefined });
    });
  }
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
// recoverybot://open/<path> (the chip goes to /recovery, the day count to #today).
function installAppLinks() {
  const go = (url) => {
    try {
      const target = new URL(url);
      const ours = target.host === window.location.host || (target.protocol === "recoverybot:" && target.host === "open");
      const path = target.pathname.startsWith("/") ? target.pathname : `/${target.pathname}`;
      // A sign-in callback belongs to the browser that started it (Android can't leave it out
      // of the app's links), so the app stays where it is
      if (!ours || path.startsWith("/users/auth/")) return;
      // #today (the day count widget) opens Today over whatever page is showing
      if (target.hash === "#today" && path === "/" && !target.search) { window.location.hash = "today"; return; }
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
