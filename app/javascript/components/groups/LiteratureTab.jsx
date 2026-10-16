import React, { useEffect, useState } from "react";
import { BookPlus, Trash2 } from "lucide-react";
import { inputClass, labelClass } from "../ui/styles";
import { api } from "./lib";
import { Card, ErrorNote, Tray, dangerButton, primaryButton } from "./ui";

// The library books this group has approved for its meetings
export default function LiteratureTab({ group, reload }) {
  const manage = group.can_manage;
  const [library, setLibrary] = useState(null);
  const [bookSlug, setBookSlug] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!manage) return;
    fetch("/api/books", { headers: { Accept: "application/json" }, credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => setLibrary(Array.isArray(data) ? data : data.books || []))
      .catch(() => setLibrary([]));
  }, [manage]);

  const approved = new Set(group.books.map((b) => b.book.slug));
  const choices = (library || []).filter((b) => !approved.has(b.slug));

  const add = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api(`/groups/${group.slug}/books`, { method: "POST", body: { book_slug: bookSlug, note } });
      setBookSlug("");
      setNote("");
      reload();
    } catch (err) {
      setError(err.message);
    }
  };
  const remove = async (id) => {
    try {
      await api(`/groups/${group.slug}/books/${id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <ErrorNote error={error} />
      <Tray label="Approved literature">
        {group.books.length === 0 ? (
          <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">
            {manage ? "No books yet. Add the literature this group reads from." : "The group hasn't listed its literature yet."}
          </Card>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {group.books.map(({ id, note: bookNote, book }) => (
              <Card key={id} className="flex gap-3 p-3">
                <a href={`/library/${book.slug}`} className="shrink-0">
                  {book.cover_url ? (
                    <img src={book.cover_url} alt="" className="h-20 w-14 rounded object-cover shadow" />
                  ) : (
                    <span className="grid h-20 w-14 place-items-center rounded bg-sky-800 p-1 text-center text-[9px] font-semibold leading-tight text-white shadow">{book.title}</span>
                  )}
                </a>
                <div className="min-w-0 flex-1">
                  <a href={`/library/${book.slug}`} className="font-medium text-slate-900 hover:text-accent dark:text-white">{book.title}</a>
                  {book.author && <p className="text-xs text-slate-500 dark:text-neutral-400">{book.author}</p>}
                  {bookNote && <p className="mt-1 text-sm text-slate-600 dark:text-neutral-300">{bookNote}</p>}
                  {manage && (
                    <button type="button" onClick={() => remove(id)} className={`${dangerButton} mt-1 !px-2 !py-1 !text-xs`}>
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Tray>

      {manage && (
        <Tray label="Add a book">
          <Card className="p-3">
            <form onSubmit={add} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <div>
                <label htmlFor="book" className={labelClass}>Book</label>
                <select id="book" required className={inputClass} value={bookSlug} onChange={(e) => setBookSlug(e.target.value)}>
                  <option value="">{library ? "Pick from the library" : "Loading the library…"}</option>
                  {choices.map((b) => <option key={b.slug} value={b.slug}>{b.title}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="book-note" className={labelClass}>Note (optional)</label>
                <input id="book-note" maxLength={200} className={inputClass} placeholder="e.g. Step study on Thursdays" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <button type="submit" className={primaryButton}><BookPlus className="h-4 w-4" /> Add</button>
            </form>
          </Card>
        </Tray>
      )}
    </div>
  );
}
