import { useMemo, useRef, useEffect, useState } from "react";
import { Notebook, NotebookPen, Highlighter, X } from "lucide-react";

/**
 * Props:
 * - colors: array of css colors OR object name->css
 * - value: currently selected css color
 * - onChangeColor(css: string)
 * - onHighlight()
 * - onOpenModal()
 */
export default function ReaderBubbleMenu({
  colors = [],
  value,
  onChangeColor,
  onHighlight,
  onOpenModal,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  // normalize palette to array of CSS colors
  const swatches = useMemo(
    () => (Array.isArray(colors) ? colors : Object.values(colors || {})),
    [colors]
  );

  // close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // optional: click outside to close
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="fixed bottom-4 right-4 z-50 flex items-end justify-end gap-2"
      aria-live="polite"
    >
      {/* Sliding tray */}
      <div
        className={[
          "flex items-center gap-2 rounded-full border border-slate-300 bg-white shadow-xl px-2 py-3",
          "transition-all duration-200 will-change-transform",
          open
            ? "opacity-100 translate-x-0 pointer-events-auto"
            : "opacity-0 translate-x-2 pointer-events-none",
        ].join(" ")}
      >
        {/* Color swatches */}
        <div className="flex items-center gap-2 px-3">
          {swatches.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChangeColor?.(c)}
              className="w-6! h-6! rounded-full border border-slate-300 hover:border-slate-400! outline-offset-1 focus:outline-none"
              style={{
                backgroundColor: c,
                boxShadow: value === c ? "0 0 0 2px rgba(0,0,0,0.2)" : "none",
              }}
              aria-label={`Choose highlight color ${c}`}
              title={c}
            />
          ))}
        </div>

        {/* Highlight button */}
        <button
          type="button"
          onClick={() => onHighlight?.()}
          className="px-2 py-1 rounded-full! border border-slate-300 bg-white text-black hover:bg-gray-50 active:scale-[0.98] transition"
          title="Highlight selection"
          aria-label="Highlight selection"
        >
          <Highlighter size={18} />
        </button>

        {/* User highlights (Notebook) */}
        <button
          type="button"
          onClick={() => onOpenModal?.()}
          className="px-2 py-1 rounded-full! border border-slate-300 bg-white text-black hover:bg-gray-50 active:scale-[0.98] transition"
          title="Open your highlights"
          aria-label="Open your highlights"
        >
          <Notebook size={18} />
        </button>
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "h-13.5 w-13.5 rounded-full! border border-slate-300! bg-white text-black shadow-xl",
          "grid place-items-center transition-colors active:scale-[0.98]",
        ].join(" ")}
        aria-expanded={open}
        aria-label={open ? "Close reader menu" : "Open reader menu"}
        title={open ? "Close" : "Tools"}
      >
        {open ? <X size={20} /> : <NotebookPen size={20} />}
      </button>
    </div>
  );
}