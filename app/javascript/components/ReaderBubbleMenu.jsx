import { useMemo, useRef, useEffect, useState } from "react";
import { Notebook, NotebookPen, Highlighter, X, Moon, Sun } from "lucide-react";

/**
 * Props:
 * - colors: array<string> OR object {name: cssColor}
 * - value: string (current css color)
 * - onChangeColor(css: string)
 * - onHighlight()
 * - onOpenModal()    // still opens your full modal list if you want it
 * - onToggleTheme()  // <- NEW
 * - isDark: boolean  // <- NEW (controls sun/moon icon)
 */
export default function ReaderBubbleMenu({
  colors = [],
  value,
  onChangeColor,
  onHighlight,
  onOpenModal,
  onToggleTheme,     // NEW
  isDark = false,    // NEW
}) {
  // main menu (FAB) just opens/closes the small tool chip if you keep it
  const [openFab, setOpenFab] = useState(false);

  // the HIGHLIGHTS TRAY that slides out from the Highlights button
  const [trayOpen, setTrayOpen] = useState(false);
  const trayRef = useRef(null);
  const rootRef = useRef(null);
  const hlBtnRef = useRef(null);

  // normalize palette -> array
  const swatches = useMemo(
    () => (Array.isArray(colors) ? colors : Object.values(colors || {})),
    [colors]
  );

  // Close tray on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setTrayOpen(false);
        setOpenFab(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click outside closes tray
  useEffect(() => {
    if (!trayOpen) return;
    const onDoc = (e) => {
      if (!trayRef.current) return;
      const clickedInsideTray = trayRef.current.contains(e.target);
      const clickedAnchor = hlBtnRef.current?.contains(e.target);
      if (!clickedInsideTray && !clickedAnchor) setTrayOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [trayOpen]);

  return (
        <div className="fixed bottom-4 right-4 z-50 flex items-end justify-end gap-3">
      {/* Highlight Options (NotebookPen) */}
      <div className="relative">
        <button
          ref={hlBtnRef}
          type="button"
          onClick={() => setTrayOpen((v) => !v)}
          className="size-12 grid place-items-center rounded-full border
                     border-slate-300 bg-stone-100 text-slate-900 shadow-xl
                     active:scale-[0.98] transition
                     dark:border-slate-500 dark:bg-neutral-600 dark:hover:bg-neutral-800 dark:text-stone-100"
          title={trayOpen ? "Close highlight options" : "Open highlight options"}
          aria-expanded={trayOpen}
          aria-label="Highlight options"
        >
          <NotebookPen size={18} />
        </button>

        {/* Vertical tray that slides out from NotebookPen */}
        <div
          ref={trayRef}
          className={[
            "absolute bottom-14 right-1 origin-bottom-right",
            "transition-all duration-200 will-change-transform",
            trayOpen
              ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
              : "opacity-0 translate-y-2 scale-95 pointer-events-none",
          ].join(" ")}
        >
          <div
            className="flex flex-col items-stretch gap-2 p-2 w-[220px]
                       rounded-2xl border border-slate-300 bg-white shadow-2xl
                       dark:border-neutral-700 dark:bg-neutral-800"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-neutral-300">
                Highlights
              </div>
              <button
                type="button"
                onClick={() => setTrayOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-700"
                aria-label="Close highlights tray"
              >
                <X size={16} />
              </button>
            </div>

            {/* Color swatches */}
            <div className="grid grid-cols-6 gap-2">
              {swatches.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChangeColor?.(c)}
                  className="h-6 w-6 rounded-full border border-slate-300
                             hover:ring-2 ring-offset-1 ring-offset-white ring-slate-400
                             dark:border-slate-500 dark:hover:ring-neutral-400 dark:ring-offset-neutral-800"
                  style={{
                    backgroundColor: c,
                    boxShadow: value === c ? "inset 0 0 0 2px rgba(0,0,0,.35)" : "none",
                  }}
                  aria-label={`Choose highlight color ${c}`}
                  title={c}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onHighlight?.()}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border
                           border-slate-300 bg-white text-slate-900 hover:bg-gray-50 active:scale-[0.98] transition
                           dark:border-slate-500 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
                title="Highlight selection"
              >
                <Highlighter size={16} />
                <span className="text-sm">Highlight</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenModal?.()}
                className="inline-flex items-center justify-center rounded-md border px-2 py-1
                           border-slate-300 bg-white text-slate-900 hover:bg-gray-50 active:scale-[0.98] transition
                           dark:border-slate-500 dark:bg-neutral-900 dark:text-stone-100 dark:hover:bg-neutral-700"
                title="Open all highlights"
                aria-label="Open all highlights"
              >
                <Notebook size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dark/Light toggle (Sun/Moon) */}
      <button
        type="button"
        onClick={onToggleTheme}
        className="size-12 grid place-items-center rounded-full border
                   border-slate-300 bg-white text-slate-900 shadow-xl
                   active:scale-[0.98] transition
                   dark:border-slate-500 dark:bg-neutral-600 dark:hover:bg-neutral-800 dark:text-stone-100 "
        title={isDark ? "Switch to light" : "Switch to dark"}
        aria-label="Toggle theme"
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  );
}