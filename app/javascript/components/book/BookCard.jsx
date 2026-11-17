import React from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
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
        {book.members_only && (
          <span className="wb-library__lock" title={book.locked ? "Only members of groups that read it can open it" : "Open to members of groups that read it"}>
            <Lock size={12} aria-hidden="true" /> Members only
          </span>
        )}
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
