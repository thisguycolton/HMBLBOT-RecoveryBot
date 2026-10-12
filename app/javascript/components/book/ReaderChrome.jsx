import React, { useEffect } from "react";
import { ArrowLeft, ArrowRight, ListOrdered, RotateCcw, X } from "lucide-react";
import "../../styles/writebook.css";

export function chapterHref(bookSlug, chapter) {
  return `/books/${bookSlug}/chapters/${chapter.slug}`;
}

export function tocHref(bookSlug) {
  return `/library/${bookSlug}`;
}

// Writebook-style navigation: arrow keys move between chapters, falling back to
// the table of contents at either end of the book.
export function useChapterHotkeys(prevHref, nextHref) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const el = e.target;
      const tag = (el?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (window.getSelection?.()?.toString()) return;
      if (e.key === "ArrowLeft" && prevHref) window.location.href = prevHref;
      if (e.key === "ArrowRight" && nextHref) window.location.href = nextHref;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevHref, nextHref]);
}

export function ReaderBar({ bookSlug, bookTitle, chapterTitle, prev, next, onOpenChapters }) {
  const prevHref = prev ? chapterHref(bookSlug, prev) : tocHref(bookSlug);
  const nextHref = next ? chapterHref(bookSlug, next) : null;

  return (
    <nav className="wb-reader__bar" aria-label="Chapter navigation">
      <a
        className="wb-btn wb-btn--icon"
        href={prevHref}
        title={prev ? `Previous: ${prev.title}` : "Table of contents"}
        aria-label={prev ? `Previous: ${prev.title}` : `Table of contents: ${bookTitle}`}
      >
        <ArrowLeft size={20} />
      </a>

      <div className="wb-breadcrumbs">
        <a className="wb-breadcrumbs__library" href="/library">Library</a>
        <span className="wb-breadcrumbs__sep" aria-hidden="true">▸</span>
        <a className="wb-ellipsis" href={tocHref(bookSlug)}>{bookTitle || "Book"}</a>
        <span className="wb-breadcrumbs__sep" aria-hidden="true">▸</span>
        <strong className="wb-ellipsis">{chapterTitle || "…"}</strong>
      </div>

      <button
        type="button"
        className="wb-btn wb-btn--icon"
        onClick={onOpenChapters}
        title="Chapters"
        aria-label="Open the chapter list"
      >
        <ListOrdered size={20} />
      </button>

      {nextHref ? (
        <a className="wb-btn wb-btn--icon" href={nextHref} title={`Next: ${next.title}`} aria-label={`Next: ${next.title}`}>
          <ArrowRight size={20} />
        </a>
      ) : (
        <span className="wb-btn wb-btn--icon" aria-disabled="true">
          <ArrowRight size={20} />
        </span>
      )}
    </nav>
  );
}

export function ReaderFooter({ bookSlug, bookTitle, next }) {
  return (
    <nav className="wb-reader__footer" aria-label="Next chapter">
      {next ? (
        <a className="wb-btn" href={chapterHref(bookSlug, next)}>
          <span className="wb-ellipsis">Next: {next.title}</span>
          <ArrowRight size={22} aria-hidden="true" />
        </a>
      ) : (
        <a className="wb-btn" href={tocHref(bookSlug)}>
          <span className="wb-ellipsis">Table of contents: {bookTitle}</span>
          <RotateCcw size={20} aria-hidden="true" />
        </a>
      )}
    </nav>
  );
}

export function ChaptersDialog({ open, onClose, bookSlug, bookTitle, chapters, currentSlug }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Chapters">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="wb relative w-full max-w-2xl max-h-[80vh] overflow-auto rounded-xl shadow-xl p-5 bg-white dark:bg-neutral-900">
        <div className="flex items-center justify-between gap-3 mb-4">
          <a href={tocHref(bookSlug)} className="text-xl font-extrabold no-underline text-inherit">{bookTitle}</a>
          <button type="button" className="wb-btn wb-btn--icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {Array.isArray(chapters) && chapters.length ? (
          <ol className="wb-toc wb-toc--list">
            {chapters.map((c) => (
              <li key={c.slug} className={`wb-toc__leaf ${c.slug === currentSlug ? "wb-toc__leaf--last-read" : ""}`}>
                <a className="wb-toc__title" href={chapterHref(bookSlug, c)} aria-current={c.slug === currentSlug ? "page" : undefined}>
                  <span className="wb-ellipsis">{c.title}</span>
                </a>
                {c.first_page != null && <small className="wb-toc__meta">{c.first_page}</small>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="opacity-70">No chapter index available.</p>
        )}
      </div>
    </div>
  );
}
