import React, { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { inputClass, selectClass } from "../../ui/styles";
import { button, chip, chipTone, columnsApi, primary } from "./lib";

const KIND_LABEL = { start: "Waiting for someone", doing: "Being worked on", finished: "Done" };

// The Task board's columns: rename, reorder, say what each means, add one, remove an empty
// one. There's always one Done column and at least one where new tasks wait.
export default function ColumnsDialog({ columns: initial, onClose, onSaved, notify }) {
  const [columns, setColumns] = useState(initial);
  const [name, setName] = useState("");

  const call = (promise) => promise.then((data) => { setColumns(data.columns); onSaved(); }).catch((e) => notify(e.message, "error"));
  const update = (column, body) => call(columnsApi(`/${column.id}`, { method: "PATCH", body }));
  const add = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    call(columnsApi("", { method: "POST", body: { name } })).then(() => setName(""));
  };

  return createPortal(
    <div className="fixed inset-0 z-[2200] grid place-items-end !font-sans sm:place-items-center" role="dialog" aria-modal="true" aria-label="Columns">
      <button type="button" aria-label="Close" className="absolute inset-0 !bg-slate-900/40" onClick={onClose} />
      <div className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-2xl dark:bg-neutral-950 sm:w-[32rem] sm:rounded-[28px]">
        <div className="mb-1 flex items-center">
          <h2 className="flex-1 !text-xl font-extrabold text-slate-900 dark:text-white">Columns</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full !bg-transparent text-slate-500 hover:!bg-slate-100 dark:hover:!bg-neutral-800"><X className="size-5" /></button>
        </div>
        <p className="mb-4 text-sm text-slate-500 dark:text-neutral-400">Moving a task into Done finishes it. New tasks start in the first “waiting” column.</p>
        <ul className="space-y-2">
          {columns.map((column, i) => (
            <li key={column.id} className="flex items-center gap-2 rounded-2xl border border-slate-200 p-2 dark:border-neutral-800">
              <input defaultValue={column.name} aria-label="Column name" className={`${inputClass} !py-1.5`}
                onBlur={(e) => e.target.value.trim() && e.target.value !== column.name && update(column, { name: e.target.value })} />
              {column.kind === "finished" ? (
                <span className={`${chip} ${chipTone.done} shrink-0`}>Done</span>
              ) : (
                <select value={column.kind} onChange={(e) => update(column, { kind: e.target.value })} aria-label="What this column means" className={`${selectClass} !w-auto !py-1.5 text-xs`}>
                  <option value="start">{KIND_LABEL.start}</option>
                  <option value="doing">{KIND_LABEL.doing}</option>
                </select>
              )}
              <button type="button" disabled={i === 0} onClick={() => update(column, { index: i - 1 })} aria-label="Move up" className="grid size-8 shrink-0 place-items-center rounded-full !bg-transparent text-slate-500 hover:!bg-slate-100 disabled:opacity-30 dark:hover:!bg-neutral-800"><ArrowUp className="size-4" /></button>
              <button type="button" disabled={i === columns.length - 1} onClick={() => update(column, { index: i + 1 })} aria-label="Move down" className="grid size-8 shrink-0 place-items-center rounded-full !bg-transparent text-slate-500 hover:!bg-slate-100 disabled:opacity-30 dark:hover:!bg-neutral-800"><ArrowDown className="size-4" /></button>
              {column.kind !== "finished" && (
                <button type="button" onClick={() => call(columnsApi(`/${column.id}`, { method: "DELETE" }))} aria-label={`Remove ${column.name}`} className="grid size-8 shrink-0 place-items-center rounded-full !bg-transparent text-slate-400 hover:!bg-slate-100 hover:text-rose-600 dark:hover:!bg-neutral-800"><Trash2 className="size-4" /></button>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={add} className="mt-3 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New column, like “Waiting on someone”" className={inputClass} />
          <button type="submit" className={primary} disabled={!name.trim()}><Plus className="size-4" /> Add</button>
        </form>
        <div className="mt-5 flex justify-end"><button type="button" className={button} onClick={onClose}>Done</button></div>
      </div>
    </div>,
    document.body,
  );
}
