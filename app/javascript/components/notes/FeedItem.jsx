import React, { useRef, useState } from "react";
import { Ban, BookOpen, EyeOff, Flag, ImageIcon, MessageSquareOff, MessageSquareText, Pencil, Repeat2, Trash2 } from "lucide-react";
import ReportDialog from "../groups/chat/ReportDialog";
import Markdown from "../book/Markdown";
import HighlightNote from "../book/HighlightNote";
import { highlightCss } from "../book/HighlightCard";
import Lightbox from "../events/Lightbox";
import Avatar from "../groups/Avatar";
import { api } from "../groups/lib";
import { timeAgo } from "../groups/page/lib";
import { showToast } from "../../lib/toast";
import LinkCard from "./LinkCard";
import NoteActions, { HighlightActions } from "./NoteActions";
import PictureShare from "../share/PictureShare";
import NoteComments from "./NoteComments";
import NoteEditor from "./NoteEditor";
import PostMenu, { blockPerson, useBlocked } from "./PostMenu";
import VisibilityPicker from "./VisibilityPicker";
import ChipModal, { FlatChip } from "../recovery/ChipModal";
import { dayLabel, meetingPlace } from "../recovery/lib";
import { HIGHLIGHT_VISIBILITY, recipientVisibility, saveNote } from "./lib";

// One thing on a timeline: a note (Markdown and pictures), a repost of someone's note, or a
// highlight (its quote, its note and where it's from). Its owner edits it right there and
// picks who sees it; others react to notes and repost them (NoteActions).
// `showAuthor` puts their name on it (a feed of several people); `readOnly` (the editor's
// canvas) leaves off the owner's buttons. A note written on someone's page always names who
// wrote it and whose page it's on, and that person can take it off. Needs a `.wb` around it.
//
// What else you can do with it is in the ••• at its top right (PostMenu): on yours, Edit,
// Turn comments off and Delete; on someone else's, Report and Block them (and Take off my
// page, when it's on yours). Blocking someone hides what's theirs here right away.
// Your own highlights and notes can also be shared as a picture (PictureShare), and others'
// highlights shared with Members can be reposted like notes (HighlightActions).
export default function FeedItem({ item: given, readOnly = false, showAuthor = false, compact = false, groups = null, max, imagesMax, onChange, onRemove, extraAction }) {
  const item = readOnly ? { ...given, mine: false, by: null } : given;
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [picturing, setPicturing] = useState(false);
  const authorId = item.kind === "repost" ? item.note?.author?.id : item.author?.id;
  useBlocked((id, blocked) => { if (blocked && (id === authorId || id === item.author?.id)) setHidden(true); });
  if (hidden) return null;
  if (item.kind === "repost") return <Repost item={item} readOnly={readOnly} compact={compact} onChange={onChange} onRemove={onRemove} />;

  const destroy = async () => {
    const ask = !item.mine ? `Take ${item.author.name.split(" ")[0]}'s note off your page? It's deleted for both of you.`
      : item.groups?.length ? "Delete this note? It comes off every group it's shared to." : "Delete this note?";
    if (!window.confirm(ask)) return;
    try {
      await api(`/timeline_notes/${item.id}`, { method: "DELETE" });
      onRemove?.(item.id);
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  };
  const toggleComments = async () => {
    const previous = item;
    onChange?.({ ...item, comments_off: !item.comments_off });
    try {
      onChange?.(await saveNote(item.id, { comments_off: !item.comments_off }));
    } catch {
      onChange?.(previous);
      showToast("Couldn't change that.", { tone: "error" });
    }
  };
  const note = item.kind === "note";
  const picturable = item.kind === "highlight" || (note && !!item.body?.trim());
  const menu = readOnly || editing ? [] : item.mine ? [
    picturable && { label: "Share as a picture", icon: ImageIcon, onClick: () => setPicturing(true) },
    note && { label: "Edit", icon: Pencil, onClick: () => setEditing(true) },
    note && { label: item.comments_off ? "Turn comments on" : "Turn comments off", icon: item.comments_off ? MessageSquareText : MessageSquareOff, onClick: toggleComments },
    note && { label: "Delete", icon: Trash2, danger: true, onClick: destroy },
  ] : othersMenu(item.author, {
    takeOff: note && item.recipient && item.can_remove && destroy,
    report: note && (() => setReporting(true)),
  });

  return (
    <article className={`wb-feed-item ${compact ? "wb-feed-item--compact" : ""}`}>
      <ItemHead item={item} showAuthor={showAuthor} compact={compact} extraAction={extraAction} onChange={onChange} onRemove={onRemove} editing={editing} menu={menu} />
      {item.kind === "highlight"
        ? <HighlightBody item={item} onChange={onChange} />
        : <NoteBody item={item} editing={editing} setEditing={setEditing} groups={groups} max={max} imagesMax={imagesMax} compact={compact} onChange={onChange} onDelete={destroy} />}
      {note && !readOnly && !editing && <Social note={item} onChange={onChange} />}
      {item.kind === "highlight" && !readOnly && <HighlightActions highlight={item} onChange={onChange} />}
      {picturing && <PictureShare onClose={() => setPicturing(false)} {...pictureProps(item)} />}
      {reporting && <ReportDialog subject={{ type: "timeline_note", id: item.id }} person={item.author} onClose={() => setReporting(false)} />}
    </article>
  );
}

// What PictureShare needs for a highlight or a note of yours
function pictureProps(item) {
  if (item.kind !== "highlight") return { cardUrl: `/api/timeline_notes/${item.id}/card`, kind: "note", title: "A note" };
  return {
    cardUrl: `/api/highlights/${item.id}/card`, kind: "highlight", hasNote: !!item.note?.trim(), title: `A highlight from ${item.book_title}`,
    link: `${location.origin}${highlightHref(item)}`,
  };
}

const highlightHref = (item) => `/books/${item.book_slug}/chapters/${item.chapter_slug}?hl=${encodeURIComponent(item.share_id)}#hl-${item.id}`;

// The ••• on someone else's post: Take off my page (when it's on yours), Report, Block them
function othersMenu(person, { takeOff, report }) {
  if (!person) return [];
  return [
    takeOff && { label: "Take off my page", icon: Trash2, onClick: takeOff },
    report && { label: "Report", icon: Flag, onClick: report },
    { label: `Block ${person.name.split(" ")[0]}`, icon: Ban, danger: true, onClick: () => blockPerson(person) },
  ];
}

// Reactions, Comment and Repost under a note, then its comments
function Social({ note, onChange }) {
  const comments = useRef(null);
  return (
    <>
      <NoteActions note={note} onChange={onChange} onComment={note.can_comment ? () => comments.current?.focus() : undefined} />
      <NoteComments ref={comments} note={note} onChange={onChange} />
      {note.comments_off && <p className="wb-feed-item__comments-off"><MessageSquareOff size={13} aria-hidden="true" /> {note.mine ? "You turned comments off." : "Comments are off."}</p>}
    </>
  );
}

// Someone's note (or highlight) on the reposter's timeline: who reposted it and when, then
// the note as its author wrote it. The reposter picks who sees the repost, or takes it off.
function Repost({ item, readOnly, compact, onChange, onRemove }) {
  const mine = item.mine && !readOnly;
  const note = { ...item.note, mine: false };
  const highlight = note.kind === "highlight";
  const [reporting, setReporting] = useState(false);

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
        {!readOnly && <PostMenu className="wb-feed-item__menu" items={mine ? [{ label: "Take off my timeline", icon: Trash2, danger: true, onClick: undo }] : othersMenu(item.author, {})} />}
      </header>
      <div className="wb-feed-item__repost">
        <ItemHead item={note} showAuthor compact menu={readOnly || item.note.mine ? [] : othersMenu(item.note.author, { report: !highlight && (() => setReporting(true)) })} />
        {highlight ? <HighlightBody item={note} /> : <NoteBody item={note} compact={compact} />}
      </div>
      {!readOnly && (highlight
        ? <HighlightActions highlight={item.note} onChange={(n) => onChange?.({ ...item, note: n })} />
        : <Social note={item.note} onChange={(n) => onChange?.({ ...item, note: n })} />)}
      {reporting && <ReportDialog subject={{ type: "timeline_note", id: item.note.id }} person={item.note.author} onClose={() => setReporting(false)} />}
    </article>
  );
}

function ItemHead({ item, showAuthor, compact, extraAction, onChange, onRemove, editing, menu = [] }) {
  const changeVisibility = async (visibility) => {
    const previous = item;
    onChange?.({ ...item, visibility });
    try {
      if (item.kind === "highlight") {
        await api(`/highlights/${item.id}`, { method: "PATCH", body: { highlight: { visibility } } });
        // "private" takes a highlight off every timeline, this one too
        if (visibility === "private") onRemove?.(item.id);
      } else onChange?.(await saveNote(item.id, { visibility }));
    } catch {
      onChange?.(previous);
      showToast("Couldn't change who sees it.", { tone: "error" });
    }
  };
  const to = item.kind === "note" && item.recipient;
  const visibilityOptions = item.kind === "highlight" ? { options: HIGHLIGHT_VISIBILITY, title: "Who sees this on your timeline" }
    : to ? { options: recipientVisibility(to), title: "Who sees this note" } : {};
  return (
    <header className="wb-feed-item__head">
      {(showAuthor || to) && (
        <a href={`/people/${item.author.username}`} className="wb-feed-item__author">
          <Avatar person={item.author} size={compact ? 26 : 32} />
          <span>{item.author.name}</span>
        </a>
      )}
      <span className="wb-feed-item__meta">
        {to ? <>To <a href={`/people/${to.username}`} className="font-semibold hover:underline">{to.name}</a></>
          : item.kind === "highlight" ? "Highlighted" : item.chip ? "Chip" : "Note"} · {timeAgo(item.created_at)}{item.edited ? " · edited" : ""}
      </span>
      <span className="flex-1" />
      {extraAction}
      {item.mine && item.visibility && !editing && (
        <VisibilityPicker value={item.visibility} onChange={changeVisibility} align="right" {...visibilityOptions} />
      )}
      <PostMenu items={menu} className="wb-feed-item__menu" />
    </header>
  );
}

function HighlightBody({ item, onChange }) {
  const href = highlightHref(item);
  return (
    <>
      <blockquote className="wb-hl-quote wb-feed-item__quote">
        <mark style={{ "--hl": highlightCss(item.color) }}>{item.quote}</mark>
      </blockquote>
      <a href={href} className="wb-feed-item__source"><BookOpen size={13} aria-hidden="true" /> {item.book_title} · {item.chapter_title}</a>
      <HighlightNote highlight={{ ...item, by: item.by === null ? null : item.author?.name?.split(" ")[0] }} onChange={(h) => onChange?.({ ...item, note: h.note, mentions: h.mentions })} />
    </>
  );
}

function NoteBody({ item, editing, setEditing, groups, max, imagesMax, compact, onChange, onDelete }) {
  const [open, setOpen] = useState(null);

  if (editing) {
    return (
      <NoteEditor note={item} groups={groups} max={max} imagesMax={imagesMax} autoFocus onDelete={onDelete}
        onCancel={() => setEditing(false)} onSaved={(saved) => { onChange?.(saved); setEditing(false); }} />
    );
  }

  const images = item.images || [];
  return (
    <>
      {item.chip && <SharedChip chip={item.chip} hidden={item.chip_hidden} />}
      {item.body?.trim() && <Markdown source={item.body} hashtags mentions={item.mentions} mine={item.mentions_me} className={`wb-feed-item__body ${compact ? "wb-feed-item__body--compact" : ""}`} />}
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
      {item.mine && item.groups?.length > 0 && (
        <div className="wb-feed-item__foot">
          <span className="wb-feed-item__shared">Shared to {item.groups.map((g) => g.title).join(", ")}</span>
        </div>
      )}
    </>
  );
}

// What a shared chip says about itself, under its name
export function chipLine(chip) {
  const on = chip.on ? dayLabel(chip.on, { month: "long", day: "numeric", year: "numeric" }) : "";
  if (chip.source === "given") return `From ${chip.group?.title}${chip.given_by ? `, given by ${chip.given_by}` : ""} · ${on}`;
  if (chip.kind === "meeting") return `Meeting Maker${chip.meeting ? meetingPlace(chip.meeting, " at ") : ""} · ${on}`;
  if (chip.kind === "round") return `Sobriety · ${on}`;
  return on;
}

// A chip on a note, as it looked when it was shared (it never changes). Opens big, to spin.
function SharedChip({ chip, hidden }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`See the ${chip.label} chip`}
        className="wb-feed-item__chip flex w-full items-center gap-3 rounded-2xl !bg-transparent p-1 text-left">
        <FlatChip chip={chip} design={chip.design} size={84} />
        <span className="min-w-0">
          <span className="block text-lg font-semibold text-slate-900 dark:text-white">{chip.label}</span>
          <span className="block text-sm text-slate-500 dark:text-neutral-400">{chipLine(chip)}</span>
          {chip.edition && <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-400">{chip.edition.name}{chip.edition.serial ? ` · No. ${chip.edition.serial}` : ""}</span>}
        </span>
      </button>
      {hidden && (
        <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400">
          <EyeOff className="size-3.5" /> Only you see this now: your sobriety date changed, so this chip isn't yours at the moment.
        </p>
      )}
      {open && <ChipModal chip={chip} design={chip.design} text={chipLine(chip)} onClose={() => setOpen(false)} />}
    </>
  );
}
