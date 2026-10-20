import React from "react";
import { X } from "lucide-react";

// The card for a note's first link: its picture, site, title and description, as our
// server read them (LinkPreview). With `onRemove` (writing a note) it has an X to drop it.
export default function LinkCard({ link, onRemove, loading = false }) {
  if (loading) return <div className="wb-link-card wb-link-card--loading" aria-live="polite">Getting a preview of the link…</div>;
  if (!link) return null;
  return (
    <div className="wb-link-card">
      <a href={link.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="wb-link-card__link">
        {link.image_url && <img src={link.image_url} alt="" loading="lazy" className="wb-link-card__image" />}
        <span className="wb-link-card__text">
          <span className="wb-link-card__site">{link.site_name}</span>
          <span className="wb-link-card__title">{link.title}</span>
          {link.description && <span className="wb-link-card__description">{link.description}</span>}
        </span>
      </a>
      {onRemove && (
        <button type="button" className="wb-link-card__remove" onClick={onRemove} aria-label="Remove the link preview" title="Remove the link preview">
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// The first web address in a note's text (bare or in a [label](link)), if any
export function firstLink(text) {
  const m = (text || "").match(/https?:\/\/[^\s<>()[\]]+[^\s<>()[\].,;:!?'"]/i);
  return m ? m[0] : null;
}
