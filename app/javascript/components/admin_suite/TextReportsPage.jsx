import React, { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, MessageSquare, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import SegmentedControl from "../ui/SegmentedControl";
import { inputClass } from "../ui/styles";
import { api } from "../topicificator_admin/api";
import { buttonClass } from "../topicificator_admin/App";
import { formatCount } from "./App";
import { Badge, shortDate } from "./UsersPage";

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
];

// Readers' reports of problems in book text, made from the reader's selection menu.
export default function TextReportsPage({ notify }) {
  const [status, setStatus] = useState("open");
  const [data, setData] = useState(null);

  async function load() {
    try {
      setData(await api(`/text_reports?${new URLSearchParams({ status })}`));
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
      return true;
    } catch (e) {
      notify(e.message, "error");
      return false;
    }
  }

  const subtitle = data
    ? `${formatCount(data.open)} open${data.total > data.limit ? `, showing the ${data.limit} newest` : ""}`
    : "Loading…";

  return (
    <Shell>
      <ShellBand icon={TriangleAlert} title="Text reports" subtitle={subtitle} />
      <ShellPanel position="middle" className="p-4">
        <SegmentedControl options={STATUSES} value={status} onChange={setStatus} />
      </ShellPanel>
      <ShellPanel position="bottom" className="divide-y divide-neutral-100 dark:divide-neutral-800 !font-sans [&_*]:!font-sans">
        {!data ? null : data.text_reports.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">{status === "open" ? "No open reports." : "No reports here."}</p>
        ) : (
          data.text_reports.map((r) => <Report key={r.id} report={r} act={act} />)
        )}
      </ShellPanel>
    </Shell>
  );
}

function Report({ report: r, act }) {
  const [comment, setComment] = useState("");
  const resolved = r.status === "resolved";

  async function addComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    if (await act(`/text_reports/${r.id}/comment`, { method: "POST", body: { body: comment } })) setComment("");
  }

  return (
    <article className="p-4 space-y-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <a href={r.path} className="font-semibold text-slate-900 dark:text-white hover:text-accent inline-flex items-center gap-1">
            {r.book.title} · {r.chapter.title} <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <p className="text-slate-500 dark:text-neutral-400">
            {r.reporter}, {shortDate(r.created_at)}
            {resolved && <> · <Badge>Resolved{r.resolved_by ? ` by ${r.resolved_by}` : ""}</Badge></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {resolved ? (
            <button type="button" className={buttonClass.secondary} onClick={() => act(`/text_reports/${r.id}`, { method: "PATCH", body: { status: "open" } }, "Report reopened.")}>
              <RotateCcw className="w-4 h-4" /> Reopen
            </button>
          ) : (
            <button type="button" className={buttonClass.primary} onClick={() => act(`/text_reports/${r.id}`, { method: "PATCH", body: { status: "resolved" } }, "Report resolved.")}>
              <CheckCircle2 className="w-4 h-4" /> Resolve
            </button>
          )}
          <button
            type="button"
            className={buttonClass.danger}
            aria-label="Delete report"
            onClick={() => window.confirm("Delete this report and its comments?") && act(`/text_reports/${r.id}`, { method: "DELETE" }, "Report deleted.")}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <blockquote className="border-l-4 border-amber-400 pl-3 text-slate-700 dark:text-neutral-300 whitespace-pre-wrap">
        {r.quote.length > 800 ? `${r.quote.slice(0, 800)}…` : r.quote}
      </blockquote>
      <p className="text-slate-900 dark:text-white whitespace-pre-wrap">{r.message}</p>

      {r.comments.length > 0 && (
        <ul className="space-y-2 rounded-xl bg-slate-50 dark:bg-neutral-800/60 p-3">
          {r.comments.map((c) => (
            <li key={c.id}>
              <p className="text-xs text-slate-500 dark:text-neutral-400">{c.by}, {shortDate(c.created_at)}</p>
              <p className="text-slate-800 dark:text-neutral-200 whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form className="flex gap-2" onSubmit={addComment}>
        <input className={inputClass} placeholder="Add a comment for other admins" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={5000} />
        <button type="submit" className={buttonClass.secondary} disabled={!comment.trim()}>
          <MessageSquare className="w-4 h-4" /> Comment
        </button>
      </form>
    </article>
  );
}
