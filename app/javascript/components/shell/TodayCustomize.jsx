import React, { useEffect, useRef, useState } from "react";
import { DndContext, KeyboardSensor, MouseSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, RotateCcw, SlidersHorizontal } from "lucide-react";
import useFlip from "../ui/useFlip";
import { useMedia } from "../admin_suite/tasks/lib";
import { refreshNav } from "./useShell";

// The Today panel's sections in their default order (TodayLayout::SECTIONS on the server),
// with what each is called in Customize
export const SECTIONS = [
  { id: "greeting", label: "Greeting", hint: "Good morning, with your name" },
  { id: "day_count", label: "Day count", hint: "Your days, next milestone and a fun fact" },
  { id: "admin_tasks", label: "Your admin tasks", hint: "From the site task board" },
  { id: "attention", label: "Needs your attention", hint: "What your service roles need from you" },
  { id: "covers", label: "Filling in", hint: "Who is covering the meetings you're part of" },
  { id: "meetings", label: "Next meetings", hint: "Your groups' next meetings, with Join" },
  { id: "birthdays", label: "Birthdays", hint: "Sobriety birthdays in your groups" },
  { id: "events", label: "Events", hint: "Coming up in your groups" },
];
const DEFAULT_ORDER = SECTIONS.map((s) => s.id);

// Their saved layout (users.today_layout) as a full order and a hidden set. A section their
// saved order doesn't name (one added since) goes in after the one before it by default.
export function resolveLayout(layout) {
  const order = (layout?.order || []).filter((id) => DEFAULT_ORDER.includes(id));
  DEFAULT_ORDER.forEach((id, i) => {
    if (order.includes(id)) return;
    const before = i === 0 ? -1 : order.indexOf(DEFAULT_ORDER[i - 1]);
    order.splice(before + 1, 0, id);
  });
  return { order, hidden: (layout?.hidden || []).filter((id) => DEFAULT_ORDER.includes(id)) };
}

const isDefault = ({ order, hidden }) => !hidden.length && order.join() === DEFAULT_ORDER.join();

const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content || "";
// Saves to their account, so the website and the app show the same Today
export function saveLayout(layout) {
  const reset = isDefault(layout);
  return fetch("/api/today_layout", {
    method: reset ? "DELETE" : "PUT", credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-CSRF-Token": csrf() },
    body: reset ? undefined : JSON.stringify(layout),
  }).then((r) => { if (!r.ok) throw new Error(); return r.json(); })
    .then((data) => { refreshNav(); return data.layout; });
}

// The quiet button under the panel that opens Customize
export function CustomizeButton({ onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full !bg-transparent px-2 py-1 -ml-2 text-sm font-medium text-slate-400 hover:!bg-slate-100 hover:text-slate-700 dark:text-neutral-500 dark:hover:!bg-neutral-800 dark:hover:text-neutral-200">
      <SlidersHorizontal className="size-4" /> Customize Today
    </button>
  );
}

// Customize: show or hide each section and put them in the order they want. On a computer a
// row drags by its grip (or Space and the arrow keys); on a phone it moves with ↑ ↓, so a finger
// still scrolls the sheet. Only the sections that apply to them are listed (Your admin tasks for
// site admins, the group ones once they're in a group); the rest keep their place.
export default function TodayCustomize({ layout, available, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => resolveLayout(layout));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const touch = useMedia("(pointer: coarse), (max-width: 767px)");
  const anchor = useRef(null);
  const top = useRef(null);
  // Opened from the bottom of a long panel: bring its top into view
  useEffect(() => { top.current?.scrollIntoView({ block: "start" }); }, []);
  const shown = draft.order.filter((id) => available.includes(id));
  const flip = useFlip(touch ? shown.join(",") : "", anchor);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  // Reorders the listed ones among themselves, leaving the unlisted ones where they were
  const reorder = (list) => {
    const order = [...draft.order];
    const spots = order.map((id, i) => (available.includes(id) ? i : -1)).filter((i) => i >= 0);
    spots.forEach((spot, i) => { order[spot] = list[i]; });
    setDraft((d) => ({ ...d, order }));
  };
  const move = (from, to) => reorder(arrayMove(shown, from, to));
  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    move(shown.indexOf(active.id), shown.indexOf(over.id));
  };
  const toggle = (id) => setDraft((d) => ({ ...d, hidden: d.hidden.includes(id) ? d.hidden.filter((h) => h !== id) : [...d.hidden, id] }));

  const done = () => {
    setSaving(true);
    setError(false);
    saveLayout(draft).then((saved) => onSave(saved)).catch(() => { setSaving(false); setError(true); });
  };

  const rows = shown.map((id, i) => (
    <Row key={id} section={SECTIONS.find((s) => s.id === id)} touch={touch} visible={!draft.hidden.includes(id)}
      onToggle={() => toggle(id)}
      onUp={i > 0 ? () => { anchor.current = id; move(i, i - 1); } : null}
      onDown={i < shown.length - 1 ? () => { anchor.current = id; move(i, i + 1); } : null} />
  ));

  return (
    <div className="space-y-4 !font-sans">
      <div ref={top} className="scroll-mt-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Customize Today</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">Choose what shows and put what matters most at the top. It's saved to your account, so the app matches.</p>
      </div>
      {touch ? (
        <ul ref={flip} className="space-y-2">{rows}</ul>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={shown} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">{rows}</ul>
          </SortableContext>
        </DndContext>
      )}
      {error && <p className="text-sm text-rose-600">Couldn't save. Check your connection and try again.</p>}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="button" onClick={() => setDraft(resolveLayout(null))} disabled={isDefault(draft)}
          className="-ml-2 inline-flex items-center gap-1.5 rounded-xl !bg-transparent px-2 py-2 text-sm font-medium text-slate-500 hover:text-accent disabled:opacity-40 dark:text-neutral-400">
          <RotateCcw className="size-4" /> Reset to default
        </button>
        <span className="ml-auto flex gap-2">
          <button type="button" onClick={onCancel}
            className="rounded-xl !bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-neutral-200 hover:ring-accent/50 dark:!bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-700">Cancel</button>
          <button type="button" onClick={done} disabled={saving}
            className="rounded-xl !bg-accent px-4 py-2 text-sm font-semibold !text-white shadow-sm hover:opacity-90 disabled:opacity-60">{saving ? "Saving…" : "Done"}</button>
        </span>
      </div>
    </div>
  );
}

function Row({ section, touch, visible, onToggle, onUp, onDown }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: section.id, disabled: touch });
  const tool = "grid size-8 shrink-0 place-items-center rounded-full !bg-transparent text-slate-400 hover:!bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:!bg-neutral-800 dark:hover:text-neutral-200";
  return (
    <li ref={setNodeRef} data-flip-id={section.id}
      style={touch ? undefined : { transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-2xl bg-slate-50 px-2 py-2 ring-1 ring-neutral-200/80 dark:bg-neutral-800/60 dark:ring-neutral-800 ${isDragging ? "relative z-10 shadow-lg ring-2 ring-accent" : ""}`}>
      {!touch && (
        <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Move ${section.label}`} title="Drag to reorder"
          className={`${tool} cursor-grab active:cursor-grabbing`}><GripVertical className="size-4" /></button>
      )}
      <span className={`min-w-0 flex-1 ${touch ? "pl-2" : ""} ${visible ? "" : "opacity-50"}`}>
        <span className="block font-semibold leading-snug text-slate-900 dark:text-white">{section.label}</span>
        <span className="block text-xs text-slate-500 dark:text-neutral-400">{section.hint}</span>
      </span>
      {touch && (
        <>
          <button type="button" className={tool} disabled={!onUp} onClick={onUp} aria-label={`Move ${section.label} up`}><ArrowUp className="size-4" /></button>
          <button type="button" className={tool} disabled={!onDown} onClick={onDown} aria-label={`Move ${section.label} down`}><ArrowDown className="size-4" /></button>
        </>
      )}
      <button type="button" role="switch" aria-checked={visible} aria-label={`Show ${section.label}`} onClick={onToggle}
        className={`relative mx-1 inline-flex h-5 w-9 shrink-0 items-center rounded-full !p-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${visible ? "!bg-accent" : "!bg-neutral-300 dark:!bg-neutral-600"}`}>
        <span aria-hidden="true" className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${visible ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </button>
    </li>
  );
}
