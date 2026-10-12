import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import "../../styles/writebook.css";

export function searchHref(bookSlug, chapterSlug, query) {
  return `/books/${bookSlug}/chapters/${chapterSlug}?search=${encodeURIComponent(query)}`;
}

// Opens the search dialog with "/" or Cmd/Ctrl+K, as long as the reader isn't typing.
export function useSearchHotkey(open) {
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      const tag = (el?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
}

export function SearchButton({ onClick }) {
  return (
    <button type="button" className="wb-btn wb-btn--icon" onClick={onClick} title="Search this book (/)" aria-label="Search this book">
      <Search size={20} />
    </button>
  );
}

export function SearchDialog({ open, onClose, bookSlug, bookTitle, initialQuery = "" }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery((q) => q || initialQuery);
    const t = setTimeout(() => inputRef.current?.select(), 0);
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [open, onClose, initialQuery]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) { setResults(null); return; }
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/books/${encodeURIComponent(bookSlug)}/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (alive) setResults(Array.isArray(data.results) ? data.results : []);
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 200);
    return () => { alive = false; clearTimeout(t); };
  }, [query, open, bookSlug]);

  if (!open) return null;

  const q = query.trim();
  const total = results?.reduce((n, r) => n + r.count, 0) || 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label={`Search ${bookTitle || "this book"}`}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="wb wb-search relative w-full max-w-2xl max-h-[75vh] flex flex-col rounded-xl shadow-xl bg-white dark:bg-neutral-900">
        <form
          className="relative p-4 pb-3"
          onSubmit={(e) => {
            e.preventDefault();
            const first = results?.[0];
            if (first) window.location.href = searchHref(bookSlug, first.slug, q);
          }}
        >
          <Search size={18} className="absolute left-8 top-1/2 -translate-y-1/2 opacity-60" aria-hidden="true" />
          <input
            ref={inputRef}
            className="wb-search__input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${bookTitle || "this book"}`}
            aria-label="Search text"
            autoComplete="off"
          />
        </form>

        <div className="overflow-auto px-3 pb-3">
          {q.length < 2 ? (
            <p className="px-2 pb-2 text-sm opacity-60">Type at least two letters.</p>
          ) : results === null || (loading && !results.length) ? (
            <p className="px-2 pb-2 text-sm opacity-60">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-2 pb-2 text-sm opacity-60">Nothing in this book matches “{q}”.</p>
          ) : (
            <>
              <p className="px-2 pb-2 text-sm opacity-60">
                {total} {total === 1 ? "match" : "matches"} in {results.length} {results.length === 1 ? "chapter" : "chapters"}
              </p>
              {results.map((r) => (
                <a key={r.slug} className="wb-search__result" href={searchHref(bookSlug, r.slug, q)}>
                  <div className="flex items-baseline justify-between gap-3">
                    <strong className="wb-ellipsis">{r.title}</strong>
                    <small className="wb-toc__meta">{r.count} {r.count === 1 ? "match" : "matches"}</small>
                  </div>
                  {r.snippets.map((s, i) => (
                    <div key={i} className="wb-search__snippet">
                      {s.page != null && <span className="wb-toc__meta mr-2">p. {s.page}</span>}
                      {s.before}<mark>{s.match}</mark>{s.after}
                    </div>
                  ))}
                </a>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Highlights every occurrence of `query` inside `root` without touching the DOM
// (CSS Custom Highlight API), and lets the reader step through them. Re-scans
// whenever the content under `root` changes (chapter load, user highlights).
export function useInTextSearch(root, query) {
  const [ranges, setRanges] = useState([]);
  const [current, setCurrent] = useState(0);
  const [version, setVersion] = useState(0);
  const scrolledRef = useRef(null);
  const supported = typeof CSS !== "undefined" && !!CSS.highlights && typeof Highlight !== "undefined";
  const needle = (query || "").trim().toLowerCase();

  useEffect(() => {
    if (!root) return;
    let t = null;
    const observer = new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => setVersion((v) => v + 1), 120);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => { clearTimeout(t); observer.disconnect(); };
  }, [root]);

  useEffect(() => {
    if (!supported) return;
    const clear = () => { CSS.highlights.delete("wb-search"); CSS.highlights.delete("wb-search-current"); };
    if (!root || needle.length < 2) { clear(); setRanges([]); return clear; }

    const found = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue.toLowerCase();
      let at = text.indexOf(needle);
      while (at !== -1) {
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + needle.length);
        found.push(range);
        at = text.indexOf(needle, at + needle.length);
      }
    }
    CSS.highlights.set("wb-search", new Highlight(...found));
    setRanges(found);
    setCurrent((i) => (i < found.length ? i : 0));
    return clear;
  }, [root, needle, version, supported]);

  useEffect(() => {
    if (!supported || !ranges.length) return;
    const range = ranges[current] || ranges[0];
    CSS.highlights.set("wb-search-current", new Highlight(range));

    // Scroll on the first hit for a query and whenever the reader steps, not on re-scans.
    const key = `${needle}:${current}`;
    if (scrolledRef.current === key) return;
    scrolledRef.current = key;
    const rect = range.getBoundingClientRect();
    const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--reader-sticky-offset"), 10) || 112;
    window.scrollTo({ top: window.scrollY + rect.top - offset - 80, behavior: "smooth" });
  }, [ranges, current, needle, supported]);

  const step = useCallback((dir) => {
    setCurrent((i) => (ranges.length ? (i + dir + ranges.length) % ranges.length : 0));
  }, [ranges.length]);

  return { count: ranges.length, current, next: () => step(1), prev: () => step(-1) };
}

export function SearchBanner({ query, count, current, onNext, onPrev, onClear }) {
  return (
    <div className="wb-search-banner" role="status">
      <span>
        {count ? `${current + 1} of ${count}` : "No matches"} for “{query}”
      </span>
      {count > 1 && (
        <>
          <button type="button" onClick={onPrev} aria-label="Previous match"><ChevronUp size={18} /></button>
          <button type="button" onClick={onNext} aria-label="Next match"><ChevronDown size={18} /></button>
        </>
      )}
      <button type="button" onClick={onClear} aria-label="Clear search"><X size={18} /></button>
    </div>
  );
}
