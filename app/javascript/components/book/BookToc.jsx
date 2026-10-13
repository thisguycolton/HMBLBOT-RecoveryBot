import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, LayoutGrid, List, BookOpen, Pencil } from "lucide-react";
import BookCover from "./BookCover.jsx";
import { lastReadFor } from "./readingProgress.js";
import { SearchButton, SearchDialog, useSearchHotkey } from "./BookSearch.jsx";
import "../../styles/writebook.css";

const VIEW_KEY = "hb:toc-view-v2"; // v2: cards became the default

const GROUP_LABELS = {
  preface: "Front matter",
  foreword: "Front matter",
  chapter: "Chapters",
  story: "Personal stories",
  appendix: "Appendices",
};

// Chapters labelled "Step" or "Tradition" (the Twelve and Twelve) group under their label.
const CHAPTER_LABEL_GROUPS = { Step: "The Twelve Steps", Tradition: "The Twelve Traditions" };

function groupOf(ch) {
  const kind = ch.kind || "chapter";
  if (kind === "chapter" && CHAPTER_LABEL_GROUPS[ch.label]) return CHAPTER_LABEL_GROUPS[ch.label];
  return GROUP_LABELS[kind] || kind;
}

function chapterHref(bookSlug, chapter) {
  return `/books/${bookSlug}/chapters/${chapter.slug}`;
}

function pageRange(ch) {
  if (ch.first_page == null) return null;
  if (ch.last_page == null || ch.last_page === ch.first_page) return `p. ${ch.first_page}`;
  return `pp. ${ch.first_page}–${ch.last_page}`;
}

function Bookmark() {
  return (
    <svg className="wb-toc__bookmark" viewBox="0 0 64 64" aria-label="Last read" role="img">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="m17.01 54.01v-42.98c0-1.66 1.34-3 3-3h24c1.66 0 3 1.34 3 3v42.98c0 1.1-.9 2-2 2-.35 0-.69-.09-1-.27l-11.5-6.62c-.31-.18-.69-.18-1 0l-11.5 6.62c-.96.55-2.18.22-2.73-.74-.17-.3-.27-.65-.27-1z"
      />
    </svg>
  );
}

function readView() {
  try { return localStorage.getItem(VIEW_KEY) || "grid"; } catch { return "grid"; }
}

export default function BookToc() {
  const { slug } = useParams();
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState(null);
  const [error, setError] = useState("");
  const [view, setView] = useState(readView);
  const lastRead = useMemo(() => lastReadFor(slug), [slug]);
  const [openSearch, setOpenSearch] = useState(false);
  const isAdmin = document.getElementById("books-root")?.dataset.admin === "true";
  useSearchHotkey(useCallback(() => setOpenSearch(true), []));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [b, c] = await Promise.all([
          fetch(`/api/books/${encodeURIComponent(slug)}`),
          fetch(`/api/books/${encodeURIComponent(slug)}/chapters`),
        ]);
        if (!b.ok) throw new Error(b.status === 404 ? "That book isn't in the library." : "Couldn't load this book.");
        const bookData = await b.json();
        const chapterData = c.ok ? await c.json() : [];
        if (!alive) return;
        setBook(bookData);
        setChapters(Array.isArray(chapterData) ? chapterData : []);
        document.title = `${bookData.title} | HMBLBOT`;
      } catch (e) {
        if (alive) setError(e.message);
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  function chooseView(next) {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch {}
  }

  if (error) {
    return (
      <div className="wb py-12 text-center">
        <p>{error}</p>
        <Link to="/" className="wb-btn mt-4">Back to the library</Link>
      </div>
    );
  }

  if (!book || !chapters) return <div className="wb" />;

  const resume = lastRead && chapters.find((c) => c.slug === lastRead);
  const startWith = resume || chapters[0];
  const groups = new Set(chapters.map(groupOf));
  const showGroups = groups.size > 1;

  const items = [];
  let currentGroup = null;
  for (const ch of chapters) {
    const group = groupOf(ch);
    if (showGroups && group !== currentGroup) {
      currentGroup = group;
      items.push(
        <li key={`group-${ch.slug}`} className="wb-toc__group">
          {group}
        </li>
      );
    }
    const href = chapterHref(slug, ch);
    const isLastRead = ch.slug === lastRead;
    const meta = pageRange(ch) || (ch.word_count ? `${ch.word_count.toLocaleString()} words` : null);
    items.push(
      <li key={ch.slug} className={`wb-toc__leaf ${isLastRead ? "wb-toc__leaf--last-read" : ""}`}>
        {isLastRead && <Bookmark />}
        <a className="wb-toc__thumbnail" href={href} tabIndex={-1} aria-hidden="true">
          <h4>{ch.title}</h4>
          {ch.preview && <p>{ch.preview}</p>}
        </a>
        <a className="wb-toc__title" href={href}>
          <span className="wb-ellipsis">{ch.title}</span>
        </a>
        {meta && <small className="wb-toc__meta">{meta}</small>}
      </li>
    );
  }

  return (
    <div className="wb">
      <div className="wb-book">
        <aside className="wb-book__sidebar">
          <BookCover book={book} />
          {startWith && (
            <a className="wb-btn wb-btn--reversed" href={chapterHref(slug, startWith)}>
              <BookOpen size={18} aria-hidden="true" />
              <span className="wb-ellipsis">{resume ? "Continue reading" : "Start reading"}</span>
            </a>
          )}
        </aside>

        <section>
          <h1 className="wb-book__heading">
            <strong className="wb-book__title">{book.title}</strong>
            {book.author && <span className="wb-book__byline">{book.author}</span>}
          </h1>
          {book.description && <p className="wb-book__description">{book.description}</p>}

          <div className="wb-toolbar">
            <Link to="/" className="wb-btn wb-btn--icon" aria-label="Back to the library" title="Library">
              <ArrowLeft size={20} />
            </Link>
            <span className="wb-toolbar__spacer" />
            {isAdmin && (
              <Link to={`/${slug}/edit`} className="wb-btn wb-btn--icon" aria-label="Edit this book" title="Edit book">
                <Pencil size={18} />
              </Link>
            )}
            <SearchButton onClick={() => setOpenSearch(true)} />
            <button
              type="button"
              className="wb-btn wb-btn--icon"
              aria-pressed={view === "list"}
              aria-label="List view"
              title="List view"
              onClick={() => chooseView("list")}
            >
              <List size={20} />
            </button>
            <button
              type="button"
              className="wb-btn wb-btn--icon"
              aria-pressed={view === "grid"}
              aria-label="Page view"
              title="Page view"
              onClick={() => chooseView("grid")}
            >
              <LayoutGrid size={20} />
            </button>
          </div>

          {chapters.length ? (
            <ol className={`wb-toc ${view === "list" ? "wb-toc--list" : ""}`}>{items}</ol>
          ) : (
            <p className="opacity-70">This book doesn't have any chapters yet.</p>
          )}
        </section>
      </div>

      <SearchDialog open={openSearch} onClose={() => setOpenSearch(false)} bookSlug={slug} bookTitle={book.title} />
    </div>
  );
}
