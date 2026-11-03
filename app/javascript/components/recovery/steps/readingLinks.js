// Readings named in a worksheet's text ("The Doctor's Opinion, and Chapter 3, More About
// Alcoholism, in the Big Book. Step One in the 12&12.", "From the Big Book (page 63):") become
// links into the library. Each link goes to /library/go (LibraryLinksController), which finds
// the book by its work_key and opens the chapter, or the printed page. A sentence has to name
// the book (Big Book, 12&12) for its chapters, steps and pages to link, except The Doctor's
// Opinion and "Chapter 3, More About Alcoholism", which can only mean the Big Book.

const BIG_BOOK = "bigbook";
const TWELVE = "twelve_and_twelve";

const slugOf = (title) => title.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// The Big Book's first 164 pages, by chapter number
const BB_CHAPTERS = ["Bill's Story", "There Is a Solution", "More About Alcoholism", "We Agnostics", "How It Works", "Into Action",
  "Working with Others", "To Wives", "The Family Afterward", "To Employers", "A Vision for You"];
const WORDS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const number = (s) => (/^\d+$/.test(s) ? Number(s) : WORDS.indexOf(s.toLowerCase()) + 1);

const titles = ["The Doctor['’]s Opinion", ...BB_CHAPTERS.map((t) => t.replace("'", "['’]"))].join("|");
const stepWord = `(?:${WORDS.join("|")}|\\d{1,2})`;
const PATTERN = new RegExp([
  `(?:Chapter\\s+(?<chNum>\\d{1,2}),?\\s+)?(?<title>${titles})\\b`,
  `Chapter\\s+(?<bareNum>\\d{1,2})\\b`,
  `Steps?\\s+(?<step>${stepWord})(?:\\s+(?:and|&|to|through)\\s+${stepWord})?\\b`,
  `pages?\\s+(?<page>\\d{1,3})(?:\\s*(?:to|-|–|and)\\s*\\d{1,3})?\\b`,
].join("|"), "gi");

const BIG_BOOK_RE = /big\s*book/i;
const TWELVE_RE = /12\s*&\s*12|twelve\s+(?:and|&)\s+twelve|twelve steps and twelve traditions/i;

export const libraryHref = (work, { chapter, page }) =>
  `/library/go?work=${work}${chapter ? `&chapter=${encodeURIComponent(chapter)}` : ""}${page ? `&page=${page}` : ""}`;

function hrefFor(g, sentence) {
  const bb = BIG_BOOK_RE.test(sentence);
  const tt = TWELVE_RE.test(sentence);
  if (g.title) {
    const doctor = /doctor/i.test(g.title);
    if (!bb && !doctor && !g.chNum) return null;
    return libraryHref(BIG_BOOK, { chapter: doctor ? "the-doctors-opinion" : slugOf(g.title.replace("’", "'")) });
  }
  if (g.bareNum) {
    const title = BB_CHAPTERS[Number(g.bareNum) - 1];
    return bb && title ? libraryHref(BIG_BOOK, { chapter: slugOf(title) }) : null;
  }
  if (g.step) {
    const n = number(g.step);
    return tt && n >= 1 && n <= 12 ? libraryHref(TWELVE, { chapter: `step-${WORDS[n - 1]}` }) : null;
  }
  if (g.page) {
    const work = bb ? BIG_BOOK : tt ? TWELVE : null;
    return work ? libraryHref(work, { page: Number(g.page) }) : null;
  }
  return null;
}

// The text as pieces: plain strings, and { text, href } for each reading found
export function readingPieces(text) {
  const out = [];
  const push = (piece) => {
    if (typeof piece === "string" && typeof out.at(-1) === "string") out[out.length - 1] += piece;
    else if (piece !== "") out.push(piece);
  };
  // A sentence at a time, so "in the Big Book" only reaches what's in its own sentence
  for (const sentence of text.split(/(?<=[.!?]["”)]?\s+)/)) {
    let at = 0;
    for (const m of sentence.matchAll(PATTERN)) {
      const href = hrefFor(m.groups, sentence);
      if (!href) continue;
      push(sentence.slice(at, m.index));
      push({ text: m[0], href });
      at = m.index + m[0].length;
    }
    push(sentence.slice(at));
  }
  return out;
}

// The home screen app opens links in place (it has no tabs); a browser opens the book in a new
// tab so the worksheet stays where it was
export const opensInPlace = () =>
  typeof window !== "undefined" && (window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches);
