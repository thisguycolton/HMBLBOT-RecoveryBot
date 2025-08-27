import { useEffect, useMemo, useState } from "react";
import axios from "axios";

function tiptapToPlain(doc, limit = 300) {
  if (!doc || typeof doc !== "object") return "";
  const out = [];
  let count = 0;

  function walk(node) {
    if (!node || count >= limit) return;
    if (node.type === "text" && node.text) {
      const need = Math.max(0, limit - count);
      out.push(node.text.slice(0, need));
      count += Math.min(need, node.text.length);
      return;
    }
    const kids = Array.isArray(node.content) ? node.content : [];
    for (const k of kids) {
      if (count >= limit) break;
      walk(k);
      if (k.type === "paragraph") {
        out.push("\n");
        count += 1;
      }
    }
  }

  walk(doc);
  return out.join("").replace(/\n{2,}/g, "\n").trim();
}

export default function MergeChaptersModal({
  open,
  bookSlug,
  sourceSlug,   // dragged
  targetSlug,   // dropped onto
  onClose,
  onMerged,     // (newTargetSlug) => void
}) {
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState(null);
  const [target, setTarget] = useState(null);
  const [title, setTitle]   = useState("");
  const [slug, setSlug]     = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const [a, b] = await Promise.all([
          axios.get(`/api/books/${bookSlug}/chapters/${sourceSlug}.json`),
          axios.get(`/api/books/${bookSlug}/chapters/${targetSlug}.json`),
        ]);
        if (!alive) return;
        setSource(a.data);
        setTarget(b.data);
        setTitle(b.data?.title || "");
        setSlug(b.data?.slug || "");
      } catch (e) {
        if (alive) setError("Failed to load chapters for preview.");
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, bookSlug, sourceSlug, targetSlug]);

  const sourcePreview = useMemo(
    () => tiptapToPlain(source?.tiptap_json || source?.tiptap, 250),
    [source]
  );
  const targetPreview = useMemo(
    () => tiptapToPlain(target?.tiptap_json || target?.tiptap, 250),
    [target]
  );

  if (!open) return null;

  const doMerge = async () => {
  try {
    setSaving(true);
    setError("");

    const res = await axios.post(`/api/books/${bookSlug}/chapters/merge`, {
      source_slugs: [source.slug, target.slug],  // the two chapters
      target_slug:  target.slug,                 // merge into target
      new_title:    title,                       // whatever user typed
      new_slug:     slug,                        // whatever user typed
      preview:      false
    });

    onMerged?.(res.data?.target_slug || slug || target.slug);
  } catch (e) {
    console.error(e);
    setError(e.response?.data?.error || "Merge failed.");
  } finally {
    setSaving(false);
  }
};

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/30">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl border">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-semibold">Merge chapters</div>
          <button className="text-sm underline" onClick={onClose}>Close</button>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <div>Loading preview…</div>
          ) : (
            <>
              {!!error && (
                <div className="text-sm text-red-600">{error}</div>
              )}

              <div className="text-sm text-gray-600">
                You’re merging <strong>{source?.title}</strong> into <strong>{target?.title}</strong>.
                The content of <em>{source?.title}</em> will be appended to the end of <em>{target?.title}</em>.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded p-2">
                  <div className="text-xs font-medium text-gray-500 mb-1">
                    Source ({source?.slug})
                  </div>
                  <pre className="text-[12px] whitespace-pre-wrap max-h-40 overflow-auto">
                    {sourcePreview || "—"}
                  </pre>
                </div>
                <div className="border rounded p-2">
                  <div className="text-xs font-medium text-gray-500 mb-1">
                    Target ({target?.slug})
                  </div>
                  <pre className="text-[12px] whitespace-pre-wrap max-h-40 overflow-auto">
                    {targetPreview || "—"}
                  </pre>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">New Title</label>
                  <input
                    className="w-full rounded border px-2 py-1"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">New Slug</label>
                  <input
                    className="w-full rounded border px-2 py-1"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t flex justify-end gap-2">
          <button className="px-3 py-1 border rounded bg-white" onClick={onClose}>
            Cancel
          </button>
          <button
            className="px-3 py-1 rounded bg-black text-white disabled:opacity-50"
            disabled={saving || loading}
            onClick={doMerge}
          >
            {saving ? "Merging…" : "Merge"}
          </button>
        </div>
      </div>
    </div>
  );
}