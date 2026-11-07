import React, { useLayoutEffect, useRef } from "react";
import { Outlet, useHref, useLocation, useNavigationType } from "react-router-dom";

// The window scrolls every page, and a React Router link swaps the page without a real page
// load, so on its own the new page opens wherever the last one was scrolled to. This puts
// each new page at the top, puts a page back where it was when you go Back or Forward, and
// leaves the scroll alone when only the query (?filters) changes on the same page.
// A link or navigate() can keep the scroll with { state: { keepScroll: true } }.

const STORE = "hb.scroll";
let positions = {};
try { positions = JSON.parse(sessionStorage.getItem(STORE) || "{}"); } catch { /* private window */ }

function save() {
  try { sessionStorage.setItem(STORE, JSON.stringify(positions)); } catch { /* full or private */ }
}

// The page coming back usually fetches its content after it renders, so it may still be too
// short to scroll that far. Keep trying for a moment, and stop as soon as the person scrolls.
function restore(y) {
  let frame;
  let stopped = false;
  const until = performance.now() + 2000;
  const stop = () => { stopped = true; cancelAnimationFrame(frame); off(); };
  const events = ["wheel", "touchstart", "keydown", "mousedown"];
  const off = () => events.forEach((e) => window.removeEventListener(e, stop, true));
  events.forEach((e) => window.addEventListener(e, stop, { capture: true, passive: true }));
  const step = () => {
    if (stopped) return;
    const room = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.min(y, Math.max(room, 0)));
    if (room >= y || performance.now() > until) return off();
    frame = requestAnimationFrame(step);
  };
  step();
  return stop;
}

export function ScrollManager() {
  const location = useLocation();
  // The first entry of every real page load has the key "default", so the full path keeps them apart
  const base = useHref("/");
  const keyOf = (loc) => `${base}${loc.pathname}:${loc.key}`;
  const action = useNavigationType();
  const last = useRef(null);
  const current = useRef(keyOf(location));
  const cancel = useRef(null);
  const lastY = useRef(window.scrollY); // read before the new page renders, which may clamp it

  // Remember where each page is scrolled to; hand back to the browser for real page loads
  useLayoutEffect(() => {
    window.history.scrollRestoration = "manual";
    const onScroll = () => { lastY.current = window.scrollY; positions[current.current] = lastY.current; };
    const onHide = () => { positions[current.current] = window.scrollY; save(); window.history.scrollRestoration = "auto"; };
    const onShow = () => { window.history.scrollRestoration = "manual"; };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onShow);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", onShow);
      window.history.scrollRestoration = "auto";
    };
  }, []);

  useLayoutEffect(() => {
    const before = last.current;
    last.current = location;
    if (!before) {
      // A reload or a Back into this page from another site: the browser tries to put the scroll
      // back right away, before the page has fetched its content, so it lands short. Finish it.
      const kind = performance.getEntriesByType?.("navigation")?.[0]?.type;
      const y = positions[keyOf(location)];
      if ((kind === "reload" || kind === "back_forward") && typeof y === "number" && y > 0) cancel.current = restore(y);
      return;
    }
    if (before.key === location.key) return;
    positions[keyOf(before)] = lastY.current;
    current.current = keyOf(location);
    cancel.current?.();
    cancel.current = null;

    if (action === "POP") {
      const y = positions[keyOf(location)];
      if (typeof y === "number") cancel.current = restore(y);
      else window.scrollTo(0, 0);
      return;
    }
    if (location.state?.keepScroll) return;
    if (location.hash) {
      window.scrollTo(0, 0);
      try { document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView(); } catch { /* bad hash */ }
      return;
    }
    if (before.pathname === location.pathname) return; // only the query changed: filters, paging
    window.scrollTo(0, 0);
  }, [location, action]);

  return null;
}

// Wraps a data router's routes so every page gets the scroll handling. ScrollManager comes
// before the page so its layout effect runs first and a page that scrolls itself on load
// (to a meeting card, a #hash, the end of a chat) still gets the last word.
export function withScrollManager(routes) {
  return [{ element: <><ScrollManager /><Outlet /></>, children: routes }];
}
