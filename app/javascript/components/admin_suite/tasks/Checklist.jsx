import React, { useRef } from "react";
import { DndContext, KeyboardSensor, MouseSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
import useFlip from "../../ui/useFlip";
import { useMedia } from "./lib";

// A task's checklist: tick, remove, and reorder. On a computer an item drags by its grip (or
// Space and the arrow keys); on a phone or any touch screen it moves with ↑ ↓ instead, so a
// finger still scrolls the panel.
export default function Checklist({ items, onChange }) {
  const touch = useMedia("(pointer: coarse), (max-width: 767px)");
  const anchor = useRef(null);
  const flip = useFlip(touch ? items.map((i) => i.id).join(",") : "", anchor);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const move = (from, to) => onChange(arrayMove(items, from, to));
  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    move(items.findIndex((i) => i.id === active.id), items.findIndex((i) => i.id === over.id));
  };
  const nudge = (index, step) => { anchor.current = items[index].id; move(index, index + step); };

  const rows = items.map((item, i) => (
    <Item key={item.id} item={item} touch={touch}
      onToggle={() => onChange(items.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)))}
      onRemove={() => onChange(items.filter((x) => x.id !== item.id))}
      onUp={i > 0 ? () => nudge(i, -1) : null}
      onDown={i < items.length - 1 ? () => nudge(i, 1) : null} />
  ));

  if (touch) return <ul ref={flip} className="space-y-1">{rows}</ul>;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1">{rows}</ul>
      </SortableContext>
    </DndContext>
  );
}

function Item({ item, touch, onToggle, onRemove, onUp, onDown }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: touch });
  const tool = "grid size-7 shrink-0 place-items-center rounded-full !bg-transparent text-slate-400 hover:!bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:!bg-neutral-800 dark:hover:text-neutral-200";
  return (
    <li ref={setNodeRef} data-flip-id={item.id}
      style={touch ? undefined : { transform: CSS.Transform.toString(transform), transition }}
      className={`group relative flex items-center gap-2 rounded-xl bg-white text-sm dark:bg-neutral-950 ${isDragging ? "z-10 shadow-lg ring-2 ring-accent" : ""}`}>
      {!touch && (
        <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Move ${item.text}`} title="Drag to reorder"
          className={`${tool} -ml-1 cursor-grab opacity-40 group-hover:opacity-100 active:cursor-grabbing`}><GripVertical className="size-4" /></button>
      )}
      <input type="checkbox" checked={!!item.done} onChange={onToggle} className="size-4 shrink-0 rounded accent-[var(--color-accent)]" aria-label={item.text} />
      <span className={`flex-1 py-1 ${item.done ? "text-slate-400 line-through" : "text-slate-800 dark:text-neutral-200"}`}>{item.text}</span>
      {touch && (
        <>
          <button type="button" className={tool} disabled={!onUp} onClick={onUp} aria-label={`Move ${item.text} up`}><ArrowUp className="size-4" /></button>
          <button type="button" className={tool} disabled={!onDown} onClick={onDown} aria-label={`Move ${item.text} down`}><ArrowDown className="size-4" /></button>
        </>
      )}
      <button type="button" aria-label={`Remove ${item.text}`} onClick={onRemove}
        className={`${tool} hover:!text-rose-600 ${touch ? "" : "opacity-60 group-hover:opacity-100"}`}><X className="size-3.5" /></button>
    </li>
  );
}
