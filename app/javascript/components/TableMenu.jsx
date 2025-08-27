// app/javascript/components/TableMenu.jsx
import { useEffect, useRef, useState } from "react";
import { Table as TableIcon, ChevronDown, X } from "lucide-react";

export default function TableMenu({ editor }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // close on outside click / ESC
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (e.key === "Escape") setOpen(false);
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onDown);
    };
  }, [open]);

  const can = (fn) => editor && editor.can().chain().focus()[fn]?.().run?.();

  const Item = ({ label, action, disabled }) => (
    <button
      type="button"
      className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-50 ${
        disabled ? "text-gray-300 cursor-not-allowed hover:bg-transparent" : "text-gray-800"
      }`}
      disabled={disabled}
      onClick={() => {
        action();
        setOpen(false);
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="hb-btn flex items-center gap-1"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Table tools"
      >
        {open ? <X size={14} /> : <TableIcon size={16}/>}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute z-50 mt-2 w-56 rounded border bg-white shadow-lg p-1 right-0"
        >
          <div className="px-3 py-2 text-xs font-semibold text-gray-500">Insert</div>
          <Item
            label="Insert 3×3 (header row)"
            action={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
            disabled={!editor}
          />

          <div className="my-1 h-px bg-gray-200" />

          <div className="px-3 py-2 text-xs font-semibold text-gray-500">Columns</div>
          <Item
            label="Add column after"
            action={() => editor.chain().focus().addColumnAfter().run()}
            disabled={!can("addColumnAfter")}
          />
          <Item
            label="Delete column"
            action={() => editor.chain().focus().deleteColumn().run()}
            disabled={!can("deleteColumn")}
          />

          <div className="my-1 h-px bg-gray-200" />

          <div className="px-3 py-2 text-xs font-semibold text-gray-500">Rows</div>
          <Item
            label="Add row below"
            action={() => editor.chain().focus().addRowAfter().run()}
            disabled={!can("addRowAfter")}
          />
          <Item
            label="Delete row"
            action={() => editor.chain().focus().deleteRow().run()}
            disabled={!can("deleteRow")}
          />

          <div className="my-1 h-px bg-gray-200" />

          <div className="px-3 py-2 text-xs font-semibold text-gray-500">Cells</div>
          <Item
            label="Merge cells"
            action={() => editor.chain().focus().mergeCells().run()}
            disabled={!can("mergeCells")}
          />
          <Item
            label="Split cell"
            action={() => editor.chain().focus().splitCell().run()}
            disabled={!can("splitCell")}
          />

          <div className="my-1 h-px bg-gray-200" />

          <Item
            label="Delete table"
            action={() => editor.chain().focus().deleteTable().run()}
            disabled={!can("deleteTable")}
          />
        </div>
      )}
    </div>
  );
}