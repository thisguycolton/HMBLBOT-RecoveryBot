// app/javascript/components/HighlightsModal.jsx
import { useEffect } from "react";
import { Link2, NotebookText, X } from "lucide-react";
import Markdown from "./book/Markdown";

// The highlights in this chapter. Tapping one jumps to it in the text; the
// reader who made them can also share one, or every highlight they've made.
export default function HighlightsModal({
  open,
  onClose,
  highlights,
  swatchOf,         // (h) => cssColor
  onJump,           // (id) => void
  onShare,          // (h) => void
  onShareAll,       // () => void
  sharedBy,         // first name when viewing someone else's highlights
  signedIn = true,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const mine = highlights.some((h) => h.mine);
  const title = sharedBy !== undefined && !mine ? `${sharedBy || "Shared"}${sharedBy ? "'s" : ""} highlights` : "Your highlights";

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="wb wb-hl-card relative w-full sm:max-w-2xl max-h-[85vh] overflow-auto shadow-xl bg-white dark:bg-neutral-900">
        <div className="wb-hl-card__head">
          <span className="wb-hl-card__title">{title}</span>
          <button type="button" className="wb-btn wb-btn--icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <ul className="wb-hl-list">
          {highlights.map((h) => (
            <li key={h.id} className="wb-hl-item">
              <div className="flex-1 min-w-0">
                <a
                  href={`#hl-${h.id}`}
                  className="wb-hl-quote"
                  onClick={(e) => { e.preventDefault(); onClose(); onJump(h.id); }}
                  title="Go to this highlight"
                >
                  <mark style={{ "--hl": swatchOf(h) }}>{h.selector?.quote?.exact || "…"}</mark>
                </a>
                {h.note && <Markdown source={h.note} className="wb-hl-item__note" />}
              </div>
              {h.mine && onShare && (
                <div className="wb-hl-actions">
                  <button type="button" className="wb-btn" onClick={() => onShare(h)} aria-label="Share this highlight">
                    <Link2 size={14} aria-hidden="true" /> Share
                  </button>
                </div>
              )}
            </li>
          ))}
          {highlights.length === 0 && (
            <li className="wb-hl-item justify-center opacity-70">No highlights in this chapter yet. Select some text to add one.</li>
          )}
        </ul>

        {signedIn && (mine || sharedBy === undefined) ? (
          <div className="wb-hl-card__foot">
            <a className="wb-btn" href="/library/highlights">
              <NotebookText size={15} aria-hidden="true" /> All my highlights
            </a>
            <span className="flex-1" />
            {onShareAll && (
              <button type="button" className="wb-btn wb-btn--reversed" onClick={onShareAll}>
                <Link2 size={15} aria-hidden="true" /> Share all my highlights
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
