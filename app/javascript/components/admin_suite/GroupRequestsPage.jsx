import React, { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, UserPlus, XCircle } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { api } from "../topicificator_admin/api";
import { buttonClass } from "../topicificator_admin/App";
import { formatCount } from "./App";
import { Badge, shortDate } from "./UsersPage";
import { InlineSkeleton } from "../ui/Skeleton";

// Groups people started from an intergroup listing (AA Intergroup's or an imported meeting
// list's). Each waits here until a site admin approves it (it goes live, run by whoever started
// it) or declines it (it's removed, and they're told why if you say).
export default function GroupRequestsPage({ notify }) {
  const [data, setData] = useState(null);

  async function load() {
    try {
      setData(await api("/group_requests"));
    } catch (e) {
      notify(e.message, "error");
    }
  }
  useEffect(() => { load(); }, []);

  async function act(path, body, message) {
    try {
      await api(path, { method: "POST", body });
      notify(message);
      await load();
      return true;
    } catch (e) {
      notify(e.message, "error");
      return false;
    }
  }

  const rows = data?.group_requests || [];
  const subtitle = data ? `${formatCount(rows.length)} waiting for approval` : <InlineSkeleton className="w-40" />;

  return (
    <Shell>
      <ShellBand icon={UserPlus} title="Group requests" subtitle={subtitle} />
      <ShellPanel position="bottom" className="divide-y divide-neutral-100 dark:divide-neutral-800 !font-sans [&_*]:!font-sans">
        {!data ? null : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No groups waiting. When someone starts a group from a meeting listing, it shows up here.</p>
        ) : (
          rows.map((r) => <Request key={r.id} request={r} act={act} />)
        )}
      </ShellPanel>
    </Shell>
  );
}

function Request({ request: r, act }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const s = r.started_by;

  async function run(path, body, message) {
    setBusy(true);
    const ok = await act(path, body, message);
    if (!ok) setBusy(false);
  }

  return (
    <article className="p-4 space-y-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white break-words">{r.title}</p>
          <p className="text-slate-500 dark:text-neutral-400">
            {r.listing && <Badge>{r.listing.source}</Badge>}
            Started {shortDate(r.created_at)}
            {s ? <> by <a className="underline" href={`/people/${s.username}`}>{s.name}</a> &lt;{s.email}&gt;, member since {shortDate(s.joined_at)}</> : " by a deleted account"}
            {s && !s.confirmed && <> <Badge tone="warn">Email not confirmed</Badge></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <a href={`/groups/${r.slug}`} className={buttonClass.secondary}><ArrowUpRight className="w-4 h-4" /> See its page</a>
          <button type="button" disabled={busy} className={buttonClass.primary}
            onClick={() => run(`/group_requests/${r.id}/approve`, {}, `${r.title} is live.`)}>
            <CheckCircle2 className="w-4 h-4" /> Approve
          </button>
          <button type="button" disabled={busy} className={buttonClass.secondary} onClick={() => setDeclining((v) => !v)}>
            <XCircle className="w-4 h-4" /> Decline
          </button>
        </div>
      </div>
      {r.description && <p className="text-slate-700 dark:text-neutral-300 whitespace-pre-wrap break-words">{r.description}</p>}
      {r.meetings.length > 0 && (
        <ul className="text-slate-600 dark:text-neutral-400 list-disc pl-5">
          {r.meetings.map((m, i) => <li key={i}>{m.name}: {m.schedule_label}</li>)}
        </ul>
      )}
      {r.listing && (
        <p className="text-slate-500 dark:text-neutral-400">
          From the listing <a className="underline" href={`/groups/find/${encodeURIComponent(r.listing.slug)}`}>{r.listing.group_name || r.listing.name}</a>
        </p>
      )}
      {declining && (
        <div className="space-y-2 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
          <label className="block text-slate-700 dark:text-neutral-300" htmlFor={`reason-${r.id}`}>
            Why not? {s ? `${s.name} sees this.` : ""} (optional)
          </label>
          <textarea id={`reason-${r.id}`} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2" />
          <button type="button" disabled={busy} className={buttonClass.danger}
            onClick={() => run(`/group_requests/${r.id}/decline`, { reason }, `${r.title} was declined.`)}>
            Decline and remove it
          </button>
        </div>
      )}
    </article>
  );
}
