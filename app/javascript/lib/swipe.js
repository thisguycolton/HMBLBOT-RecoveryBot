// Swipe to dismiss, for phones: a finger dragging toward one of `directions` carries `targets`
// along, and letting go far enough (or with a flick) dismisses them; otherwise they spring
// back. Used by toasts (swipe sideways or up), the side menus (swipe them back the way they
// came) and the sheets that slide over the page.
//
//   swipeToDismiss(area, { directions: ["left"], targets: () => [el], onDismiss, flyOut, fade, onDrag })
//
// - `area` hears the touches (an element, or document for "anywhere on screen")
// - `flyOut`: the targets slide the rest of the way out before onDismiss (toasts, sheets).
//   Without it, onDismiss runs at once and the page animates them home itself (the shell's
//   pushed page, whose transition is put back first)
// - `fade`: the targets fade as they go
// - `onDrag(progress)`: 0 to 1 while dragging, 0 again if it springs back (to fade a backdrop)
// Returns a function that stops listening.
//
// A drag that starts in a field, a canvas, a video or anything marked data-no-swipe is left
// alone, and so is one that something under the finger can still scroll (a sideways list, a
// sheet scrolled down from its top).

const SKIP = "input, textarea, select, [contenteditable='true'], canvas, video, [data-no-swipe]";
const SIGN = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const SETTLE_MS = 220;

const hasSelection = () => {
  const s = window.getSelection?.();
  return !!s && !s.isCollapsed && String(s).trim() !== "";
};

// Whether something between the touch and `stop` can still scroll the way the finger moves
function scrollsAlong(el, dir, stop) {
  const horizontal = dir === "left" || dir === "right";
  for (let n = el; n && n !== stop && n !== document.documentElement; n = n.parentElement) {
    if (!(n instanceof HTMLElement)) continue;
    const style = getComputedStyle(n);
    if (horizontal) {
      if (/(auto|scroll)/.test(style.overflowX) && n.scrollWidth > n.clientWidth + 1) {
        const atEnd = n.scrollLeft + n.clientWidth >= n.scrollWidth - 1;
        if (dir === "left" ? !atEnd : n.scrollLeft > 0) return true;
      }
    } else if (/(auto|scroll)/.test(style.overflowY) && n.scrollHeight > n.clientHeight + 1) {
      const atEnd = n.scrollTop + n.clientHeight >= n.scrollHeight - 1;
      if (dir === "down" ? n.scrollTop > 0 : !atEnd) return true;
    }
  }
  return false;
}

export function swipeToDismiss(area, { directions, targets, onDismiss, onDrag, flyOut = false, fade = false }) {
  if (!area) return () => {};
  let drag = null;
  const stop = area === document ? document.documentElement : area;

  const paint = (off) => {
    const [sx, sy] = SIGN[drag.dir];
    drag.els.forEach(({ el, transform }) => {
      el.style.transform = `translate(${sx * off}px, ${sy * off}px) ${transform}`.trim();
      if (fade) el.style.opacity = String(Math.max(0, 1 - off / drag.size));
    });
    onDrag?.(Math.min(1, off / drag.size));
  };

  const springBack = (d) => {
    d.els.forEach(({ el, transform, opacity }) => {
      el.style.transition = `transform ${SETTLE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${SETTLE_MS}ms`;
      el.style.transform = transform;
      el.style.opacity = opacity;
    });
    onDrag?.(0);
    setTimeout(() => d.els.forEach(({ el, transition }) => { el.style.transition = transition; }), SETTLE_MS + 20);
  };

  const dismiss = (d) => {
    if (!flyOut) {
      d.els.forEach(({ el, transition }) => { el.style.transition = transition; });
      onDismiss();
      return;
    }
    const [sx, sy] = SIGN[d.dir];
    const out = d.size * 1.15;
    d.els.forEach(({ el, transform }) => {
      el.style.transition = `transform ${SETTLE_MS - 40}ms ease-out, opacity ${SETTLE_MS - 40}ms`;
      el.style.transform = `translate(${sx * out}px, ${sy * out}px) ${transform}`.trim();
      if (fade) el.style.opacity = "0";
    });
    onDrag?.(1);
    setTimeout(onDismiss, SETTLE_MS - 40);
  };

  const start = (e) => {
    if (e.touches.length !== 1) { drag = null; return; }
    if (e.target instanceof Element && e.target.closest(SKIP)) { drag = null; return; }
    const t = e.touches[0];
    drag = { x: t.clientX, y: t.clientY, target: e.target, dir: null, off: 0, samples: [] };
  };

  const move = (e) => {
    if (!drag) return;
    const t = e.touches[0];
    const dx = t.clientX - drag.x;
    const dy = t.clientY - drag.y;
    if (!drag.dir) {
      if (Math.hypot(dx, dy) < 10) return;
      const horizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
      const vertical = Math.abs(dy) > Math.abs(dx) * 1.2;
      const dir = horizontal ? (dx < 0 ? "left" : "right") : vertical ? (dy < 0 ? "up" : "down") : null;
      if (!dir || !directions.includes(dir) || hasSelection() || scrollsAlong(drag.target, dir, stop)) { drag = null; return; }
      const els = (targets() || []).filter(Boolean);
      if (!els.length) { drag = null; return; }
      drag.dir = dir;
      drag.els = els.map((el) => ({ el, transform: el.style.transform, transition: el.style.transition, opacity: el.style.opacity }));
      drag.size = Math.min(horizontal ? els[0].offsetWidth : els[0].offsetHeight, horizontal ? window.innerWidth : window.innerHeight) || 300;
      els.forEach((el) => { el.style.transition = "none"; });
    }
    if (e.cancelable) e.preventDefault();
    const [sx, sy] = SIGN[drag.dir];
    drag.off = Math.max(0, dx * sx + dy * sy);
    drag.samples.push({ off: drag.off, at: e.timeStamp });
    if (drag.samples.length > 5) drag.samples.shift();
    paint(drag.off);
  };

  const end = (e) => {
    const d = drag;
    drag = null;
    if (!d?.dir) return;
    if (e.cancelable) e.preventDefault(); // the drag isn't a tap
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const speed = first && last && last.at > first.at ? (last.off - first.off) / (last.at - first.at) : 0;
    if (e.type !== "touchcancel" && (d.off > d.size * 0.35 || (speed > 0.45 && d.off > 24))) dismiss(d);
    else springBack(d);
  };

  area.addEventListener("touchstart", start, { passive: true });
  area.addEventListener("touchmove", move, { passive: false });
  area.addEventListener("touchend", end, { passive: false });
  area.addEventListener("touchcancel", end, { passive: false });
  return () => {
    area.removeEventListener("touchstart", start);
    area.removeEventListener("touchmove", move);
    area.removeEventListener("touchend", end);
    area.removeEventListener("touchcancel", end);
  };
}

// From the left edge of the screen, a swipe right: `onSwipe` (opens the menu in the app, where
// no browser keeps that edge for its own back gesture)
export function edgeSwipe(onSwipe, { edge = 24, distance = 56 } = {}) {
  let from = null;
  const start = (e) => {
    const t = e.touches[0];
    from = e.touches.length === 1 && t.clientX <= edge && !(e.target instanceof Element && e.target.closest(SKIP)) ? { x: t.clientX, y: t.clientY } : null;
  };
  const move = (e) => {
    if (!from) return;
    const t = e.touches[0];
    const dx = t.clientX - from.x;
    const dy = Math.abs(t.clientY - from.y);
    if (dy > 30 || dx < -10) { from = null; return; }
    if (dx > distance && dx > dy * 2) { from = null; onSwipe(); }
  };
  const end = () => { from = null; };
  document.addEventListener("touchstart", start, { passive: true });
  document.addEventListener("touchmove", move, { passive: true });
  document.addEventListener("touchend", end, { passive: true });
  return () => {
    document.removeEventListener("touchstart", start);
    document.removeEventListener("touchmove", move);
    document.removeEventListener("touchend", end);
  };
}
