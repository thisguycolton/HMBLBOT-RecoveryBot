import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { SheetClose } from "../../shell/Sheet";

// A box over the page for the chat's forms: a sheet from the bottom on phones, in the middle
// on wide screens (like FollowListModal). Esc or the backdrop closes it.
export default function Dialog({ title, onClose, children, footer = null, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[2200] flex items-end justify-center !font-sans sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 !bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl dark:bg-neutral-900 sm:max-h-[min(44rem,90dvh)] sm:rounded-[28px] ${wide ? "sm:max-w-xl" : "sm:max-w-md"}`}>
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-5">
          <h2 className="min-w-0 truncate text-xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h2>
          <SheetClose onClose={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 text-sm text-slate-700 dark:text-neutral-200">{children}</div>
        {footer && <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-neutral-800">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
