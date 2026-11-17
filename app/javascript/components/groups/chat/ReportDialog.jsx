import React, { useState } from "react";
import { Flag } from "lucide-react";
import { api } from "../lib";
import { showToast } from "../../../lib/toast";
import { ErrorNote, primaryButton, quietButton } from "../ui";
import Dialog from "./Dialog";

// Telling the site admins about something someone wrote (a chat message, note or comment:
// `subject` { type, id }) or about them (`person` alone). Api::UserReportsController keeps a
// copy of what they wrote, so it can still be read if it's deleted.
export default function ReportDialog({ subject = null, person, onClose }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const send = async () => {
    setSaving(true);
    setError(null);
    try {
      await api("/user_reports", { method: "POST", body: subject ? { subject_type: subject.type, subject_id: subject.id, reason } : { user_id: person.id, reason } });
      showToast("Thanks. The site admins will take a look.");
      onClose();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <Dialog title={`Report ${person?.name || "this"}`} onClose={onClose}
      footer={(
        <>
          <span className="flex-1" />
          <button type="button" className={quietButton} onClick={onClose}>Cancel</button>
          <button type="button" className={primaryButton} onClick={send} disabled={saving || !reason.trim()}><Flag className="size-4" /> {saving ? "Sending…" : "Send report"}</button>
        </>
      )}>
      <p className="mb-3 text-slate-600 dark:text-neutral-300">
        This goes to RecoveryBot's site admins, not to {person?.name?.split(" ")[0] || "them"}. {subject ? "They'll see what was written, even if it's deleted later." : ""}
      </p>
      <label className="block">
        <span className="mb-1 block font-medium text-slate-900 dark:text-white">What's wrong?</span>
        <textarea autoFocus rows={4} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Harassment, spam, sharing someone's anonymity…"
          className="w-full rounded-xl border-0 bg-neutral-100 px-3 py-2 text-sm text-slate-900 ring-1 ring-neutral-200 focus:ring-2 focus:ring-accent dark:bg-neutral-800 dark:text-white dark:ring-neutral-700" />
      </label>
      <div className="mt-2"><ErrorNote error={error} /></div>
    </Dialog>
  );
}
