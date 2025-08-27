import React, { useEffect, useState } from "react";
import BookCard from "./BookCard.jsx";

export default function BooksIndex({ isAdmin: isAdminProp }) {
  const [books, setBooks] = useState([]);
  const [isAdmin, setIsAdmin] = useState(!!isAdminProp);

  useEffect(() => {
    // optionally read from a data-attr for admin flag if you render it server-side
    const el = document.getElementById("books-root");
    if (el?.dataset?.admin) setIsAdmin(el.dataset.admin === "true");
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/books");
      const data = await res.json();
      setBooks(Array.isArray(data) ? data : []);
    })().catch(console.error);
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
            href="/books/new" // if you want a React page for creation later, point to /books/new and make a route
            className="inline-flex items-center gap-2 rounded-md px-3 py-2
                       bg-slate-900 text-white hover:bg-slate-800
                       dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            + New Book
          </a>
        )}
      </div>
    </div>
    <div className="max-w-6xl">
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