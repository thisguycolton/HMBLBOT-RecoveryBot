import React, { useEffect, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { api } from "./lib";
import { Card, ErrorNote, Tray, copy, quietButton } from "./ui";

// Group admins: this group's court verification form link (not linked anywhere public)
// and the verifications sent from it
export default function CourtTab({ group }) {
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
