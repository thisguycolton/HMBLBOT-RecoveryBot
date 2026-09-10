import { useRef, useState } from "react";
import axios from "axios";

export default function ChapterImportPanel({ bookSlug, onImported }) {
  const fileRef = useRef(null);
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const importChapters = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage("Choose a chapter JSON file first.");
      return;
    }

    try {
      setBusy(true);
      setMessage("");
      const payload = JSON.parse(await file.text());
      const isChapterExport = Array.isArray(payload?.chapters);
      const isLiteratureExtraction = Array.isArray(payload?.document?.pages);
      if (!isChapterExport && !isLiteratureExtraction) {
        throw new Error('Expected an exported book ("chapters") or a repaired PDF extraction ("document.pages").');
      }

      // This page always imports into the book being managed, even if the
      // source was exported under a different slug.
      payload.book = { ...(payload.book || {}), slug: bookSlug };

      const { data } = await axios.post("/api/books/import_json", {
        payload: JSON.stringify(payload),
        replace_chapters: replace,
      });

      setMessage(
        `Imported ${data.chapter_count} chapters (${data.created} new, ${data.updated} updated).`
      );
      fileRef.current.value = "";
      await onImported?.();
    } catch (error) {
      console.error(error);
      setMessage(error.response?.data?.error || error.message || "Chapter import failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded border border-slate-200 bg-slate-50 p-4 dark:border-stone-700 dark:bg-stone-900">
      <h2 className="font-semibold">Re-import chapters</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-stone-300">
        Choose an exported book JSON file or a repaired PDF extraction. Chapters are imported into this book.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept="application/json,.json" className="text-sm" />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={replace}
            onChange={(event) => setReplace(event.target.checked)}
          />
          Replace current chapters
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={importChapters}
          className="rounded bg-black px-3 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {busy ? "Importing…" : "Import chapters"}
        </button>
      </div>
      {replace && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          Replacing removes chapters not present in the file, including their highlights.
        </p>
      )}
      {message && <p className="mt-2 text-sm" role="status">{message}</p>}
    </section>
  );
}
