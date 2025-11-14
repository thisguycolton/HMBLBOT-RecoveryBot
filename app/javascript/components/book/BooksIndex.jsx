import React, { useEffect, useState } from "react";
import BookCard from "./BookCard.jsx";
import AdminJsonUploader from "./AdminJsonUploader.jsx";

export default function BooksIndex({ isAdmin: isAdminProp }) {
  const [books, setBooks] = useState([]);
  const [isAdmin, setIsAdmin] = useState(!!isAdminProp);

  useEffect(() => {
    const el = document.getElementById("books-root");
    if (el?.dataset?.admin) setIsAdmin(el.dataset.admin === "true");

    const refresh = () => loadBooks();
    window.addEventListener("books:refresh", refresh);
    return () => window.removeEventListener("books:refresh", refresh);
  }, []);

  async function loadBooks() {
    const res = await fetch("/api/books");
    const data = await res.json();
    setBooks(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadBooks().catch(console.error);
  }, []);

  return (
    <div className="w-full mx-auto">
      <div className="max-w-6xl px-3 py-6 w-full">
        <div className="place-self-center absolute top-10 w-full max-w-6xl flex items-center justify-between mb-4 p-10">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Library</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Browse available titles.</p>
          </div>
          {isAdmin && (
            <a
              href="/books/new"
              className="inline-flex items-center gap-2 rounded-md px-3 py-2
                         bg-slate-900 text-white hover:bg-slate-800
                         dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              + New Book
            </a>
          )}
        </div>
      </div>

      {/* Admin uploader */}
      {isAdmin && (
        <div className="max-w-6xl mx-auto px-3 pb-6">
          <AdminJsonUploader />
        </div>
      )}

      <div className="max-w-6xl mx-auto px-3">
        {books.length ? (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {books.map((b) => (
              <BookCard key={b.slug} book={b} isAdmin={isAdmin} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-6 text-slate-600 dark:text-slate-400">
            No books yet.
          </div>
        )}
      </div>
    </div>
  );
}