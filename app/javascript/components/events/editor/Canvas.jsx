import React, { useEffect, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeftRight, Copy, GripVertical, Trash2 } from "lucide-react";
import BlockView, { HeadingView, isCompact } from "../BlockView";
import { LayoutColumns, blockWrapClass } from "../EventLayout";
import { BLOCK_INFO, SPANS, nearestSpan } from "../lib";

// The editor's canvas: the event's regions as drop zones, each block a sortable card that
// can be selected, dragged (within or between columns), resized by its right edge, and,
// for text blocks, typed into right on the page.
export default function Canvas({ layout, blocks, polls, selected, onSelect, onChange, onRemove, onDuplicate, activeId }) {
  const renderRegion = (region) => {
    const list = blocks.filter((b) => b.region === region);
    return (
      <Region key={region} region={region} layout={layout} ids={list.map((b) => b.id)}>
        {list.map((block) => (
          <SortableBlock
            key={block.id}
            block={block}
            layout={layout}
            polls={polls}
            selected={selected === block.id}
            dragging={activeId === block.id}
            onSelect={() => onSelect(block.id)}
            onChange={(patch) => onChange(block.id, patch)}
            onRemove={() => onRemove(block.id)}
            onDuplicate={() => onDuplicate(block.id)}
          />
        ))}
      </Region>
    );
  };
  return <LayoutColumns layout={layout} renderRegion={renderRegion} />;
}

function Region({ region, layout, ids, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `region:${region}` });
  const label = region === "main" ? "Main content" : layout === "centered" ? "Below the main content" : "Side column";
  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">{label}</p>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div
          ref={setNodeRef}
          data-region-grid
          className={`grid grid-cols-12 gap-x-3 gap-y-2 rounded-2xl p-2 transition-colors ${ids.length ? "" : "ev-region-empty"} ${
            isOver ? "bg-accent/10 ring-2 ring-accent/40" : "ring-1 ring-dashed ring-neutral-300/70 dark:ring-neutral-700"
          }`}
        >
          {children}
          {!ids.length && (
            <p className="col-span-12 grid place-items-center text-sm text-slate-400">Drag a block here</p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableBlock({ block, layout, polls, selected, dragging, onSelect, onChange, onRemove, onDuplicate }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id: block.id });
  const wrapRef = useRef(null);
  const compact = isCompact(block, layout);
  const info = BLOCK_INFO[block.type];
  const otherRegion = block.region === "main" ? "side" : "main";
  const tool = "grid size-7 place-items-center rounded-lg !bg-transparent text-slate-500 hover:!bg-slate-100 hover:text-slate-900 dark:text-neutral-400 dark:hover:!bg-neutral-800 dark:hover:text-white";

  // Drag the right edge to change the width; it snaps to the allowed column spans
  const startResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const grid = wrapRef.current?.closest("[data-region-grid]");
    if (!grid) return;
    const column = grid.getBoundingClientRect().width / 12;
    const startX = e.clientX;
    const startSpan = block.span;
    const move = (ev) => {
      const span = nearestSpan(Math.min(12, Math.max(SPANS[0], startSpan + (ev.clientX - startX) / column)));
      if (span !== block.span) onChange({ span });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "ew-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={(node) => { setNodeRef(node); wrapRef.current = node; }}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={blockWrapClass(block)}
    >
      <div
        className="ev-block"
        data-selected={selected}
        data-dragging={dragging}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        <div className="ev-tools absolute left-0 top-0 z-10 flex items-center gap-0.5 rounded-xl bg-white px-1 py-0.5 shadow-panel ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700">
          <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} className={`${tool} cursor-grab active:cursor-grabbing`} aria-label={`Move ${info?.label}`} title="Drag to move">
            <GripVertical className="size-4" />
          </button>
          <span className="px-1 text-xs font-semibold text-slate-600 dark:text-neutral-300">{info?.label}</span>
          <button type="button" className={tool} onClick={(e) => { e.stopPropagation(); onChange({ region: otherRegion }); }} title={`Move to the ${otherRegion === "main" ? "main" : "side"} column`} aria-label="Move to the other column">
            <ArrowLeftRight className="size-3.5" />
          </button>
          <button type="button" className={tool} onClick={(e) => { e.stopPropagation(); onDuplicate(); }} title="Duplicate" aria-label="Duplicate"><Copy className="size-3.5" /></button>
          <button type="button" className={`${tool} hover:!text-rose-600`} onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Delete" aria-label="Delete"><Trash2 className="size-3.5" /></button>
        </div>

        <InlineBlock block={block} compact={compact} polls={polls} selected={selected} onChange={onChange} />

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to resize"
          title={`Width: ${block.span}/12 — drag to resize`}
          onPointerDown={startResize}
          className="ev-resize absolute -right-2.5 top-1/2 hidden h-12 w-1.5 cursor-ew-resize rounded-full bg-accent md:block"
        />
      </div>
    </div>
  );
}

// Headings, notes and guidelines are typed into right on the page once selected
function InlineBlock({ block, compact, polls, selected, onChange }) {
  if (selected && block.type === "heading") {
    return <InlineHeading block={block} compact={compact} onChange={onChange} />;
  }
  if (selected && (block.type === "notes" || block.type === "guidelines")) {
    return (
      <div className={`rounded-2xl p-1 ${block.type === "guidelines" ? "bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900/60" : "bg-white shadow-panel dark:bg-neutral-800/70 dark:ring-1 dark:ring-white/5"}`}>
        <AutoTextarea
          value={block.markdown}
          onChange={(markdown) => onChange({ markdown })}
          placeholder={"# A headline\nThen write what's new. Markdown works: **bold**, - lists, [links](https://…)"}
          className={`w-full resize-none rounded-xl !bg-transparent p-4 font-mono text-sm text-slate-800 outline-none dark:text-neutral-100 ${compact ? "" : "sm:text-[15px]"}`}
        />
        <p className="px-4 pb-2 text-[11px] text-slate-400">Markdown · click outside to see it as the page shows it</p>
      </div>
    );
  }
  return <BlockView block={block} compact={compact} editing polls={polls} />;
}

function InlineHeading({ block, compact, onChange }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="relative">
      <div className="invisible" aria-hidden="true"><HeadingView block={block} compact={compact} /></div>
      <AutoTextarea
        ref={ref}
        value={block.text}
        onChange={(text) => onChange({ text: text.replace(/\n/g, " ") })}
        rows={1}
        className={`ev-heading absolute inset-0 w-full resize-none overflow-hidden !bg-transparent p-0 tracking-tight text-slate-900 outline-none dark:text-white ${
          compact ? { 1: "text-2xl font-extrabold", 2: "text-xl font-bold", 3: "text-base font-semibold" }[block.level] : { 1: "text-4xl sm:text-5xl font-extrabold", 2: "text-2xl sm:text-3xl font-bold", 3: "text-xl font-semibold" }[block.level]
        } ${{ left: "text-left", center: "text-center", right: "text-right" }[block.align]}`}
      />
    </div>
  );
}

// A textarea that grows with its text
export const AutoTextarea = React.forwardRef(function AutoTextarea({ value, onChange, className = "", ...rest }, outer) {
  const inner = useRef(null);
  const ref = outer || inner;
  useEffect(() => {
    const el = ref.current;
    if (!el || el.classList.contains("absolute")) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, ref]);
  return <textarea ref={ref} value={value || ""} onChange={(e) => onChange(e.target.value)} className={className} {...rest} />;
});
