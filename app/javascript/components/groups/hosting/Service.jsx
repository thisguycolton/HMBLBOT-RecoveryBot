import React, { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, PartyPopper, Plus, Trash2, Users } from "lucide-react";
import { inputClass } from "../../ui/styles";
import { quietButton } from "../ui";
import { roleToken, serviceNames } from "./lib";

const label = "!text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400";
const smallButton = "inline-grid size-7 shrink-0 place-items-center rounded-lg !bg-transparent text-slate-400 hover:!bg-neutral-100 hover:text-slate-700 disabled:opacity-30 dark:hover:!bg-neutral-800 dark:hover:text-neutral-200";

// A text box that keeps what you type until you leave it (or press Enter), then saves; while
// you're not in it, it shows what the other host saved
function LiveInput({ value, onSave, ...props }) {
  const [draft, setDraft] = useState(value || "");
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(value || ""); }, [value]);
  const save = () => { if (draft.trim() !== (value || "").trim()) onSave(draft.trim()); };
  return (
    <input {...props} value={draft} onChange={(e) => setDraft(e.target.value)}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; save(); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
  );
}

// Who is doing service today (Host Helper's scratch paper), at the top of "Before we begin". The
// names go into the script wherever it says {{ service_hiw }}, and into chat postings.
export function ServicePanel({ center, live, act }) {
  const roles = center.kit.service_roles;
  const names = serviceNames(center, live);
  return (
    <section className="rounded-2xl bg-white p-4 shadow-panel ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200"><Users className="size-4" /></span>
        <div className="min-w-0">
          <h2 className="font-semibold">People doing service today</h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400">Both hosts see these, and the script uses them.</p>
        </div>
      </div>
      <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
        {roles.map((r) => (
          <div key={r.key}>
            <label htmlFor={`svc-${r.key}`} className={`${label} mb-1 block`} title={roleToken(r.key)}>{r.label}</label>
            <LiveInput id={`svc-${r.key}`} className={inputClass} maxLength={80} value={names[r.key]} placeholder="Name"
              onSave={(value) => act("service", { index: r.key, label: r.label, data: { value } })} />
          </div>
        ))}
      </div>
    </section>
  );
}

const LENGTHS = ["24 hours", "30 days", "60 days", "90 days", "6 months", "9 months", "1 year", "18 months", "2 years", "5 years", "10 years"];

// People counting days or celebrating a milestone today, in the order they'll be called on, as
// Host Helper had it. Only the name is needed: not everyone says their time. Checked off once
// they've been celebrated. In the sidebar, and `inScript` where the format has a Milestone Form
// (Insert > Milestone Form), as a card in the text: the same list.
export function Milestones({ live, act, inScript = false }) {
  const lengths = useId();
  const [name, setName] = useState("");
  const [length, setLength] = useState("");
  const list = live.milestones || [];
  const add = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    act("milestone_add", { data: { name: name.trim(), length: length.trim() } });
    setName("");
    setLength("");
  };
  const timeCol = inScript ? "grid-cols-[minmax(0,1fr)_6rem] sm:grid-cols-[minmax(0,1fr)_9rem]" : "grid-cols-[minmax(0,1fr)_5.5rem]";
  const update = (id, change) => act("milestone_update", { data: { id, ...change } });
  return (
    <section className={inScript ? "hc-script-form my-5 max-w-[70ch] rounded-2xl bg-white p-4 text-base shadow-panel ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800" : ""}>
      <h2 className={`${label} mb-2 flex items-center gap-1.5`}><PartyPopper className="size-3.5" /> Celebrating milestones</h2>
      {inScript && list.length === 0 && <p className="mb-2 text-sm text-slate-500 dark:text-neutral-400">Add each person as they speak up. Your co-host sees them too.</p>}
      {list.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {list.map((m, i) => (
            <li key={m.id} className={`flex items-center gap-1.5 rounded-xl bg-white p-1.5 pl-2 shadow-panel ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800 ${m.done ? "opacity-60" : ""}`}>
              <button type="button" onClick={() => update(m.id, { done: !m.done })} aria-pressed={!!m.done} aria-label={m.done ? `${m.name} celebrated (undo)` : `Mark ${m.name} celebrated`}
                className={`grid size-5 shrink-0 place-items-center rounded-md border ${m.done ? "border-emerald-500 !bg-emerald-500 text-white" : "border-neutral-300 !bg-transparent dark:border-neutral-600"}`}>
                {m.done && <Check className="size-3.5" />}
              </button>
              <div className={`grid min-w-0 flex-1 gap-1 ${timeCol}`}>
                <LiveInput aria-label="Screen name" className={`${inputClass} !px-2 !py-1 ${m.done ? "line-through" : ""}`} maxLength={80} value={m.name} onSave={(v) => v && update(m.id, { name: v })} />
                <LiveInput aria-label="Time" list={lengths} className={`${inputClass} !px-2 !py-1`} maxLength={60} value={m.length} placeholder="No time" onSave={(v) => update(m.id, { length: v })} />
              </div>
              <button type="button" className={smallButton} onClick={() => act("milestone_move", { data: { id: m.id, by: -1 } })} disabled={i === 0} aria-label={`Move ${m.name} up`}><ArrowUp className="size-3.5" /></button>
              <button type="button" className={smallButton} onClick={() => act("milestone_move", { data: { id: m.id, by: 1 } })} disabled={i === list.length - 1} aria-label={`Move ${m.name} down`}><ArrowDown className="size-3.5" /></button>
              <button type="button" className={`${smallButton} hover:!text-rose-600`} onClick={() => act("milestone_remove", { data: { id: m.id } })} aria-label={`Take ${m.name} off`}><Trash2 className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className={`grid gap-1.5 ${inScript ? "grid-cols-[minmax(0,1fr)_7rem_auto] sm:grid-cols-[minmax(0,1fr)_9rem_auto]" : "grid-cols-[minmax(0,1fr)_5.5rem_auto]"}`}>
        <input aria-label="Screen name" className={`${inputClass} !px-2 !py-1.5`} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Screen name" />
        <input aria-label="Time" list={lengths} className={`${inputClass} !px-2 !py-1.5`} maxLength={60} value={length} onChange={(e) => setLength(e.target.value)} placeholder={inScript ? "Time (optional)" : "Time"} />
        <button type="submit" className={`${quietButton} !px-2.5`} disabled={!name.trim()} aria-label="Add a milestone"><Plus className="size-4" /></button>
      </form>
      {list.length === 0 && <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">Only the name is needed. Leave the time empty when someone doesn't say it.</p>}
      <datalist id={lengths}>{LENGTHS.map((l) => <option key={l} value={l} />)}</datalist>
    </section>
  );
}
