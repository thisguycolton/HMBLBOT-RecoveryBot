import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

// How far (px) a finger has to travel before the swipe counts.
const PAGE_AT = 60;
const CLOSE_AT = 110;
const SLIDE_MS = 180;

// The shadow box: a picture filling the screen, with arrows (and the arrow keys) to page
// through the others. On touch screens a sideways swipe pages and an up or down swipe
// closes it. photos: [{ url, caption }]
export default function Lightbox({ photos, index, onClose }) {
  const [at, setAt] = useState(index);
  // The photo's offset while a finger drags it (or while it slides away).
  const [drag, setDrag] = useState({ x: 0, y: 0, animate: false });
  const touch = useRef(null);
  const busy = useRef(false);
  const count = photos.length;
  const go = (step) => setAt((i) => (i + step + count) % count);

  // Slides the photo off one side, swaps it, and slides the next one in from the other.
  const page = (step) => {
    if (count < 2 || busy.current) return;
    busy.current = true;
    const width = window.innerWidth;
    setDrag({ x: -step * width, y: 0, animate: true });
    setTimeout(() => {
      go(step);
      setDrag({ x: step * width, y: 0, animate: false });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setDrag({ x: 0, y: 0, animate: true });
        busy.current = false;
      }));
    }, SLIDE_MS);
  };

  const close = (dir = 0) => {
    if (!dir) return onClose();
    busy.current = true;
    setDrag({ x: 0, y: dir * window.innerHeight, animate: true });
    setTimeout(onClose, SLIDE_MS);
  };

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

  const onTouchStart = (e) => {
    if (busy.current || e.touches.length !== 1) { touch.current = null; return; }
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, axis: null };
  };

  const onTouchMove = (e) => {
    const start = touch.current;
    if (!start) return;
    if (e.touches.length !== 1) { touch.current = null; setDrag({ x: 0, y: 0, animate: true }); return; }
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (!start.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      start.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    // Kept on the ref too, so touchend reads where the finger got to without waiting on a render
    start.dx = dx;
    start.dy = dy;
    if (start.axis === "x") {
      // With one photo there is nowhere to go, so it only gives a little.
      setDrag({ x: count > 1 ? dx : dx / 4, y: 0, animate: false });
    } else {
      setDrag({ x: 0, y: dy, animate: false });
    }
  };

  const onTouchEnd = () => {
    const start = touch.current;
    touch.current = null;
    if (!start || !start.axis) return;
    if (start.axis === "x" && count > 1 && Math.abs(start.dx) > PAGE_AT) return page(start.dx < 0 ? 1 : -1);
    if (start.axis === "y" && Math.abs(start.dy) > CLOSE_AT) return close(start.dy < 0 ? -1 : 1);
    setDrag({ x: 0, y: 0, animate: true });
  };

  const photo = photos[at];
  if (!photo) return null;
  const arrow = "absolute top-1/2 -translate-y-1/2 grid size-11 place-items-center rounded-full !bg-white/10 text-white hover:!bg-white/20";
  // The backdrop fades as the photo is pulled up or down, so it reads as "letting go".
  const fade = Math.max(0.35, 1 - Math.abs(drag.y) / 500);
  const ease = drag.animate ? `transform ${SLIDE_MS}ms ease-out, opacity ${SLIDE_MS}ms ease-out` : "none";

  return createPortal(
    <div
      className="fixed inset-0 z-[3000] flex touch-none select-none flex-col !font-sans pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      style={{ backgroundColor: `rgba(0,0,0,${0.9 * fade})`, transition: drag.animate ? `background-color ${SLIDE_MS}ms ease-out` : "none" }}
      role="dialog" aria-modal="true" aria-label="Photo"
      onClick={() => close()}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
    >
      <div className="flex items-center justify-between px-4 py-3 text-sm text-white/80" style={{ opacity: fade }}>
        <span>{count > 1 ? `${at + 1} of ${count}` : ""}</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} className="grid size-10 place-items-center rounded-full !bg-white/10 text-white hover:!bg-white/20" aria-label="Close">
          <X className="size-5" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pb-4 sm:px-16">
        <img
          src={photo.url} alt={photo.caption || ""} draggable={false}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          style={{ transform: `translate3d(${drag.x}px, ${drag.y}px, 0)`, transition: ease }}
        />
        {count > 1 && (
          <>
            <button type="button" className={`${arrow} left-2 sm:left-4`} style={{ opacity: fade }} onClick={(e) => { e.stopPropagation(); page(-1); }} aria-label="Previous photo"><ChevronLeft className="size-6" /></button>
            <button type="button" className={`${arrow} right-2 sm:right-4`} style={{ opacity: fade }} onClick={(e) => { e.stopPropagation(); page(1); }} aria-label="Next photo"><ChevronRight className="size-6" /></button>
          </>
        )}
      </div>
      {photo.caption && <p className="px-4 pb-6 text-center text-sm text-white/85" style={{ opacity: fade }} onClick={(e) => e.stopPropagation()}>{photo.caption}</p>}
    </div>,
    document.body
  );
}
