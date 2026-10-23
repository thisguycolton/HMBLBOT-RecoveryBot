import React, { useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCorners, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, LayoutTemplate, MoveHorizontal, Plus, RotateCcw, Settings2, SlidersHorizontal, X } from "lucide-react";
import { ErrorNote, primaryButton, quietButton } from "../../ui";
import { selectClass } from "../../../ui/styles";
import { BLOCKS } from "./blocks";
import TemplateGallery from "./TemplateGallery";
import { LAYOUT_CHOICES, LAYOUT_SIDES, REGIONS, REGION_SIZE, baseTemplate, draftOf } from "./templates";

// HostDeck's layout editor: the deck itself, live, with its blocks to drag between the columns,
// the strip and the bottom bar (a block only goes where it has a size), a layout to pick, blocks
// to add and take off, and saving for this meeting or every meeting of the group.

export const fits = (type, region) => !!BLOCKS[type]?.sizes.includes(REGION_SIZE[region]);
const shownRegions = (layout) => ["strip", ...(LAYOUT_SIDES[layout] || []).filter((s) => s === "left"), "main", ...(LAYOUT_SIDES[layout] || []).filter((s) => s === "right"), "bar"];
const regionOf = (draft, id) => (String(id).startsWith("region:") ? String(id).slice(7) : REGIONS.find((r) => draft[r].some((b) => b.id === id)));
const onDeck = (draft) => new Set(REGIONS.flatMap((r) => draft[r].map((b) => b.type)));

// The drag and drop around the deck while it's being edited
export function EditDnd({ draft, setDraft, children }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  // Into another region, while dragging, when the block has a size there
  const onDragOver = ({ active, over }) => {
    if (!over) return;
    setDraft((d) => {
      const from = regionOf(d, active.id);
      const to = regionOf(d, over.id);
      if (!from || !to || from === to) return d;
      const block = d[from].find((b) => b.id === active.id);
      if (!block || !fits(block.type, to)) return d;
      const at = d[to].findIndex((b) => b.id === over.id);
      const list = [...d[to]];
      list.splice(at < 0 ? list.length : at, 0, block);
      return { ...d, [from]: d[from].filter((b) => b.id !== active.id), [to]: list };
    });
  };
  // Its place within the region it ended up in
  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setDraft((d) => {
      const region = regionOf(d, active.id);
      if (region !== regionOf(d, over.id)) return d;
      const ids = d[region].map((b) => b.id);
      const to = ids.indexOf(over.id);
      return to < 0 ? d : { ...d, [region]: arrayMove(d[region], ids.indexOf(active.id), to) };
    });
  };
  return <DndContext sensors={sensors} collisionDetection={closestCorners} onDragOver={onDragOver} onDragEnd={onDragEnd}>{children}</DndContext>;
}

const REGION_LABELS = { strip: "Top strip", left: "Left sidebar", main: "Middle", right: "Right sidebar", bar: "Bottom bar" };

// A region that takes blocks: its blocks in order, and room to drop one when it's empty
export function EditRegion({ region, ids, className = "", children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `region:${region}` });
  const across = region === "bar" || region === "strip";
  return (
    <SortableContext items={ids} strategy={across ? horizontalListSortingStrategy : verticalListSortingStrategy}>
      <div ref={setNodeRef} data-region={region}
        className={`${className} rounded-xl transition-colors ${isOver ? "bg-accent/10 ring-2 ring-accent/40" : ""} ${ids.length ? "" : "grid min-h-16 place-items-center border-2 border-dashed border-neutral-300 dark:border-neutral-700"}`}>
        {children}
        {!ids.length && <p className="px-3 py-2 text-center text-xs text-slate-500 dark:text-neutral-400">{REGION_LABELS[region]}: drag a block here</p>}
      </div>
    </SortableContext>
  );
}

// A block while editing: its name to drag it by, a button to take it off (not the stage), and in
// the bar whether it stretches. What's in it is the real thing, but can't be clicked.
// `onKit`: opens the part of the meeting's kit it shows (saved on its own, right away).
export function EditBlock({ block, region, setDraft, placeholder, onKit = null, className = "", children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const [open, setOpen] = useState(!!block.fresh && !!BLOCKS[block.type].settings);
  const info = BLOCKS[block.type];
  const Settings = info.settings;
  const Icon = info.icon;
  const patch = (p) => setDraft((d) => ({ ...d, [region]: d[region].map((b) => (b.id === block.id ? { ...b, ...p } : b)) }));
  const remove = () => setDraft((d) => ({ ...d, [region]: d[region].filter((b) => b.id !== block.id) }));
  const small = "inline-grid size-6 place-items-center rounded-md !bg-transparent text-slate-500 hover:!bg-neutral-200 hover:text-slate-800 dark:text-neutral-400 dark:hover:!bg-neutral-700 dark:hover:text-white";
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} data-block={block.type}
      className={`${className} relative min-w-0 rounded-xl bg-white/60 p-1.5 pt-8 ring-2 ring-accent/30 dark:bg-neutral-900/60 ${isDragging ? "z-20 opacity-80 shadow-lg ring-accent" : ""}`}>
      <div className="absolute inset-x-1.5 top-1.5 flex items-center gap-1">
        <button type="button" {...attributes} {...listeners} className="inline-flex min-w-0 cursor-grab items-center gap-1 rounded-md !bg-accent/10 px-1.5 py-0.5 text-xs font-semibold text-accent active:cursor-grabbing dark:!bg-accent/25 dark:text-sky-200" aria-label={`Move ${info.label}`}>
          <GripVertical className="size-3.5 shrink-0" /><Icon className="size-3.5 shrink-0" /><span className="truncate">{info.label}</span>
        </button>
        <span className="flex-1" />
        {onKit && (
          <button type="button" className={small} onClick={onKit} aria-label={`Set up ${info.label}`} title={`Set up ${info.label.toLowerCase()} (saved for the meeting right away)`}><SlidersHorizontal className="size-3.5" /></button>
        )}
        {Settings && (
          <button type="button" className={`${small} ${open ? "!text-accent" : ""}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={`${info.label} settings`} title="Settings"><Settings2 className="size-3.5" /></button>
        )}
        {region === "bar" && (
          <button type="button" className={`${small} ${block.grow ? "!text-accent" : ""}`} onClick={() => patch({ grow: !block.grow || undefined })} aria-pressed={!!block.grow} title={block.grow ? "Stretches to fill the bar" : "Stretch to fill the bar"}>
            <MoveHorizontal className="size-3.5" />
          </button>
        )}
        {block.type !== "stage" && <button type="button" className={small} onClick={remove} aria-label={`Take ${info.label} off the deck`} title="Take it off"><X className="size-3.5" /></button>}
      </div>
      {Settings && open && (
        <div className="mb-2 rounded-lg bg-white p-2.5 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700">
          <Settings settings={block.settings || {}} change={(p) => patch({ settings: { ...(block.settings || {}), ...p } })} />
        </div>
      )}
      <div className="pointer-events-none select-none" inert>
        {placeholder ? <p className="px-2 py-3 text-center text-xs text-slate-500 dark:text-neutral-400">{placeholder}</p> : children}
      </div>
    </div>
  );
}

// Above the deck while editing: the layout, blocks to add, where it's saved, and saving
export function EditorToolbar({ center, draft, setDraft, scope, setScope, saving, error, onSave, onCancel, onRemoveOwn }) {
  const [adding, setAdding] = useState(false);
  const [templates, setTemplates] = useState(false);
  const present = onDeck(draft);
  const isDeck = !!center.deck;
  const base = baseTemplate(center);
  // What can go on: a block not on yet (notes, checklists and timers as many as wanted), and on a
  // deck of its own, only ones that don't need a meeting
  const missing = Object.entries(BLOCKS).filter(([type, info]) => type !== "stage" && (info.multi || !present.has(type)) && !(isDeck && info.meetingOnly));
  const shown = shownRegions(draft.layout);
  // A new block goes in the right sidebar (else the left), the strip (reminders) or the bar
  const add = (type) => {
    const region = ["strip", "right", "left", "bar", "main"].find((r) => shown.includes(r) && fits(type, r) && (r !== "strip" || type === "reminders"))
      || shown.find((r) => fits(type, r));
    if (!region) return;
    const info = BLOCKS[type];
    const id = info.multi ? `${type}-${Math.random().toString(36).slice(2, 8)}` : type;
    setDraft((d) => ({ ...d, [region]: [...d[region], { id, type, fresh: true, ...(region === "bar" && info.barGrow ? { grow: true } : {}), ...(info.defaults ? { settings: structuredClone(info.defaults) } : {}) }] }));
    setAdding(false);
  };
  // A sidebar that goes away hands its blocks to the one that stays
  const setLayout = (layout) => setDraft((d) => {
    const sides = LAYOUT_SIDES[layout];
    const next = { ...d, layout };
    if (sides.length === 1) {
      const gone = sides[0] === "left" ? "right" : "left";
      next[sides[0]] = [...d[sides[0]], ...d[gone]];
      next[gone] = [];
    }
    return next;
  });
  const seg = (on) => `rounded-lg px-2.5 py-1.5 text-xs font-semibold ${on ? "!bg-accent text-white" : "!bg-transparent text-slate-600 hover:!bg-neutral-100 dark:text-neutral-300 dark:hover:!bg-neutral-800"}`;
  return (
    <div className="relative z-30 shrink-0 border-b border-accent/30 bg-accent/5 px-3 py-2 dark:bg-accent/10">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-accent dark:text-sky-200">Editing the layout</p>
        <div className="flex rounded-xl bg-white p-0.5 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800" role="group" aria-label="Layout">
          {LAYOUT_CHOICES.map(([key, label]) => <button key={key} type="button" className={seg(draft.layout === key)} aria-pressed={draft.layout === key} onClick={() => setLayout(key)}>{label}</button>)}
        </div>
        <div className="relative">
          <button type="button" className={`${quietButton} !px-3 !py-1.5`} onClick={() => setAdding((v) => !v)} aria-expanded={adding} disabled={!missing.length}><Plus className="size-4" /> Add a block</button>
          {adding && (
            <div className="absolute left-0 top-full z-40 mt-1 w-72 rounded-xl bg-white p-1 shadow-lg ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
              {missing.map(([type, info]) => {
                const Icon = info.icon;
                const ok = shown.some((r) => fits(type, r));
                return (
                  <button key={type} type="button" disabled={!ok} onClick={() => add(type)} className="flex w-full items-center gap-2 rounded-lg !bg-transparent px-2.5 py-2 text-left text-sm hover:!bg-neutral-100 disabled:opacity-50 dark:hover:!bg-neutral-800">
                    <Icon className="size-4 shrink-0 text-slate-400" /> <span className="flex-1">{info.label}</span>
                    {!ok && <span className="text-[11px] text-slate-500">Needs a sidebar</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <button type="button" className={`${quietButton} !px-3 !py-1.5`} onClick={() => setDraft(draftOf(base))} title={`Put every block back where ${base.name} has it`}><RotateCcw className="size-4" /> Start from {base.name}</button>
        <button type="button" className={`${quietButton} !px-3 !py-1.5`} onClick={() => setTemplates(true)}><LayoutTemplate className="size-4" /> Templates</button>
        {templates && <TemplateGallery center={center} draft={draft} setDraft={setDraft} onClose={() => setTemplates(false)} />}
        <span className="flex-1" />
        {!isDeck && <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-neutral-300">
          Save for
          <select className={`${selectClass} !w-auto !py-1.5 !text-sm`} value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="meeting">{center.meeting.name} only</option>
            <option value="default">All the group's meetings{center.layout?.scope === "meeting" ? ` (${center.meeting.name} too)` : ""}</option>
          </select>
        </label>}
        <button type="button" className={`${quietButton} !px-3 !py-1.5`} onClick={onCancel}>Cancel</button>
        <button type="button" className={`${primaryButton} !px-4 !py-1.5`} onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save layout"}</button>
      </div>
      {draft.layout === "focus" && REGIONS.some((r) => (r === "left" || r === "right") && draft[r].length) && (
        <p className="mt-1.5 text-xs text-slate-600 dark:text-neutral-300">The sidebars' blocks are kept, and come back when you pick a layout with a sidebar.</p>
      )}
      {!isDeck && center.layout?.scope === "meeting" && (
        <p className="mt-1.5 text-xs text-slate-600 dark:text-neutral-300">
          {center.meeting.name} has its own layout. <button type="button" className="!bg-transparent p-0 font-semibold text-accent hover:underline" onClick={onRemoveOwn}>Use the group's layout instead</button>
        </p>
      )}
      {error && <div className="mt-2"><ErrorNote error={error} /></div>}
    </div>
  );
}
