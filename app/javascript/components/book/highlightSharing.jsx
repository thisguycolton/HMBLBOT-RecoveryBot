import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Check } from "lucide-react";

// Links:
//   one highlight   /books/:book/chapters/:chapter?hl=SHARE_ID#hl-ID   (reveals only that highlight)
//   all highlights  /library/highlights/SHARE_TOKEN
export function highlightUrl(bookSlug, chapterSlug, h) {
  const base = `${location.origin}/books/${bookSlug}/chapters/${chapterSlug}`;
  return h?.share_id ? `${base}?hl=${encodeURIComponent(h.share_id)}#hl-${h.id}` : `${base}#hl-${h?.id}`;
}

export async function allHighlightsUrl() {
  const { data } = await axios.post("/api/highlights/share");
  return `${location.origin}/library/highlights/${encodeURIComponent(data.share_token)}`;
}

// Opens the share sheet on phones, copies the link elsewhere. Resolves to
// "shared", "copied" or "cancelled".
export async function shareLink(url, { title, text } = {}) {
  const touch = window.matchMedia?.("(pointer: coarse)").matches;
  if (touch && navigator.share) {
    try {
      await navigator.share({ url, title, text });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    window.prompt("Copy this link:", url);
  }
  return "copied";
}

export function useToast() {
  const [message, setMessage] = useState(null);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2600);
    return () => clearTimeout(t);
  }, [message]);
  const toast = useCallback((m) => setMessage(m), []);
  const node = message ? (
    <div className="wb-toast" role="status" aria-live="polite">
      <Check size={16} aria-hidden="true" /> {message}
    </div>
  ) : null;
  return [toast, node];
}
