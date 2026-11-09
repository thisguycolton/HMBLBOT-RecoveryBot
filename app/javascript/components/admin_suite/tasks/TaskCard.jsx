import React from "react";
import { CheckSquare, Diamond, Link2, MessageSquare } from "lucide-react";
import Avatar from "../../groups/Avatar";
import { chip, chipTone, dueLabel, holder, shortDate } from "./lib";

// What a task shows on the board and on the Dashboard: title (a red ! when it's High), its
// badges (High, due or overdue, for all admins, checklist, comments, link) and who has it.
// `children` go in a row at the bottom (the Dashboard's buttons, the phone's arrows).
export default function TaskCard({ task, me, onOpen, outline = false, className = "", children, ...rest }) {
  const done = !!task.completed_at;
  const due = dueLabel(task);
  const who = holder(task, me);
  const { done: ticked, total } = task.checklist_counts || {};
  return (
    <div
      {...rest}
      className={`relative rounded-[20px] bg-white p-3.5 text-left shadow-[0_1px_2px_rgb(0_0_0/0.06)] ring-1 dark:bg-neutral-900 ${
        outline && task.due_state === "overdue" ? "ring-red-300 dark:ring-red-800" : "ring-slate-200/70 dark:ring-neutral-800"
      } ${className}`}
    >
      <button type="button" onClick={onOpen} className="block w-full !bg-transparent p-0 text-left">
        <span className={`block text-sm font-semibold leading-snug ${done ? "text-slate-500 line-through dark:text-neutral-500" : "text-slate-900 dark:text-white"}`}>
          {task.priority === "high" && !done && <span className="mr-1 font-extrabold text-red-600" aria-label="High priority">!</span>}
          {task.title}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          {done && <span className={`${chip} ${chipTone.done}`}>✓ {shortDate(task.completed_at)}</span>}
          {!done && task.priority === "high" && <span className={`${chip} ${chipTone.high}`}>High</span>}
          {due && <span className={`${chip} ${chipTone[task.due_state] || chipTone.due}`}>{due}</span>}
          {!done && !task.assignee && task.for_all_admins && <span className={`${chip} ${chipTone.all}`}><Diamond className="size-3 fill-current" /> All site admins</span>}
          {total > 0 && <span className={`${chip} ${chipTone.plain}`}><CheckSquare className="size-3" /> {ticked}/{total}</span>}
          {task.comments > 0 && <span className={`${chip} ${chipTone.plain}`}><MessageSquare className="size-3" /> {task.comments}</span>}
          {task.link_path && <span className={`${chip} ${chipTone.plain}`}><Link2 className="size-3" /> Link</span>}
          {(done ? task.completed_by : task.assignee) && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400">
              <Avatar person={done ? task.completed_by : task.assignee} size={20} />
              {!done && who}
            </span>
          )}
        </span>
      </button>
      {children && <div className="mt-2.5 flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
