import React, { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Compass, Hash, Library, Search, UserRound, Users } from "lucide-react";
import { EXPLORE_ITEMS, EXTRA_ITEMS, YOU_ITEMS } from "./navItems";

const SECTIONS = {
  pages: { title: "Go to", icon: Compass, kind: "Page" },
  groups: { title: "Groups", icon: Users, kind: "Group" },
  people: { title: "People", icon: UserRound, kind: "Person" },
  readings: { title: "Readings", icon: BookOpen, kind: "Reading" },
  literature: { title: "Literature", icon: BookOpen, kind: "Chapter" },
};

const getJson = (url) => fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

// The search box at the top of every page. As you type it shows hashtags on notes you can see
// (from the hashtags endpoint, /api/hashtags), the site's own pages, groups, people, readings
// and the library's chapters and books (/api/search). ↑↓ move, Enter opens, Esc closes, and
// "/" anywhere on the page jumps here.
export default function SearchBox({ autoFocus = false, onDone, className = "" }) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(autoFocus);
  const [results, setResults] = useState(null);
  const [tags, setTags] = useState([]);
  const [cursor, setCursor] = useState(0);
  const input = useRef(null);
  const box = useRef(null);
  const signedIn = document.body.dataset.currentUser === "true";

  useEffect(() => {
    const onKey = (e) => {
      // The library's own "/" (its search dialog) gets there first and wins
      if (e.key !== "/" || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t.closest?.("input, textarea, select, [contenteditable=true], .ProseMirror")) return;
      if (!input.current || input.current.offsetParent === null) return; // this box isn't showing
      e.preventDefault();
      input.current.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!focused) return undefined;
    const onDoc = (e) => box.current && !box.current.contains(e.target) && setFocused(false);
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [focused]);

  const term = q.trim();
  useEffect(() => {
    if (term.length < 2) { setResults(null); setTags([]); return undefined; }
    const timer = setTimeout(() => {
      getJson(`/api/search?q=${encodeURIComponent(term)}`).then((d) => d && setResults(d.sections));
      if (signedIn) getJson(`/api/hashtags?q=${encodeURIComponent(term.replace(/^#/, ""))}`).then((d) => setTags(d?.hashtags || []));
    }, 180);
    return () => clearTimeout(timer);
  }, [term, signedIn]);

  // The site's own pages whose names match, so "lib" finds the Library without a round trip
  const pages = useMemo(() => {
    if (term.length < 2 || term.startsWith("#")) return [];
    const needle = term.toLowerCase();
    return [...YOU_ITEMS, ...EXPLORE_ITEMS, ...EXTRA_ITEMS]
      .filter((i) => (signedIn || !i.host) && i.label.toLowerCase().includes(needle))
      .slice(0, 3).map((i) => ({ title: i.label, url: i.href, icon: i.icon, kind: "Page" }));
  }, [term, signedIn]);

  const sections = [
    ...(pages.length ? [{ key: "pages", items: pages }] : []),
    ...(results || []),
  ];
  const tagItems = tags.slice(0, 6).map((t) => ({ title: `#${t.name}`, url: `/people/tags/${encodeURIComponent(t.name)}`, count: t.count }));
  const flat = [...tagItems, ...sections.flatMap((s) => s.items)];
  useEffect(() => setCursor(0), [term, results, tags]);

  const go = (item) => {
    if (!item) return;
    setFocused(false);
    onDone?.();
    window.location.href = item.url;
  };
  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(flat[cursor]); }
    else if (e.key === "Escape") { setFocused(false); input.current?.blur(); onDone?.(); }
  };

  const showPanel = focused && term.length >= 2;
  let index = tagItems.length;

  return (
    <div ref={box} className={`relative !font-sans ${className}`}>
      <label className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-2.5 dark:bg-neutral-900 ${showPanel ? "border-accent ring-2 ring-accent/15" : "border-neutral-300/80 dark:border-neutral-700"}`}>
        <Search className="size-5 shrink-0 text-slate-500" />
        <input ref={input} value={q} autoFocus={autoFocus} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocused(true)} onKeyDown={onKeyDown}
          placeholder="Search readings, notes, groups, books..." aria-label="Search" role="combobox" aria-expanded={showPanel} aria-controls="site-search-results"
          className="min-w-0 flex-1 border-0 !bg-transparent p-0 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-0 dark:text-white" />
        <kbd className="hidden rounded-lg bg-neutral-100 px-2.5 py-0.5 text-sm text-slate-500 sm:inline dark:bg-neutral-800">/</kbd>
      </label>

      {showPanel && (
        <div id="site-search-results" role="listbox"
          className="absolute inset-x-0 top-full z-[2300] mt-2 flex max-h-[min(70vh,34rem)] flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex-1 overflow-y-auto p-2">
            {tagItems.length > 0 && (
              <div className="px-2 pb-2">
                <SectionTitle>Notes (hashtags)</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  {tagItems.map((t, i) => (
                    <a key={t.url} href={t.url} role="option" aria-selected={cursor === i} onMouseEnter={() => setCursor(i)}
                      className={`inline-flex items-center gap-1 rounded-full px-4 py-1.5 font-semibold ${cursor === i ? "bg-accent/15 !text-accent" : "bg-neutral-100 !text-slate-800 dark:bg-neutral-800 dark:!text-neutral-100"}`}>
                      <Hash className="size-4 opacity-60" />{t.title.slice(1)}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {sections.map((s) => {
              const meta = SECTIONS[s.key] || SECTIONS.pages;
              return (
                <div key={s.key} className="pb-1">
                  <div className="px-2"><SectionTitle>{meta.title}</SectionTitle></div>
                  {s.items.map((item) => {
                    const i = index++;
                    const Icon = item.icon || (item.kind === "Book" ? Library : meta.icon);
                    return (
                      <a key={`${s.key}-${item.url}`} href={item.url} role="option" aria-selected={cursor === i} onMouseEnter={() => setCursor(i)}
                        className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${cursor === i ? "bg-accent/10" : ""}`}>
                        {item.avatar_url ? <img src={item.avatar_url} alt="" className="size-7 shrink-0 rounded-full object-cover" /> : <Icon className="size-6 shrink-0 text-slate-500" strokeWidth={1.6} />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base text-slate-900 dark:text-white">{item.title}</span>
                          {item.subtitle && <span className="block truncate text-sm text-slate-500 dark:text-neutral-400">{item.subtitle}</span>}
                        </span>
                        <span className="shrink-0 text-sm text-slate-500 dark:text-neutral-400">{item.kind || meta.kind}</span>
                      </a>
                    );
                  })}
                </div>
              );
            })}
            {flat.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-slate-500">{results ? `Nothing matches “${term}”.` : "Searching…"}</p>
            )}
          </div>
          <div className="hidden items-center justify-between gap-3 border-t border-neutral-200 px-5 py-3 text-sm text-slate-500 dark:border-neutral-800 sm:flex">
            <a href={`/library?q=${encodeURIComponent(term)}`} className="!text-accent hover:underline">Search the library for “{term}”</a>
            <span>↑↓ to move · Enter to open · Esc to close</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }) {
  return <div className="pb-2 pt-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-neutral-400">{children}</div>;
}
