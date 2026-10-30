import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { VISIBILITY, visibilityOf } from "./lib";

// Who sees a note or highlight on its owner's profile: Only me, Followers or Members.
// A small button that opens the three choices (above it with `up`). `options` swaps in
// other choices (HIGHLIGHT_VISIBILITY); `children` replaces the button's label, and then
// every choice can be picked (Share to timeline).
export default function VisibilityPicker({ value, onChange, disabled = false, align = "left", up = false, options = VISIBILITY, title = "Who sees this on your profile", className = "", children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = options.find((v) => v.value === value) || visibilityOf(value);
  const Icon = current.icon;

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc, true); };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        title={title}
        className={className || "inline-flex items-center gap-1.5 rounded-full !bg-transparent px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-neutral-300 hover:!bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:ring-neutral-700 dark:hover:!bg-neutral-800"}>
        {children || <><Icon className="size-3.5" /> <span className="wb-vis-label">{current.label}</span> <ChevronDown className="size-3" /></>}
      </button>
      {open && (
        <ul role="listbox" className={`absolute z-30 w-60 ${up ? "bottom-full mb-1" : "mt-1"} overflow-hidden rounded-xl bg-white p-1 shadow-lg ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700 ${align === "right" ? "right-0" : "left-0"}`}>
          {options.map((v) => {
            const VIcon = v.icon;
            const picked = !children && v.value === current.value;
            return (
              <li key={v.value}>
                <button type="button" role="option" aria-selected={picked}
                  onClick={() => { setOpen(false); if (!picked) onChange(v.value); }}
                  className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left ${picked ? "!bg-accent/10" : "!bg-transparent hover:!bg-neutral-100 dark:hover:!bg-neutral-800"}`}>
                  <VIcon className={`mt-0.5 size-4 shrink-0 ${picked ? "text-accent" : "text-slate-500"}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">{v.label}</span>
                    <span className="block text-xs text-slate-500 dark:text-neutral-400">{v.note}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
