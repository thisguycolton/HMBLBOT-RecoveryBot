import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

// The shadow box: a picture filling the screen, with arrows (and the arrow keys) to page
// through the others. photos: [{ url, caption }]
export default function Lightbox({ photos, index, onClose }) {
  const [at, setAt] = useState(index);
  const count = photos.length;
  const go = (step) => setAt((i) => (i + step + count) % count);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && count > 1) go(-1);
      if (e.key === "ArrowRight" && count > 1) go(1);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [count]);

  const photo = photos[at];
  if (!photo) return null;
  const arrow = "absolute top-1/2 -translate-y-1/2 grid size-11 place-items-center rounded-full !bg-white/10 text-white hover:!bg-white/20";

  return createPortal(
    <div className="fixed inset-0 z-[3000] flex flex-col bg-black/90 !font-sans" role="dialog" aria-modal="true" aria-label="Photo" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 text-sm text-white/80">
        <span>{count > 1 ? `${at + 1} of ${count}` : ""}</span>
        <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full !bg-white/10 text-white hover:!bg-white/20" aria-label="Close">
          <X className="size-5" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4 sm:px-16" onClick={(e) => e.stopPropagation()}>
        <img src={photo.url} alt={photo.caption || ""} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
        {count > 1 && (
          <>
            <button type="button" className={`${arrow} left-2 sm:left-4`} onClick={() => go(-1)} aria-label="Previous photo"><ChevronLeft className="size-6" /></button>
            <button type="button" className={`${arrow} right-2 sm:right-4`} onClick={() => go(1)} aria-label="Next photo"><ChevronRight className="size-6" /></button>
          </>
        )}
      </div>
      {photo.caption && <p className="px-4 pb-6 text-center text-sm text-white/85" onClick={(e) => e.stopPropagation()}>{photo.caption}</p>}
    </div>,
    document.body
  );
}
