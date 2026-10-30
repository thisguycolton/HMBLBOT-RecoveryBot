import React, { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, RotateCcw, ShieldAlert, Trash2 } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import SegmentedControl from "../ui/SegmentedControl";
import { api } from "../topicificator_admin/api";
import { buttonClass } from "../topicificator_admin/App";
import { formatCount } from "./App";
import { Badge, shortDate } from "./UsersPage";

const STATUSES = [
  { value: "open", label: "To review" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
];

// What members reported about someone (UserReport): a chat message, note or comment they
// wrote, kept as it was, or the person. Each also came to the site admins' bell.
export default function UserReportsPage({ notify }) {
  const [status, setStatus] = useState("open");
  const [data, setData] = useState(null);

  async function load() {
    try {
      setData(await api(`/user_reports?${new URLSearchParams({ status })}`));
    } catch (e) {
      notify(e.message, "error");
    }
  }
  useEffect(() => { load(); }, [status]);

  async function act(path, options, message) {
    try {
      await api(path, options);
      if (message) notify(message);
      await load();
    } catch (e) {
      notify(e.message, "error");
    }
  }

  const subtitle = data ? `${formatCount(data.open)} to review${data.total > data.limit ? `, showing the ${data.limit} newest` : ""}` : "Loading…";

  return (
    <Shell>
      <ShellBand icon={ShieldAlert} title="Reports about people" subtitle={subtitle} />
      <ShellPanel position="middle" className="p-4">
        <SegmentedControl options={STATUSES} value={status} onChange={setStatus} />
      </ShellPanel>
      <ShellPanel position="bottom" className="divide-y divide-neutral-100 dark:divide-neutral-800 !font-sans [&_*]:!font-sans">
        {!data ? null : data.reports.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">{status === "open" ? "Nothing waiting for review." : "No reports here."}</p>
        ) : (
          data.reports.map((r) => <Report key={r.id} report={r} act={act} />)
        )}
      </ShellPanel>
    </Shell>
  );
}

function Report({ report: r, act }) {
  const resolved = r.status === "resolved";
  return (
    <article className="space-y-3 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-semibold text-slate-900 dark:text-white">
            <a href={`/people/${r.user.username}`} className="hover:underline">{r.user.name}</a>
            <span className="font-normal text-slate-500 dark:text-neutral-400"> &lt;{r.user.email}&gt;</span>
          </p>
          <p className="text-slate-500 dark:text-neutral-400">
            <Badge tone="warn">{r.where}</Badge>
            {shortDate(r.created_at)} · reported by {r.reporter.name} (@{r.reporter.username})
            {r.quote && !r.still_there && " · since deleted"}
            {resolved && <> · Resolved{r.resolved_by ? ` by ${r.resolved_by}` : ""}{r.resolved_at ? `, ${shortDate(r.resolved_at)}` : ""}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {r.group && <a href={`/groups/${r.group.slug}/members`} className={buttonClass.secondary}><ExternalLink className="h-4 w-4" /> {r.group.title}</a>}
          {resolved ? (
            <button type="button" className={buttonClass.secondary} onClick={() => act(`/user_reports/${r.id}`, { method: "PATCH", body: { status: "open" } }, "Moved back to review.")}>
              <RotateCcw className="h-4 w-4" /> Reopen
            </button>
          ) : (
            <button type="button" className={buttonClass.primary} onClick={() => act(`/user_reports/${r.id}`, { method: "PATCH", body: { status: "resolved" } }, "Marked resolved.")}>
              <CheckCircle2 className="h-4 w-4" /> Mark resolved
            </button>
          )}
          <button type="button" className={buttonClass.danger} aria-label="Delete report"
            onClick={() => window.confirm("Delete this report for good?") && act(`/user_reports/${r.id}`, { method: "DELETE" }, "Report deleted.")}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {r.quote && <blockquote className="whitespace-pre-wrap break-words rounded-xl bg-neutral-100 px-3 py-2 text-slate-800 dark:bg-neutral-800 dark:text-neutral-100">{r.quote}</blockquote>}
      <p className="whitespace-pre-wrap break-words text-slate-900 dark:text-white"><span className="font-semibold">Why: </span>{r.reason}</p>
    </article>
  );
}
