import React, { useId, useMemo, useRef, useState } from "react";
import { Plus, Tag as TagIcon, X } from "lucide-react";

const MAX_SUGGESTIONS = 50;

// Picked tags as removable pills, plus a field that filters the existing tags while
// typing. Clicking a suggestion (or Enter) adds it. With onCreate, a typed name that
// matches no tag can be added as a new one.
// The suggestion list sits in the flow under the field rather than floating, so the
// overflow-hidden shell panels don't clip it.
export default function TagAutocomplete({ tags, value, onChange, onCreate, creating = false, placeholder = "Search tags" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listId = useId();

  const byId = useMemo(() => Object.fromEntries(tags.map((t) => [Number(t.id), t])), [tags]);
  const picked = value.map((id) => byId[id]).filter(Boolean);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    const free = tags.filter((t) => !value.includes(Number(t.id)));
    if (!q) return free;
    const starts = free.filter((t) => t.title.toLowerCase().startsWith(q));
    const inside = free.filter((t) => !t.title.toLowerCase().startsWith(q) && t.title.toLowerCase().includes(q));
    return [...starts, ...inside];
  }, [tags, value, q]);
  const shown = matches.slice(0, MAX_SUGGESTIONS);
  const exact = q && tags.some((t) => t.title.toLowerCase() === q);
  const canCreate = Boolean(onCreate && q && !exact);
  const options = [...shown.map((t) => ({ tag: t })), ...(canCreate ? [{ create: query.trim() }] : [])];
  const showList = open && (q || shown.length > 0);

  function add(tag) {
    onChange([...value, Number(tag.id)]);
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  }

  function remove(id) {
    onChange(value.filter((v) => v !== id));
  }

  async function choose(option) {
    if (!option) return;
    if (option.tag) return add(option.tag);
    await onCreate(option.create);
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showList) choose(options[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !query && picked.length) {
      remove(Number(picked[picked.length - 1].id));
    }
  }

  return (
    <div>
      {picked.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-lg:gap-2 mb-3">
          {picked.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 max-lg:py-1.5 rounded-full text-xs max-lg:text-sm font-semibold bg-accent-tint text-accent-ink dark:bg-accent/35 dark:text-white"
            >
              {tag.title}
              <button
                type="button"
                onClick={() => remove(Number(tag.id))}
                aria-label={`Remove ${tag.title}`}
                className="grid place-items-center size-5 rounded-full !bg-transparent opacity-70 hover:opacity-100 hover:!bg-black/10 dark:hover:!bg-white/15"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <TagIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={Boolean(showList)}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && options[active] ? `${listId}-${active}` : undefined}
          aria-label="Add a tag"
          autoComplete="off"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder={picked.length ? "Add another tag" : placeholder}
          className="w-full pl-9 pr-3 py-2 max-lg:py-3 text-sm max-lg:text-base bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
        />
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          // Keep focus in the field so a click lands before blur closes the list
          onMouseDown={(e) => e.preventDefault()}
          className="mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1"
        >
          {options.map((option, i) => (
            <li
              key={option.tag ? option.tag.id : "create"}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(option)}
              className={`flex items-center gap-2 px-3 py-2 max-lg:py-2.5 rounded-lg text-sm max-lg:text-base cursor-pointer ${
                i === active ? "bg-accent/10 text-accent-ink dark:bg-white/10 dark:text-white" : "text-slate-700 dark:text-neutral-200"
              }`}
            >
              {option.tag ? (
                <Highlight text={option.tag.title} query={q} />
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>{creating ? "Adding…" : <>Create “{option.create}”</>}</span>
                </>
              )}
            </li>
          ))}
          {options.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-400">No tags match “{query.trim()}”</li>
          )}
          {matches.length > MAX_SUGGESTIONS && (
            <li className="px-3 py-1.5 text-xs text-slate-400">Keep typing to see more</li>
          )}
        </ul>
      )}
    </div>
  );
}

function Highlight({ text, query }) {
  const at = query ? text.toLowerCase().indexOf(query) : -1;
  if (at < 0) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, at)}
      <strong className="font-semibold">{text.slice(at, at + query.length)}</strong>
      {text.slice(at + query.length)}
    </span>
  );
}
