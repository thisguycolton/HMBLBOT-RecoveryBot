import React, { useEffect, useState } from "react";
import { CheckCircle2, Copy, Mail, RotateCcw, Smartphone, Trash2 } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import SegmentedControl from "../ui/SegmentedControl";
import { api } from "../topicificator_admin/api";
import { buttonClass } from "../topicificator_admin/App";
import { formatCount } from "./App";
import { Badge, shortDate } from "./UsersPage";
import { InlineSkeleton } from "../ui/Skeleton";

const STATUSES = [
  { value: "new", label: "New" },
  { value: "invited", label: "Invited" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" },
];
const LABELS = { new: "New", invited: "Invited", done: "Done" };

// People who asked to try the iPhone app (/testflight). Copy the emails into App Store Connect
// (TestFlight > testers), then mark them invited; done is for once they're in.
export default function TestflightRequestsPage({ notify }) {
  const [status, setStatus] = useState("new");
  const [data, setData] = useState(null);

  async function load() {
    try {
      setData(await api(`/testflight_requests?${new URLSearchParams({ status })}`));
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

  const rows = data?.testflight_requests || [];

  async function copyEmails() {
    // One per line pastes straight into App Store Connect's "add testers" box and a spreadsheet
    const text = rows.map((r) => r.email).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      notify(`Copied ${rows.length} email${rows.length === 1 ? "" : "s"}.`);
    } catch {
      window.prompt("Copy these emails", text.replace(/\n/g, ", "));
    }
  }

  function downloadCsv() {
    // App Store Connect's "Import testers" takes First Name, Last Name, Email
    const cell = (v) => `"${String(v || "").replace(/"/g, '""')}"`;
    const lines = rows.map((r) => {
      const [first, ...rest] = r.name.split(/\s+/);
      return [first, rest.join(" "), r.email].map(cell).join(",");
    });
    const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `testflight-${status}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const counts = data?.counts || {};
  const subtitle = data
    ? `${formatCount(counts.new || 0)} new, ${formatCount(counts.invited || 0)} invited${data.total > data.limit ? `, showing the ${data.limit} newest` : ""}`
    : <InlineSkeleton className="w-40" />;

  return (
    <Shell>
      <ShellBand icon={Smartphone} title="TestFlight requests" subtitle={subtitle} />
      <ShellPanel position="middle" className="p-4 space-y-3">
        <SegmentedControl options={STATUSES} value={status} onChange={setStatus} />
        <p className="text-sm text-slate-500 dark:text-neutral-400 !font-sans">
          People ask at <a href="/testflight" target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">/testflight</a>.
          To show the form to everyone, add a site notice with the link <code>/testflight</code>.
        </p>
        {rows.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass.secondary} onClick={copyEmails}><Copy className="w-4 h-4" /> Copy {rows.length} email{rows.length === 1 ? "" : "s"}</button>
            <button type="button" className={buttonClass.secondary} onClick={downloadCsv}>Download CSV for App Store Connect</button>
            {status === "new" && (
              <button type="button" className={buttonClass.primary}
                onClick={() => act("/testflight_requests/bulk", { method: "PATCH", body: { ids: rows.map((r) => r.id), status: "invited" } }, "Marked invited.")}>
                <Mail className="w-4 h-4" /> Mark all {rows.length} invited
              </button>
            )}
          </div>
        )}
      </ShellPanel>
      <ShellPanel position="bottom" className="divide-y divide-neutral-100 dark:divide-neutral-800 !font-sans [&_*]:!font-sans">
        {!data ? null : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">{status === "new" ? "Nobody waiting for an invite." : "No requests here."}</p>
        ) : (
          rows.map((r) => <Request key={r.id} request={r} act={act} showStatus={status === "all"} />)
        )}
      </ShellPanel>
    </Shell>
  );
}

function Request({ request: r, act, showStatus }) {
  const mark = (to, message) => act(`/testflight_requests/${r.id}`, { method: "PATCH", body: { status: to } }, message);

  return (
    <article className="p-4 space-y-2 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white break-words">
            {r.name} <span className="font-normal text-slate-500 dark:text-neutral-400 select-all">&lt;{r.email}&gt;</span>
          </p>
          <p className="text-slate-500 dark:text-neutral-400">
            {showStatus && <Badge tone={r.status === "new" ? "warn" : undefined}>{LABELS[r.status]}</Badge>}
            {shortDate(r.created_at)}
            {r.account ? ` · signed in as @${r.account.username}` : " · not signed in"}
            {r.status !== "new" && r.invited_at && <> · Invited {shortDate(r.invited_at)}{r.handled_by ? ` by ${r.handled_by}` : ""}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {r.status === "new" && (
            <button type="button" className={buttonClass.primary} onClick={() => mark("invited", "Marked invited.")}>
              <Mail className="w-4 h-4" /> Mark invited
            </button>
          )}
          {r.status === "invited" && (
            <button type="button" className={buttonClass.primary} onClick={() => mark("done", "Marked done.")}>
              <CheckCircle2 className="w-4 h-4" /> Mark done
            </button>
          )}
          {r.status !== "new" && (
            <button type="button" className={buttonClass.secondary} onClick={() => mark("new", "Moved back to new.")}>
              <RotateCcw className="w-4 h-4" /> Back to new
            </button>
          )}
          <button
            type="button"
            className={buttonClass.danger}
            aria-label="Delete request"
            onClick={() => window.confirm("Delete this request for good?") && act(`/testflight_requests/${r.id}`, { method: "DELETE" }, "Request deleted.")}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {r.note && <p className="text-slate-900 dark:text-white whitespace-pre-wrap break-words">{r.note}</p>}
    </article>
  );
}
