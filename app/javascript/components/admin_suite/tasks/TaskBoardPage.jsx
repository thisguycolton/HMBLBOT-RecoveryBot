import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  DndContext, DragOverlay, KeyboardSensor, MeasuringStrategy, MouseSensor, defaultDropAnimationSideEffects,
  pointerWithin, rectIntersection, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Hand, Plus } from "lucide-react";
import Skeleton from "../../ui/Skeleton";
import useFlip from "../../ui/useFlip";
import TaskCard from "./TaskCard";
import TaskDrawer from "./TaskDrawer";
import ColumnsDialog from "./ColumnsDialog";
import useTaskBoard from "./useTaskBoard";
import { act, button, primary, small } from "./lib";

const FILTERS = [
  ["all", "All"],
  ["mine", "Mine"],
  ["grabs", "Up for grabs"],
  ["urgent", "Urgent"],
];
const DONE_SHOWN = 10;

const matches = (filter, task, me) => {
  if (filter === "mine") return task.assignee?.id === me;
  if (filter === "grabs") return !task.assignee && !task.completed_at;
  if (filter === "urgent") return task.urgent;
  return true;
};

// "(max-width: 767px)" etc., kept current
function useMedia(query) {
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

// Site Admin > Task board (internally SCRUMBLBOT). On a computer the columns sit side by side
// and cards drag between them, the others making room as one passes (like the HMBLBOT
// Editor). On a phone it's one column at a time with tabs, and each card has arrows: ↑ ↓ in its
// column, ‹ › to the column before or after. Touch never drags, so a finger still scrolls.
export default function TaskBoardPage({ notify }) {
  const { board, setBoard, reload, setHold } = useTaskBoard(notify);
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState(null);
  const [showAllDone, setShowAllDone] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [order, setOrder] = useState({}); // column id => [task ids], while dragging
  const [activeId, setActiveId] = useState(null);
  const before = useRef(null);
  const justPassed = useRef(null);
  const anchor = useRef(null);
  const phone = useMedia("(max-width: 767px)");
  const touch = useMedia("(pointer: coarse)");
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const opened = params.get("task");
  const openTask = (id, columnId) => setParams((p) => { const next = new URLSearchParams(p); next.set("task", id); if (columnId) next.set("column", columnId); else next.delete("column"); return next; });
  const closeTask = useCallback(() => setParams((p) => { const next = new URLSearchParams(p); next.delete("task"); next.delete("column"); return next; }), [setParams]);

  const byId = useMemo(() => Object.fromEntries((board?.tasks || []).map((t) => [t.id, t])), [board]);

  // The board's own order, from the server (or the drag in progress)
  const serverOrder = useMemo(() => {
    const map = Object.fromEntries((board?.columns || []).map((c) => [c.id, []]));
    (board?.tasks || []).forEach((t) => map[t.column_id]?.push(t.id));
    return map;
  }, [board]);
  useEffect(() => { if (!activeId) setOrder(serverOrder); }, [serverOrder, activeId]);

  const flip = useFlip(JSON.stringify(order), anchor);

  if (!board) return <Skeleton variant="stats" />;

  const me = board.me;
  const canDrag = filter === "all" && !touch;
  const columnOf = (taskId) => Number(Object.keys(order).find((c) => order[c].includes(taskId)));
  const counts = Object.fromEntries(board.columns.map((c) => [c.id, (order[c.id] || []).filter((id) => byId[id] && matches(filter, byId[id], me)).length]));
  const currentTab = board.columns.find((c) => c.id === tab) ? tab : board.columns[0]?.id;

  // Moves a card on the server; the board shows it there right away
  const send = (taskId, columnId, index) => {
    act({ id: taskId }, "move", { column_id: columnId, index })
      .then((saved) => setBoard((b) => b && { ...b, tasks: b.tasks.map((t) => (t.id === saved.id ? { ...t, ...saved } : t)) }))
      .catch((e) => { notify(e.message, "error"); reload(); });
  };
  const applyOrder = (next) => {
    setOrder(next);
    setBoard((b) => {
      if (!b) return b;
      const place = {};
      Object.entries(next).forEach(([col, ids]) => ids.forEach((id, i) => { place[id] = [Number(col), i + 1]; }));
      return { ...b, tasks: b.tasks.map((t) => (place[t.id] ? { ...t, column_id: place[t.id][0], position: place[t.id][1] } : t)).sort((x, y) => x.position - y.position) };
    });
  };

  // The phone's (and touch screens') arrows
  const nudge = (taskId, step, across) => {
    const from = columnOf(taskId);
    const list = order[from];
    const at = list.indexOf(taskId);
    const next = { ...order };
    if (across) {
      const ci = board.columns.findIndex((c) => c.id === from) + step;
      const to = board.columns[ci];
      if (!to) return;
      next[from] = list.filter((id) => id !== taskId);
      next[to.id] = [taskId, ...order[to.id]];
      applyOrder(next);
      send(taskId, to.id, 0);
      if (phone) notify(`Moved to ${to.name}.`);
    } else {
      const j = at + step;
      if (j < 0 || j >= list.length) return;
      const moved = [...list];
      [moved[at], moved[j]] = [moved[j], moved[at]];
      next[from] = moved;
      anchor.current = String(taskId);
      applyOrder(next);
      send(taskId, from, j);
    }
  };

  const cardId = (id) => `t:${id}`;
  const parse = (id) => {
    const s = String(id);
    if (s.startsWith("c:")) return { column: Number(s.slice(2)) };
    if (s.startsWith("t:")) return { task: Number(s.slice(2)) };
    return {};
  };

  const onDragStart = ({ active }) => {
    setHold(true);
    before.current = order;
    justPassed.current = null;
    setActiveId(parse(active.id).task);
  };
  const onDragOver = ({ active, over }) => {
    if (!over || over.id === active.id || over.id === justPassed.current) return;
    const id = parse(active.id).task;
    const target = parse(over.id);
    setOrder((current) => {
      const from = Number(Object.keys(current).find((c) => current[c].includes(id)));
      const to = target.column ?? Number(Object.keys(current).find((c) => current[c].includes(target.task)));
      if (!to) return current;
      if (from === to && target.column) { justPassed.current = null; return current; }
      justPassed.current = target.task ? over.id : null;
      const next = { ...current, [from]: current[from].filter((t) => t !== id) };
      const list = [...next[to]];
      let index = target.task ? current[to].indexOf(target.task) : list.length;
      if (index < 0) index = list.length;
      list.splice(index, 0, id);
      next[to] = list;
      return next;
    });
  };
  const finishDrag = () => { setActiveId(null); justPassed.current = null; setHold(false); };
  const onDragEnd = ({ active }) => {
    const id = parse(active.id).task;
    const was = before.current;
    const to = columnOf(id);
    const index = order[to]?.indexOf(id);
    const from = Number(Object.keys(was).find((c) => was[c].includes(id)));
    if (to && (to !== from || was[from].indexOf(id) !== index)) {
      applyOrder(order);
      send(id, to, index);
    }
    before.current = null;
    finishDrag();
  };
  const onDragCancel = () => { if (before.current) setOrder(before.current); before.current = null; finishDrag(); };

  const renderColumn = (column) => {
    const ids = (order[column.id] || []).filter((id) => byId[id] && matches(filter, byId[id], me));
    const finished = column.kind === "finished";
    const shown = finished && !showAllDone ? ids.slice(0, DONE_SHOWN) : ids;
    const ci = board.columns.indexOf(column);
    return (
      <Column key={column.id} column={column} count={ids.length} ids={shown.map(cardId)} canDrag={canDrag} onAdd={() => openTask("new", column.id)} phone={phone}>
        {shown.map((id, i) => {
          const task = byId[id];
          return (
            <SortableCard key={id} id={cardId(id)} task={task} me={me} canDrag={canDrag} dragging={activeId === id} onOpen={() => openTask(id)}>
              {(touch || phone) && (
                <>
                  {!task.completed_at && task.assignee?.id !== me && (
                    <button type="button" className={`${button} ${small}`} onClick={() => act(task, "take").then(reload).catch((e) => notify(e.message, "error"))}><Hand className="size-3.5" /> I'll take it</button>
                  )}
                  {filter === "all" && (
                    <span className="ml-auto flex gap-1">
                      <Arrow label="Up" disabled={i === 0} onClick={() => nudge(id, -1)}><ArrowUp className="size-4" /></Arrow>
                      <Arrow label="Down" disabled={i === shown.length - 1} onClick={() => nudge(id, 1)}><ArrowDown className="size-4" /></Arrow>
                      <Arrow label={`To ${board.columns[ci - 1]?.name}`} disabled={ci === 0} onClick={() => nudge(id, -1, true)}><ChevronLeft className="size-4" /></Arrow>
                      <Arrow label={`To ${board.columns[ci + 1]?.name}`} disabled={ci === board.columns.length - 1} onClick={() => nudge(id, 1, true)}><ChevronRight className="size-4" /></Arrow>
                    </span>
                  )}
                </>
              )}
            </SortableCard>
          );
        })}
        {finished && ids.length > DONE_SHOWN && (
          <button type="button" onClick={() => setShowAllDone((v) => !v)} className="w-full !bg-transparent px-2 py-1.5 text-left text-sm font-medium text-slate-500 hover:text-accent">
            {showAllDone ? "Show fewer" : `Show ${ids.length - DONE_SHOWN} more`} · finished tasks archive after 30 days
          </button>
        )}
        {!ids.length && <p className="px-2 py-6 text-center text-sm text-slate-400">{filter === "all" ? (canDrag ? "Drag a task here" : "Nothing here") : "Nothing here"}</p>}
      </Column>
    );
  };

  const activeTask = activeId && byId[activeId];

  return (
    <div className="!font-sans">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex max-w-full overflow-x-auto rounded-full bg-slate-200/70 p-1 dark:bg-neutral-800">
          {FILTERS.map(([value, text]) => {
            const n = value === "all" ? null : board.tasks.filter((t) => matches(value, t, me) && !(value !== "urgent" && t.completed_at)).length;
            return (
              <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${filter === value ? "!bg-white !text-slate-900 shadow-sm dark:!bg-neutral-950 dark:!text-white" : "!bg-transparent !text-slate-600 dark:!text-neutral-300"}`}>
                {text}{n ? ` · ${n}` : ""}
              </button>
            );
          })}
        </div>
        <span className="flex-1" />
        <button type="button" className={button} onClick={() => setColumnsOpen(true)}><Columns3 className="size-4" /> Columns</button>
        <button type="button" className={primary} onClick={() => openTask("new")}><Plus className="size-4" /> New task</button>
      </div>
      {filter !== "all" && !touch && <p className="-mt-2 mb-3 text-xs text-slate-500">Switch to All to drag tasks around.</p>}

      {phone ? (
        <>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {board.columns.map((c) => (
              <button key={c.id} type="button" onClick={() => setTab(c.id)} aria-pressed={currentTab === c.id}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold ${currentTab === c.id ? "!bg-slate-900 !text-white dark:!bg-white dark:!text-slate-900" : "!bg-slate-200/70 !text-slate-600 dark:!bg-neutral-800 dark:!text-neutral-300"}`}>
                {c.name} {counts[c.id]}
              </button>
            ))}
          </div>
          <div ref={flip}>{renderColumn(board.columns.find((c) => c.id === currentTab))}</div>
        </>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={(args) => { const hits = pointerWithin(args); return hits.length ? hits : rectIntersection(args); }}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div ref={flip} className="flex items-start gap-4 overflow-x-auto pb-4">
            {board.columns.map(renderColumn)}
          </div>
          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.35" } } }) }}>
            {activeTask ? <TaskCard task={activeTask} me={me} className="rotate-2 cursor-grabbing shadow-2xl ring-2 !ring-accent" /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <p className="mt-2 text-right text-[10px] font-bold tracking-[0.14em] text-slate-300 dark:text-neutral-700" title="Internal codename">SCRUMBLBOT</p>

      {opened && (
        <TaskDrawer key={opened} taskId={opened === "new" ? "new" : Number(opened)} columnId={params.get("column") || undefined} board={board} notify={notify}
          onClose={closeTask} onSaved={() => reload()} />
      )}
      {columnsOpen && <ColumnsDialog columns={board.columns} onClose={() => setColumnsOpen(false)} onSaved={reload} notify={notify} />}
    </div>
  );
}

function Column({ column, count, ids, canDrag, onAdd, phone, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `c:${column.id}`, disabled: !canDrag });
  return (
    <section className={`flex min-w-0 flex-col rounded-[28px] bg-slate-200/50 p-2 dark:bg-neutral-900/60 ${phone ? "w-full" : "w-[19rem] shrink-0 xl:w-auto xl:flex-1"} ${isOver ? "ring-2 ring-accent/40" : ""}`}>
      {!phone && (
        <header className="flex items-center gap-2 px-2.5 pb-2.5 pt-2">
          <h2 className="!text-sm font-bold text-slate-900 dark:text-white">{column.name}</h2>
          <span className="rounded-full bg-white px-2 text-[11px] font-semibold leading-5 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400">{count}</span>
          <span className="flex-1" />
          <button type="button" onClick={onAdd} aria-label={`Add a task to ${column.name}`} title="Add a task here"
            className="grid size-7 place-items-center rounded-full !bg-transparent text-slate-500 hover:!bg-white hover:text-slate-900 dark:hover:!bg-neutral-800 dark:hover:text-white"><Plus className="size-4" /></button>
        </header>
      )}
      <SortableContext items={ids} strategy={stayPut}>
        <div ref={setNodeRef} className="flex min-h-[4rem] flex-col gap-2">{children}</div>
      </SortableContext>
    </section>
  );
}

// Cards aren't shifted with transforms while dragging: the lists themselves change order and
// useFlip slides the cards to their new places
const stayPut = () => null;
const keepStill = () => false;

function SortableCard({ id, task, me, canDrag, dragging, onOpen, children }) {
  const { attributes, listeners, setNodeRef } = useSortable({ id, disabled: !canDrag, animateLayoutChanges: keepStill });
  return (
    <div ref={setNodeRef} data-flip-id={String(task.id)} {...(canDrag ? attributes : {})} {...(canDrag ? listeners : {})}
      className={`${canDrag ? "cursor-grab" : ""} ${dragging ? "opacity-35" : ""} rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-accent`}>
      <TaskCard task={task} me={me} onOpen={onOpen} outline>{children}</TaskCard>
    </div>
  );
}

function Arrow({ label, disabled, onClick, children }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className="grid size-8 place-items-center rounded-full !bg-slate-100 text-slate-700 disabled:opacity-30 dark:!bg-neutral-800 dark:text-neutral-200">
      {children}
    </button>
  );
}
