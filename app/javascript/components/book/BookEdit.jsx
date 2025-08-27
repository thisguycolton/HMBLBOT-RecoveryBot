import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

export default function BookEdit() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [book, setBook] = useState({
    title: "",
    slug: "",
    description: "",
    image_url: "",   // UI name
    author: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // fetch details
  useEffect(() => {
    (async () => {
      setError("");
      const res = await fetch(`/api/books/${encodeURIComponent(slug)}`);
      if (!res.ok) { setError("Failed to load book"); return; }
      const data = await res.json();
      setBook({
        title: data.title || "",
        slug: data.slug || "",
        description: data.description || "",
        image_url: data.image_url || data.cover_url || "", // <- accept either
        author: data.author || "",
      });
    })().catch(e => setError(String(e)));
  }, [slug]);

  function csrfToken() {
    const m = document.querySelector('meta[name="csrf-token"]');
    return m ? m.content : "";
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      // Map UI field -> API field
      const payloadBook = {
        title: book.title,
        slug: book.slug,
        description: book.description,
        image_url: book.image_url, // <- server expects cover_url
        author: book.author,
      };

      const res = await fetch(`/api/books/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken(),
        },
        body: JSON.stringify({ book: payloadBook }),
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);

      const data = await res.json();

      // if slug changed, navigate to new edit URL in your SPA
      if (data.slug && data.slug !== slug) {
        navigate(`/library/${data.slug}/edit`, { replace: true });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Edit Book</h1>
        <Link
          className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          to="/library"
        >
          Back
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Title">
            <input
              className="mt-1 w-full rounded-md border-slate-300 dark:border-slate-700 dark:bg-neutral-900 dark:text-slate-100"
              value={book.title}
              onChange={(e) => setBook({ ...book, title: e.target.value })}
            />
          </Field>
          <Field label="Slug">
            <input
              className="mt-1 w-full rounded-md border-slate-300 dark:border-slate-700 dark:bg-neutral-900 dark:text-slate-100"
              value={book.slug}
              onChange={(e) => setBook({ ...book, slug: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Author">
          <input
            className="mt-1 w-full rounded-md border-slate-300 dark:border-slate-700 dark:bg-neutral-900 dark:text-slate-100"
            value={book.author}
            onChange={(e) => setBook({ ...book, author: e.target.value })}
          />
        </Field>

        <Field label="Image URL">
          <input
            className="mt-1 w-full rounded-md border-slate-300 dark:border-slate-700 dark:bg-neutral-900 dark:text-slate-100"
            value={book.image_url}
            onChange={(e) => setBook({ ...book, image_url: e.target.value })}
            placeholder="https://…"
          />
          {/* Optional preview */}
          {book.image_url && (
            <img
              src={book.image_url}
              alt="Cover preview"
              className="mt-2 h-40 w-auto rounded border border-slate-200 object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
        </Field>

        <Field label="Description">
          <textarea
            rows={4}
            className="mt-1 w-full rounded-md border-slate-300 dark:border-slate-700 dark:bg-neutral-900 dark:text-slate-100"
            value={book.description}
            onChange={(e) => setBook({ ...book, description: e.target.value })}
          />
        </Field>

        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2
                       bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50
                       dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <Link
            to="/library"
            className="inline-flex items-center gap-2 rounded-md px-3 py-2
                       border border-slate-200 text-slate-700 hover:bg-slate-50
                       dark:border-slate-700 dark:text-slate-200 dark:hover:bg-neutral-800"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      {children}
    </label>
  );
}