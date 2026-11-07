import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import LucideIcon from "../ui/LucideIcon";
import { api } from "../groups/lib";

// Search the docs (/api/docs/search): titles first, then summaries, then the words of each
// page, with a line around the match. Results drop down under the box; ↑↓ and Enter pick one.
// `compact` is the docs nav's small box (its results as wide as the box with `fullWidth`, in
// the phone's sheet); otherwise the big one on the Docs home.
export default function DocSearch({ compact = false, autoFocus = false, fullWidth = false }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [at, setAt] = useState(0);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const wrap = useRef(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setResults(null); return undefined; }
    const timer = setTimeout(() => {
      api(`/docs/search?q=${encodeURIComponent(query)}`).then((d) => { setResults(d.results); setAt(0); }).catch(() => setResults([]));
    }, 180);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const close = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const go = (result) => {
    if (!result) return;
    setOpen(false);
    setQ("");
    navigate(result.path);
  };

  const onKeyDown = (e) => {
    if (!results?.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setAt((i) => (i + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAt((i) => (i - 1 + results.length) % results.length); }
    else if (e.key === "Enter") { e.preventDefault(); go(results[at]); }
    else if (e.key === "Escape") setOpen(false);
  };

  const showing = open && results;

  return (
    <div ref={wrap} className="relative">
      <label className="relative block">
        <span className="sr-only">Search the docs</span>
        <Search className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${compact ? "left-3 size-4" : "left-4 size-5"}`} />
        <input
          type="text"
          enterKeyHint="search"
          value={q}
          autoFocus={autoFocus} // eslint-disable-line jsx-a11y/no-autofocus
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={compact ? "Search docs" : "Search the docs: chips, hosting, sponsors…"}
          role="combobox"
          aria-expanded={!!showing}
          aria-controls="doc-search-results"
          aria-autocomplete="list"
          className={`w-full border border-neutral-200 bg-white text-slate-900 placeholder-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent dark:border-neutral-700 dark:bg-neutral-900 dark:text-white ${
            compact ? "rounded-xl py-2 pl-9 pr-3 text-sm" : "rounded-2xl py-3.5 pl-12 pr-10 text-base shadow-sm"
          }`}
        />
        {!compact && q && (
          <button type="button" aria-label="Clear" onClick={() => setQ("")} className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full !bg-transparent !p-0 !text-slate-400 hover:!text-slate-700">
            <X size={16} />
          </button>
        )}
      </label>
      {showing && (
        <ul
          id="doc-search-results"
          role="listbox"
          className={`!m-0 absolute left-0 z-40 mt-2 max-h-[min(28rem,70dvh)] list-none overflow-y-auto rounded-2xl border border-neutral-200 bg-white !p-1.5 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 ${
            compact && !fullWidth ? "w-[min(26rem,85vw)]" : "w-full"
          }`}
        >
          {results.length === 0 && <li className="px-3 py-3 text-sm text-slate-500 dark:text-neutral-400">Nothing in the docs matches “{q.trim()}”.</li>}
          {results.map((r, i) => (
            <li key={r.path} role="option" aria-selected={i === at}>
              <button
                type="button"
                onMouseEnter={() => setAt(i)}
                onClick={() => go(r)}
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left !text-slate-800 dark:!text-neutral-100 ${i === at ? "!bg-neutral-100 dark:!bg-neutral-800" : "!bg-transparent"}`}
              >
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-accent-tint text-accent dark:bg-accent/25 dark:text-white">
                  <LucideIcon name={r.icon} fallback={Search} size={14} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{r.title}</span>
                  <span className="block text-xs text-slate-500 dark:text-neutral-400">{r.section}</span>
                  {r.snippet && <span className="mt-1 line-clamp-2 block text-xs text-slate-500 dark:text-neutral-400">{r.snippet}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
