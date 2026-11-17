import { pagesOf } from "./stepText";

// Changing a worksheet's pages in the HumbleBot Editor. A page starts at a section with `page`
// (its title) and `page_line` (a sentence under it); see pagesOf. While no section has `page`
// the pages are worked out automatically, so the first change "pins" them: each page's first
// section gets `page`, and from then on only those start pages. Every function takes the
// sections and returns new ones.

const marker = ["page", "page_line"];
const without = (s) => { const out = { ...s }; marker.forEach((k) => delete out[k]); return out; };
const pagesFor = (sections) => pagesOf({ sections }, { all: true });

export function pinPages(sections) {
  if (sections.some((s) => s.page)) return sections;
  const titles = new Map(pagesFor(sections).map((p) => [p.id, p.title]));
  return sections.map((s) => (titles.has(s.id) ? { ...s, page: titles.get(s.id) } : s));
}

// A page's title and line. A title being typed may be empty for a moment: it's kept as a space
// (so the page still starts there) and saving (tidy) falls back to the section's title.
export function setPage(sections, pageId, patch) {
  return pinPages(sections).map((s) => {
    if (s.id !== pageId) return s;
    const next = { ...s, ...patch };
    if ("page" in patch && !patch.page) next.page = " ";
    return next;
  });
}

// Start a new page at this section
export function splitAt(sections, sectionId) {
  return pinPages(sections).map((s) => (s.id === sectionId ? { ...s, page: s.title || "New page" } : s));
}

// Put this page's sections at the end of the page above. Not for a page that starts a part
// (a part always starts a page).
export function mergeUp(sections, pageId) {
  const pinned = pinPages(sections);
  if (pinned[0]?.id === pageId) return pinned;
  return pinned.map((s) => (s.id === pageId ? without(s) : s));
}

// Take a section out, handing its page's title to the next section on that page
export function dropSection(sections, sectionId) {
  const page = pagesFor(sections).find((p) => p.sections.some((s) => s.id === sectionId));
  const gone = sections.find((s) => s.id === sectionId);
  let list = sections.filter((s) => s.id !== sectionId);
  if (gone?.page && page) {
    const next = page.sections[page.sections.findIndex((s) => s.id === sectionId) + 1];
    if (next) list = list.map((s) => (s.id === next.id ? { ...s, page: gone.page, page_line: gone.page_line } : s));
  }
  return list;
}

// Move a section to the end of another page
export function moveToPage(sections, sectionId, targetPageId) {
  const pinned = pinPages(sections);
  const pages = pagesFor(pinned);
  const from = pages.find((p) => p.sections.some((s) => s.id === sectionId));
  const target = pages.find((p) => p.id === targetPageId);
  if (!from || !target || from.id === target.id) return pinned;
  const moving = without(pinned.find((s) => s.id === sectionId));
  const list = dropSection(pinned, sectionId);
  const last = target.sections[target.sections.length - 1].id;
  list.splice(list.findIndex((s) => s.id === last) + 1, 0, moving);
  return list;
}

// Move a section up or down within its page; the page's title stays at the top of the page
export function moveInPage(sections, sectionId, d) {
  const pinned = pinPages(sections);
  const page = pagesFor(pinned).find((p) => p.sections.some((s) => s.id === sectionId));
  const i = page?.sections.findIndex((s) => s.id === sectionId) ?? -1;
  const other = page?.sections[i + d];
  if (!other) return pinned;
  const head = page.sections[0];
  const list = [...pinned];
  const a = list.findIndex((s) => s.id === sectionId);
  const b = list.findIndex((s) => s.id === other.id);
  [list[a], list[b]] = [list[b], list[a]];
  if (head.id !== sectionId && head.id !== other.id) return list;
  // The page's first section moved down: the section now first on the page takes its title
  const top = Math.min(a, b);
  const headIndex = Math.max(a, b);
  list[headIndex] = without(list[headIndex]);
  list[top] = { ...without(list[top]), page: head.page, ...(head.page_line ? { page_line: head.page_line } : {}) };
  return list;
}
