import React, { useCallback, useEffect, useState } from "react";
import BookCard from "./BookCard.jsx";
import AdminJsonUploader from "./AdminJsonUploader.jsx";
import { SearchButton, SearchDialog, useSearchHotkey } from "./BookSearch.jsx";
import "../../styles/writebook.css";

export default function BooksIndex({ isAdmin: isAdminProp }) {
  const [books, setBooks] = useState(null);
  const [isAdmin, setIsAdmin] = useState(!!isAdminProp);
  const [showUploader, setShowUploader] = useState(false);
  // ?q= (from the search box at the top of the page) opens the library search on it
  const [initialQuery] = useState(() => new URLSearchParams(window.location.search).get("q") || "");
  const [openSearch, setOpenSearch] = useState(!!initialQuery);
  useSearchHotkey(useCallback(() => setOpenSearch(true), []));

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
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-2">
        <h1 className="text-3xl md:text-4xl font-extrabold m-0">Library</h1>
        <div className="flex flex-wrap gap-2">
          {books?.length > 0 && <SearchButton onClick={() => setOpenSearch(true)} label="Search all books" />}
          {document.body.dataset.currentUser === "true" && (
            <a href="/library/highlights" className="wb-btn">My highlights</a>
          )}
          {isAdmin && (
            <button type="button" className="wb-btn" onClick={() => setShowUploader((v) => !v)} aria-pressed={showUploader}>
              Import
            </button>
          )}
        </div>
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

      <SearchDialog open={openSearch} onClose={() => setOpenSearch(false)} initialQuery={initialQuery} />
    </div>
  );
}
