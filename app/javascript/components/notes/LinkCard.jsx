import React from "react";
import { X } from "lucide-react";
import { Bone, SkeletonGroup } from "../ui/Skeleton";

// The card for a note's first link: its picture, site, title and description, as our
// server read them (LinkPreview). With `onRemove` (writing a note) it has an X to drop it.
export default function LinkCard({ link, onRemove, loading = false }) {
  if (loading) {
    // The card's shape while our server reads the page: a picture, then the site and the title
    return (
      <SkeletonGroup label="Getting a preview of the link" className="wb-link-card">
        <Bone rounded="rounded-none" className="aspect-[1.91/1] max-h-48 w-full" />
        <span className="block space-y-2 px-3.5 py-3">
          <Bone className="h-2.5 w-20" />
          <Bone className="h-3.5 w-3/4" />
          <Bone className="h-3 w-1/2" />
        </span>
      </SkeletonGroup>
    );
  }
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
