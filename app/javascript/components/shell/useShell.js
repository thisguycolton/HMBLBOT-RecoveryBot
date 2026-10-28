import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";

// What the shell knows about the signed-in member (/api/nav): their groups and roles, the
// Hosting badge and Today. Every page is its own load, so the last answer is kept for this tab
// and shown at once while a fresh one comes in; the sidebar doesn't flash empty between pages.
const CACHE_KEY = "hb-nav";
let pending = null;

const signedIn = () => document.body.dataset.currentUser === "true";

function cached() {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null"); } catch { return null; }
}

function fetchNav() {
  pending ||= fetch("/api/nav", { headers: { Accept: "application/json" }, credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
      return data;
    })
    .catch(() => cached());
  return pending;
}

// Something on the page changed what the sidebar shows (joined a group, got a role)
export function refreshNav() {
  pending = null;
  return fetchNav().then((data) => window.dispatchEvent(new CustomEvent("hb:nav", { detail: data })));
}

export function useNav() {
  const [nav, setNav] = useState(() => (signedIn() ? cached() : null));
  useEffect(() => {
    if (!signedIn()) {
      try { sessionStorage.removeItem(CACHE_KEY); } catch {}
      return undefined;
    }
    let live = true;
    fetchNav().then((data) => live && data && setNav(data));
    const onNav = (e) => e.detail && setNav(e.detail);
    window.addEventListener("hb:nav", onNav);
    return () => { live = false; window.removeEventListener("hb:nav", onNav); };
  }, []);
  return nav;
}

// Light, dark, or the system's, remembered in localStorage (the layouts read it before
// anything draws, so the page doesn't flash)
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("theme") || "system"; } catch { return "system"; }
  });
  const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && systemDark());
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    try { localStorage.setItem("theme", theme); } catch {}
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = isDark ? "#0a0a0a" : "#ececec";
  }, [theme, isDark]);
  // Another bar (the group dashboard, a deck) flipped it
  useEffect(() => {
    const onStorage = (e) => e.key === "theme" && e.newValue && setTheme(e.newValue);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return { isDark, toggle: () => setTheme(isDark ? "light" : "dark") };
}

// Whether a media query matches, kept current
export function useMedia(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

// The page's side panel (PageAside.jsx) goes into the shell through this: the right column on
// wide screens, a sheet from the bottom bar on phones
export const ShellContext = createContext({ asideTarget: null, setAside: () => {} });
export const useShellContext = () => useContext(ShellContext);

// A meeting that started in the last half hour is on now
export const isOnNow = (meeting) => new Date(meeting.next_start) <= new Date();

// The page's path, kept current when a React Router page moves without a load (the sidebar
// lights up where you are). History calls are wrapped once to announce themselves.
if (!window.__hbHistoryWrapped) {
  window.__hbHistoryWrapped = true;
  for (const name of ["pushState", "replaceState"]) {
    const original = window.history[name];
    window.history[name] = function wrapped(...args) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event("hb:locationchange"));
      return result;
    };
  }
}

export function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    window.addEventListener("hb:locationchange", update);
    return () => { window.removeEventListener("popstate", update); window.removeEventListener("hb:locationchange", update); };
  }, []);
  return path;
}

// Inside a React Router app (groups.jsx, people.jsx...), the shell's links move without a load
// when they're the app's own: the app registers its router here
export function registerRouter(router, basename) {
  window.hbRouter = { router, basename };
}

export function followLink(e) {
  const a = e.target.closest?.("a[href]");
  const hb = window.hbRouter;
  if (!a || !hb || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return false;
  const href = a.getAttribute("href");
  if (!href.startsWith(`${hb.basename}/`) && href !== hb.basename) return false;
  e.preventDefault();
  hb.router.navigate(href.slice(hb.basename.length) || "/");
  return true;
}
