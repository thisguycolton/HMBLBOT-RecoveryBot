import React, { useState } from "react";
import { Check, CornerDownRight, RotateCcw, Trash2 } from "lucide-react";
import { timeAgo } from "../page/lib";
import Avatar from "../Avatar";
import { primaryButton, quietButton } from "../ui";

// The comments in a document's margin (GroupDocumentComment): threads about some of its words,
// with replies, that the thread's writer or the document's editors resolve. Off unless the
// document turns them on (Document details > Comments). The page underlines their words
// (commentAnchors.js); here are the threads, in the order their words come in the document.

const box = "w-full resize-none rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-white";

function Composer({ placeholder, onSubmit, onCancel, autoFocus = false, compact = false }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(!compact);
  const submit = async (e) => {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try { await onSubmit(text.trim()); setText(""); if (compact) setOpen(false); } finally { setBusy(false); }
  };
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={`${box} text-left text-slate-400`}>{placeholder}</button>;
  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea autoFocus={autoFocus || compact} rows={2} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className={box}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e); if (e.key === "Escape") { setOpen(!compact); onCancel?.(); } }} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => { setText(""); if (compact) setOpen(false); onCancel?.(); }} className={`${quietButton} !py-1 text-xs`}>Cancel</button>
        <button type="submit" disabled={!text.trim() || busy} className={`${primaryButton} !py-1 text-xs`}>{busy ? "Posting…" : "Comment"}</button>
      </div>
    </form>
  );
}

function Said({ comment, onDelete }) {
  return (
    <div className="group/said">
      <div className="flex items-center gap-2">
        <Avatar person={comment.user || { name: "?" }} size={24} />
        <span className="text-sm font-semibold text-slate-900 dark:text-white">{comment.user?.name || "Someone"}</span>
        <span className="text-xs text-slate-500 dark:text-neutral-400" title={new Date(comment.created_at).toLocaleString()}>{timeAgo(comment.created_at)}</span>
        {comment.can_delete && (
          <button type="button" onClick={() => onDelete(comment)} title="Delete" aria-label="Delete this comment"
            className="ml-auto grid size-6 place-items-center rounded-md !bg-transparent text-slate-400 opacity-0 hover:text-rose-600 focus:opacity-100 group-hover/said:opacity-100"><Trash2 className="size-3.5" /></button>
        )}
      </div>
      <p className="mt-1 whitespace-pre-line break-words text-sm text-slate-800 dark:text-neutral-200">{comment.body}</p>
    </div>
  );
}

function Thread({ thread, active, located, canResolve, onSelect, onReply, onResolve, onDelete }) {
  return (
    <div id={`comment-${thread.id}`} onClick={() => onSelect(thread.id)}
      className={`cursor-pointer space-y-2.5 rounded-xl bg-white p-3 ring-1 transition dark:bg-neutral-900 ${active ? "ring-2 ring-amber-500" : "ring-neutral-200 hover:ring-amber-400/60 dark:ring-neutral-800"} ${thread.resolved ? "opacity-70" : ""}`}>
      {thread.quote && (
        <p className={`line-clamp-2 border-l-[3px] pl-2 text-xs italic ${located ? "border-amber-400 text-slate-500 dark:text-neutral-400" : "border-neutral-300 text-slate-400 line-through decoration-slate-300"}`}
          title={located ? thread.quote : "These words aren't in the document any more"}>{thread.quote}</p>
      )}
      <Said comment={thread} onDelete={onDelete} />
      {thread.replies.map((r) => (
        <div key={r.id} className="flex gap-1.5 pl-1"><CornerDownRight className="mt-1 size-3.5 shrink-0 text-slate-300" /><div className="min-w-0 flex-1"><Said comment={r} onDelete={onDelete} /></div></div>
      ))}
      {active && (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          <Composer compact placeholder={thread.resolved ? "Reply (reopens it)…" : "Reply…"} onSubmit={(body) => onReply(thread, body)} />
          {(canResolve || thread.mine) && (
            <button type="button" onClick={() => onResolve(thread, !thread.resolved)} className="inline-flex items-center gap-1 !bg-transparent p-0 text-xs font-semibold text-accent hover:underline">
              {thread.resolved ? <><RotateCcw className="size-3.5" /> Reopen</> : <><Check className="size-3.5" /> Resolve</>}
            </button>
          )}
        </div>
      )}
      {thread.resolved && <p className="text-xs text-slate-500 dark:text-neutral-400">Resolved{thread.resolved_by ? ` by ${thread.resolved_by}` : ""}</p>}
    </div>
  );
}

// threads: from the API; order: thread ids in the order their words come; located: ids found in the text
export default function CommentsPane({ threads, order, located, active, pending, canResolve, onSelect, onCreate, onCancelPending, onReply, onResolve, onDelete }) {
  const [showResolved, setShowResolved] = useState(false);
  if (!threads) return <p className="text-sm text-slate-500">Loading…</p>;
  const rank = (t) => { const i = order.indexOf(t.id); return i === -1 ? Infinity : i; };
  const open = threads.filter((t) => !t.resolved).sort((a, b) => rank(a) - rank(b) || a.id - b.id);
  const resolved = threads.filter((t) => t.resolved);
  const props = { canResolve, onSelect, onReply, onResolve, onDelete };
  return (
    <div className="space-y-2">
      {pending ? (
        <div className="space-y-2 rounded-xl bg-white p-3 ring-2 ring-amber-500 dark:bg-neutral-900">
          <p className="line-clamp-3 border-l-[3px] border-amber-400 pl-2 text-xs italic text-slate-500 dark:text-neutral-400">{pending.quote}</p>
          <Composer autoFocus placeholder="Add a comment…" onSubmit={onCreate} onCancel={onCancelPending} />
        </div>
      ) : (
        <p className="px-1 text-xs text-slate-500 dark:text-neutral-400">Select some words in the document, then press <strong>Comment</strong>.</p>
      )}
      {open.map((t) => <Thread key={t.id} thread={t} active={active === t.id} located={located.has(t.id)} {...props} />)}
      {!open.length && !pending && <p className="px-1 py-2 text-sm text-slate-500 dark:text-neutral-400">No open comments.</p>}
      {resolved.length > 0 && (
        <button type="button" onClick={() => setShowResolved((v) => !v)} className="!bg-transparent px-1 text-xs font-medium text-accent hover:underline">
          {showResolved ? "Hide" : "Show"} resolved ({resolved.length})
        </button>
      )}
      {showResolved && resolved.map((t) => <Thread key={t.id} thread={t} active={active === t.id} located={located.has(t.id)} {...props} />)}
    </div>
  );
}
