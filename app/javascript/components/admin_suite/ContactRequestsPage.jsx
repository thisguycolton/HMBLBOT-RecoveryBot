import React, { useEffect, useState } from "react";
import { CheckCircle2, Inbox, Mail, RotateCcw, Trash2 } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import SegmentedControl from "../ui/SegmentedControl";
import { api } from "../topicificator_admin/api";
import { buttonClass } from "../topicificator_admin/App";
import { formatCount } from "./App";
import { Badge, shortDate } from "./UsersPage";

const STATUSES = [
  { value: "open", label: "To answer" },
  { value: "handled", label: "Handled" },
  { value: "all", label: "All" },
];

// Messages from the Contact page (/contact). Each also went to support@hmblbot.com by email;
// this is where they're kept and checked off.
export default function ContactRequestsPage({ notify }) {
  const [status, setStatus] = useState("open");
  const [data, setData] = useState(null);

  async function load() {
    try {
      setData(await api(`/contact_requests?${new URLSearchParams({ status })}`));
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

  const subtitle = data
    ? `${formatCount(data.open)} to answer${data.total > data.limit ? `, showing the ${data.limit} newest` : ""}`
    : "Loading…";

  return (
    <Shell>
      <ShellBand icon={Inbox} title="Contact requests" subtitle={subtitle} />
      <ShellPanel position="middle" className="p-4">
        <SegmentedControl options={STATUSES} value={status} onChange={setStatus} />
      </ShellPanel>
      <ShellPanel position="bottom" className="divide-y divide-neutral-100 dark:divide-neutral-800 !font-sans [&_*]:!font-sans">
        {!data ? null : data.contact_requests.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">{status === "open" ? "Nothing waiting for an answer." : "No messages here."}</p>
        ) : (
          data.contact_requests.map((r) => <Request key={r.id} request={r} act={act} />)
        )}
      </ShellPanel>
    </Shell>
  );
}

function Request({ request: r, act }) {
  const handled = r.status === "handled";
  const reply = `mailto:${r.email}?subject=${encodeURIComponent(`Re: ${r.topic_label}`)}`;

  return (
    <article className="p-4 space-y-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white break-words">
            {r.name || "No name given"} <span className="font-normal text-slate-500 dark:text-neutral-400">&lt;{r.email}&gt;</span>
          </p>
          <p className="text-slate-500 dark:text-neutral-400">
            <Badge tone={r.topic === "privacy" ? "warn" : undefined}>{r.topic_label}</Badge>
            {shortDate(r.created_at)}
            {r.account ? ` · signed in as @${r.account.username}` : " · not signed in"}
            {handled && <> · Handled{r.handled_by ? ` by ${r.handled_by}` : ""}{r.handled_at ? `, ${shortDate(r.handled_at)}` : ""}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <a href={reply} className={buttonClass.secondary}><Mail className="w-4 h-4" /> Reply</a>
          {handled ? (
            <button type="button" className={buttonClass.secondary} onClick={() => act(`/contact_requests/${r.id}`, { method: "PATCH", body: { status: "open" } }, "Moved back to answer.")}>
              <RotateCcw className="w-4 h-4" /> Reopen
            </button>
          ) : (
            <button type="button" className={buttonClass.primary} onClick={() => act(`/contact_requests/${r.id}`, { method: "PATCH", body: { status: "handled" } }, "Marked handled.")}>
              <CheckCircle2 className="w-4 h-4" /> Mark handled
            </button>
          )}
          <button
            type="button"
            className={buttonClass.danger}
            aria-label="Delete message"
            onClick={() => window.confirm("Delete this message for good?") && act(`/contact_requests/${r.id}`, { method: "DELETE" }, "Message deleted.")}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="text-slate-900 dark:text-white whitespace-pre-wrap break-words">{r.message}</p>
    </article>
  );
}
