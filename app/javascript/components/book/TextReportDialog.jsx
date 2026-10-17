import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { TriangleAlert, X } from "lucide-react";

// "Report a problem with this text": the selected quote and what's wrong with it.
// Admins review reports in the admin suite.
export default function TextReportDialog({ selector, bookSlug, chapterSlug, onClose, onSent }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const textRef = useRef(null);

  useEffect(() => {
    if (!selector) return;
    setMessage("");
    setError(null);
    textRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selector, onClose]);

  if (!selector) return null;
  const quote = selector.quote?.exact || "";

  async function send(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    try {
      await axios.post("/api/text_reports", {
        text_report: { chapter_slug: chapterSlug, book_slug: bookSlug, message, selector },
      });
      onSent?.();
    } catch (err) {
      setError(err?.response?.status === 401 ? "Sign in to report a problem." : err?.response?.data?.error || "Couldn't send the report. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Report a problem with this text">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form onSubmit={send} className="wb wb-hl-card relative w-full sm:max-w-lg max-h-[85vh] overflow-auto shadow-xl bg-white dark:bg-neutral-900">
        <div className="wb-hl-card__head">
          <span className="wb-hl-card__title inline-flex items-center gap-2">
            <TriangleAlert size={16} aria-hidden="true" /> Report a problem
          </span>
          <button type="button" className="wb-btn wb-btn--icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <blockquote className="wb-hl-quote wb-hl-card__quote">{quote.length > 600 ? `${quote.slice(0, 600)}…` : quote}</blockquote>

        <div className="wb-hl-note wb-hl-note--editing">
          <textarea
            ref={textRef}
            className="wb-hl-note__input"
            value={message}
            rows={4}
            maxLength={5000}
            placeholder="What's wrong? A typo, a missing word, text in the wrong place… If you know the correct wording, add it here."
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send(e);
            }}
          />
          {error && <p className="wb-hl-note__error" role="alert">{error}</p>}
          <div className="wb-hl-note__actions">
            <span className="flex-1" />
            <button type="button" className="wb-btn" onClick={onClose} disabled={sending}>Cancel</button>
            <button type="submit" className="wb-btn wb-btn--reversed" disabled={sending || !message.trim()}>
              {sending ? "Sending…" : "Send report"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
