import React, { useCallback } from "react";
import axios from "axios";
import { showToast } from "../../lib/toast";

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

// The reader's toasts go through the app-wide queue (components/Toasts.jsx).
// Returns [toast, node] like before; node is null because <Toasts /> draws them.
export function useToast() {
  const toast = useCallback((m, options) => showToast(m, { tone: "success", ...options }), []);
  return [toast, null];
}
