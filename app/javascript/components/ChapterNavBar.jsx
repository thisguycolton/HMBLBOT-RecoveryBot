import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import axios from "axios";

export default function ChapterNavBar({
  bookSlug,
  currentSlug: propCurrentSlug,      // may be undefined; we’ll fallback to URL
  overrideTitle,
  className = "",
}) {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fallback: infer current slug from /books/:book/chapters/:slug
  const currentSlug = useMemo(() => {
    if (propCurrentSlug) return propCurrentSlug;
    const m = location.pathname.match(/\/books\/[^/]+\/chapters\/([^/]+)/);
    return m ? m[1] : null;
  }, [propCurrentSlug]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`/api/books/${bookSlug}/chapters`);
        if (!alive) return;
        setChapters(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("[ChapterNavBar] load error", e);
        setChapters([]);
      } finally {
        alive && setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [bookSlug]);

  // Build index → chapter map (only numeric indexes)
  const byIndex = useMemo(() => {
    const m = new Map();
    for (const ch of chapters) {
      const idx = Number(ch.index);
      if (Number.isFinite(idx)) m.set(idx, ch);
    }
    return m;
  }, [chapters]);

  const { prev, next, bookTitle } = useMemo(() => {
    const res = { prev: null, next: null, bookTitle: overrideTitle || "Book" };
    if (!chapters.length) return res;

    // title fallback
    res.bookTitle =
      overrideTitle ||
      chapters[0]?.book_title ||
      chapters[0]?.book?.title ||
      chapters[0]?.title_of_book ||
      "Book";

    // find the current chapter in the list
    const current = chapters.find((c) => c.slug === currentSlug);
    if (!current) return res;

    const idx = Number(current.index);
    if (!Number.isFinite(idx)) return res; // can’t compute neighbors without an index

    // neighbors are simply index-1 / index+1 if they exist
    res.prev = byIndex.get(idx - 1) || null;
    res.next = byIndex.get(idx + 1) || null;
    return res;
  }, [chapters, currentSlug, byIndex, overrideTitle]);

  const prevHref = prev ? `/books/${bookSlug}/chapters/${prev.slug}` : null;
  const nextHref = next ? `/books/${bookSlug}/chapters/${next.slug}` : null;

  // Optional: keyboard shortcuts (skip when typing)
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || e.isComposing) return;
      if (e.key === "ArrowLeft" && prevHref) window.location.href = prevHref;
      if (e.key === "ArrowRight" && nextHref) window.location.href = nextHref;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevHref, nextHref]);

  const Btn = ({ href, dir }) => {
    const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
    const label = dir === "prev" ? "Previous chapter" : "Next chapter";
    const base =
      "grid place-items-center rounded border border-slate-300! transition " +
      "h-9 w-9 bg-white";
    if (!href) {
      return (
        <button
          type="button"
          aria-label={label}
          title={label}
          disabled
          className={`${base} text-gray-300 cursor-not-allowed`}
        >
          <Icon size={18} />
        </button>
      );
    }
    return (
      <a
        href={href}
        aria-label={label}
        title={label}
        className={`${base} border px-2 py-1 rounded
                   border-slate-200 bg-white hover:bg-slate-50
                   dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700`}
      >
        <Icon size={18} />
      </a>
    );
  };

  return (
    <div
      className={[
        "sticky z-30 w-full  bg-stone-100/90 dark:bg-stone-800/90 backdrop-blur text-slate-900 dark:text-neutral-100",
        "top-[calc(var(--reader-sticky-second-offset,0px))]",
        className,
      ].join(" ")}
      role="navigation"
      aria-label="Chapter navigation"
    >
      <div className="mx-auto max-w-3xl px-4">
        <div className="h-12 flex items-center gap-3">
          <Btn href={prevHref} dir="prev" />
          <div
            className="flex-1 text-center font-medium truncate select-none noto italic"
            title={loading ? "" : bookTitle}
          >
            {loading ? "…" : bookTitle}
          </div>
          <Btn href={nextHref} dir="next" />
        </div>
      </div>
    </div>
  );
}