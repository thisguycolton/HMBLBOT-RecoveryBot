import React, { useEffect, useState } from "react";
import BookCard from "./BookCard.jsx";
import AdminJsonUploader from "./AdminJsonUploader.jsx";
import "../../styles/writebook.css";

export default function BooksIndex({ isAdmin: isAdminProp }) {
  const [books, setBooks] = useState(null);
  const [isAdmin, setIsAdmin] = useState(!!isAdminProp);
  const [showUploader, setShowUploader] = useState(false);

  async function loadBooks() {
    const res = await fetch("/api/books");
    const data = await res.json();
    setBooks(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    const el = document.getElementById("books-root");
    if (el?.dataset?.admin) setIsAdmin(el.dataset.admin === "true");

    const refresh = () => loadBooks();
    window.addEventListener("books:refresh", refresh);
    return () => window.removeEventListener("books:refresh", refresh);
  }, []);

  useEffect(() => {
    loadBooks().catch(console.error);
  }, []);

  return (
    <div className="wb">
      <header className="flex items-center justify-between gap-4 pt-2">
        <h1 className="text-3xl md:text-4xl font-extrabold m-0">Library</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <button type="button" className="wb-btn" onClick={() => setShowUploader((v) => !v)} aria-pressed={showUploader}>
              Import
            </button>
            <a href="/books/new" className="wb-btn wb-btn--reversed">+ New book</a>
          </div>
        )}
      </header>

      {isAdmin && showUploader && (
        <div className="pt-6">
          <AdminJsonUploader />
        </div>
      )}

      {books === null ? null : books.length ? (
        <div className="wb-library">
          {books.map((b) => (
            <BookCard key={b.slug} book={b} isAdmin={isAdmin} />
          ))}
        </div>
      ) : (
        <p className="py-12 text-center opacity-70">No books yet.</p>
      )}
    </div>
  );
}
