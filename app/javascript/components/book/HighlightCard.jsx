import React, { useEffect, useState } from "react";
import axios from "axios";
import { BookmarkPlus, ImageIcon, Link2, Trash2, X } from "lucide-react";
import HighlightNote from "./HighlightNote";
import ShareToTimeline from "./ShareToTimeline";
import { highlightUrl, shareLink } from "./highlightSharing";
import PictureShare from "../share/PictureShare";

export const HIGHLIGHT_PALETTE = {
  yellow: "#fef08a",
  lime: "#bef264",
  cyan: "#a5f3fc",
  pink: "#fbcfe8",
  orange: "#fed7aa",
};

export const highlightCss = (stored) => HIGHLIGHT_PALETTE[stored] || stored || HIGHLIGHT_PALETTE.yellow;

// "Adopted from Sam's highlight", linking to theirs while it's still there
export function AdoptedFrom({ from, className = "wb-hl-card__from" }) {
  if (!from) return null;
  const label = `Adopted from ${from.by ? `${from.by}'s` : "a shared"} highlight`;
  return (
    <p className={className}>
      <BookmarkPlus size={14} aria-hidden="true" />
      {from.url ? <a href={from.url}>{label}</a> : <span>{label}</span>}
    </p>
  );
}

// One highlight, opened by tapping it in the text: the quote, its note, and
// (for the reader who made it) color, share to timeline, share as a picture (PictureShare),
// share link and delete.
// Highlights stay with their reader until they pick Share to timeline.
// Someone else's highlight can be adopted (onAdopt): a copy in your own highlights, which then
// says whose it came from.
export default function HighlightCard({ highlight, onClose, bookSlug, chapterSlug, onChange, onDelete, onAdopt, adoptedCopy, onOpen, toast, startEditing = false }) {
  const [picturing, setPicturing] = useState(false);
  useEffect(() => {
    if (!highlight || picturing) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [highlight, onClose, picturing]);

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
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Highlight">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`wb wb-hl-card ${mine ? "wb-hl-card--actions" : ""} relative w-full sm:max-w-lg max-h-[85vh] overflow-auto shadow-xl bg-white dark:bg-neutral-900`}>
        <div className="wb-hl-card__head">
          <span className="wb-hl-card__title">{mine ? "Your highlight" : highlight.by ? `${highlight.by}'s highlight` : "Shared highlight"}</span>
          <button type="button" className="wb-btn wb-btn--icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {mine && <AdoptedFrom from={highlight.adopted_from} />}

        {quote && (
          <blockquote className="wb-hl-quote wb-hl-card__quote">
            <mark style={{ "--hl": highlightCss(highlight.style?.color) }}>{quote}</mark>
          </blockquote>
        )}

        <HighlightNote highlight={highlight} onChange={onChange} startEditing={startEditing} />

        {!mine && onAdopt && (
          <div className="wb-hl-card__foot">
            {adoptedCopy ? (
              <>
                <span className="wb-hl-card__adopted">It's in your highlights.</span>
                <span className="flex-1" />
                <button type="button" className="wb-btn" onClick={() => onOpen?.(adoptedCopy.id)}>Open yours</button>
              </>
            ) : (
              <>
                <span className="wb-hl-card__adopted">Keep this one in your own highlights, with a note of where it came from.</span>
                <span className="flex-1" />
                <button type="button" className="wb-btn wb-btn--reversed" onClick={() => onAdopt(highlight)}>
                  <BookmarkPlus size={16} aria-hidden="true" /> Adopt this highlight
                </button>
              </>
            )}
          </div>
        )}

        {mine && (
          // Pinned to the bottom of the sheet, so the actions stay in reach under a long note
          <div className="wb-hl-card__foot wb-hl-card__foot--actions">
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
            <div className="wb-hl-card__actions" role="group" aria-label="Highlight actions">
              <ShareToTimeline highlight={highlight} onChange={onChange} toast={toast} tile up align="left" />
              {!highlight.members_only && (
                <button type="button" className="wb-btn wb-hl-card__action" onClick={() => setPicturing(true)}>
                  <ImageIcon size={18} aria-hidden="true" /> <span>Picture</span>
                </button>
              )}
              <button type="button" className="wb-btn wb-hl-card__action" onClick={share}>
                <Link2 size={18} aria-hidden="true" /> <span>Copy link</span>
              </button>
              <button
                type="button"
                className="wb-btn wb-hl-card__action wb-hl-card__delete"
                onClick={() => {
                  if (window.confirm(highlight.note ? "Delete this highlight and its note?" : "Delete this highlight?")) onDelete?.(highlight.id);
                }}
              >
                <Trash2 size={18} aria-hidden="true" /> <span>Delete</span>
              </button>
            </div>
          </div>
        )}
      </div>
      {picturing && (
        <PictureShare onClose={() => setPicturing(false)} cardUrl={`/api/highlights/${highlight.id}/card`} kind="highlight" canVideo heading="Share as a picture or video"
          hasNote={!!highlight.note?.trim()} link={highlightUrl(bookSlug, chapterSlug, highlight)} title="A highlight" />
      )}
    </div>
  );
}
