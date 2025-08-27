// components/PageBreakModal.jsx
import { useState, useEffect } from "react";

export default function PageBreakModal({ open, initialAttrs, onClose, onSave }) {
  const [page, setPage] = useState(initialAttrs?.page ?? "");
  const [title, setTitle] = useState(initialAttrs?.title ?? "");
  const [kind, setKind] = useState(initialAttrs?.kind ?? "");

  useEffect(() => {
    if (open) {
      setPage(initialAttrs?.page ?? "");
      setTitle(initialAttrs?.title ?? "");
      setKind(initialAttrs?.kind ?? "");
    }
  }, [open, initialAttrs]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/30">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl border">
        <div className="px-4 py-3 border-b font-semibold">Edit page break</div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Page (number or blank)</label>
            <input
              type="number"
              className="w-full rounded border px-2 py-1"
              value={page ?? ""}
              onChange={(e) => setPage(e.target.value === "" ? null : Number(e.target.value))}
              placeholder="e.g. 59"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Running title (optional)</label>
            <input
              className="w-full rounded border px-2 py-1"
              value={title || ""}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. HOW IT WORKS"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Kind</label>
            <select
              className="w-full rounded border px-2 py-1"
              value={kind || ""}
              onChange={(e) => setKind(e.target.value || null)}
            >
              <option value="">Default</option>
              <option value="header">Header</option>
              <option value="footer">Footer</option>
            </select>
          </div>
        </div>

        <div className="px-4 py-3 border-t flex justify-end gap-2">
          <button type="button" className="px-3 py-1 border rounded bg-white" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-1 rounded bg-black text-white"
            onClick={() => onSave({ page, title, kind })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}