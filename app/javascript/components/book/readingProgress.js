// Remembers the last chapter read in each book on this device, for the
// table of contents bookmark and the "Continue reading" button.
const KEY = "hb:last-read";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") || {};
  } catch {
    return {};
  }
}

export function lastReadFor(bookSlug) {
  return readAll()[bookSlug] || null;
}

export function rememberLastRead(bookSlug, chapterSlug) {
  if (!bookSlug || !chapterSlug) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [bookSlug]: chapterSlug }));
  } catch {}
}
