import React, { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { inputClass } from "../ui/styles";
import { Card, primaryButton, quietButton } from "../groups/ui";
import { EntryShell, useEntry } from "./EntryShell";
import { PrintableGratitude } from "./PrintableEntry";
import EntryShare from "./EntryShare";
import { dayLabel } from "./lib";

const MAX = 50; // GratitudeList::MAX_ITEMS

const summary = (entry) => {
  const text = entry.items.slice(0, 3).join(", ");
  return entry.items.length > 3 ? `${text} and ${entry.items.length - 3} more` : text;
};

// Gratitude (/recovery/gratitude): today's list, one line for each thing, and the days before
export default function GratitudePage() {
  const state = useEntry("gratitude_lists", ["day", "days"]);
  const { entry, on, saving, saved, setSaved, save } = state;
  const [items, setItems] = useState([""]);
  const refs = useRef([]);
  const focusAt = useRef(null);
  useEffect(() => {
    if (entry === undefined) return;
    setItems(entry?.items?.length ? [...entry.items, ""] : ["", "", ""]);
  }, [entry, on]);
  useEffect(() => {
    if (focusAt.current == null) return;
    refs.current[focusAt.current]?.focus();
    focusAt.current = null;
  });

  const filled = items.map((i) => i.trim()).filter(Boolean);
  const change = (next) => { setItems(next); setSaved(false); };
  const add = (at) => {
    if (items.length >= MAX) return;
    focusAt.current = at;
    change([...items.slice(0, at), "", ...items.slice(at)]);
  };
  const remove = (i) => change(items.length > 1 ? items.filter((_, j) => j !== i) : [""]);
  const submit = (e) => {
    e?.preventDefault();
    save({ items: filled }, ({ kind, count: n }) => (kind.endsWith("-streak")
      ? { title: `${n} days in a row`, text: `${n} days of gratitude in a row. Keep it going.` }
      : {
        title: n === 1 ? "Your first gratitude list" : `${n.toLocaleString()} gratitude lists`,
        text: n === 1 ? "The first of many. A grateful heart doesn't drink." : `That's ${n.toLocaleString()} days you stopped to count what's good.`,
      }));
  };

  return (
    <EntryShell base="gratitude" title="Gratitude" state={state} summary={summary} reminder="gratitude"
      printable={<PrintableGratitude items={items} date={dayLabel(on)} />}
      intro="What you're grateful for today, big or small. One thing on each line.">
      <form onSubmit={submit} className="space-y-4">
        <Card className="space-y-2 p-4">
          <ol className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-right text-sm tabular-nums text-slate-400">{i + 1}.</span>
                <input ref={(el) => { refs.current[i] = el; }} className={inputClass} value={item} maxLength={500}
                  aria-label={`Thing ${i + 1} I'm grateful for`} placeholder={i === 0 ? "I'm grateful for…" : ""}
                  onChange={(e) => change(items.map((x, j) => (j === i ? e.target.value : x)))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); add(i + 1); }
                    if (e.key === "Backspace" && !item && items.length > 1) { e.preventDefault(); focusAt.current = Math.max(0, i - 1); remove(i); }
                  }} />
                <button type="button" aria-label="Take this off" onClick={() => remove(i)}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg !bg-transparent text-slate-400 hover:!bg-neutral-100 hover:text-slate-700 dark:hover:!bg-neutral-800"><X className="size-4" /></button>
              </li>
            ))}
          </ol>
          {items.length < MAX && <button type="button" className={`${quietButton} ml-8`} onClick={() => add(items.length)}><Plus className="size-4" /> Another</button>}
        </Card>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {saved && <span role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{entry ? "Saved." : "Cleared."}</span>}
          <EntryShare tool="gratitude" kind="gratitude" on={on} what="gratitude list" title={`My gratitude list · ${dayLabel(on)}`} disabled={!filled.length}
            build={() => filled.map((item, i) => `${i + 1}. ${item}`).join("\n")} />
          <button type="submit" disabled={saving} className={primaryButton}>{saving ? "Saving…" : "Save list"}</button>
        </div>
      </form>
    </EntryShell>
  );
}
