import React, { useState } from "react";
import { MessageCircleHeart, UserRound } from "lucide-react";
import { api } from "../groups/lib";
import Dialog from "../groups/chat/Dialog";
import { ErrorNote, primaryButton, quietButton } from "../groups/ui";
import { showToast } from "../../lib/toast";

// The reading a note links to (/readings/123 on this site), for "Move to the reading's shares"
export function linkedReadingId(body) {
  const match = /(?:^|[\s(<])(?:https?:\/\/[^\s/]+)?\/readings\/(\d+)(?![\w/])/.exec(body || "");
  return match ? Number(match[1]) : null;
}

// Moving a note about a reading into that reading's Shares (ReadingShares): it's posted there
// as "A member" or under their name, waits for the reading's poster to approve it like any share,
// and the note is deleted unless they untick it. Words only: a note's pictures don't move.
export default function MoveToSharesDialog({ note, readingId, onClose, onMoved }) {
  const [anonymous, setAnonymous] = useState(true);
  const [deleteNote, setDeleteNote] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const move = async () => {
    setSaving(true);
    setError(null);
    try {
      const share = await api(`/readings/${readingId}/shares`, {
        method: "POST",
        body: { share: { body: note.body, anonymous, from_note_id: note.id, delete_note: deleteNote } },
      });
      showToast(share.status === "pending" ? "Moved. It shows to others once the reading's poster approves it." : "Moved to the reading's shares.");
      onMoved?.(deleteNote);
      onClose();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  const pill = (on) => `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${on ? "!bg-sky-600 !text-white" : "!bg-neutral-100 text-slate-700 dark:!bg-neutral-800 dark:text-neutral-200"}`;
  return (
    <Dialog title="Move to the reading's shares" onClose={onClose}
      footer={(
        <>
          <a href={`/readings/${readingId}#shares`} className="text-sm text-accent hover:underline">Open the reading</a>
          <span className="flex-1" />
          <button type="button" className={quietButton} onClick={onClose}>Cancel</button>
          <button type="button" className={primaryButton} onClick={move} disabled={saving}><MessageCircleHeart className="size-4" /> {saving ? "Moving…" : "Move"}</button>
        </>
      )}>
      <p className="mb-4">Your note's words go to the Shares under the reading it links to, where the reading's poster approves them. Pictures don't move.</p>
      <div className="mb-4 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Share as">
        <span className="text-slate-500 dark:text-neutral-400">Share as</span>
        <button type="button" role="radio" aria-checked={anonymous} className={pill(anonymous)} onClick={() => setAnonymous(true)}><UserRound size={14} /> A member</button>
        <button type="button" role="radio" aria-checked={!anonymous} className={pill(!anonymous)} onClick={() => setAnonymous(false)}>{note.author?.name || "My name"}</button>
      </div>
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={deleteNote} onChange={(e) => setDeleteNote(e.target.checked)} className="mt-0.5" />
        <span>Delete the note from my timeline once it's moved{anonymous ? " (so it isn't tied to your name)" : ""}</span>
      </label>
      <div className="mt-2"><ErrorNote error={error} /></div>
    </Dialog>
  );
}
