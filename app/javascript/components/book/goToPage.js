// Turns a page number typed on a book's page into the chapter to open.
//
// Books converted from the printed edition (the Big Book, the Twelve and Twelve)
// carry printed page ranges on their chapters, so "59" means printed page 59.
// Books without them (daily readers, most others) fall back to counting
// chapters in order, so "12" opens the twelfth one.

export function hasPrintedPages(chapters) {
  return chapters.some((ch) => ch.first_page != null);
}

export function printedRange(chapters) {
  const pages = chapters.flatMap((ch) => [ch.first_page, ch.last_page]).filter((p) => p != null);
  return pages.length ? { first: Math.min(...pages), last: Math.max(...pages) } : null;
}

// Returns null for empty or unusable input, otherwise one of:
//   { mode: "printed", page, chapter, exact }  exact is false when the page falls between chapters
//   { mode: "order", page, total, chapter }
//   { mode: "printed" | "order", page, error }
export function resolvePage(chapters, input) {
  const text = String(input ?? "").trim().replace(/^p(age|g)?\.?\s*/i, "");
  if (!/^\d+$/.test(text) || !chapters?.length) return null;
  const page = parseInt(text, 10);

  if (hasPrintedPages(chapters)) {
    const range = printedRange(chapters);
    if (page < range.first || page > range.last) {
      return { mode: "printed", page, error: `This book's printed pages run ${range.first}–${range.last}.` };
    }
    const numbered = chapters.filter((ch) => ch.first_page != null);
    const hit = numbered.find((ch) => page >= ch.first_page && page <= (ch.last_page ?? ch.first_page));
    if (hit) return { mode: "printed", page, chapter: hit, exact: true };
    // Pages between chapters (part title pages and the like) open the chapter just before.
    const before = numbered.filter((ch) => ch.first_page <= page).sort((a, b) => b.first_page - a.first_page)[0];
    return { mode: "printed", page, chapter: before, exact: false };
  }

  if (page < 1 || page > chapters.length) {
    return { mode: "order", page, error: `This book has ${chapters.length} sections, so pick 1–${chapters.length}.` };
  }
  return { mode: "order", page, total: chapters.length, chapter: chapters[page - 1] };
}

// "Chapter 5: How It Works" for numbered chapters, the plain title otherwise.
export function chapterName(ch) {
  if (!ch) return "";
  if ((ch.kind || "chapter") === "chapter" && !ch.label && ch.number != null && !/^chapter\b/i.test(ch.title || "")) {
    return `Chapter ${ch.number}: ${ch.title}`;
  }
  return ch.title || "Untitled";
}
