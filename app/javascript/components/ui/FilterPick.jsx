import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

const MAX_SHOWN = 100;

// A pick-one list to type into: the field filters the options (words anywhere in the label or
// its hint), and clicking one (or Enter) picks it. Picked, the field shows its label.
// The list sits in the flow under the field rather than floating, so overflow-hidden panels
// don't clip it (as TagAutocomplete does).
// options: [{ value, label, hint }]
export default function FilterPick({ id, options, value, onChange, placeholder = "Type to search", disabled = false, empty = "Nothing matches" }) {
  const picked = options.find((o) => String(o.value) === String(value));
  const [query, setQuery] = useState(picked?.label || "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef(null);

  // the field follows the pick when it changes from outside (or the options load)
  useEffect(() => { if (!open) setQuery(picked?.label || ""); }, [picked?.label]); // eslint-disable-line react-hooks/exhaustive-deps

  // while it shows the picked label, the whole list shows (so it's easy to pick another)
  const words = open && query !== (picked?.label || "") ? query.toLowerCase().split(/\s+/).filter(Boolean) : [];
  const matches = useMemo(() => {
    if (!words.length) return options;
    return options.filter((o) => {
      const text = `${o.label} ${o.hint || ""}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [options, words.join(" ")]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = matches.slice(0, MAX_SHOWN);

  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (option) => {
    if (!option) return;
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  };
  const close = () => {
    setOpen(false);
    setQuery(picked?.label || "");
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open) choose(shown[active]);
      else setOpen(true);
    } else if (e.key === "Escape") {
      close();
    }
  };

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
          onFocus={(e) => { setOpen(true); setActive(Math.max(matches.indexOf(picked), 0)); e.target.select(); }}
          onBlur={close}
          onKeyDown={onKeyDown}
          className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60 max-lg:py-3 max-lg:text-base dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
        />
        <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          // keep focus in the field, so a click lands before blur closes the list
          onMouseDown={(e) => e.preventDefault()}
          className="mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900"
        >
          {shown.map((o, i) => {
            const isPicked = String(o.value) === String(value);
            return (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm max-lg:py-2.5 max-lg:text-base ${i === active ? "bg-accent/10 text-accent-ink dark:bg-white/10 dark:text-white" : "text-slate-700 dark:text-neutral-200"}`}
              >
                <span className="min-w-0 flex-1">
                  <Highlight text={o.label} words={words} />
                  {o.hint && <span className="text-slate-500 dark:text-neutral-400"> · <Highlight text={o.hint} words={words} /></span>}
                </span>
                {isPicked && <Check className="size-4 shrink-0 text-accent" />}
              </li>
            );
          })}
          {shown.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">{empty}</li>}
          {matches.length > MAX_SHOWN && <li className="px-3 py-1.5 text-xs text-slate-400">Keep typing to see more</li>}
        </ul>
      )}
    </div>
  );
}

// The typed words in bold
function Highlight({ text, words }) {
  if (!words.length) return text;
  const lower = text.toLowerCase();
  const marks = new Array(text.length).fill(false);
  words.forEach((w) => {
    for (let at = lower.indexOf(w); at >= 0; at = lower.indexOf(w, at + w.length)) marks.fill(true, at, at + w.length);
  });
  const parts = [];
  let start = 0;
  for (let i = 1; i <= text.length; i += 1) {
    if (i === text.length || marks[i] !== marks[start]) {
      const piece = text.slice(start, i);
      parts.push(marks[start] ? <strong key={start} className="font-semibold">{piece}</strong> : piece);
      start = i;
    }
  }
  return parts;
}
