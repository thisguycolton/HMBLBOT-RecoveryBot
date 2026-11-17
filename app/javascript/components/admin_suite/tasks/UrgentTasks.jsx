import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { Check, ChevronRight, Hand, Plus } from "lucide-react";
import TaskCard from "./TaskCard";
import TaskDrawer from "./TaskDrawer";
import { act, button, primary, small, tasksApi } from "./lib";

const FILTERS = [
  ["all", "All"],
  ["overdue", "Overdue"],
  ["due_soon", "Due soon"],
  ["high", "High priority"],
];
const SHOWN = 8;

const matches = (filter, t) => {
  if (filter === "overdue") return t.due_state === "overdue";
  if (filter === "due_soon") return t.due_state === "due_soon";
  if (filter === "high") return t.priority === "high";
  return true;
};

// The admin Dashboard's "Tasks that need you": only what's urgent on the Task board (overdue,
// due within 3 days, or High), theirs or nobody's yet, plus anyone's that's overdue
// (AdminTask.urgent_for). Take it or finish it right here; a card opens the task.
export default function UrgentTasks({ data, notify, onChanged }) {
  const [filter, setFilter] = useState("all");
  const [board, setBoard] = useState(null);
  const [opened, setOpened] = useState(null);
  const [busy, setBusy] = useState(null);
  if (!data) return null;

  const me = data.me;
  const list = data.urgent.filter((t) => matches(filter, t));
  const count = (f) => data.urgent.filter((t) => matches(f, t)).length;

  // The task panel needs the admins and columns, so the board comes along the first time
  const open = (id) => {
    setOpened(id);
    if (!board) tasksApi().then(setBoard).catch((e) => notify(e.message, "error"));
  };
  const run = (task, action) => {
    setBusy(task.id);
    act(task, action).then(() => { notify(action === "take" ? "It's yours." : "Done. Nice work."); onChanged(); })
      .catch((e) => notify(e.message, "error")).finally(() => setBusy(null));
  };

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 !font-sans dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="!text-lg font-semibold text-slate-900 dark:text-white">Tasks that need you</h2>
        {data.urgent_count > 0 && (
          <div className="inline-flex max-w-full overflow-x-auto rounded-full bg-slate-100 p-1 dark:bg-neutral-800">
            {FILTERS.map(([value, text]) => (
              <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold ${filter === value ? "!bg-white !text-slate-900 shadow-sm dark:!bg-neutral-950 dark:!text-white" : "!bg-transparent !text-slate-600 dark:!text-neutral-300"}`}>
                {text} {count(value)}
              </button>
            ))}
          </div>
        )}
        <span className="flex-1" />
        <button type="button" className={`${button} ${small}`} onClick={() => open("new")}><Plus className="size-3.5" /> New task</button>
        <NavLink to="/tasks" className={`${button} ${small}`}>Open the board <ChevronRight className="size-3.5" /></NavLink>
      </div>

      {data.urgent_count === 0 ? (
        <p className="text-sm text-slate-500 dark:text-neutral-400">
          Nothing urgent. {data.open_count > 0 ? <NavLink to="/tasks" className="font-semibold text-accent">{data.open_count} {data.open_count === 1 ? "task" : "tasks"} on the board ›</NavLink> : "The board is empty."}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {list.slice(0, SHOWN).map((task) => {
              const mine = task.assignee?.id === me;
              const free = !task.assignee;
              return (
                <TaskCard key={task.id} task={task} me={me} outline onOpen={() => open(task.id)} className="!shadow-none">
                  {free && <button type="button" disabled={busy === task.id} className={`${primary} ${small}`} onClick={() => run(task, "take")}><Hand className="size-3.5" /> I'll take it</button>}
                  {(mine || free) && <button type="button" disabled={busy === task.id} className={`${button} ${small}`} onClick={() => run(task, "complete")}><Check className="size-3.5" /> Done</button>}
                  {!mine && !free && <button type="button" className={`${button} ${small}`} onClick={() => open(task.id)}>Open</button>}
                </TaskCard>
              );
            })}
          </div>
          {list.length > SHOWN && <NavLink to="/tasks" className="mt-3 inline-block text-sm font-semibold text-accent">and {list.length - SHOWN} more on the board ›</NavLink>}
        </>
      )}

      {opened && board && (
        <TaskDrawer key={opened} taskId={opened} board={board} notify={notify} onClose={() => setOpened(null)} onSaved={onChanged} />
      )}
    </section>
  );
}
