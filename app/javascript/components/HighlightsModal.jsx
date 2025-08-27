// app/javascript/components/HighlightsModal.jsx
import { X } from "lucide-react";

export default function HighlightsModal({
  open,
  onClose,
  highlights,
  swatchOf,         // (h) => cssColor
  onJump,           // (id) => void
  onDelete,         // (id) => void
  MiddleTruncate,   // pass your component for responsive truncation
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
                      w-full sm:w-[640px] max-h-[80vh] overflow-auto rounded-2xl bg-white dark:bg-neutral-900 shadow-xl border border-slate-200 dark:border-slate-600">
        <div className="flex items-center justify-between px-4 py-3 border-b  border-slate-200 dark:border-slate-600">
          <div className="font-semibold">Your highlights</div>
          <button className="p-1 rounded border  border-slate-200 dark:border-slate-600 bg-white  dark:bg-neutral-900" onClick={onClose} aria-label="Close">
            <X size={16}/>
          </button>
        </div>

        <ul className="p-3 space-y-1">
          {highlights.map((h) => {
            const color = swatchOf(h);
            const text  = h.selector?.quote?.exact || "…";
            return (
              <li key={h.id} className="flex items-start gap-3">
                <span className="inline-block w-3 h-3 rounded mt-1 shrink-0" style={{ backgroundColor: color }} />
                <button
                  type="button"
                  className="flex-1 text-left hover:bg-gray-50 dark:hover:bg-neutral-500 rounded px-2 py-1"
                  onClick={() => { onJump(h.id); onClose(); }}
                  title="Jump to highlight"
                >
                  <MiddleTruncate text={text} className="block min-w-0 w-full" paddingPx={8} />
                </button>
                <button
                  type="button"
                  className="text-red-600 hover:underline shrink-0 mt-1"
                  onClick={() => onDelete(h.id)}
                >
                  delete
                </button>
              </li>
            );
          })}
          {highlights.length === 0 && (
            <li className="text-sm text-slate-500 px-2 py-6 text-center">No highlights yet</li>
          )}
        </ul>
      </div>
    </div>
  );
}