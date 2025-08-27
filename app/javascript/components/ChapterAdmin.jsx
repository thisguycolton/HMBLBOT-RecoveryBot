import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { GripVertical, Save, Trash2, Pencil } from "lucide-react";
import MergeChaptersModal from "./MergeChaptersModal";


// Pragmatic Drag & Drop
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  attachClosestEdge,
  extractClosestEdge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';

// helpers
const dragCleanupByEl = new WeakMap();
const dropCleanupByEl = new WeakMap();

const slugify = (s) =>
  (s || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// safer, predictable reorder
function reorderById(list, sourceId, targetId, position /* 'before' | 'after' */) {
  if (sourceId === targetId) return list;

  const fromIndex = list.findIndex((c) => c.slug === sourceId);
  const toIndexBase = list.findIndex((c) => c.slug === targetId);
  if (fromIndex === -1 || toIndexBase === -1) return list;

  const copy = [...list];
  const [moved] = copy.splice(fromIndex, 1); // remove source

  // after removing source, indices of items after it shift left
  let insertAt = toIndexBase;
  if (position === "after") {
    // insert after the *current* position of target in the updated list
    // if source was before target, target index is now one less
    insertAt = toIndexBase + (fromIndex < toIndexBase ? 0 : 1);
  } else {
    // "before"
    insertAt = toIndexBase + (fromIndex < toIndexBase ? -1 : 0);
  }

  if (insertAt < 0) insertAt = 0;
  if (insertAt > copy.length) insertAt = copy.length;

  copy.splice(insertAt, 0, moved);

  // reindex 1-based
  return copy.map((c, i) => ({ ...c, index: i + 1 }));
}

// --- Row (draggable + droppable) ---
function Row({ ch, bookSlug, onChange, onSave, onDelete, onReorder, onMerge }) {
  const ref = useRef(null);
  const handleRef = useRef(null);

  // three overlay zones
  const topRef = useRef(null);
  const midRef = useRef(null);
  const botRef = useRef(null);

  const [hint, setHint] = useState(null); // 'before' | 'after' | 'merge' | null

  useEffect(() => {
    const rowEl = ref.current;
    const handle = handleRef.current;
    if (!rowEl || !handle) return;

    // turn on a “drag active” class for pointer-events on zones
    const monitorCleanup = monitorForElements({
      onDragStart() { document.body.classList.add('cursor-grabbing', 'pnd-active'); },
      onDrop()      { document.body.classList.remove('cursor-grabbing', 'pnd-active'); },
    });

    // draggable (handle only)
    const dragCleanup = draggable({
      element: handle,
      getInitialData: () => ({ id: ch.slug }),
      onDragStart: () => rowEl.classList.add('drop-shadow-sm'),
      onDrop:      () => rowEl.classList.remove('drop-shadow-sm'),
    });

    // helpers
    const addTarget = (el, kind) => dropTargetForElements({
      element: el,
      getData: () => ({ id: ch.slug, zone: kind }),
      canDrop: ({ source }) => !!source?.data?.id, // same-list check if you want
      onDragEnter: () => setHint(kind),
      onDrag:      () => setHint(kind),
      onDragLeave: () => setHint(null),
      onDrop: ({ source }) => {
        setHint(null);
        const sourceId = source?.data?.id;
        const targetId = ch.slug;
        if (!sourceId || sourceId === targetId) return;

        if (kind === 'merge') onMerge?.(sourceId, targetId);
        else onReorder?.(sourceId, targetId, kind); // 'before' | 'after'
      },
    });

    // register three independent zones
    const cleanTop = addTarget(topRef.current, 'before');
    const cleanMid = addTarget(midRef.current, 'merge');
    const cleanBot = addTarget(botRef.current, 'after');

    return () => {
      try { dragCleanup(); } catch {}
      try { cleanTop();    } catch {}
      try { cleanMid();    } catch {}
      try { cleanBot();    } catch {}
      try { monitorCleanup(); } catch {}
      document.body.classList.remove('cursor-grabbing', 'pnd-active');
    };
  }, [ch.slug, onReorder, onMerge]);

  return (
    <li
      ref={ref}
      className={[
        "rounded border p-3 bg-white flex flex-col gap-2 relative",
        hint === 'before' && 'chapter-row--before',
        hint === 'after'  && 'chapter-row--after',
        hint === 'merge'  && 'chapter-row--merge',
      ].filter(Boolean).join(' ')}
    >
      {/* overlay drop zones; inactive until body.pnd-active */}
      <div
        ref={topRef}
        className="chapter-row-dropzone absolute left-0 right-0 top-0"
        style={{ height: '25%' }}
      />
      <div
        ref={midRef}
        className="chapter-row-dropzone absolute left-0 right-0"
        style={{ top: '25%', height: '50%' }}
      />
      <div
        ref={botRef}
        className="chapter-row-dropzone absolute left-0 right-0 bottom-0"
        style={{ height: '25%' }}
      />

      <div className="flex items-center gap-3">
        <button
          ref={handleRef}
          className="cursor-grab p-1 rounded border bg-white text-black"
          title="Drag to reorder"
          type="button"
        >
          <GripVertical size={16} />
        </button>
        <div className="text-sm text-gray-500 w-14 shrink-0">#{ch.index}</div>

        <input
          className="flex-1 rounded border px-2 py-1"
          value={ch.title || ""}
          onChange={(e) => onChange({ ...ch, title: e.target.value })}
          placeholder="Title"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <div className="md:col-span-2">
          <label className="text-xs text-gray-500">Slug</label>
          <input
            className="w-full rounded border px-2 py-1"
            value={ch.slug || ""}
            onChange={(e) => onChange({ ...ch, slug: e.target.value })}
            onBlur={(e) => onChange({ ...ch, slug: (e.target.value || "")
              .toLowerCase().trim().replace(/['"]/g, "")
              .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") })}
            placeholder="slug"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">First page</label>
          <input
            type="number"
            className="w-full rounded border px-2 py-1"
            value={ch.first_page ?? ""}
            onChange={(e) => onChange({
              ...ch,
              first_page: e.target.value === "" ? null : Number(e.target.value),
            })}
            placeholder="e.g. 1"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Last page</label>
          <input
            type="number"
            className="w-full rounded border px-2 py-1"
            value={ch.last_page ?? ""}
            onChange={(e) => onChange({
              ...ch,
              last_page: e.target.value === "" ? null : Number(e.target.value),
            })}
            placeholder="e.g. 18"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSave(ch)}
          className="px-3 py-1 border rounded bg-white text-black flex items-center gap-1"
          title="Save"
        >
          <Save size={16} /> Save
        </button>
        <button
          type="button"
          onClick={() => { if (confirm(`Delete "${ch.title}"? This cannot be undone.`)) onDelete(ch); }}
          className="px-3 py-1 border rounded bg-white text-black flex items-center gap-1"
          title="Delete"
        >
          <Trash2 size={16} /> Delete
        </button>
        <a
        href={`/books/${bookSlug}/chapters/${ch.slug}/edit`}
        className="px-3 py-1 bg-slate-500 text-white flex items-center gap-1 rounded hover:bg-slate-600"
      >
        <Pencil size={16} /> Edit Pages
      </a>
      </div>
    </li>
  );
}

export default function ChapterAdmin({ bookSlug }) {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);


  const [mergePair, setMergePair] = useState(null); // { sourceSlug, targetSlug } | null

  const onMerge = (sourceSlug, targetSlug) => {
    setMergePair({ sourceSlug, targetSlug });
  };

  const handleMerged = async (newTargetSlug) => {
    setMergePair(null);
    // Easiest: refetch after merge
    const res = await axios.get(`/api/books/${bookSlug}/chapters`);
    const items = [...res.data].sort((a, b) => (a.index || 0) - (b.index || 0));
    setChapters(items);
  };
  // fetch
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`/api/books/${bookSlug}/chapters`);
        const items = [...res.data].sort((a, b) => (a.index || 0) - (b.index || 0));
        setChapters(items);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [bookSlug]);

  // near the top (inside the component)
const createOne = async () => {
  // quick & dirty prompts; swap for a nice modal later
  const title = window.prompt("New chapter title?", "Untitled");
  if (title == null) return;
  const slug = (title || "untitled")
    .toLowerCase().trim().replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  try {
    const res = await axios.post(`/api/books/${bookSlug}/chapters`, {
      chapter: { title, slug }
    });
    const added = res.data;
    setChapters(prev => {
      const next = [...prev, added].sort((a,b) => (a.index||0)-(b.index||0));
      // reindex in UI for consistency
      return next.map((c, i) => ({ ...c, index: i + 1 }));
    });
  } catch (e) {
    console.error(e);
    alert(e.response?.data?.error || "Failed to create chapter");
  }
};

  const updateLocal = (updated) => {
    setChapters((prev) =>
      prev.map((c) => (c.slug === updated.slug || c.id === updated.id ? updated : c))
    );
  };

  const saveOne = async (ch) => {
    const payload = {
      chapter: {
        title: ch.title,
        slug: ch.slug,
        first_page: ch.first_page,
        last_page: ch.last_page,
      },
    };
    const targetSlug = ch.slug_original || ch.slug;
    await axios.patch(`/api/books/${bookSlug}/chapters/${targetSlug}`, payload);
    setChapters((prev) =>
      prev.map((c) => (c.slug === targetSlug ? { ...ch, slug_original: ch.slug } : c))
    );
  };

  const deleteOne = async (ch) => {
    await axios.delete(`/api/books/${bookSlug}/chapters/${ch.slug}`);
    setChapters((prev) =>
      prev.filter((c) => c.slug !== ch.slug).map((c, i) => ({ ...c, index: i + 1 }))
    );
  };

  const onReorder = async (sourceId, targetId, position) => {
    const reordered = reorderById(chapters, sourceId, targetId, position);
    setChapters(reordered); // optimistic

    try {
      await axios.post(`/api/books/${bookSlug}/chapters/reorder`, {
        order: reordered.map((c) => ({ slug: c.slug, index: c.index })),
      });
    } catch (e) {
      console.error(e);
      // optionally refetch here
    }
  };

  if (loading) return <div className="p-4">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Chapter Admin</h1>
        <button
          type="button"
          onClick={createOne}
          className="px-3 py-1 rounded bg-black text-white hover:opacity-90"
        >
          + Add Chapter
        </button>
        
      </div>
      <p className="text-sm text-gray-600">
          Drag by the handle to reorder. Edit fields inline and press <strong>Save</strong>.
        </p>
      <ul className="space-y-2">
        {chapters.map((ch) => (
          <Row
            key={ch.slug}
            ch={ch}
            bookSlug={bookSlug} 
            onChange={updateLocal}
            onSave={saveOne}
            onDelete={deleteOne}
            onReorder={onReorder}
            onMerge={onMerge}
          />
        ))}
      </ul>
      <MergeChaptersModal
        open={!!mergePair}
        bookSlug={bookSlug}
        sourceSlug={mergePair?.sourceSlug}
        targetSlug={mergePair?.targetSlug}
        onClose={() => setMergePair(null)}
        onMerged={handleMerged}
      />
    </div>
  );
}