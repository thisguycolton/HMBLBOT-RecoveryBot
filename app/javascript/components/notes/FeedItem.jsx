import React, { useRef, useState } from "react";
import { BookOpen, Pencil, Repeat2, Trash2 } from "lucide-react";
import Markdown from "../book/Markdown";
import HighlightNote from "../book/HighlightNote";
import { highlightCss } from "../book/HighlightCard";
import Lightbox from "../events/Lightbox";
import Avatar from "../groups/Avatar";
import { api } from "../groups/lib";
import { timeAgo } from "../groups/page/lib";
import { showToast } from "../../lib/toast";
import LinkCard from "./LinkCard";
import NoteActions from "./NoteActions";
import NoteComments from "./NoteComments";
import NoteEditor from "./NoteEditor";
import VisibilityPicker from "./VisibilityPicker";
import { saveNote } from "./lib";

// One thing on a timeline: a note (Markdown and pictures), a repost of someone's note, or a
// highlight (its quote, its note and where it's from). Its owner edits it right there and
// picks who sees it; others react to notes and repost them (NoteActions).
// `showAuthor` puts their name on it (a feed of several people); `readOnly` (the editor's
// canvas) leaves off the owner's buttons. Needs a `.wb` around it.
export default function FeedItem({ item: given, readOnly = false, showAuthor = false, compact = false, groups = null, max, imagesMax, onChange, onRemove, extraAction }) {
  const item = readOnly ? { ...given, mine: false, by: null } : given;
  const [editing, setEditing] = useState(false);
  if (item.kind === "repost") return <Repost item={item} readOnly={readOnly} compact={compact} onChange={onChange} onRemove={onRemove} />;
  return (
    <article className={`wb-feed-item ${compact ? "wb-feed-item--compact" : ""}`}>
      <ItemHead item={item} showAuthor={showAuthor} compact={compact} extraAction={extraAction} onChange={onChange} editing={editing} />
      {item.kind === "highlight"
        ? <HighlightBody item={item} onChange={onChange} />
        : <NoteBody item={item} editing={editing} setEditing={setEditing} groups={groups} max={max} imagesMax={imagesMax} compact={compact} onChange={onChange} onRemove={onRemove} />}
      {item.kind === "note" && !readOnly && !editing && <Social note={item} onChange={onChange} />}
    </article>
  );
}

// Reactions, Comment and Repost under a note, then its comments
function Social({ note, onChange }) {
  const comments = useRef(null);
  return (
    <>
      <NoteActions note={note} onChange={onChange} onComment={note.can_comment ? () => comments.current?.focus() : undefined} />
      <NoteComments ref={comments} note={note} onChange={onChange} />
    </>
  );
}

// Someone's note on the reposter's timeline: who reposted it and when, then the note as its
// author wrote it. The reposter picks who sees the repost, or takes it off.
function Repost({ item, readOnly, compact, onChange, onRemove }) {
  const mine = item.mine && !readOnly;
  const note = { ...item.note, mine: false };

  const changeVisibility = async (visibility) => {
    const previous = item;
    onChange?.({ ...item, visibility });
    try {
      onChange?.(await saveNote(item.id, { visibility }));
    } catch {
      onChange?.(previous);
      showToast("Couldn't change who sees it.", { tone: "error" });
    }
  };
  const undo = async () => {
    try {
      await api(`/timeline_notes/${item.id}`, { method: "DELETE" });
      onRemove?.(item.id);
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  };

  return (
    <article className={`wb-feed-item ${compact ? "wb-feed-item--compact" : ""}`}>
      <header className="wb-feed-item__head">
        <span className="wb-feed-item__meta wb-feed-item__reposted">
          <Repeat2 size={13} aria-hidden="true" />
          <a href={`/people/${item.author.username}`}>{item.mine ? "You" : item.author.name}</a> reposted · {timeAgo(item.created_at)}
        </span>
        <span className="flex-1" />
        {mine && <VisibilityPicker value={item.visibility} onChange={changeVisibility} align="right" />}
      </header>
      <div className="wb-feed-item__repost">
        <ItemHead item={note} showAuthor compact />
        <NoteBody item={note} compact={compact} />
      </div>
      {!readOnly && <Social note={item.note} onChange={(n) => onChange?.({ ...item, note: n })} />}
      {mine && (
        <div className="wb-feed-item__foot">
          <span className="flex-1" />
          <button type="button" className="wb-hl-note__edit wb-hl-note__delete" onClick={undo}><Trash2 size={13} aria-hidden="true" /> Take off my timeline</button>
        </div>
      )}
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
      {item.body?.trim() && <Markdown source={item.body} hashtags className={`wb-feed-item__body ${compact ? "wb-feed-item__body--compact" : ""}`} />}
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
      {item.link && <LinkCard link={item.link} />}
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
