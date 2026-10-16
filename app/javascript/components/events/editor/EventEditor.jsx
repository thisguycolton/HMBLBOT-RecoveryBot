import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, rectIntersection, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ArrowLeft, Check, Columns3, Eye, FileText, Inbox, Menu, PanelRight, Plus, Users, X } from "lucide-react";
import { showToast } from "../../../lib/toast";
import { RecoveryBotLogo } from "../../brand/Logo";
import NotificationBell from "../../NotificationBell";
import { api, BLOCK_GROUPS, BLOCK_INFO, newBlock, newId, pendingUpdates } from "../lib";
import { EventHero } from "../EventLayout";
import RsvpCard from "../RsvpCard";
import Canvas from "./Canvas";
import BlockInspector from "./Inspector";
import { DangerZone, DetailsPanel, LayoutPanel, PanelTitle, PeoplePanel, RsvpsPanel } from "./Panels";

// The event's own settings, in the sidebar's "Event" section
const PANELS = [
  { key: "details", label: "Details", icon: FileText, note: "Title, when and where, cover and flyer" },
  { key: "layout", label: "Layout", icon: Columns3, note: "How the page's columns are laid out" },
  { key: "people", label: "Collaborators", icon: Users, note: "Who can edit this event" },
  { key: "rsvps", label: "RSVPs & updates", icon: Inbox, note: "Who's coming, and what went out" },
];

const formFrom = (e) => ({
  title: e.title || "", short_description: e.short_description || "", layout: e.layout, status: e.status,
  time_zone: e.time_zone, starts_at: e.starts_at || "", ends_at: e.ends_at || "", location: e.location || "",
  blocks: e.blocks || [],
});
const imagesFrom = (e) => ({ cover: { url: e.cover_url, file: null, remove: false }, flyer: { url: e.flyer_url, file: null, remove: false } });

// The HMBLBOT Editor at /events/:token/edit: the admin suite's sidebar (event settings and
// the block palette), the page itself as the canvas, and a panel on the right for whatever
// is selected. Changes stay local until Save.
export default function EventEditor() {
  const { token } = useParams();
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [images, setImages] = useState(null);
  const [selected, setSelected] = useState("details");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [inspector, setInspector] = useState(false);
  const [activeId, setActiveId] = useState(null);

  const adopt = useCallback((data) => {
    setSaved(data);
    setDraft(formFrom(data));
    setImages(imagesFrom(data));
    document.title = `Edit ${data.title} | HMBLBOT Editor`;
  }, []);

  useEffect(() => {
    api(`/events/${token}`).then((data) => {
      if (!data.can_edit) throw new Error("Only the people running this event can edit it.");
      adopt(data);
    }).catch((e) => setError(e.message));
  }, [token, adopt]);

  const dirty = useMemo(() => {
    if (!saved || !draft) return false;
    return JSON.stringify(draft) !== JSON.stringify(formFrom(saved)) || images.cover.file || images.cover.remove || images.flyer.file || images.flyer.remove;
  }, [saved, draft, images]);

  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const pending = useMemo(() => (saved && draft && draft.status === "published" ? pendingUpdates(saved.blocks, draft.blocks) : []), [saved, draft]);

  const save = useCallback(async () => {
    if (!draft || saving) return;
    if (!draft.title.trim()) {
      setSelected("details");
      showToast("Give the event a title first.", { tone: "error" });
      return;
    }
    if (pending.length && saved.followers_count > 0) {
      const n = saved.followers_count;
      if (!window.confirm(`Saving sends ${pending.length === 1 ? "an update" : `${pending.length} updates`} to ${n} ${n === 1 ? "person" : "people"} following this event. Save and send?`)) return;
    }
    setSaving(true);
    try {
      const withFiles = images.cover.file || images.flyer.file || images.cover.remove || images.flyer.remove;
      let data;
      if (withFiles) {
        const form = new FormData();
        for (const [key, value] of Object.entries(draft)) form.append(`event[${key}]`, key === "blocks" ? JSON.stringify(value) : value ?? "");
        for (const name of ["cover", "flyer"]) {
          if (images[name].file) form.append(`event[${name}]`, images[name].file);
          if (images[name].remove) form.append(`event[remove_${name}]`, "1");
        }
        data = await api(`/events/${token}`, { method: "PATCH", form });
      } else {
        data = await api(`/events/${token}`, { method: "PATCH", body: { event: draft } });
      }
      adopt(data);
      const sent = data.sent_updates?.length || 0;
      showToast(sent ? `Saved, and sent ${sent === 1 ? "an update" : `${sent} updates`}.` : "Saved.", { tone: "success" });
    } catch (e) {
      showToast(e.message, { tone: "error" });
    } finally {
      setSaving(false);
    }
  }, [draft, saving, pending, saved, images, token, adopt]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [save]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  if (error) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Can't open the editor</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-neutral-400">{error}</p>
        <a href="/groups" className="mt-4 inline-block text-sm text-accent hover:underline">Back to groups</a>
      </div>
    );
  }
  if (!draft) return <p className="py-24 text-center text-sm text-slate-500">Loading the editor…</p>;

  const blocks = draft.blocks;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setBlocks = (fn) => setDraft((d) => ({ ...d, blocks: typeof fn === "function" ? fn(d.blocks) : fn }));
  const patchBlock = (id, patch) => setBlocks((list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const select = (key) => { setSelected(key); setInspector(true); setDrawer(false); };
  const removeBlock = (id) => {
    setBlocks((list) => list.filter((b) => b.id !== id));
    if (selected === id) setSelected("details");
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
    const block = newBlock(type, after?.region || "main");
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
      const block = newBlock(active.data.current.type, regionOf(over.id) || "main");
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
  const panel = PANELS.find((p) => p.key === selected) || (!selectedBlock && PANELS[0]);
  const activeLabel = activeId && (isNew(activeId) ? BLOCK_INFO[String(activeId).slice(4)] : BLOCK_INFO[blocks.find((b) => b.id === activeId)?.type]);
  const preview = { ...saved, ...draft, cover_url: images.cover.url, flyer_url: images.flyer.url, when_label: whenLabel(draft) };
  const iconButton = "relative inline-flex size-9 items-center justify-center rounded-full border border-slate-200 !bg-transparent text-slate-700 hover:!bg-slate-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:!bg-neutral-800";

  const sidebar = (
    <div className="flex h-full flex-col">
      <a href={`/groups/${saved.group.slug}`} className="flex items-center gap-2 px-6 py-6">
        <span className="!text-slate-900 dark:!text-white"><RecoveryBotLogo markClassName="h-7 w-auto" textClassName="text-lg" /></span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold !text-white">Editor</span>
      </a>
      <nav className="flex-1 overflow-y-auto px-4 pb-6" aria-label="HMBLBOT Editor">
        <SidebarSection title="Event">
          {PANELS.map((p) => (
            <SidebarItem key={p.key} icon={p.icon} label={p.label} active={selected === p.key} onClick={() => select(p.key)}
              count={p.key === "rsvps" ? saved.counts.going : null} />
          ))}
        </SidebarSection>
        {BLOCK_GROUPS.map((group) => (
          <SidebarSection key={group.title} title={`${group.title} blocks`}>
            {group.items.map((item) => <PaletteItem key={item.type} item={item} onAdd={() => addBlock(item.type)} />)}
          </SidebarSection>
        ))}
        <p className="px-3 text-xs text-slate-400 dark:text-neutral-500">Drag a block onto the page, or click to add it after the selected one.</p>
      </nav>
      <div className="border-t border-slate-200 p-4 dark:border-neutral-800">
        <a href={`/groups/${saved.group.slug}/events`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium !text-slate-700 hover:bg-slate-100 dark:!text-neutral-300 dark:hover:bg-neutral-800">
          <ArrowLeft className="size-5 opacity-70" /> Back to {saved.group.title}
        </a>
      </div>
    </div>
  );

  const inspectorBody = selectedBlock ? (
    <BlockInspector
      block={selectedBlock}
      token={token}
      followers={saved.followers_count}
      changed={pending.includes(selectedBlock.id)}
      onChange={(patch) => patchBlock(selectedBlock.id, patch)}
      onRemove={() => removeBlock(selectedBlock.id)}
    />
  ) : (
    <>
      <PanelTitle icon={panel.icon} title={panel.label} note={panel.note} />
      {panel.key === "details" && (
        <>
          <DetailsPanel draft={draft} set={set} images={images} setImages={setImages} max={saved.short_description_max} />
          {saved.can_manage && (
            <div className="mt-6 border-t border-slate-200 pt-4 dark:border-neutral-800">
              <DangerZone onDelete={async () => {
                if (!window.confirm(`Delete “${saved.title}”? Its RSVPs and updates go too.`)) return;
                try {
                  await api(`/events/${token}`, { method: "DELETE" });
                  window.location.href = `/groups/${saved.group.slug}/events`;
                } catch (e) { showToast(e.message, { tone: "error" }); }
              }} />
            </div>
          )}
        </>
      )}
      {panel.key === "layout" && <LayoutPanel value={draft.layout} onChange={(layout) => set({ layout })} />}
      {panel.key === "people" && <PeoplePanel event={saved} setEvent={(data) => { setSaved(data); }} />}
      {panel.key === "rsvps" && <RsvpsPanel event={saved} />}
    </>
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
              <p className="truncate text-xs text-slate-500 dark:text-neutral-400">
                <a href={`/groups/${saved.group.slug}/events`} className="!text-slate-500 hover:underline dark:!text-neutral-400">{saved.group.title}</a> / Events
              </p>
              <p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-900 dark:text-white">
                <span className="truncate">{draft.title || "Untitled event"}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${draft.status === "published" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"}`}>
                  {draft.status === "published" ? "Published" : "Draft"}
                </span>
              </p>
            </div>
            {dirty && <span className="hidden text-xs font-medium text-amber-600 dark:text-amber-300 sm:inline" role="status">Unsaved changes</span>}
            <NotificationBell />
            <Link to={`/${token}`} className={iconButton} title="See the page" aria-label="See the page" onClick={(e) => { if (dirty && !window.confirm("Leave without saving?")) e.preventDefault(); }}>
              <Eye className="size-4" />
            </Link>
            <button type="button" className={`${iconButton} xl:hidden`} aria-label="Open the panel" onClick={() => setInspector(true)}><PanelRight className="size-4" /></button>
            <button type="button" onClick={save} disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 rounded-xl !bg-accent px-3.5 py-2 text-sm font-semibold !text-white shadow-panel hover:opacity-90 disabled:opacity-50">
              <Check className="size-4" /> {saving ? "Saving…" : pending.length && saved.followers_count ? "Save & send" : "Save"}
            </button>
          </header>

          <main className="px-3 py-6 sm:px-6" onClick={() => selectedBlock && setSelected("details")}>
            <div className="mx-auto max-w-6xl space-y-8">
              <div className="cursor-pointer rounded-3xl outline-2 outline-offset-4 outline-transparent hover:outline-accent/30" onClick={(e) => { e.stopPropagation(); select("details"); }} title="Edit the details">
                <EventHero event={preview} groupLink={false} aside={<RsvpCard event={preview} setEvent={() => {}} preview />} />
              </div>
              <Canvas
                layout={draft.layout}
                blocks={blocks}
                polls={saved.polls}
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
          {inspectorBody}
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

// The details line while editing, before the server has worded it
function whenLabel(draft) {
  if (!draft.starts_at) return null;
  const start = new Date(draft.starts_at);
  const opts = { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" };
  let label = start.toLocaleString([], opts);
  if (draft.ends_at) {
    const end = new Date(draft.ends_at);
    label += ` – ${end.toDateString() === start.toDateString() ? end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : end.toLocaleString([], opts)}`;
  }
  return label;
}
