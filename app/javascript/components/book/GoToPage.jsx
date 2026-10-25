import React, { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { chapterName, hasPrintedPages, printedRange, resolvePage } from "./goToPage.js";

// "Go to page..." on a book's page: type a page number, see where it lands, press Go.
export default function GoToPage({ bookSlug, chapters }) {
  const [value, setValue] = useState("");
  const printed = useMemo(() => hasPrintedPages(chapters), [chapters]);
  const range = useMemo(() => printedRange(chapters), [chapters]);
  const result = useMemo(() => resolvePage(chapters, value), [chapters, value]);
  const target = result?.chapter;

  function go(e) {
    e.preventDefault();
    if (!target) return;
    const hash = result.mode === "printed" && result.exact ? `#page-${result.page}` : "";
    window.location.assign(`/books/${bookSlug}/chapters/${target.slug}${hash}`);
  }

  let line;
  if (result?.error) {
    line = <span className="wb-goto__error">{result.error}</span>;
  } else if (result?.mode === "printed") {
    line = (
      <>
        p. {result.page} (printed) <ArrowRight size={14} aria-hidden="true" className="wb-goto__arrow" />{" "}
        {chapterName(target)}
        {!result.exact && <span className="wb-goto__soft"> (p. {result.page} falls between chapters)</span>}
      </>
    );
  } else if (result?.mode === "order") {
    line = (
      <>
        Page {result.page} of {result.total} (by order) <ArrowRight size={14} aria-hidden="true" className="wb-goto__arrow" />{" "}
        {chapterName(target)}
      </>
    );
  }

  const hint = printed
    ? `Printed page numbers, ${range.first}–${range.last}.`
    : `No printed page numbers in this book, so pages count chapters in order (1–${chapters.length}).`;

  return (
    <form className="wb-goto" onSubmit={go} role="search" aria-label="Go to page">
      <div className="wb-goto__row">
        <input
          className="wb-goto__input"
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Go to page..."
          aria-label="Page number"
          aria-describedby="wb-goto-status"
          autoComplete="off"
        />
        <button type="submit" className="wb-btn wb-goto__btn" disabled={!target}>
          Go
        </button>
      </div>
      <p id="wb-goto-status" className="wb-goto__status" aria-live="polite">
        {line || <span className="wb-goto__soft">{hint}</span>}
      </p>
    </form>
  );
}
