import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Camera, Check, Eye, EyeOff, Link2, Trash2 } from "lucide-react";
import BookCover, { COVER_COLORS, coverColorName } from "./BookCover.jsx";
import "../../styles/writebook.css";

function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || "";
}

// Writebook's edit page: color swatches, the cover, and the title/subtitle/author fields side by
// side, then who can read the book. Grouped in soft trays borrowed from HMBLBOT's panels.
export default function BookEdit() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [saved, setSaved] = useState(null);   // the book as the server last returned it
  const [book, setBook] = useState(null);     // the form
  const [coverFile, setCoverFile] = useState(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`/api/books/${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error(res.status === 404 ? "That book isn't in the library." : "Couldn't load this book.");
      const data = await res.json();
      if (!alive) return;
      setSaved(data);
      setBook(formFrom(data));
      document.title = `Edit ${data.title} | HMBLBOT`;
    })().catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [slug]);

  // Preview the picked file without uploading it yet.
  const previewUrl = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : null), [coverFile]);
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  if (error && !book) {
    return (
      <div className="wb py-12 text-center">
        <p>{error}</p>
        <Link to="/" className="wb-btn mt-4">Back to the library</Link>
      </div>
    );
  }
  if (!book) return <div className="wb" />;

  const set = (field) => (e) => { setBook({ ...book, [field]: e.target.value }); setNotice(""); };
  const imageUrl = removeCover ? null : previewUrl || saved.image_url;
  const preview = { ...book, image_url: imageUrl };
  const color = coverColorName(book);
  const dirty =
    coverFile || removeCover || JSON.stringify(book) !== JSON.stringify(formFrom(saved));

  function pickColor(name) {
    setBook({ ...book, cover_color: name });
    setNotice("");
  }

  function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCoverFile(file);
    setRemoveCover(false);
    setNotice("");
  }

  function dropCover() {
    setCoverFile(null);
    setRemoveCover(true);
    setNotice("");
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = new FormData();
      for (const [key, value] of Object.entries(book)) body.append(`book[${key}]`, value ?? "");
      if (coverFile) body.append("book[cover_image]", coverFile);
      if (removeCover) body.append("book[remove_cover_image]", "1");

      const res = await fetch(`/api/books/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "X-CSRF-Token": csrfToken(), Accept: "application/json" },
        body,
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Couldn't save (${res.status}).`);

      setSaved(data);
      setBook(formFrom(data));
      setCoverFile(null);
      setRemoveCover(false);
      setNotice("Saved.");
      if (data.slug !== slug) navigate(`/${data.slug}/edit`, { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wb wb-edit">
      <div className="wb-toolbar">
        <Link to={`/${slug}`} className="wb-btn wb-btn--icon" aria-label={`Back to ${saved.title}`} title="Back to the book">
          <ArrowLeft size={20} />
        </Link>
        <span className="wb-toolbar__spacer" />
        {(notice || dirty) && (
          <span className={`wb-edit__status ${notice ? "" : "wb-edit__status--dirty"}`} role="status">
            {notice || "Unsaved changes"}
          </span>
        )}
        <Link to={`/${slug}`} className="wb-btn">Cancel</Link>
        <button type="submit" form="book-edit" className="wb-btn wb-btn--reversed" disabled={saving || !dirty}>
          <Check size={18} aria-hidden="true" />
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <form id="book-edit" onSubmit={save}>
        <div className="wb-edit__main">
          <div className="wb-edit__tray wb-edit__swatches" role="radiogroup" aria-label="Cover color">
            {Object.entries(COVER_COLORS).map(([name, value]) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={color === name}
                aria-label={name}
                title={name}
                className={`wb-edit__swatch ${name === "white" ? "wb-edit__swatch--white" : ""}`}
                style={{ "--swatch": value }}
                onClick={() => pickColor(name)}
              >
                {color === name && <Check size={16} strokeWidth={3} aria-hidden="true" />}
              </button>
            ))}
          </div>

          <div className="wb-edit__cover">
            <BookCover book={preview} />
            <div className="wb-edit__cover-actions">
              <button type="button" className="wb-edit__camera" onClick={() => fileRef.current?.click()} title="Upload a cover image" aria-label="Upload a cover image">
                <Camera size={20} />
              </button>
              {imageUrl && (
                <button type="button" className="wb-edit__camera wb-edit__camera--soft" onClick={dropCover} title="Remove the cover image" aria-label="Remove the cover image">
                  <Trash2 size={18} />
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
          </div>

          <div className="wb-edit__group wb-edit__fields">
            <label className="wb-edit__cell">
              <span className="wb-edit__label">Title</span>
              <textarea
                className="wb-edit__input wb-edit__input--title"
                rows={1}
                value={book.title}
                onChange={set("title")}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                placeholder="Title"
                required
              />
            </label>
            <label className="wb-edit__cell">
              <span className="wb-edit__label">Subtitle</span>
              <textarea className="wb-edit__input" rows={3} value={book.description} onChange={set("description")} placeholder="A line or two about the book" />
            </label>
            <label className="wb-edit__cell">
              <span className="wb-edit__label">Author</span>
              <input className="wb-edit__input" value={book.author} onChange={set("author")} placeholder="Author" />
            </label>
          </div>
        </div>

        <div className="wb-edit__group wb-edit__settings">
          <div className="wb-edit__cell wb-edit__row">
            <span className="wb-edit__icon">
              {book.publicly_accessible ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
            </span>
            <div className="min-w-0">
              <strong>Everyone</strong>
              <p className="wb-edit__hint">
                {book.publicly_accessible ? "Anyone can find and read this book." : "Hidden: only admins can see this book."}
              </p>
            </div>
            <span className="wb-edit__leader" aria-hidden="true" />
            <button
              type="button"
              role="switch"
              aria-checked={book.publicly_accessible}
              aria-label="Everyone can read this book"
              className="wb-edit__switch"
              onClick={() => { setBook({ ...book, publicly_accessible: !book.publicly_accessible }); setNotice(""); }}
            >
              <span />
            </button>
          </div>

          <label className="wb-edit__cell wb-edit__row">
            <span className="wb-edit__icon"><Link2 size={18} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <strong>Web address</strong>
              <span className="wb-edit__slug">
                <span>/library/</span>
                <input className="wb-edit__input" value={book.slug} onChange={set("slug")} pattern="[a-z0-9\-]+" title="Lowercase letters, numbers and dashes" required />
              </span>
            </div>
          </label>
        </div>
      </form>

      {error && <p className="wb-edit__error" role="alert">{error}</p>}
    </div>
  );
}

function formFrom(data) {
  return {
    title: data.title || "",
    description: data.description || "",
    author: data.author || "",
    slug: data.slug || "",
    cover_color: data.cover_color || "",
    publicly_accessible: data.public !== false,
  };
}
