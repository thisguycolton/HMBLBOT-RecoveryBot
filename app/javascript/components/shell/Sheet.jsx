import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { swipeToDismiss } from "../../lib/swipe";

const SIDES = {
  left: "inset-y-0 left-0 w-[min(22rem,88vw)] rounded-r-[28px]",
  right: "inset-y-0 right-0 w-[min(24rem,92vw)] rounded-l-[28px]",
  bottom: "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[28px]",
};

// How far the stage slides aside for a pushed sheet (Layout.jsx), and so the sheet's width
export const PUSH_WIDTH = { left: "min(22rem, 85vw)", right: "min(24rem, 85vw)" };

// A panel that slides over the page on phones: the menu (left), Today or the page's side panel
// (right) and quick actions (bottom). Escape, the backdrop or swiping it back the way it came
// closes it. A `push` sheet lies
// under the stage instead, and the shell slides the stage aside to show it (Layout.jsx).
export default function Sheet({ open, onClose, side = "left", label, push = false, children, className = "" }) {
  const root = useRef(null);
  const panel = useRef(null);
  const backdrop = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  // A pushed sheet is swiped closed by the shell, which moves the page over it (Layout.jsx)
  useEffect(() => {
    if (!open || push) return undefined;
    return swipeToDismiss(root.current, {
      directions: [{ left: "left", right: "right", bottom: "down" }[side]],
      targets: () => [panel.current],
      flyOut: true,
      onDrag: (p) => { if (backdrop.current) backdrop.current.style.opacity = p ? String(1 - p) : ""; },
      onDismiss: () => close.current(),
    });
  }, [open, push, side]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [open, onClose]);
  if (!open) return null;

  if (push) {
    return createPortal(
      <div role="dialog" aria-modal="true" aria-label={label} style={{ width: PUSH_WIDTH[side] }}
        className={`shell-sheet fixed inset-y-0 z-[2100] flex flex-col overflow-hidden bg-[#ececec] !font-sans dark:bg-neutral-950 ${side === "left" ? "left-0" : "right-0"} ${className}`}>
        {children}
      </div>,
      document.body
    );
  }

  return createPortal(
    <div ref={root} className="shell-sheet fixed inset-0 z-[2200] !font-sans" role="dialog" aria-modal="true" aria-label={label}>
      <button ref={backdrop} type="button" aria-label="Close" className="absolute inset-0 !bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={panel} className={`absolute flex flex-col overflow-hidden bg-[#ececec] shadow-2xl dark:bg-neutral-950 ${SIDES[side]} ${className}`}>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function SheetClose({ onClose, className = "" }) {
  return (
    <button type="button" onClick={onClose} aria-label="Close"
      className={`inline-grid size-9 place-items-center rounded-full !bg-white/80 text-slate-700 hover:!bg-white dark:!bg-neutral-800 dark:text-neutral-200 ${className}`}>
      <X className="size-4" />
    </button>
  );
}
