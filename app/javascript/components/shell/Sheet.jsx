import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const SIDES = {
  left: "inset-y-0 left-0 w-[min(22rem,88vw)] rounded-r-[28px]",
  right: "inset-y-0 right-0 w-[min(24rem,92vw)] rounded-l-[28px]",
  bottom: "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-[28px]",
};

// A panel that slides over the page on phones: the menu (left), Today or the page's side panel
// (right) and quick actions (bottom). Escape or the backdrop closes it.
export default function Sheet({ open, onClose, side = "left", label, children, className = "" }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [open, onClose]);
  if (!open) return null;

  return createPortal(
    <div className="shell-sheet fixed inset-0 z-[2200] !font-sans" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" aria-label="Close" className="absolute inset-0 !bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`absolute flex flex-col overflow-hidden bg-[#ececec] shadow-2xl dark:bg-neutral-950 ${SIDES[side]} ${className}`}>
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
