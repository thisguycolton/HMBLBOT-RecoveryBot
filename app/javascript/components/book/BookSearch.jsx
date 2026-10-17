import React, { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Search, X } from "lucide-react";
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

export function SearchButton({ onClick, label = "Search this book" }) {
  return (
    <button type="button" className="wb-btn wb-btn--icon" onClick={onClick} title={`${label} (/)`} aria-label={label}>
      <Search size={20} />
    </button>
  );
}

function plural(n, word, many = `${word}s`) {
  return `${n} ${n === 1 ? word : many}`;
}

function ChapterResult({ bookSlug, chapter, query }) {
  return (
    <a className="wb-search__result" href={searchHref(bookSlug, chapter.slug, query)}>
      <div className="flex items-baseline justify-between gap-3">
        <strong className="wb-ellipsis">{chapter.title}</strong>
        <small className="wb-toc__meta">{plural(chapter.count, "match", "matches")}</small>
      </div>
      {chapter.snippets.map((s, i) => (
        <div key={i} className="wb-search__snippet">
          {s.page != null && <span className="wb-toc__meta mr-2">p. {s.page}</span>}
          {s.before}<mark>{s.match}</mark>{s.after}
        </div>
      ))}
    </a>
  );
}

// Searches one book when given `bookSlug` (with a switch to widen it to the whole
// library), or every book in the library when not.
export function SearchDialog({ open, onClose, bookSlug, bookTitle, initialQuery = "" }) {
  const [query, setQuery] = useState(initialQuery);
  const [allBooks, setAllBooks] = useState(!bookSlug);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const library = allBooks || !bookSlug;

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
    if (q.length < 2) { setResponse(null); return; }
    let alive = true;
    setLoading(true);
    const url = library
      ? `/api/books/search?q=${encodeURIComponent(q)}`
      : `/api/books/${encodeURIComponent(bookSlug)}/search?q=${encodeURIComponent(q)}`;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (alive) setResponse({ library, results: Array.isArray(data.results) ? data.results : [] });
      } catch {
        if (alive) setResponse({ library, results: [] });
      } finally {
        if (alive) setLoading(false);
      }
    }, 200);
    return () => { alive = false; clearTimeout(t); };
  }, [query, open, bookSlug, library]);

  if (!open) return null;

  const q = query.trim();
  // Ignore results left over from the other scope while the new ones load.
  let results = response && response.library === library ? response.results : null;
  // Searching every book from inside one: list that book first.
  if (results && library && bookSlug) {
    results = [...results].sort((a, b) => (b.slug === bookSlug) - (a.slug === bookSlug));
  }
  const scopeName = library ? "the library" : bookTitle || "this book";
  const total = results?.reduce((n, r) => n + r.count, 0) || 0;
  const chapterTotal = library ? results?.reduce((n, b) => n + b.chapters.length, 0) || 0 : results?.length || 0;

  function openFirst() {
    const first = results?.[0];
    if (!first) return;
    window.location.href = library
      ? searchHref(first.slug, first.chapters[0].slug, q)
      : searchHref(bookSlug, first.slug, q);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label={`Search ${scopeName}`}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="wb wb-search relative w-full max-w-2xl max-h-[75vh] flex flex-col rounded-xl shadow-xl bg-white dark:bg-neutral-900">
        <form
          className="relative p-4 pb-3"
          onSubmit={(e) => {
            e.preventDefault();
            openFirst();
          }}
        >
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-60" aria-hidden="true" />
            <input
              ref={inputRef}
              className="wb-search__input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${scopeName}`}
              aria-label="Search text"
              autoComplete="off"
            />
          </div>
          {bookSlug && (
            <div className="wb-search__scope" role="group" aria-label="Where to search">
              <button type="button" aria-pressed={!allBooks} onClick={() => setAllBooks(false)}>
                <span className="wb-ellipsis">{bookTitle || "This book"}</span>
              </button>
              <button type="button" aria-pressed={allBooks} onClick={() => setAllBooks(true)}>
                All books
              </button>
            </div>
          )}
        </form>

        <div className="overflow-auto px-3 pb-3">
          {q.length < 2 ? (
            <p className="px-2 pb-2 text-sm opacity-60">Type at least two letters.</p>
          ) : results === null || (loading && !results.length) ? (
            <p className="px-2 pb-2 text-sm opacity-60">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-2 pb-2 text-sm opacity-60">
              Nothing in {library ? "any book" : "this book"} matches “{q}”.
            </p>
          ) : (
            <>
              <p className="px-2 pb-2 text-sm opacity-60">
                {plural(total, "match", "matches")} in {plural(chapterTotal, "chapter")}
                {library && ` of ${plural(results.length, "book")}`}
              </p>
              {library
                ? results.map((book) => (
                    <section key={book.slug} className="wb-search__book">
                      <h3 className="wb-search__book-title" data-current={book.slug === bookSlug || undefined}>
                        <BookOpen size={16} aria-hidden="true" className="shrink-0" />
                        <span className="wb-ellipsis">{book.title}</span>
                        {bookSlug && (
                          <span className="wb-search__book-tag">
                            {book.slug === bookSlug ? "This book" : "Another book"}
                          </span>
                        )}
                        <small className="wb-search__book-count">{plural(book.count, "match", "matches")}</small>
                      </h3>
                      {book.chapters.map((ch) => (
                        <ChapterResult key={ch.slug} bookSlug={book.slug} chapter={ch} query={q} />
                      ))}
                    </section>
                  ))
                : results.map((ch) => <ChapterResult key={ch.slug} bookSlug={bookSlug} chapter={ch} query={q} />)}
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
