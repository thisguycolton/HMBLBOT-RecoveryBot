import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Link2, Trash2 } from "lucide-react";
import HighlightNote from "./HighlightNote";
import { highlightCss } from "./HighlightCard";
import ShareToTimeline from "./ShareToTimeline";
import { allHighlightsUrl, highlightUrl, shareLink, useToast } from "./highlightSharing";

// /library/highlights         every highlight you've made, across books (notes editable)
// /library/highlights/:token  someone's shared highlights (notes read-only)
export default function HighlightsPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [toast, toastNode] = useToast();

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    axios
      .get("/api/highlights/collection", { params: token ? { share: token } : {} })
      .then(({ data }) => alive && setData(data))
      .catch((e) => {
        if (!alive) return;
        const status = e?.response?.status;
        setError(
          status === 401 ? "signin"
          : status === 404 ? (e.response.data?.error || "That share link isn't valid anymore.")
          : "Couldn't load highlights. Try again."
        );
      });
    return () => { alive = false; };
  }, [token]);

  const mine = !!data?.owner?.mine;
  const name = data?.owner?.first_name;
  const title = mine ? "Your highlights" : name ? `${name}'s highlights` : "Shared highlights";

  useEffect(() => {
    document.title = title;
  }, [title]);

  const groups = useMemo(() => {
    const books = [];
    for (const h of data?.highlights || []) {
      let book = books.find((b) => b.slug === h.book_slug);
      if (!book) books.push((book = { slug: h.book_slug, title: h.book_title, chapters: [] }));
      let ch = book.chapters.find((c) => c.slug === h.chapter_slug);
      if (!ch) book.chapters.push((ch = { slug: h.chapter_slug, title: h.chapter_title, items: [] }));
      ch.items.push(h);
    }
    return books;
  }, [data]);

  const linkFor = (h) => {
    const base = `/books/${h.book_slug}/chapters/${h.chapter_slug}`;
    if (mine) return `${base}#hl-${h.id}`;
    return `${base}?share=${encodeURIComponent(token)}#hl-${h.id}`;
  };

  const update = (next) =>
    setData((d) => ({ ...d, highlights: d.highlights.map((h) => (h.id === next.id ? { ...h, ...next } : h)) }));

  async function remove(h) {
    if (!window.confirm(h.note ? "Delete this highlight and its note?" : "Delete this highlight?")) return;
    try {
      await axios.delete(`/api/highlights/${h.id}`);
      setData((d) => ({ ...d, highlights: d.highlights.filter((x) => x.id !== h.id) }));
      toast("Highlight deleted");
    } catch {
      toast("Couldn't delete that highlight", { tone: "error" });
    }
  }

  async function shareOne(h) {
    const result = await shareLink(highlightUrl(h.book_slug, h.chapter_slug, h), { title: h.chapter_title });
    if (result === "copied") toast("Link to this highlight copied");
  }

  async function shareAll() {
    try {
      const result = await shareLink(await allHighlightsUrl(), { title: "My highlights" });
      if (result === "copied") toast("Link to all your highlights copied");
    } catch {
      toast("Couldn't make a share link", { tone: "error" });
    }
  }

  if (error === "signin") {
    return (
      <div className="wb wb-hl-page">
        <h1 className="wb-hl-page__title">Your highlights</h1>
        <p>
          <a className="wb-btn wb-btn--reversed" href="/users/sign_in">Sign in</a> to see the highlights and notes you've made.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wb wb-hl-page">
        <h1 className="wb-hl-page__title">Highlights</h1>
        <p>{error}</p>
        <p><a href="/library">Back to the library</a></p>
      </div>
    );
  }

  if (!data) return <div className="wb wb-hl-page opacity-70">Loading…</div>;

  return (
    <div className="wb wb-hl-page">
      <header className="wb-hl-page__head">
        <div>
          <h1 className="wb-hl-page__title">{title}</h1>
          <p className="wb-hl-page__meta">
            {data.highlights.length} {data.highlights.length === 1 ? "highlight" : "highlights"}
            {!mine && " · notes are read-only"}
          </p>
        </div>
        {mine && data.highlights.length > 0 && (
          <button type="button" className="wb-btn wb-btn--reversed" onClick={shareAll}>
            <Link2 size={15} aria-hidden="true" /> Share all
          </button>
        )}
      </header>

      {groups.length === 0 && (
        <p className="opacity-70">
          {mine ? "No highlights yet. Select text while reading to add one." : "Nothing shared here yet."}
        </p>
      )}

      {groups.map((book) => (
        <section key={book.slug} className="wb-hl-page__book">
          <h2 className="wb-hl-page__book-title">
            <a href={`/library/${book.slug}`}>{book.title}</a>
          </h2>
          {book.chapters.map((ch) => (
            <div key={ch.slug} className="wb-hl-page__chapter">
              <h3 className="wb-hl-page__chapter-title">
                <a href={`/books/${book.slug}/chapters/${ch.slug}`}>{ch.title}</a>
              </h3>
              <ul className="wb-hl-list">
                {ch.items.map((h) => (
                  <li key={h.id} className="wb-hl-item">
                    <div className="flex-1 min-w-0">
                      <a className="wb-hl-quote" href={linkFor(h)} title="Read it in context">
                        <mark style={{ "--hl": highlightCss(h.style?.color) }}>{h.quote || "…"}</mark>
                      </a>
                      <HighlightNote highlight={h} onChange={update} compact />
                    </div>
                    {mine && (
                      <div className="wb-hl-actions">
                        <ShareToTimeline highlight={h} onChange={update} toast={toast} iconOnly />
                        <button type="button" className="wb-btn wb-btn--icon" onClick={() => shareOne(h)} aria-label="Copy a link to this highlight" title="Copy link">
                          <Link2 size={15} />
                        </button>
                        <button type="button" className="wb-btn wb-btn--icon" onClick={() => remove(h)} aria-label="Delete this highlight" title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}

      {toastNode}
    </div>
  );
}
