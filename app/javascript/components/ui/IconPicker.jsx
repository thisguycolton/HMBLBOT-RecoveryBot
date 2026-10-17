import React, { useMemo, useState } from "react";
import { Ban, Search } from "lucide-react";
import LucideIcon, { ICON_NAMES } from "./LucideIcon";
import { inputClass, iconInputClass } from "./styles";

// Suggestions that suit recovery topics; search covers the whole Lucide library
export const SUGGESTED_ICONS = [
  "compass", "heart", "footprints", "users", "quote", "brain", "party-popper", "sunrise",
  "sun", "moon", "sprout", "leaf", "flower-2", "tree-pine", "mountain", "waves",
  "hand-heart", "heart-handshake", "handshake", "hand-helping", "users-round", "message-circle", "megaphone", "phone",
  "book-open", "scroll", "notebook-pen", "lightbulb", "key", "door-open", "lock-open", "puzzle",
  "anchor", "life-buoy", "shield-check", "scale", "infinity", "hourglass", "clock", "calendar-heart",
  "flame", "sparkles", "star", "trophy", "medal", "gift", "cake", "smile",
  "coffee", "house", "tent", "signpost", "milestone", "route", "map", "flag",
  "feather", "bird", "rainbow", "wind", "refresh-cw", "link", "eye", "ear",
];

const MAX_RESULTS = 96;

// A grid of Lucide icons to choose from. value / onChange use the kebab-case name, or null.
export default function IconPicker({ value, onChange, label = "Icon" }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase().replace(/\s+/g, "-");
  const results = useMemo(() => {
    if (!q) return SUGGESTED_ICONS;
    const starts = ICON_NAMES.filter((n) => n.startsWith(q));
    const contains = ICON_NAMES.filter((n) => !n.startsWith(q) && n.includes(q));
    return [...starts, ...contains].slice(0, MAX_RESULTS);
  }, [q]);

  const tile = (name, selected) =>
    `w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
      selected
        ? "!bg-accent !text-white shadow-panel"
        : "!bg-transparent text-slate-700 dark:text-neutral-300 hover:!bg-accent/10 dark:hover:!bg-white/10"
    }`;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className={iconInputClass} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${ICON_NAMES.length.toLocaleString()} icons…`}
          aria-label={`Search icons for ${label}`}
          className={`${inputClass} pl-9`}
        />
      </div>
      <p className="text-xs text-slate-500 dark:text-neutral-400 !font-sans">
        {q ? (results.length ? `${results.length === MAX_RESULTS ? `First ${MAX_RESULTS}` : results.length} matching “${query.trim()}”` : `No icons match “${query.trim()}”`) : "Suggested"}
        {value && <> · Selected: <span className="font-medium text-slate-700 dark:text-neutral-200">{value}</span></>}
      </p>
      <div role="radiogroup" aria-label={label}
        className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1 max-h-60 overflow-y-auto rounded-xl bg-neutral-100 dark:bg-neutral-900 p-2">
        <button type="button" role="radio" aria-checked={!value} aria-label="No icon" title="No icon"
          onClick={() => onChange(null)} className={tile(null, !value)}>
          <Ban className="w-4 h-4" />
        </button>
        {results.map((name) => (
          <button key={name} type="button" role="radio" aria-checked={value === name} aria-label={name} title={name}
            onClick={() => onChange(name)} className={tile(name, value === name)}>
            <LucideIcon name={name} size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}
