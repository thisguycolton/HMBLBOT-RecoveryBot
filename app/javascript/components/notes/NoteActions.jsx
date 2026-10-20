import React, { useEffect, useRef, useState } from "react";
import { HandHeart, Heart, MessageCircle, Repeat2, ThumbsUp } from "lucide-react";
import Avatar from "../groups/Avatar";
import { api } from "../groups/lib";
import { showToast } from "../../lib/toast";
import { VISIBILITY } from "./lib";

export const REACTIONS = [
  { value: "like", label: "Like", icon: ThumbsUp },
  { value: "love", label: "Love", icon: Heart },
  { value: "hugs", label: "Hugs", icon: HandHeart },
];
const reactionOf = (value) => REACTIONS.find((r) => r.value === value);

// Under a note: Like, Love and Hugs (one each, tap yours again to take it back), who
// reacted, Comment (with `onComment`), and Repost to your own timeline (only for notes
// their author shares with Members; the server says so in `can_repost`). `onChange` gets
// the note back. A comment has the same reactions (`path` is where it lives, `small` a
// tighter row).
export default function NoteActions({ note, onChange, onComment, path = `/timeline_notes/${note.id}`, small = false }) {
  const [busy, setBusy] = useState(false);

  const run = async (optimistic, request, failure) => {
    if (busy) return;
    const previous = note;
    setBusy(true);
    onChange?.({ ...note, ...optimistic });
    try {
      onChange?.(await request());
    } catch (e) {
      onChange?.(previous);
      showToast(e.message || failure, { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const react = (kind) => {
    const taking = note.my_reaction === kind;
    const reactions = { ...note.reactions };
    if (note.my_reaction) reactions[note.my_reaction] = Math.max(0, (reactions[note.my_reaction] || 0) - 1);
    if (!taking) reactions[kind] = (reactions[kind] || 0) + 1;
    run({ reactions, my_reaction: taking ? null : kind },
      () => api(`${path}/reaction`, taking ? { method: "DELETE" } : { method: "PUT", body: { kind } }),
      "Couldn't save that.");
  };

  const repost = (visibility) => run({ reposted: true, repost_count: (note.repost_count || 0) + 1 },
    async () => {
      const made = await api(`/timeline_notes/${note.id}/repost`, { method: "POST", body: { visibility } });
      showToast("Reposted to your timeline.");
      return made.note;
    }, "Couldn't repost it.");

  const unrepost = () => run({ reposted: false, repost_count: Math.max(0, (note.repost_count || 0) - 1) },
    () => api(`/timeline_notes/${note.id}/repost`, { method: "DELETE" }), "Couldn't undo the repost.");

  const reactions = note.reactions || {};
  return (
    <div className={`wb-note-actions ${small ? "wb-note-actions--small" : ""}`}>
      {REACTIONS.map((r) => {
        const Icon = r.icon;
        const mine = note.my_reaction === r.value;
        const count = reactions[r.value] || 0;
        return (
          <button key={r.value} type="button" className={`wb-note-actions__btn wb-note-actions__btn--${r.value}`} aria-pressed={mine} aria-label={count ? `${r.label}, ${count}` : r.label}
            onClick={() => react(r.value)} title={mine ? `Take back your ${r.label.toLowerCase()}` : r.label}>
            <Icon size={14} aria-hidden="true" fill={mine && r.value !== "hugs" ? "currentColor" : "none"} />
            <span>{r.label}</span>
            {count > 0 && <span className="wb-note-actions__count">{count}</span>}
          </button>
        );
      })}
      <WhoReacted reactors={note.reactors || []} />
      <span className="flex-1" />
      {onComment && (
        <button type="button" className="wb-note-actions__btn wb-note-actions__btn--comment" onClick={onComment} aria-label={note.comment_count ? `Comment, ${note.comment_count}` : "Comment"}>
          <MessageCircle size={14} aria-hidden="true" /> <span>Comment</span>
          {note.comment_count > 0 && <span className="wb-note-actions__count">{note.comment_count}</span>}
        </button>
      )}
      {note.reposted ? (
        <button type="button" className="wb-note-actions__btn wb-note-actions__btn--repost" aria-pressed="true" onClick={unrepost} title="Take it off your timeline">
          <Repeat2 size={14} aria-hidden="true" /> <span>Reposted</span>
          {note.repost_count > 0 && <span className="wb-note-actions__count">{note.repost_count}</span>}
        </button>
      ) : note.can_repost ? (
        <RepostMenu count={note.repost_count} onPick={repost} />
      ) : note.repost_count > 0 ? (
        <span className="wb-note-actions__static" title="Reposts"><Repeat2 size={14} aria-hidden="true" /> {note.repost_count}</span>
      ) : null}
    </div>
  );
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc, true); };
  }, [open]);
  return { open, setOpen, ref };
}

// "Lee and 2 others", which opens the list of who reacted and how
function WhoReacted({ reactors }) {
  const { open, setOpen, ref } = usePopover();
  if (reactors.length === 0) return null;
  const first = reactors[0].name.split(" ")[0];
  const label = reactors.length === 1 ? first : `${first} and ${reactors.length - 1} other${reactors.length > 2 ? "s" : ""}`;
  return (
    <div ref={ref} className="relative">
      <button type="button" className="wb-note-actions__who" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{label}</button>
      {open && (
        <ul className="wb-note-actions__menu left-0">
          {reactors.map((p) => {
            const Icon = reactionOf(p.reaction)?.icon || ThumbsUp;
            return (
              <li key={p.id}>
                <a href={`/people/${p.username}`} className="wb-note-actions__person">
                  <Avatar person={p} size={24} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <Icon size={14} aria-label={reactionOf(p.reaction)?.label} className={`wb-note-actions__icon--${p.reaction}`} />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Repost, asking who sees it on your timeline: your followers or every member
function RepostMenu({ count, onPick }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <button type="button" className="wb-note-actions__btn wb-note-actions__btn--repost" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} title="Repost to your timeline">
        <Repeat2 size={14} aria-hidden="true" /> <span>Repost</span>
        {count > 0 && <span className="wb-note-actions__count">{count}</span>}
      </button>
      {open && (
        <ul role="menu" className="wb-note-actions__menu right-0">
          <li className="wb-note-actions__menu-head">Repost to your timeline for</li>
          {VISIBILITY.filter((v) => v.value !== "private").map((v) => {
            const Icon = v.icon;
            return (
              <li key={v.value}>
                <button type="button" role="menuitem" className="wb-note-actions__person" onClick={() => { setOpen(false); onPick(v.value); }}>
                  <Icon size={15} aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block font-semibold">{v.label}</span>
                    <span className="block text-xs opacity-70">{v.note}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
