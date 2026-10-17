import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Pencil, Trash2 } from "lucide-react";
import Markdown from "./Markdown";

// A highlight's Markdown note. The reader who made the highlight can add,
// edit and delete it; everyone the highlight is shared with sees it read-only.
export default function HighlightNote({ highlight, onChange, startEditing = false, compact = false }) {
  const mine = !!highlight?.mine;
  const [editing, setEditing] = useState(mine && startEditing);
  const [draft, setDraft] = useState(highlight?.note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const textRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(highlight?.note || "");
  }, [highlight?.note, editing]);

  useEffect(() => {
    if (editing) textRef.current?.focus();
  }, [editing]);

  async function save(note) {
    setSaving(true);
    setError(null);
    try {
      const { data } = await axios.patch(`/api/highlights/${highlight.id}`, { highlight: { note } });
      onChange?.({ ...highlight, ...data });
      setEditing(false);
    } catch (e) {
      setError(e?.response?.status === 401 ? "Sign in again to save your note." : "Couldn't save the note. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function removeNote() {
    if (!window.confirm("Delete this note? The highlight stays.")) return;
    save("");
  }

  if (!mine) {
    if (!highlight?.note) return null;
    return (
      <div className="wb-hl-note">
        {!compact && <div className="wb-hl-note__label">{highlight.by ? `${highlight.by}'s note` : "Note"}</div>}
        <Markdown source={highlight.note} />
      </div>
    );
  }

  if (editing) {
    return (
      <form
        className="wb-hl-note wb-hl-note--editing"
        onSubmit={(e) => { e.preventDefault(); save(draft); }}
      >
        <textarea
          ref={textRef}
          className="wb-hl-note__input"
          value={draft}
          rows={5}
          maxLength={10000}
          placeholder="Write a note… Markdown works: **bold**, *italic*, - lists, > quotes, [links](https://…)"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); save(draft); }
            if (e.key === "Escape") { e.stopPropagation(); setEditing(false); setDraft(highlight?.note || ""); }
          }}
        />
        {error && <p className="wb-hl-note__error" role="alert">{error}</p>}
        <div className="wb-hl-note__actions">
          {highlight?.note && (
            <button type="button" className="wb-btn wb-hl-note__delete" onClick={removeNote} disabled={saving}>
              <Trash2 size={14} aria-hidden="true" /> Delete note
            </button>
          )}
          <span className="flex-1" />
          <button type="button" className="wb-btn" onClick={() => { setEditing(false); setDraft(highlight?.note || ""); }} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="wb-btn wb-btn--reversed" disabled={saving}>
            {saving ? "Saving…" : "Save note"}
          </button>
        </div>
      </form>
    );
  }

  if (!highlight?.note) {
    return (
      <button type="button" className="wb-hl-note__add" onClick={() => setEditing(true)}>
        <Pencil size={14} aria-hidden="true" /> Add a note
      </button>
    );
  }

  return (
    <div className="wb-hl-note">
      <div className="wb-hl-note__label">
        Your note
        <button type="button" className="wb-hl-note__edit" onClick={() => setEditing(true)}>
          <Pencil size={13} aria-hidden="true" /> Edit
        </button>
      </div>
      <Markdown source={highlight.note} />
      {error && <p className="wb-hl-note__error" role="alert">{error}</p>}
    </div>
  );
}
