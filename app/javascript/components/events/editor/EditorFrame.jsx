import React, { useState } from "react";
import { Link } from "react-router-dom";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, rectIntersection, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ArrowLeft, Check, Eye, Menu, PanelRight, Plus, X } from "lucide-react";
import { RecoveryBotLogo } from "../../brand/Logo";
import NotificationBell from "../../NotificationBell";
import { newId } from "../lib";
import Canvas from "./Canvas";

// The HMBLBOT Editor's frame, shared by events (/events/:token/edit) and group pages
// (/groups/:slug/page/edit): the admin suite's sidebar (the page's settings and the block
// palette), the page itself as the canvas, and a panel on the right for whatever is
// selected. The page's own editor owns the draft and saving; this owns the blocks' moves.
//
//   blocks, setBlocks      the draft's blocks; setBlocks takes a list or list => list
//   selected, setSelected  a settings key (one of `settings`) or a block id
//   settings               [{ key, label, icon, count }] in the sidebar's first section
//   settingsTitle          that section's name ("Event", "Page")
//   blockGroups            the palette: [{ title, items: [{ type, label, note, icon }] }]
//   blockInfo              type => { label, icon }
//   makeBlock(type, region) a new block of that type
//   home, back             { href, label } for the logo and the sidebar's bottom link
//   crumb, title, badge    the header's breadcrumb, title and status pill
//   dirty, saving, onSave, saveLabel, previewTo (a router path)
//   hero                   drawn above the blocks; clicking it opens the first setting
//   canvas                 extra props for the Canvas (layout, polls, context)
//   renderPanel(key)       the right-hand panel for a setting
//   renderInspector(block, { onChange, onRemove }) the right-hand panel for a block
export default function EditorFrame({
  blocks, setBlocks, selected, setSelected, settings, settingsTitle, blockGroups, blockInfo, makeBlock,
  home, back, crumb, title, badge, dirty, saving, onSave, saveLabel = "Save", previewTo, hero, canvas,
  renderPanel, renderInspector,
}) {
  const [drawer, setDrawer] = useState(false);
  const [inspector, setInspector] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const firstSetting = settings[0].key;

  const patchBlock = (id, patch) => setBlocks((list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const select = (key) => { setSelected(key); setInspector(true); setDrawer(false); };
  const removeBlock = (id) => {
    setBlocks((list) => list.filter((b) => b.id !== id));
    if (selected === id) setSelected(firstSetting);
  };
  const duplicateBlock = (id) => {
    const i = blocks.findIndex((b) => b.id === id);
    const copy = { ...structuredClone(blocks[i]), id: newId() };
    setBlocks((list) => [...list.slice(0, i + 1), copy, ...list.slice(i + 1)]);
    setSelected(copy.id);
  };

  // Where a new block lands: after the selected one, else at the end of its column
  const insertAt = (list, block, overId) => {
    let index;
    if (overId && !String(overId).startsWith("region:")) index = list.findIndex((b) => b.id === overId);
    else {
      const last = list.map((b) => b.region).lastIndexOf(block.region);
      index = last + 1 || list.length;
    }
    if (index < 0) index = list.length;
    return [...list.slice(0, index), block, ...list.slice(index)];
  };
  const addBlock = (type) => {
    const after = blocks.find((b) => b.id === selected);
    const block = makeBlock(type, after?.region || "main");
    setBlocks((list) => {
      if (!after) return insertAt(list, block);
      const i = list.findIndex((b) => b.id === after.id);
      return [...list.slice(0, i + 1), block, ...list.slice(i + 1)];
    });
    select(block.id);
  };

  const regionOf = (id) => {
    if (id == null) return null;
    const s = String(id);
    if (s.startsWith("region:")) return s.slice(7);
    return blocks.find((b) => b.id === s)?.region || null;
  };
  const isNew = (id) => String(id).startsWith("new:");

  const onDragOver = ({ active, over }) => {
    if (!over || isNew(active.id)) return;
    const from = regionOf(active.id);
    const to = regionOf(over.id);
    if (!to || from === to) return;
    setBlocks((list) => {
      const moving = list.find((b) => b.id === active.id);
      const rest = list.filter((b) => b.id !== active.id);
      return insertAt(rest, { ...moving, region: to }, over.id);
    });
  };
  const onDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over) return;
    if (isNew(active.id)) {
      const block = makeBlock(active.data.current.type, regionOf(over.id) || "main");
      setBlocks((list) => insertAt(list, block, over.id));
      select(block.id);
      return;
    }
    if (active.id === over.id || String(over.id).startsWith("region:")) return;
    setBlocks((list) => {
      const from = list.findIndex((b) => b.id === active.id);
      const to = list.findIndex((b) => b.id === over.id);
      return from < 0 || to < 0 ? list : arrayMove(list, from, to);
    });
  };

  const selectedBlock = blocks.find((b) => b.id === selected);
  const setting = settings.find((p) => p.key === selected) || (!selectedBlock && settings[0]);
  const activeLabel = activeId && (isNew(activeId) ? blockInfo[String(activeId).slice(4)] : blockInfo[blocks.find((b) => b.id === activeId)?.type]);
  const iconButton = "relative inline-flex size-9 items-center justify-center rounded-full border border-slate-200 !bg-transparent text-slate-700 hover:!bg-slate-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:!bg-neutral-800";

  const sidebar = (
    <div className="flex h-full flex-col">
      <a href={home.href} className="flex items-center gap-2 px-6 py-6">
        <span className="!text-slate-900 dark:!text-white"><RecoveryBotLogo markClassName="h-7 w-auto" textClassName="text-lg" /></span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold !text-white">Editor</span>
      </a>
      <nav className="flex-1 overflow-y-auto px-4 pb-6" aria-label="HMBLBOT Editor">
        <SidebarSection title={settingsTitle}>
          {settings.map((p) => (
            <SidebarItem key={p.key} icon={p.icon} label={p.label} active={selected === p.key} onClick={() => select(p.key)} count={p.count} />
          ))}
        </SidebarSection>
        {blockGroups.map((group) => (
          <SidebarSection key={group.title} title={`${group.title} blocks`}>
            {group.items.map((item) => <PaletteItem key={item.type} item={item} onAdd={() => addBlock(item.type)} />)}
          </SidebarSection>
        ))}
        <p className="px-3 text-xs text-slate-400 dark:text-neutral-500">Drag a block onto the page, or click to add it after the selected one.</p>
      </nav>
      <div className="border-t border-slate-200 p-4 dark:border-neutral-800">
        <a href={back.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium !text-slate-700 hover:bg-slate-100 dark:!text-neutral-300 dark:hover:bg-neutral-800">
          <ArrowLeft className="size-5 opacity-70" /> {back.label}
        </a>
      </div>
    </div>
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => { const hits = pointerWithin(args); return hits.length ? hits : rectIntersection(args); }}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="min-h-screen w-full bg-slate-100 text-slate-900 dark:bg-neutral-950 dark:text-neutral-100">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 lg:block">{sidebar}</aside>
        {drawer && (
          <div className="fixed inset-0 z-[2100] lg:hidden">
            <button type="button" aria-label="Close menu" className="absolute inset-0 !bg-black/40" onClick={() => setDrawer(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl dark:bg-neutral-900">
              <button type="button" aria-label="Close menu" className={`${iconButton} !absolute right-3 top-5 z-10`} onClick={() => setDrawer(false)}><X className="size-4" /></button>
              {sidebar}
            </aside>
          </div>
        )}

        <div className="min-w-0 lg:pl-72 xl:pr-96">
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-3 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90 sm:gap-3 sm:px-6">
            <button type="button" className={`${iconButton} lg:hidden`} aria-label="Open menu" onClick={() => setDrawer(true)}><Menu className="size-4" /></button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-slate-500 dark:text-neutral-400">{crumb}</p>
              <p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-900 dark:text-white">
                <span className="truncate">{title}</span>
                {badge}
              </p>
            </div>
            {dirty && <span className="hidden text-xs font-medium text-amber-600 dark:text-amber-300 sm:inline" role="status">Unsaved changes</span>}
            <NotificationBell />
            <Link to={previewTo} className={iconButton} title="See the page" aria-label="See the page" onClick={(e) => { if (dirty && !window.confirm("Leave without saving?")) e.preventDefault(); }}>
              <Eye className="size-4" />
            </Link>
            <button type="button" className={`${iconButton} xl:hidden`} aria-label="Open the panel" onClick={() => setInspector(true)}><PanelRight className="size-4" /></button>
            <button type="button" onClick={onSave} disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 rounded-xl !bg-accent px-3.5 py-2 text-sm font-semibold !text-white shadow-panel hover:opacity-90 disabled:opacity-50">
              <Check className="size-4" /> {saving ? "Saving…" : saveLabel}
            </button>
          </header>

          <main className="px-3 py-6 sm:px-6" onClick={() => selectedBlock && setSelected(firstSetting)}>
            <div className="mx-auto max-w-6xl space-y-8">
              <div className="cursor-pointer rounded-3xl outline-2 outline-offset-4 outline-transparent hover:outline-accent/30" onClick={(e) => { e.stopPropagation(); select(firstSetting); }} title="Edit the details">
                {hero}
              </div>
              <Canvas
                {...canvas}
                blocks={blocks}
                blockInfo={blockInfo}
                selected={selected}
                activeId={activeId}
                onSelect={select}
                onChange={patchBlock}
                onRemove={removeBlock}
                onDuplicate={duplicateBlock}
              />
              {blocks.length === 0 && (
                <button type="button" onClick={() => addBlock("heading")} className="mx-auto flex items-center gap-2 rounded-xl !bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-panel dark:!bg-neutral-900 dark:text-neutral-200">
                  <Plus className="size-4" /> Add a heading to start
                </button>
              )}
            </div>
          </main>
        </div>

        <aside className={`fixed inset-y-0 right-0 z-[2050] w-full max-w-sm overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 xl:z-40 xl:block xl:w-96 xl:max-w-none xl:shadow-none ${inspector ? "block" : "hidden"}`}>
          <button type="button" aria-label="Close the panel" className={`${iconButton} float-right -mr-1 -mt-1 ml-2 xl:hidden`} onClick={() => setInspector(false)}><X className="size-4" /></button>
          {selectedBlock
            ? renderInspector(selectedBlock, { onChange: (patch) => patchBlock(selectedBlock.id, patch), onRemove: () => removeBlock(selectedBlock.id) })
            : renderPanel(setting.key, setting)}
        </aside>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeLabel && (
          <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-2xl ring-2 ring-accent dark:bg-neutral-900 dark:text-white">
            <activeLabel.icon className="size-4 text-accent" /> {activeLabel.label}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function SidebarSection({ title, children }) {
  return (
    <div className="mb-6">
      <div className="mb-3 px-3 text-xs uppercase tracking-wider text-slate-400 dark:text-neutral-500">{title}</div>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function SidebarItem({ icon: Icon, label, active, onClick, count }) {
  return (
    <li>
      <button type="button" onClick={onClick}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
          active ? "!bg-accent/15 !text-accent-ink dark:!text-sky-300" : "!bg-transparent !text-slate-700 hover:!bg-slate-100 dark:!text-neutral-300 dark:hover:!bg-neutral-800"
        }`}>
        <Icon className={`size-5 ${active ? "text-accent dark:text-sky-300" : "opacity-70"}`} />
        <span className="flex-1">{label}</span>
        {count > 0 && <span className="min-w-5 rounded-full bg-emerald-600 px-1.5 text-center text-xs font-semibold !text-white">{count}</span>}
      </button>
    </li>
  );
}

function PaletteItem({ item, onAdd }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `new:${item.type}`, data: { type: item.type } });
  const Icon = item.icon;
  return (
    <li>
      <button type="button" ref={setNodeRef} {...attributes} {...listeners} onClick={onAdd}
        className={`flex w-full cursor-grab items-center gap-3 rounded-xl !bg-transparent px-3 py-2 text-left !text-slate-700 hover:!bg-slate-100 active:cursor-grabbing dark:!text-neutral-300 dark:hover:!bg-neutral-800 ${isDragging ? "opacity-50" : ""}`}>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 dark:bg-neutral-800"><Icon className="size-4" /></span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{item.label}</span>
          <span className="block truncate text-xs text-slate-400 dark:text-neutral-500">{item.note}</span>
        </span>
      </button>
    </li>
  );
}
