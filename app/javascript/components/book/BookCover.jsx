import React from "react";

// Writebook's cover colors, keyed by the names stored in books.cover_color.
export const COVER_COLORS = {
  black: "oklch(22% 0 0)",
  blue: "oklch(69.14% 0.174 245.01)",
  green: "oklch(71.53% 0.175 155.352)",
  magenta: "oklch(61.8% 0.19 354.64)",
  orange: "oklch(70.22% 0.2 45.1)",
  violet: "oklch(56.13% 0.244 297.99)",
  white: "oklch(100% 0 0)",
};

// Books without a chosen color get one picked from their slug (white excluded).
const AUTO_COLORS = ["blue", "orange", "magenta", "green", "violet", "black"];

export function coverColorName(book) {
  if (COVER_COLORS[book?.cover_color]) return book.cover_color;
  let hash = 2166136261; // FNV-1a
  for (const ch of String(book?.slug || book?.title || "")) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  return AUTO_COLORS[hash % AUTO_COLORS.length];
}

export default function BookCover({ book, className = "" }) {
  if (book?.image_url) {
    return (
      <span className={`wb-cover ${className}`}>
        <img src={book.image_url} alt={`Cover of ${book.title}`} loading="lazy" />
      </span>
    );
  }

  const color = coverColorName(book);
  return (
    <span
      className={`wb-cover ${color === "white" ? "wb-cover--white" : ""} ${className}`}
      style={{ "--wb-cover-color": COVER_COLORS[color], containerType: "inline-size" }}
      aria-hidden="true"
    >
      <span className="wb-cover__title">{book?.title}</span>
      {book?.author && <span className="wb-cover__author">{book.author}</span>}
    </span>
  );
}
