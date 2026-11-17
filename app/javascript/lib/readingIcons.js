// A service reading's icon is a Lucide icon name ("bird"). Readings saved by the old Rails
// form hold a Bootstrap icon class ("bi-peace") instead, so every place that draws one runs
// it through readingIconName first. LucideIcon shows its fallback for anything unknown.
const BOOTSTRAP_TO_LUCIDE = {
  "bi-peace": "bird",
  "bi-list-ol": "list-ordered",
  "bi-people": "users",
  "bi-book": "book",
  "bi-stars": "sparkles",
  "bi-calendar-check": "calendar-check",
  "bi-gear": "settings",
  "bi-clock": "clock",
  "bi-trash": "trash",
  "bi-check-circle": "circle-check",
  "bi-heart": "heart",
  "bi-chat-quote": "message-square-quote",
};

export function readingIconName(icon) {
  const value = String(icon || "").trim().replace(/^bi\s+/, "");
  if (!value) return null;
  return BOOTSTRAP_TO_LUCIDE[value] || value.replace(/^bi-/, "") || null;
}

// The icon for readings that share a title: the first one that has an icon picked
export function groupIconName(readings = []) {
  for (const reading of readings) {
    const name = readingIconName(reading?.icon);
    if (name) return name;
  }
  return null;
}
