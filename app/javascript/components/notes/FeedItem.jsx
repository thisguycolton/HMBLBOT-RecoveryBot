import React, { useState } from "react";
import { BookOpen, Pencil, Trash2 } from "lucide-react";
import Markdown from "../book/Markdown";
import HighlightNote from "../book/HighlightNote";
import { highlightCss } from "../book/HighlightCard";
import Lightbox from "../events/Lightbox";
import Avatar from "../groups/Avatar";
import { api } from "../groups/lib";
import { timeAgo } from "../groups/page/lib";
import { showToast } from "../../lib/toast";
import NoteEditor from "./NoteEditor";
import VisibilityPicker from "./VisibilityPicker";
import { saveNote } from "./lib";

// One thing on a timeline: a note (Markdown and pictures) or a highlight (its quote, its
// note and where it's from). Its owner edits it right there and picks who sees it.
// `showAuthor` puts their name on it (a feed of several people); `readOnly` (the editor's
// canvas) leaves off the owner's buttons. Needs a `.wb` around it.
export default function FeedItem({ item: given, readOnly = false, showAuthor = false, compact = false, groups = null, max, imagesMax, onChange, onRemove, extraAction }) {
  const item = readOnly ? { ...given, mine: false, by: null } : given;
  const [editing, setEditing] = useState(false);
  return (
    <article className={`wb-feed-item ${compact ? "wb-feed-item--compact" : ""}`}>
      <ItemHead item={item} showAuthor={showAuthor} compact={compact} extraAction={extraAction} onChange={onChange} editing={editing} />
      {item.kind === "highlight"
        ? <HighlightBody item={item} onChange={onChange} />
        : <NoteBody item={item} editing={editing} setEditing={setEditing} groups={groups} max={max} imagesMax={imagesMax} compact={compact} onChange={onChange} onRemove={onRemove} />}
    </article>
  );
}

function ItemHead({ item, showAuthor, compact, extraAction, onChange, editing }) {
  const changeVisibility = async (visibility) => {
    const previous = item;
    onChange?.({ ...item, visibility });
    try {
      if (item.kind === "highlight") await api(`/highlights/${item.id}`, { method: "PATCH", body: { highlight: { visibility } } });
      else onChange?.(await saveNote(item.id, { visibility }));
    } catch {
      onChange?.(previous);
      showToast("Couldn't change who sees it.", { tone: "error" });
    }
  };
  return (
    <header className="wb-feed-item__head">
      {showAuthor && (
        <a href={`/people/${item.author.username}`} className="wb-feed-item__author">
          <Avatar person={item.author} size={compact ? 26 : 32} />
          <span>{item.author.name}</span>
        </a>
      )}
      <span className="wb-feed-item__meta">
        {item.kind === "highlight" ? "Highlighted" : "Note"} · {timeAgo(item.created_at)}{item.edited ? " · edited" : ""}
      </span>
      <span className="flex-1" />
      {extraAction}
      {item.mine && item.visibility && !editing && <VisibilityPicker value={item.visibility} onChange={changeVisibility} align="right" />}
    </header>
  );
}

function HighlightBody({ item, onChange }) {
  const href = `/books/${item.book_slug}/chapters/${item.chapter_slug}?hl=${encodeURIComponent(item.share_id)}#hl-${item.id}`;
  return (
    <>
      <blockquote className="wb-hl-quote wb-feed-item__quote">
        <mark style={{ "--hl": highlightCss(item.color) }}>{item.quote}</mark>
      </blockquote>
      <a href={href} className="wb-feed-item__source"><BookOpen size={13} aria-hidden="true" /> {item.book_title} · {item.chapter_title}</a>
      <HighlightNote highlight={{ ...item, by: item.by === null ? null : item.author?.name?.split(" ")[0] }} onChange={(h) => onChange?.({ ...item, note: h.note })} />
    </>
  );
}

function NoteBody({ item, editing, setEditing, groups, max, imagesMax, compact, onChange, onRemove }) {
  const [open, setOpen] = useState(null);

  const destroy = async () => {
    if (!window.confirm(item.groups?.length ? "Delete this note? It comes off every group it's shared to." : "Delete this note?")) return;
    try {
      await api(`/timeline_notes/${item.id}`, { method: "DELETE" });
      onRemove?.(item.id);
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  };

  if (editing) {
    return (
      <NoteEditor note={item} groups={groups} max={max} imagesMax={imagesMax} autoFocus onDelete={destroy}
        onCancel={() => setEditing(false)} onSaved={(saved) => { onChange?.(saved); setEditing(false); }} />
    );
  }

  const images = item.images || [];
  return (
    <>
      {item.body?.trim() && <Markdown source={item.body} className={`wb-feed-item__body ${compact ? "wb-feed-item__body--compact" : ""}`} />}
      {images.length > 0 && (
        <div className={`wb-feed-item__images wb-feed-item__images--${Math.min(images.length, 4)}`}>
          {images.slice(0, 4).map((image, i) => (
            <button key={image.id} type="button" onClick={() => setOpen(i)} aria-label="See the picture">
              <img src={image.url} alt="" loading="lazy" />
              {i === 3 && images.length > 4 && <span>+{images.length - 4}</span>}
            </button>
          ))}
        </div>
      )}
      {open != null && <Lightbox photos={images.map((p) => ({ url: p.url }))} index={open} onClose={() => setOpen(null)} />}
      {item.mine && (
        <div className="wb-feed-item__foot">
          {item.groups?.length > 0 && <span className="wb-feed-item__shared">Shared to {item.groups.map((g) => g.title).join(", ")}</span>}
          <span className="flex-1" />
          <button type="button" className="wb-hl-note__edit" onClick={() => setEditing(true)}><Pencil size={13} aria-hidden="true" /> Edit</button>
          <button type="button" className="wb-hl-note__edit wb-hl-note__delete" onClick={destroy}><Trash2 size={13} aria-hidden="true" /> Delete</button>
        </div>
      )}
    </>
  );
}
