import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, Check, CheckSquare, Hand, Link2, RotateCcw, Send, Trash2, Undo2, X } from "lucide-react";
import Avatar from "../../groups/Avatar";
import Markdown from "../../book/Markdown";
import { inputClass, selectClass } from "../../ui/styles";
import { TAGS, act, button, chip, chipTone, dueLabel, longDate, primary, small, tasksApi } from "./lib";
import Checklist from "./Checklist";

const label = "w-20 shrink-0 sm:w-24 pt-2 text-xs font-medium text-slate-500 dark:text-neutral-400";
const field = "flex items-start gap-3 border-b border-slate-100 py-2 dark:border-neutral-800";
const heading = "mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-neutral-400";

const giveValue = (t) => (t.assignee ? String(t.assignee.id) : t.for_all_admins ? "all" : "");
const blank = { title: "", notes: "", priority: "normal", due_on: "", link_path: "", checklist: [], tags: [], assignee: null, for_all_admins: false };

// One task, opened from the board or the Dashboard: on a computer a panel from the right, on a
// phone a sheet from the bottom. Everything saves as it's changed. With `taskId` "new" it's
// the form for a new task (in `columnId`, else the first starting column).
export default function TaskDrawer({ taskId, columnId, board, onClose, onSaved, notify }) {
  const creating = taskId === "new";
  const [task, setTask] = useState(creating ? blank : null);
  const [comment, setComment] = useState("");
  const [editingNotes, setEditingNotes] = useState(creating);
  const [newItem, setNewItem] = useState("");
  const [busy, setBusy] = useState(false);
  const titleRef = useRef(null);
  const savedTitle = useRef("");
  const me = board?.me;

  useEffect(() => {
    if (creating) { setTimeout(() => titleRef.current?.focus(), 50); return; }
    tasksApi(`/${taskId}`).then((t) => { savedTitle.current = t.title; setTask(t); }).catch((e) => { notify(e.message, "error"); onClose(); });
  }, [taskId]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  const done = (next) => { savedTitle.current = next.title; setTask(next); onSaved?.(next); };
  const run = (promise) => {
    setBusy(true);
    return promise.then(done).catch((e) => notify(e.message, "error")).finally(() => setBusy(false));
  };
  // Saves one or more fields (a new task just keeps them until Create)
  const save = (patch) => {
    if (creating) { setTask((t) => ({ ...t, ...patch })); return Promise.resolve(); }
    setTask((t) => ({ ...t, ...patch }));
    return run(tasksApi(`/${task.id}`, { method: "PATCH", body: patch }));
  };
  const give = (value) => {
    const all = value === "all";
    const assignee = all || !value ? null : board.admins.find((a) => String(a.id) === value);
    if (creating) { setTask((t) => ({ ...t, assignee, for_all_admins: all })); return; }
    run(act(task, "give", { assignee_id: assignee?.id || "", all }));
  };
  const create = () => {
    if (!task.title.trim()) { titleRef.current?.focus(); return; }
    setBusy(true);
    tasksApi("", {
      method: "POST",
      body: { ...task, column_id: columnId, assignee_id: task.assignee?.id || "", assignee: undefined },
    }).then((saved) => { onSaved?.(saved); notify("Task added."); onClose(); })
      .catch((e) => notify(e.message, "error")).finally(() => setBusy(false));
  };
  const remove = () => {
    if (!window.confirm("Delete this task for good?")) return;
    tasksApi(`/${task.id}`, { method: "DELETE" }).then(() => { onSaved?.(null); notify("Task deleted."); onClose(); }).catch((e) => notify(e.message, "error"));
  };
  const archive = () => tasksApi(`/${task.id}`, { method: "PATCH", body: { archived: true } })
    .then(() => { onSaved?.(null); notify("Task archived."); onClose(); }).catch((e) => notify(e.message, "error"));
  const sendComment = (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    run(act(task, "comment", { body: comment })).then(() => setComment(""));
  };
  const setChecklist = (list) => save({ checklist: list });
  const addItem = (e) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    setChecklist([...(task?.checklist || []), { id: Math.random().toString(36).slice(2, 10), text: newItem.trim(), done: false }]);
    setNewItem("");
  };

  const column = task && board?.columns.find((c) => c.id === task.column_id);
  const isDone = !!task?.completed_at;
  const mine = task?.assignee?.id === me;

  const body = !task ? (
    <div className="space-y-3 p-6">
      <div className="h-5 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-neutral-800" />
      <div className="h-8 w-3/4 animate-pulse rounded-xl bg-slate-100 dark:bg-neutral-800" />
      <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-neutral-800" />
    </div>
  ) : (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-5 pt-4 sm:px-6">
        {creating ? <span className={`${chip} ${chipTone.plain}`}>New task</span> : <span className={`${chip} ${isDone ? chipTone.done : chipTone.plain}`}>{column?.name}</span>}
        {task.priority === "high" && !isDone && <span className={`${chip} ${chipTone.high}`}>! High</span>}
        {dueLabel(task) && <span className={`${chip} ${chipTone[task.due_state] || chipTone.due}`}>{dueLabel(task)}</span>}
        <span className="flex-1" />
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full !bg-transparent text-slate-500 hover:!bg-slate-100 dark:hover:!bg-neutral-800"><X className="size-5" /></button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-6">
        <textarea
          ref={titleRef}
          rows={1}
          value={task.title}
          placeholder="What needs doing?"
          onChange={(e) => setTask((t) => ({ ...t, title: e.target.value.replace(/\n/g, " ") }))}
          onBlur={(e) => {
            if (creating) return;
            if (!e.target.value.trim()) setTask((t) => ({ ...t, title: savedTitle.current }));
            else if (e.target.value.trim() !== savedTitle.current) save({ title: e.target.value.trim() });
          }}
          className="mt-2 block w-full resize-none border-0 !bg-transparent p-0 text-xl font-extrabold leading-snug text-slate-900 [field-sizing:content] placeholder:text-slate-300 focus:outline-none focus:ring-0 dark:text-white"
        />

        {!creating && (
          <div className="mt-4 flex flex-wrap gap-2">
            {!isDone && !mine && <button type="button" disabled={busy} className={primary} onClick={() => run(act(task, "take"))}><Hand className="size-4" /> I'll take it</button>}
            {!isDone && mine && <button type="button" disabled={busy} className={button} onClick={() => run(act(task, "let_go"))}><Undo2 className="size-4" /> Let go</button>}
            {isDone
              ? <button type="button" disabled={busy} className={button} onClick={() => run(act(task, "reopen"))}><RotateCcw className="size-4" /> Reopen</button>
              : <button type="button" disabled={busy} className={button} onClick={() => run(act(task, "complete"))}><Check className="size-4" /> Mark done</button>}
            <label className="relative">
              <span className="sr-only">Move to</span>
              <select value={task.column_id} disabled={busy} onChange={(e) => run(act(task, "move", { column_id: e.target.value, index: 0 }))}
                className={`${selectClass} !w-auto !rounded-full !py-2 font-semibold`}>
                {board.columns.map((c) => <option key={c.id} value={c.id}>Move to: {c.name}</option>)}
              </select>
            </label>
          </div>
        )}

        <div className="mt-4">
          <div className={field}>
            <span className={label}>Priority</span>
            <div className="inline-flex rounded-full bg-slate-100 p-1 dark:bg-neutral-800">
              {[["normal", "Normal"], ["high", "! High"]].map(([value, text]) => (
                <button key={value} type="button" onClick={() => task.priority !== value && save({ priority: value })} aria-pressed={task.priority === value}
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${task.priority === value ? `!bg-white shadow-sm dark:!bg-neutral-900 ${value === "high" ? "!text-red-700 dark:!text-red-300" : "!text-slate-900 dark:!text-white"}` : "!bg-transparent !text-slate-500"}`}>
                  {text}
                </button>
              ))}
            </div>
          </div>
          <div className={field}>
            <span className={label}>Due</span>
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <input type="date" value={task.due_on || ""} onChange={(e) => save({ due_on: e.target.value || null })} className={`${inputClass} !w-auto dark:[color-scheme:dark]`} />
              {task.due_on && <span className="text-sm text-slate-500">{longDate(task.due_on)}</span>}
              {task.due_on && <button type="button" onClick={() => save({ due_on: null })} className="text-xs font-semibold text-slate-500 !bg-transparent hover:text-accent">Clear</button>}
            </div>
          </div>
          <div className={field}>
            <span className={label}>Tags</span>
            <div className="flex flex-1 flex-wrap gap-1.5 pt-1">
              {TAGS.map(([key, text, tone]) => {
                const on = (task.tags || []).includes(key);
                return (
                  <button key={key} type="button" aria-pressed={on}
                    onClick={() => save({ tags: on ? task.tags.filter((t) => t !== key) : TAGS.map(([k]) => k).filter((k) => k === key || (task.tags || []).includes(k)) })}
                    className={`${chip} !px-2.5 !py-1 !text-xs ${on ? `${tone} ring-1 ring-black/10 dark:ring-white/20` : "!bg-transparent text-slate-500 ring-1 ring-slate-200 hover:text-slate-800 dark:ring-neutral-700 dark:hover:text-neutral-200"}`}>
                    {on ? "✓ " : ""}{text}
                  </button>
                );
              })}
            </div>
          </div>
          <div className={field}>
            <span className={label}>Given to</span>
            <div className="flex flex-1 items-center gap-2">
              {task.assignee && <Avatar person={task.assignee} size={24} />}
              <select value={giveValue(task)} onChange={(e) => give(e.target.value)} className={selectClass} aria-label="Given to">
                <option value="">Nobody yet (up for grabs)</option>
                <option value="all">◆ All site admins</option>
                {board.admins.map((a) => <option key={a.id} value={a.id}>{a.name}{a.id === me ? " (you)" : ""}</option>)}
              </select>
            </div>
          </div>
          <div className={field}>
            <span className={label}>Link</span>
            <div className="flex flex-1 items-center gap-2">
              <input type="text" defaultValue={task.link_path || ""} key={`link-${task.id}`} placeholder="/groups?status=pending"
                onBlur={(e) => (e.target.value || null) !== (task.link_path || null) && save({ link_path: e.target.value })} className={inputClass} />
              {task.link_path && !creating && <a href={task.link_path} className="shrink-0 text-sm font-semibold text-accent" target="_blank" rel="noreferrer"><Link2 className="inline size-4" /> Open</a>}
            </div>
          </div>
          {!creating && task.creator && (
            <div className={field}>
              <span className={label}>Made by</span>
              <span className="flex items-center gap-2 pt-1.5 text-sm text-slate-700 dark:text-neutral-200"><Avatar person={task.creator} size={22} /> {task.creator.name}</span>
            </div>
          )}
        </div>

        <div className={`${heading} flex items-center gap-2`}>
          Notes
          {!editingNotes && <button type="button" onClick={() => setEditingNotes(true)} className="!bg-transparent text-xs font-semibold normal-case tracking-normal text-accent">Edit</button>}
        </div>
        {editingNotes ? (
          <textarea defaultValue={task.notes || ""} rows={4} placeholder="Anything that helps whoever takes it (Markdown works)"
            autoFocus={!creating}
            onChange={creating ? (e) => setTask((t) => ({ ...t, notes: e.target.value })) : undefined}
            onBlur={(e) => { if (creating) return; setEditingNotes(false); if (e.target.value !== (task.notes || "")) save({ notes: e.target.value }); }}
            className={`${inputClass} !rounded-2xl`} />
        ) : task.notes ? (
          <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-neutral-800"><Markdown source={task.notes} /></div>
        ) : (
          <button type="button" onClick={() => setEditingNotes(true)} className="text-sm text-slate-400 !bg-transparent">Add notes…</button>
        )}

        <div className={heading}>
          <CheckSquare className="mr-1 inline size-3.5" /> Checklist{task.checklist?.length ? ` · ${task.checklist.filter((i) => i.done).length}/${task.checklist.length}` : ""}
        </div>
        <Checklist items={task.checklist || []} onChange={setChecklist} />
        <form onSubmit={addItem} className="mt-2"><input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add an item and press Enter" className={inputClass} /></form>

        {creating ? (
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={button} onClick={onClose}>Cancel</button>
            <button type="button" className={primary} disabled={busy} onClick={create}>Add task</button>
          </div>
        ) : (
          <>
            <div className={heading}>Activity</div>
            <ul className="space-y-2.5">
              {task.activities.map((a) => <Activity key={a.id} activity={a} />)}
            </ul>
            <form onSubmit={sendComment} className="mt-3 flex items-end gap-2">
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={1} placeholder="Write a comment… @username to mention"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) sendComment(e); }}
                className={`${inputClass} !rounded-2xl [field-sizing:content]`} />
              <button type="submit" disabled={!comment.trim() || busy} className={`${primary} !p-2.5`} aria-label="Send comment"><Send className="size-4" /></button>
            </form>
            <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-neutral-800">
              <button type="button" className={`${button} ${small}`} onClick={archive}><Archive className="size-3.5" /> Archive</button>
              {(!task.creator || task.creator.id === me) && <button type="button" className={`${button} ${small} hover:!text-rose-600`} onClick={remove}><Trash2 className="size-3.5" /> Delete</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[2200] !font-sans" role="dialog" aria-modal="true" aria-label={creating ? "New task" : task?.title || "Task"}>
      <button type="button" aria-label="Close" className="absolute inset-0 !bg-slate-900/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 top-10 flex flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl dark:bg-neutral-950 sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:w-[min(34rem,100vw)] sm:rounded-none sm:rounded-l-[28px]">
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden dark:bg-neutral-700" />
        {body}
      </div>
    </div>,
    document.body,
  );
}

const WORDS = {
  created: "made this task",
  took: "took it",
  let_go: "let it go",
  done: "finished it",
  reopened: "reopened it",
};

function Activity({ activity: a }) {
  const who = a.user?.name?.split(" ")[0] || "Someone";
  const when = new Date(a.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  let text = WORDS[a.kind];
  if (a.kind === "moved") text = `moved it to ${a.data?.to}`;
  if (a.kind === "gave") text = a.data?.all && !a.data?.to ? "gave it to all site admins" : a.data?.to ? `gave it to ${a.data.to}` : "made it up for grabs";
  if (a.kind === "edited") text = `changed the ${(a.data?.fields || []).map((f) => ({ due_on: "due date", link_path: "link" })[f] || f).join(", ")}`;
  return (
    <li className="flex gap-2.5 text-sm">
      {a.user ? <Avatar person={a.user} size={24} /> : <span className="size-6" />}
      <div className="min-w-0 flex-1">
        {a.kind === "comment" ? (
          <div className="rounded-2xl bg-slate-50 px-3 py-2 dark:bg-neutral-900">
            <span className="text-xs font-semibold text-slate-700 dark:text-neutral-200">{who}</span> <span className="text-xs text-slate-400">{when}</span>
            <div className="mt-0.5 text-slate-800 dark:text-neutral-200"><Markdown source={a.body} /></div>
          </div>
        ) : (
          <p className="pt-0.5 text-slate-600 dark:text-neutral-400"><b className="font-semibold text-slate-800 dark:text-neutral-200">{who}</b> {text} <span className="text-xs text-slate-400">· {when}</span></p>
        )}
      </div>
    </li>
  );
}
