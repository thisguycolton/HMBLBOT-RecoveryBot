import React, { useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { inputClass } from "../../ui/styles";
import { newId, uploadImage } from "../lib";
import { showToast } from "../../../lib/toast";

// A sortable list, used for agenda activities and photos. renderItem(item, handleProps)
function SortableList({ items, onReorder, renderItem }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const end = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    onReorder(arrayMove(items, from, to));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={end}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1.5">{items.map((item) => <SortableRow key={item.id} id={item.id}>{(handle) => renderItem(item, handle)}</SortableRow>)}</ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} className="grid size-7 shrink-0 cursor-grab place-items-center rounded-lg !bg-transparent text-slate-400 hover:text-slate-700 active:cursor-grabbing dark:hover:text-white" aria-label="Drag to reorder">
      <GripVertical className="size-4" />
    </button>
  );
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={isDragging ? "relative z-10 opacity-80" : ""}>
      {children(handle)}
    </li>
  );
}

function useUpload(uploadPath) {
  const [busy, setBusy] = useState(0);
  const upload = async (files) => {
    const list = [...files];
    setBusy((n) => n + list.length);
    const urls = [];
    for (const file of list) {
      try {
        urls.push(await uploadImage(uploadPath, file));
      } catch (e) {
        showToast(e.message, { tone: "error" });
      } finally {
        setBusy((n) => n - 1);
      }
    }
    return urls;
  };
  return [busy, upload];
}

// Agenda activities: title (needed) and queue order, plus an optional picture and short
// description. The queue number follows the list; drag to change it.
export function ActivitiesEditor({ uploadPath, activities, onChange }) {
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(null);
  const [busy, upload] = useUpload(uploadPath);
  const fileFor = useRef({});
  const numbered = (list) => list.map((a, i) => ({ ...a, queue_number: i + 1 }));
  const patch = (id, change) => onChange(numbered(activities.map((a) => (a.id === id ? { ...a, ...change } : a))));

  const add = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const activity = { id: newId(), title: title.trim(), description: "", image_url: null };
    onChange(numbered([...activities, activity]));
    setTitle("");
  };

  return (
    <div className="space-y-2">
      <SortableList
        items={activities}
        onReorder={(list) => onChange(numbered(list))}
        renderItem={(a, handle) => (
          <div className="rounded-xl bg-white ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700">
            <div className="flex items-center gap-1 p-1.5">
              {handle}
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-white">{a.queue_number}</span>
              <button type="button" onClick={() => setOpen(open === a.id ? null : a.id)} className="min-w-0 flex-1 truncate !bg-transparent px-1.5 text-left text-sm font-medium text-slate-800 dark:text-neutral-100">
                {a.title}
              </button>
              {a.image_url && <img src={a.image_url} alt="" className="size-7 rounded-md object-cover" />}
              <button type="button" onClick={() => setOpen(open === a.id ? null : a.id)} className="grid size-7 place-items-center rounded-lg !bg-transparent text-slate-400" aria-label="Edit activity">
                <ChevronDown className={`size-4 transition-transform ${open === a.id ? "rotate-180" : ""}`} />
              </button>
            </div>
            {open === a.id && (
              <div className="space-y-2 border-t border-neutral-200 p-2.5 dark:border-neutral-700">
                <input className={inputClass} value={a.title} onChange={(e) => patch(a.id, { title: e.target.value })} placeholder="Title" required />
                <textarea className={`${inputClass} resize-none`} rows={2} maxLength={280} value={a.description || ""} onChange={(e) => patch(a.id, { description: e.target.value })} placeholder="Short description (optional)" />
                <div className="flex flex-wrap items-center gap-2">
                  <input type="file" accept="image/*" hidden ref={(el) => { fileFor.current[a.id] = el; }} onChange={async (e) => {
                    const [url] = await upload(e.target.files);
                    e.target.value = "";
                    if (url) patch(a.id, { image_url: url });
                  }} />
                  <button type="button" onClick={() => fileFor.current[a.id]?.click()} className="inline-flex items-center gap-1.5 rounded-lg !bg-neutral-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:!bg-neutral-800 dark:text-neutral-200">
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />} {a.image_url ? "Change photo" : "Add a photo"}
                  </button>
                  {a.image_url && <button type="button" onClick={() => patch(a.id, { image_url: null })} className="!bg-transparent text-xs text-slate-500 hover:text-rose-600">Remove photo</button>}
                  <button type="button" onClick={() => onChange(numbered(activities.filter((x) => x.id !== a.id)))} className="ml-auto inline-flex items-center gap-1 !bg-transparent text-xs font-medium text-rose-600">
                    <Trash2 className="size-3.5" /> Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      />
      <form onSubmit={add} className="flex gap-2">
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add an activity" />
        <button type="submit" disabled={!title.trim()} className="grid size-9 shrink-0 place-items-center rounded-xl !bg-accent text-white disabled:opacity-40" aria-label="Add activity">
          <Plus className="size-4" />
        </button>
      </form>
    </div>
  );
}

// Pictures for a Photo or Gallery block: upload several at once, caption, reorder, remove
export function PhotosEditor({ uploadPath, photos, onChange }) {
  const [busy, upload] = useUpload(uploadPath);
  const input = useRef(null);
  const patch = (id, change) => onChange(photos.map((p) => (p.id === id ? { ...p, ...change } : p)));

  return (
    <div className="space-y-2">
      <SortableList
        items={photos}
        onReorder={onChange}
        renderItem={(p, handle) => (
          <div className="flex items-center gap-2 rounded-xl bg-white p-1.5 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700">
            {handle}
            <img src={p.url} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
            <input className={`${inputClass} !py-1.5`} value={p.caption || ""} onChange={(e) => patch(p.id, { caption: e.target.value })} placeholder="Caption (optional)" maxLength={200} />
            <button type="button" onClick={() => onChange(photos.filter((x) => x.id !== p.id))} className="grid size-7 shrink-0 place-items-center rounded-lg !bg-transparent text-slate-400 hover:text-rose-600" aria-label="Remove photo">
              <X className="size-4" />
            </button>
          </div>
        )}
      />
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={async (e) => {
        const urls = await upload(e.target.files);
        e.target.value = "";
        if (urls.length) onChange([...photos, ...urls.map((url) => ({ id: newId(), url, caption: "" }))]);
      }} />
      <button type="button" onClick={() => input.current?.click()} disabled={busy > 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 !bg-transparent px-3 py-4 text-sm font-medium text-slate-600 hover:border-accent hover:text-accent disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300">
        {busy > 0 ? <><Loader2 className="size-4 animate-spin" /> Uploading {busy}…</> : <><ImagePlus className="size-4" /> Add photos</>}
      </button>
    </div>
  );
}
