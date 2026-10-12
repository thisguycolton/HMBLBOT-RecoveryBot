import React from "react";

// Writebook's cover colors. Books without a cover image get one picked from their slug.
const COVER_COLORS = [
  "oklch(69.14% 0.174 245.01)", // blue
  "oklch(70.22% 0.2 45.1)",     // orange
  "oklch(61.8% 0.19 354.64)",   // magenta
  "oklch(71.53% 0.175 155.352)",// green
  "oklch(56.13% 0.244 297.99)", // violet
  "oklch(22% 0 0)",             // black
];

function colorFor(key) {
  let hash = 2166136261; // FNV-1a
  for (const ch of String(key || "")) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  return COVER_COLORS[hash % COVER_COLORS.length];
}

export default function BookCover({ book, className = "" }) {
  if (book?.image_url) {
    return (
      <span className={`wb-cover ${className}`}>
        <img src={book.image_url} alt={`Cover of ${book.title}`} loading="lazy" />
      </span>
    );
  }

  return (
    <span
      className={`wb-cover ${className}`}
      style={{ "--wb-cover-color": colorFor(book?.slug || book?.title), containerType: "inline-size" }}
      aria-hidden="true"
    >
      <span className="wb-cover__title">{book?.title}</span>
      {book?.author && <span className="wb-cover__author">{book.author}</span>}
    </span>
  );
}
