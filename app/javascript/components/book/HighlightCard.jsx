import React, { useEffect } from "react";
import axios from "axios";
import { Link2, Trash2, X } from "lucide-react";
import HighlightNote from "./HighlightNote";
import ShareToTimeline from "./ShareToTimeline";
import { highlightUrl, shareLink } from "./highlightSharing";

export const HIGHLIGHT_PALETTE = {
  yellow: "#fef08a",
  lime: "#bef264",
  cyan: "#a5f3fc",
  pink: "#fbcfe8",
  orange: "#fed7aa",
};

export const highlightCss = (stored) => HIGHLIGHT_PALETTE[stored] || stored || HIGHLIGHT_PALETTE.yellow;

// One highlight, opened by tapping it in the text: the quote, its note, and
// (for the reader who made it) color, share to timeline, share link and delete.
// Highlights stay with their reader until they pick Share to timeline.
export default function HighlightCard({ highlight, onClose, bookSlug, chapterSlug, onChange, onDelete, toast, startEditing = false }) {
  useEffect(() => {
    if (!highlight) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [highlight, onClose]);

  if (!highlight) return null;

  const mine = !!highlight.mine;
  const quote = highlight.selector?.quote?.exact || "";

  async function recolor(name) {
    const previous = highlight;
    onChange?.({ ...highlight, style: { ...highlight.style, color: name } });
    try {
      await axios.patch(`/api/highlights/${highlight.id}`, { highlight: { style: { color: name } } });
    } catch {
      onChange?.(previous);
      toast?.("Couldn't change the color", { tone: "error" });
    }
  }

  async function share() {
    const result = await shareLink(highlightUrl(bookSlug, chapterSlug, highlight), {
      title: "A highlight",
      text: quote ? `“${quote.slice(0, 140)}${quote.length > 140 ? "…" : ""}”` : undefined,
    });
    if (result === "copied") toast?.("Link to this highlight copied");
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Highlight">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="wb wb-hl-card relative w-full sm:max-w-lg max-h-[85vh] overflow-auto shadow-xl bg-white dark:bg-neutral-900">
        <div className="wb-hl-card__head">
          <span className="wb-hl-card__title">{mine ? "Your highlight" : highlight.by ? `${highlight.by}'s highlight` : "Shared highlight"}</span>
          <button type="button" className="wb-btn wb-btn--icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {quote && (
          <blockquote className="wb-hl-quote wb-hl-card__quote">
            <mark style={{ "--hl": highlightCss(highlight.style?.color) }}>{quote}</mark>
          </blockquote>
        )}

        <HighlightNote highlight={highlight} onChange={onChange} startEditing={startEditing} />

        {mine && (
          <div className="wb-hl-card__foot">
            <div className="wb-hl-card__swatches" role="group" aria-label="Highlight color">
              {Object.entries(HIGHLIGHT_PALETTE).map(([name, css]) => (
                <button
                  key={name}
                  type="button"
                  className="wb-selection-pop__swatch wb-hl-card__swatch"
                  style={{ backgroundColor: css }}
                  aria-label={name}
                  aria-pressed={highlightCss(highlight.style?.color) === css}
                  onClick={() => recolor(name)}
                />
              ))}
            </div>
            <span className="flex-1" />
            <ShareToTimeline highlight={highlight} onChange={onChange} toast={toast} up />
            <button type="button" className="wb-btn" onClick={share}>
              <Link2 size={15} aria-hidden="true" /> Copy link
            </button>
            <button
              type="button"
              className="wb-btn wb-hl-card__delete"
              onClick={() => {
                if (window.confirm(highlight.note ? "Delete this highlight and its note?" : "Delete this highlight?")) onDelete?.(highlight.id);
              }}
            >
              <Trash2 size={15} aria-hidden="true" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
