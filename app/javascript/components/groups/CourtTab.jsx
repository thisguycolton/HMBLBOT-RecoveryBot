import React, { useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, Plus, RotateCcw } from "lucide-react";
import { api } from "./lib";
import { Card, ErrorNote, Tray, copy, primaryButton, quietButton } from "./ui";
import CourtLetterPreview from "../CourtLetterPreview";

// Group admins: this group's court verification form link (not linked anywhere public)
// and the verifications sent from it
export default function CourtTab({ group, setGroup }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api(`/groups/${group.slug}/court_verifications`).then((d) => setRows(d.verifications)).catch((e) => setError(e.message));
  }, [group.slug]);

  return (
    <div className="space-y-5">
      <Tray label="The group's form">
        <Card className="space-y-2 p-3">
          <p className="text-sm text-slate-700 dark:text-neutral-200">
            Hosts use this link to send attendance letters. It lists this group's meetings and puts the group's name on the letter.
            It isn't linked anywhere on the site, so share it only with the people who sign.
          </p>
          <div className="flex flex-wrap gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-neutral-100 px-3 py-2 text-xs dark:bg-neutral-800">{group.court_form_url}</code>
            <button type="button" onClick={() => copy(group.court_form_url, () => { setCopied(true); setTimeout(() => setCopied(false), 1500); })} className={quietButton}>
              <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy"}
            </button>
            <a href={group.court_form_url} target="_blank" rel="noreferrer" className={quietButton}><ExternalLink className="h-4 w-4" /> Open</a>
          </div>
        </Card>
      </Tray>

      <CourtEmailEditor group={group} setGroup={setGroup} />

      <ErrorNote error={error} />
      <Tray label="Sent from this group">
        {!rows ? (
          <Card className="p-4 text-sm text-slate-500">Loading…</Card>
        ) : rows.length === 0 ? (
          <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">None yet.</Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-neutral-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">Meeting</th>
                  <th className="px-3 py-2 font-semibold">Attendee</th>
                  <th className="px-3 py-2 font-semibold">Topic</th>
                  <th className="px-3 py-2 font-semibold">Host / signer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {rows.map((v) => (
                  <tr key={v.id} className="align-top">
                    <td className="px-3 py-2 text-slate-700 dark:text-neutral-200">{v.meeting_time_label}{v.meeting && <div className="text-xs text-slate-500">{v.meeting}</div>}</td>
                    <td className="px-3 py-2"><div className="text-slate-900 dark:text-white">{v.respondent_name}</div><div className="text-xs text-slate-500">{v.respondent_email}</div></td>
                    <td className="px-3 py-2 text-slate-700 dark:text-neutral-200">{v.topic}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-neutral-200">{v.host_name}<div className="text-xs text-slate-500">{v.signer_name}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </Tray>
    </div>
  );
}

const fieldClass =
  "w-full rounded-xl border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-neutral-200 focus:ring-2 focus:ring-accent dark:bg-neutral-900 dark:text-white dark:ring-neutral-700";

// The group's court verification email: subject and body with {{placeholders}} on the left,
// and the email as it will arrive on the right, with a chip where each form value will go
function CourtEmailEditor({ group, setGroup }) {
  const email = group.court_email;
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body);
  const [replyTo, setReplyTo] = useState(email.reply_to || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const bodyRef = useRef(null);
  const lastFocus = useRef("body");
  const subjectRef = useRef(null);

  const dirty = subject !== email.subject || body !== email.body || replyTo !== (email.reply_to || "");
  const isDefault = subject === email.default_subject && body.trim() === email.default_body.trim();

  // Put {{key}} where the cursor was, in whichever box was last used
  const insert = (key) => {
    const token = `{{${key}}}`;
    const inSubject = lastFocus.current === "subject";
    const el = inSubject ? subjectRef.current : bodyRef.current;
    const value = inSubject ? subject : body;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    (inSubject ? setSubject : setBody)(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await api(`/groups/${group.slug}`, {
        method: "PATCH",
        body: { group: { court_email_subject: subject, court_email_body: body, court_email_reply_to: replyTo } },
      });
      setGroup(updated);
      setSubject(updated.court_email.subject);
      setBody(updated.court_email.body);
      setReplyTo(updated.court_email.reply_to || "");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Tray label="The email attendees get">
      <form onSubmit={save} className="grid gap-1.5 lg:grid-cols-2">
        <Card className="space-y-3 p-3">
          <p className="text-sm text-slate-700 dark:text-neutral-200">
            Write the letter the way you want it. The highlighted fields are filled in from the form when a host sends it.
          </p>
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Subject</span>
            <input ref={subjectRef} value={subject} onFocus={() => (lastFocus.current = "subject")} onChange={(e) => setSubject(e.target.value)} maxLength={200} className={fieldClass} />
          </label>
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Letter</span>
            <div className="flex flex-wrap gap-1">
              {Object.entries(email.fields).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insert(key)}
                  className="inline-flex items-center gap-1 rounded-full !bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent ring-1 ring-accent/30 hover:!bg-accent/20 dark:!bg-accent/25 dark:text-white dark:ring-accent/50"
                >
                  <Plus className="h-3 w-3" /> {label}
                </button>
              ))}
            </div>
            <textarea
              ref={bodyRef}
              value={body}
              onFocus={() => (lastFocus.current = "body")}
              onChange={(e) => setBody(e.target.value)}
              rows={16}
              maxLength={5000}
              aria-label="Letter"
              className={`${fieldClass} font-mono !text-[13px] leading-relaxed`}
            />
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Group email (optional)</span>
            <input type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="ourgroup@example.com" className={fieldClass} />
            <span className="block text-xs text-slate-500 dark:text-neutral-400">Gets a copy of every letter, and replies from attendees or courts go here.</span>
          </label>
          <ErrorNote error={error} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={saving || !dirty} className={primaryButton}>{saving ? "Saving…" : saved ? "Saved" : "Save email"}</button>
            {!isDefault && (
              <button type="button" onClick={() => { setSubject(email.default_subject); setBody(email.default_body); }} className={quietButton}>
                <RotateCcw className="h-4 w-4" /> Start over from the standard letter
              </button>
            )}
          </div>
        </Card>
        <div className="lg:sticky lg:top-20 lg:self-start">
          <p className="px-2 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Preview</p>
          <CourtLetterPreview groupTitle={group.title} subject={subject} body={body} fields={email.fields} values={{ group: group.title }} />
        </div>
      </form>
    </Tray>
  );
}
