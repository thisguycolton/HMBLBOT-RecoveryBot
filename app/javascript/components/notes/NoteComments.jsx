import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import Markdown from "../book/Markdown";
import Avatar from "../groups/Avatar";
import { api } from "../groups/lib";
import { timeAgo } from "../groups/page/lib";
import { showToast } from "../../lib/toast";
import MarkdownEditor from "./MarkdownEditor";
import NoteActions from "./NoteActions";

const SHOWN = 2;

// @ in a comment offers people (role handles need a group, which comments don't have)
const NO_GROUPS = { groups: [] };

// The comments under a note, each like a small note (Markdown, reactions, edited or
// deleted by its writer; the note's author can delete any), with a box to add one. The
// last two show until "View all". `open` shows the box even before there are comments;
// its ref's focus() opens and focuses it (the Comment button).
const NoteComments = forwardRef(function NoteComments({ note, onChange }, ref) {
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const comments = note.comments || [];
  const shown = all ? comments : comments.slice(-SHOWN);

  useImperativeHandle(ref, () => ({ focus: () => { setOpen(true); requestAnimationFrame(() => boxRef.current?.focus()); } }));

  const set = (list) => onChange?.({ ...note, comments: list, comment_count: list.length });
  const replace = (c) => set(comments.map((x) => (x.id === c.id ? c : x)));

  if (!note.can_comment && comments.length === 0) return null;
  return (
    <div className="wb-comments">
      {comments.length > shown.length && (
        <button type="button" className="wb-comments__more" onClick={() => setAll(true)}>
          View all {comments.length} comments
        </button>
      )}
      {shown.map((c) => (
        <Comment key={c.id} comment={c} onChange={replace} onRemove={() => set(comments.filter((x) => x.id !== c.id))} />
      ))}
      {note.can_comment && (open || comments.length > 0) && (
        <CommentBox ref={boxRef} noteId={note.id} onPosted={(c) => { set([...comments, c]); setAll(true); }} />
      )}
    </div>
  );
});

export default NoteComments;

function Comment({ comment, onChange, onRemove }) {
  const [editing, setEditing] = useState(false);
  const destroy = async () => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await api(`/note_comments/${comment.id}`, { method: "DELETE" });
      onRemove();
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  };

  return (
    <div className="wb-comment">
      <a href={`/people/${comment.author.username}`} className="wb-comment__avatar"><Avatar person={comment.author} size={28} /></a>
      <div className="wb-comment__main">
        {editing ? (
          <CommentBox comment={comment} onPosted={(c) => { onChange(c); setEditing(false); }} onCancel={() => setEditing(false)} />
        ) : (
          <div className="wb-comment__bubble">
            <div className="wb-comment__head">
              <a href={`/people/${comment.author.username}`}>{comment.author.name}</a>
              <span>{timeAgo(comment.created_at)}{comment.edited ? " · edited" : ""}</span>
              <span className="flex-1" />
              {comment.mine && (
                <button type="button" className="wb-comment__tool" onClick={() => setEditing(true)} aria-label="Edit your comment" title="Edit"><Pencil size={13} /></button>
              )}
              {comment.can_remove && (
                <button type="button" className="wb-comment__tool wb-comment__tool--delete" onClick={destroy} aria-label="Delete the comment" title="Delete"><Trash2 size={13} /></button>
              )}
            </div>
            <Markdown source={comment.body} mentions={comment.mentions} className="wb-comment__body" />
          </div>
        )}
        {!editing && <NoteActions note={comment} path={`/note_comments/${comment.id}`} onChange={onChange} small />}
      </div>
    </div>
  );
}

// Writing a comment (or changing `comment`): Markdown with the format pill, Enter posts,
// Shift+Enter makes a new line, Esc cancels an edit
const CommentBox = forwardRef(function CommentBox({ noteId, comment = null, onPosted, onCancel }, ref) {
  const [body, setBody] = useState(comment?.body || "");
  const [saving, setSaving] = useState(false);

  const post = async () => {
    if (!body.trim() || saving) return;
    setSaving(true);
    try {
      const saved = comment
        ? await api(`/note_comments/${comment.id}`, { method: "PATCH", body: { body } })
        : await api(`/timeline_notes/${noteId}/comments`, { method: "POST", body: { body } });
      if (!comment) setBody("");
      onPosted(saved);
    } catch (e) {
      showToast(e.message || "Couldn't post your comment.", { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="wb-comment-box" onSubmit={(e) => { e.preventDefault(); post(); }}>
      <MarkdownEditor ref={ref} value={body} onChange={setBody} minRows={1} maxLength={2000} autoFocus={!!comment} mentions={NO_GROUPS}
        placeholder={comment ? "" : "Write a comment…"} aria-label={comment ? "Your comment" : "Write a comment"}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); post(); }
          if (e.key === "Escape" && onCancel) { e.stopPropagation(); onCancel(); }
        }} />
      {(body.trim() || comment) && (
        <div className="wb-comment-box__actions">
          {onCancel && <button type="button" className="wb-btn" onClick={onCancel} disabled={saving}>Cancel</button>}
          <button type="submit" className="wb-btn wb-btn--reversed" disabled={saving || !body.trim()}>{saving ? "Posting…" : comment ? "Save" : "Comment"}</button>
        </div>
      )}
    </form>
  );
});
