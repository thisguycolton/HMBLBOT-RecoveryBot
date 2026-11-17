// Pull to refresh for the installed app. Opened from the home screen there's no browser
// toolbar and no reload button, so at the top of a page, dragging it down past the line and
// letting go reloads it. In a browser tab the browser does this itself, so it's left alone.
//
// It stays out of the way of anything that uses its own drags: a pull only starts on the page
// itself, at the very top, with one finger, and not in something that scrolls on its own (the
// chat), a dialog or sheet (anything fixed on the screen, other than the top bar), a text box or
// editor, a canvas or drawing area, or with text selected. Sideways swipes are let go at once.
// Anything can opt out with data-no-pull-refresh.
//
// Only the little spinner moves: the page itself stays still. iOS's own bounce past the top is
// turned off in the app (overscroll-behavior), since the two together dragged the page down under
// the top bar and left a gap, and the bounce threw the bottom bar out of place.

const PULL = 72; // how far, after the drag resistance, counts as a refresh
const MAX = 120; // how far the indicator follows the finger
const SIZE = 40;

// The home-screen app, or the iPhone/Android app (mobile/), which has no reload button either
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true ||
  /RecoveryBotApp\/[\d.]+ \((iOS|Android)\)/.test(navigator.userAgent);

function blocked(target) {
  if (!(target instanceof Element)) return true;
  if (document.body.style.overflow === "hidden" || document.documentElement.style.overflow === "hidden") return true; // a modal or sheet is open
  const selection = window.getSelection?.();
  if (selection && !selection.isCollapsed && String(selection).trim()) return true;
  if (target.closest("[data-no-pull-refresh], input, textarea, select, canvas, [contenteditable=''], [contenteditable='true'], [draggable='true'], [role='dialog'], [role='slider'], [aria-modal='true'], dialog")) return true;

  for (let el = target; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (style.position === "fixed" && !el.hasAttribute("data-pull-refresh")) return true;
    const touch = style.touchAction;
    if (touch && touch !== "auto" && touch !== "manipulation" && !touch.includes("pan-y")) return true;
    const scrolls = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
    if (scrolls) return true; // its own scroller (chat, lists): its drags are its own
  }
  return false;
}

function makeIndicator() {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.className = "pull-refresh";
  el.innerHTML =
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>`;
  const style = document.createElement("style");
  style.textContent = `
    .pull-refresh { position: fixed; left: 50%; top: calc(env(safe-area-inset-top, 0px) + var(--nav-h, 0px) + 8px);
      z-index: 2200; width: ${SIZE}px; height: ${SIZE}px; margin-left: -${SIZE / 2}px; margin-top: -${SIZE + 8}px;
      display: grid; place-items: center; border-radius: 9999px; pointer-events: none; opacity: 0;
      background: #fff; color: #4c7ba6; box-shadow: 0 2px 12px rgb(0 0 0 / 0.18); }
    .pull-refresh.is-ready { color: #fff; background: #4c7ba6; }
    .pull-refresh.is-settling { transition: transform 200ms ease, opacity 200ms ease; }
    .pull-refresh.is-loading svg { animation: pull-refresh-spin 0.7s linear infinite; }
    @keyframes pull-refresh-spin { to { transform: rotate(360deg); } }
    html.dark .pull-refresh:not(.is-ready) { background: #262626; color: #9cc0e0; }
  `;
  document.head.appendChild(style);
  document.body.appendChild(el);
  return el;
}

function install() {
  if (window.__pullToRefresh) return;
  window.__pullToRefresh = true;
  if (!isStandalone() || !("ontouchstart" in window)) return;
  const calm = document.createElement("style");
  calm.textContent = "html, body { overscroll-behavior-y: none; }";
  document.head.appendChild(calm);

  let indicator = null;
  let start = null; // { x, y } while a touch might become a pull
  let pulling = false;
  let distance = 0;
  let loading = false;

  const show = (d) => {
    indicator ||= makeIndicator();
    indicator.classList.remove("is-settling");
    const ready = d >= PULL;
    indicator.classList.toggle("is-ready", ready);
    indicator.style.opacity = String(Math.min(1, d / (PULL * 0.6)));
    indicator.style.transform = `translateY(${d}px) rotate(${(d / PULL) * 270}deg)`;
  };
  const hide = () => {
    if (!indicator) return;
    indicator.classList.add("is-settling");
    indicator.classList.remove("is-ready");
    indicator.style.opacity = "0";
    indicator.style.transform = "translateY(0)";
  };
  const reset = () => { start = null; pulling = false; distance = 0; };

  document.addEventListener("touchstart", (e) => {
    reset();
    if (loading || e.touches.length !== 1 || window.scrollY > 0) return;
    if (blocked(e.target)) return;
    start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (!start) return;
    if (e.touches.length !== 1 || window.scrollY > 0) { if (pulling) hide(); reset(); return; }
    const dx = e.touches[0].clientX - start.x;
    const dy = e.touches[0].clientY - start.y;
    if (!pulling) {
      if (dy <= 0 || Math.abs(dx) > dy) { // scrolling down, or a sideways swipe
        if (Math.abs(dx) >= 8 || dy <= -8) reset();
        return;
      }
      // Heading down from the top: hold the page still from the very first move, or iOS starts
      // scrolling it itself and won't let go for the rest of the drag
      if (e.cancelable) e.preventDefault();
      if (dy < 8) return; // not sure yet
      pulling = true;
    }
    distance = Math.min(MAX, Math.max(0, dy) * 0.5);
    if (e.cancelable) e.preventDefault(); // the indicator moves instead of the page bouncing
    show(distance);
  }, { passive: false });

  const end = () => {
    if (!pulling) { reset(); return; }
    if (distance >= PULL) {
      loading = true;
      indicator.classList.add("is-settling", "is-loading", "is-ready");
      indicator.style.transform = `translateY(${PULL}px)`;
      window.location.reload();
    } else {
      hide();
    }
    reset();
  };
  document.addEventListener("touchend", end, { passive: true });
  document.addEventListener("touchcancel", () => { if (pulling) hide(); reset(); }, { passive: true });

  // Coming back to a page from the back/forward cache, the spinner shouldn't still be going
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted || !indicator) return;
    loading = false;
    indicator.classList.remove("is-loading");
    hide();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
else install();
