import React from "react";
import { Link } from "react-router-dom";
import BookCover from "./BookCover.jsx";

export default function BookCard({ book, isAdmin }) {
  return (
    <figure className="wb-library__book">
      <Link to={`/${book.slug}`} aria-label={`Open ${book.title}`}>
        <BookCover book={book} />
      </Link>

      <h2 className="wb-library__name">
        <Link to={`/${book.slug}`}>
          <strong>{book.title}</strong>
        </Link>
        {book.author && <span className="wb-ellipsis">{book.author}</span>}
      </h2>

      {isAdmin && (
        <div className="wb-library__admin">
          <Link to={`/${book.slug}/edit`} className="wb-btn">Edit</Link>
          <a href={`/books/${book.slug}/chapters`} className="wb-btn">Chapters</a>
        </div>
      )}
    </figure>
  );
}
