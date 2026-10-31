import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Pencil, Trash2 } from "lucide-react";
import Markdown from "./Markdown";
import MarkdownEditor from "../notes/MarkdownEditor";

// No groups: highlights aren't shared to groups, so @ offers people and not role handles
const NO_GROUPS = { groups: [] };

// Matches an @ mention the way app/models/mentions.rb does, to say when one waits for sharing
const HAS_MENTION = /(?:^|[^\p{L}\p{N}_@./&-])@[a-zA-Z0-9]/u;

// A highlight's Markdown note, written formatted (notes/MarkdownEditor). The reader who
// made the highlight can add, edit and delete it; everyone the highlight is shared with
// sees it read-only. Like timeline notes it can hold #hashtags (links to the tag's page,
// which lists shared highlights) and @ mentions; the people mentioned are told once the
// highlight is shared to its owner's timeline and they can see it there.
export default function HighlightNote({ highlight, onChange, startEditing = false, compact = false }) {
  const mine = !!highlight?.mine;
  const [editing, setEditing] = useState(mine && startEditing);
  const [draft, setDraft] = useState(highlight?.note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const textRef = useRef(null);
  // Hashtag and @ suggestions come from profiles (signed-in people who can use Groups)
  const social = highlight?.profiles !== false;
  const shared = !!highlight?.shared_at || (highlight?.visibility && highlight.visibility !== "private");

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
      // The CSRF token too: on the people pages nothing else gives axios one
      const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
      const { data } = await axios.patch(`/api/highlights/${highlight.id}`, { highlight: { note } }, { headers: { "X-CSRF-Token": token } });
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
        <Markdown source={highlight.note} hashtags mentions={highlight.mentions} mine={!!highlight.mentions_me} />
      </div>
    );
  }

  if (editing) {
    return (
      <form
        className="wb-hl-note wb-hl-note--editing"
        onSubmit={(e) => { e.preventDefault(); save(draft); }}
      >
        <MarkdownEditor
          ref={textRef}
          value={draft}
          minRows={5}
          maxLength={10000}
          placeholder="Write a note… Select words to make them bold, italic or a link"
          onChange={setDraft}
          hashtags={social}
          mentions={social ? NO_GROUPS : null}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); save(draft); }
            if (e.key === "Escape") { e.stopPropagation(); setEditing(false); setDraft(highlight?.note || ""); }
          }}
        />
        {social && !shared && HAS_MENTION.test(draft) && (
          <p className="wb-hl-note__hint">People you @ mention are told once you share this highlight to your timeline.</p>
        )}
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
      <Markdown source={highlight.note} hashtags={social} mentions={highlight.mentions} />
      {error && <p className="wb-hl-note__error" role="alert">{error}</p>}
    </div>
  );
}
