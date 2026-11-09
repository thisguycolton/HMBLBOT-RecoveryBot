// Site Admin > Task board (internally SCRUMBLBOT): shared bits for the board, the task detail,
// the Dashboard's "Tasks that need you" and the Today panel's "Your admin tasks".
import { useEffect, useState } from "react";
import { api } from "../../topicificator_admin/api";

export const tasksApi = (path = "", options) => api(`/tasks${path}`, options);
export const columnsApi = (path = "", options) => api(`/task_columns${path}`, options);

// Every change to a task goes through here: POST /tasks/:id/<action>
export const act = (task, action, body) => tasksApi(`/${task.id}/${action}`, { method: "POST", body });

const dateOf = (iso) => new Date(`${iso}T00:00:00`);
const todayDate = () => new Date(new Date().toDateString());

// "Due today", "Due tomorrow", "Due Mon", "Due Dec 20", "Overdue · 2 days"
export function dueLabel(task) {
  if (!task.due_on) return null;
  const days = Math.round((dateOf(task.due_on) - todayDate()) / 86400000);
  if (task.completed_at) return null;
  if (days < 0) return `Overdue · ${-days} ${days === -1 ? "day" : "days"}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 7) return `Due ${dateOf(task.due_on).toLocaleDateString([], { weekday: "short" })}`;
  return `Due ${dateOf(task.due_on).toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

export const longDate = (iso) => dateOf(iso).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
export const shortDate = (iso) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });

export const chip = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4";
export const chipTone = {
  plain: "bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300",
  high: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  due_soon: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  due: "bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300",
  all: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

export const button = "inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 !bg-white px-3.5 py-2 text-sm font-semibold !text-slate-700 hover:!bg-slate-50 disabled:opacity-50 dark:border-neutral-700 dark:!bg-neutral-900 dark:!text-neutral-200 dark:hover:!bg-neutral-800";
export const primary = "inline-flex items-center justify-center gap-1.5 rounded-full border border-accent !bg-accent px-3.5 py-2 text-sm font-semibold !text-white hover:opacity-90 disabled:opacity-50";
export const small = "!px-2.5 !py-1 !text-xs";

// Who has it, as a short line: "You", "Jo has it", "For all site admins", or nothing
export function holder(task, me) {
  if (task.assignee) return task.assignee.id === me ? "You" : `${task.assignee.name.split(" ")[0]} has it`;
  if (task.for_all_admins) return "For all site admins";
  return null;
}

// The standard kanban tags (AdminTask::TAGS), in the order the picker shows them
export const TAGS = [
  ["bug", "Bug", "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"],
  ["feature", "Feature", "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"],
  ["improvement", "Improvement", "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200"],
  ["content", "Content", "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"],
  ["design", "Design", "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200"],
  ["research", "Research", "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200"],
  ["support", "Support", "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200"],
  ["blocked", "Blocked", "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"],
];
export const TAG = Object.fromEntries(TAGS.map(([key, text, tone]) => [key, { text, tone }]));

// "(max-width: 767px)", "(pointer: coarse)"..., kept current
export function useMedia(query) {
  const [on, setOn] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return undefined;
    const change = () => setOn(list.matches);
    list.addEventListener("change", change);
    return () => list.removeEventListener("change", change);
  }, [query]);
  return on;
}
