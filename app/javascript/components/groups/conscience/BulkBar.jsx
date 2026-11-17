import React, { useState } from "react";
import { X } from "lucide-react";
import { selectClass } from "../../ui/styles";
import { dangerButton, primaryButton, quietButton } from "../ui";

// The bar that shows once some rows are ticked: how many, select all, and one action to run on
// them. `actions` are { key, label, values?: [[value, label]], danger?, confirm? }; picking one
// with values asks for the value next to it.
export default function BulkBar({ count, total, onSelectAll, onClear, actions, onRun, busy }) {
  const [action, setAction] = useState("");
  const [value, setValue] = useState("");
  const chosen = actions.find((a) => a.key === action);
  if (count === 0) return null;
  const run = () => {
    if (!chosen || (chosen.values && !value)) return;
    if (chosen.confirm && !window.confirm(chosen.confirm(count))) return;
    onRun(chosen.key, value).then(() => { setAction(""); setValue(""); });
  };
  return (
    <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-accent/40 bg-white p-2.5 shadow-lg dark:bg-neutral-900">
      <span className="px-1 text-sm font-semibold text-slate-900 dark:text-white">{count} selected</span>
      {count < total && <button type="button" className={`${quietButton} !px-2 !py-1 !text-xs`} onClick={onSelectAll}>Select all {total}</button>}
      <button type="button" aria-label="Clear the selection" className={`${quietButton} !px-2 !py-1 !text-xs`} onClick={onClear}><X className="size-3.5" /> Clear</button>
      <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-2">
        <select aria-label="Do with the selected" className={`${selectClass} !w-auto`} value={action} onChange={(e) => { setAction(e.target.value); setValue(""); }}>
          <option value="">Choose an action…</option>
          {actions.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
        </select>
        {chosen?.values && (
          <select aria-label={chosen.label} className={`${selectClass} !w-auto`} value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Choose…</option>
            {chosen.values.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        )}
        <button type="button" disabled={busy || !chosen || (chosen.values && !value)} className={chosen?.danger ? dangerButton : primaryButton} onClick={run}>{busy ? "Working…" : "Apply"}</button>
      </div>
    </div>
  );
}

// A row's checkbox, kept off the row's own click
export function RowCheck({ checked, onChange, label }) {
  return (
    <input type="checkbox" aria-label={label} checked={checked} onClick={(e) => e.stopPropagation()} onChange={(e) => onChange(e.target.checked)}
      className="mt-1 size-4 shrink-0 cursor-pointer rounded border-slate-300 accent-accent" />
  );
}
