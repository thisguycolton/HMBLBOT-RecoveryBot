import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { inputClass } from "./styles";

// A select you can type into: the list narrows to the options whose label (and hint) hold every word
// typed. `options` are { value, label, hint }; `value` is the chosen one's value as a string ("" for
// none); `emptyLabel`, when given, is a first option that clears the choice (like a select's blank
// option). Arrow keys move, Enter picks, Escape closes and puts the chosen label back.
export default function Combobox({ id, value, onChange, options, emptyLabel = null, placeholder = "Type to search", noMatches = "Nothing matches" }) {
  const listId = useId();
  const wrap = useRef(null);
  const list = useRef(null);
  const chosen = options.find((o) => String(o.value) === String(value ?? ""));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const rows = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = options.filter((o) => {
      const text = `${o.label} ${o.hint || ""}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
    return emptyLabel != null && !words.length ? [{ value: "", label: emptyLabel, empty: true }, ...hits] : hits;
  }, [options, query, emptyLabel]);

  // Close when focus or a click goes elsewhere
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!wrap.current?.contains(e.target)) close(); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("focusin", away);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("focusin", away); };
  }, [open]);

  useEffect(() => { list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active, open]);

  const show = () => {
    if (open) return;
    setQuery("");
    setActive(Math.max(0, rows.findIndex((r) => String(r.value) === String(value ?? ""))));
    setOpen(true);
  };
  const close = () => { setOpen(false); setQuery(""); };
  const pick = (row) => { onChange(row.empty ? "" : String(row.value)); close(); };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return show();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (rows.length ? (i + step + rows.length) % rows.length : 0));
    } else if (e.key === "Enter") {
      if (open) {
        e.preventDefault();
        if (rows[active]) pick(rows[active]);
      }
    } else if (e.key === "Escape") {
      if (open) { e.preventDefault(); e.stopPropagation(); close(); }
    } else if (e.key === "Tab") {
      close();
    }
  };

  const shown = open ? query : chosen ? `${chosen.label}${chosen.hint ? ` (${chosen.hint})` : ""}` : "";

  return (
    <div ref={wrap} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && rows[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className={`${inputClass} pr-16`}
        value={shown}
        placeholder={open ? placeholder : emptyLabel ?? placeholder}
        onFocus={show}
        onClick={show}
        onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      <div className="absolute inset-y-0 right-2 flex items-center gap-0.5">
        {value !== "" && value != null && !open && (
          <button type="button" aria-label="Clear" onClick={() => onChange("")} className="rounded-md !bg-transparent p-1 text-slate-400 hover:text-slate-700 dark:hover:text-neutral-200">
            <X className="size-3.5" />
          </button>
        )}
        <ChevronDown aria-hidden className="pointer-events-none size-4 text-slate-400" />
      </div>
      {open && (
        <ul ref={list} id={listId} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {rows.length === 0 && <li className="px-3 py-2 text-sm text-slate-500 dark:text-neutral-400">{noMatches}</li>}
          {rows.map((row, i) => {
            const selected = String(row.value) === String(value ?? "");
            return (
              <li
                key={row.empty ? "" : row.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={selected}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(row)}
                onMouseMove={() => active !== i && setActive(i)}
                className={`flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-sm ${i === active ? "bg-neutral-100 dark:bg-neutral-800" : ""} ${row.empty ? "text-slate-500 dark:text-neutral-400" : "text-slate-800 dark:text-neutral-100"}`}
              >
                <span className="min-w-0 flex-1">
                  {row.label}
                  {row.hint && <span className="ml-1.5 text-xs text-slate-500 dark:text-neutral-400">{row.hint}</span>}
                </span>
                {selected && <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
