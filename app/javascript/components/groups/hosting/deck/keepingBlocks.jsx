import React, { useState } from "react";
import { Check, Pause, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import Markdown from "../../../book/Markdown";
import { inputClass, labelClass } from "../../../ui/styles";
import { primaryButton, quietButton } from "../../ui";
import { QUICK_ACTIONS, label, timeOf } from "../parts";
import { mmss } from "../lib";

// HostDeck's blocks that the group writes (notes, a checklist) or that keep time (a timer, a
// deck's own clock). What they keep is shared: both hosts see the same ticks and the same timer
// (the session's block_state, by the block's id). Each has its settings, edited on the block in
// the layout editor (Settings*).

const newItemId = () => Math.random().toString(36).slice(2, 10);
const card = "rounded-xl bg-white p-3 shadow-panel ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800";

export function NotesBlock({ block, size }) {
  const { title, markdown } = block.settings || {};
  return (
    <section>
      {title && <h2 className={`${label} mb-2`}>{title}</h2>}
      {markdown?.trim() ? <div className={`${card} text-sm`}><Markdown source={markdown} className="ev-md" /></div>
        : <p className="text-sm text-slate-500 dark:text-neutral-400">No notes yet.</p>}
    </section>
  );
}

export function NotesSettings({ settings, change }) {
  return (
    <div className="space-y-2">
      <div><label className={labelClass}>Title</label><input className={inputClass} maxLength={80} value={settings.title || ""} onChange={(e) => change({ title: e.target.value })} placeholder="Notes" /></div>
      <div><label className={labelClass}>Notes (Markdown)</label><textarea className={`${inputClass} font-mono !text-xs`} rows={6} maxLength={10000} value={settings.markdown || ""} onChange={(e) => change({ markdown: e.target.value })} /></div>
    </div>
  );
}

// Things to do, ticked off for everyone, with who did each. In the bar: the next one to do.
export function ChecklistBlock({ block, size, deck }) {
  const { title, items = [] } = block.settings || {};
  const done = deck.live.block_state?.[block.id]?.done || {};
  const count = items.filter((i) => done[i.id]).length;
  const toggle = (item) => deck.act("block", { label: item.text, data: { block_id: block.id, op: "toggle", item: item.id } });
  if (size === "bar") {
    const next = items.find((i) => !done[i.id]);
    return (
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-neutral-400">{title || "Checklist"} {count}/{items.length}</span>
        {next ? (
          <button type="button" onClick={() => toggle(next)} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg !bg-transparent px-1.5 py-1 text-left hover:!bg-neutral-100 dark:hover:!bg-neutral-800" aria-label={`Check off ${next.text}`}>
            <span className="grid size-5 shrink-0 place-items-center rounded-md ring-1 ring-neutral-300 dark:ring-neutral-600" />
            <span className="min-w-0 flex-1 truncate">{next.text}</span>
          </button>
        ) : <span className="flex min-w-0 flex-1 items-center gap-1.5 text-emerald-700 dark:text-emerald-300"><Check className="size-4" /> {items.length ? "All done" : "Nothing on the list"}</span>}
      </div>
    );
  }
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className={label}>{title || "Checklist"}</h2>
        {items.length > 0 && <span className="text-xs tabular-nums text-slate-500 dark:text-neutral-400">{count} / {items.length}</span>}
      </div>
      {items.length === 0 ? <p className="text-sm text-slate-500 dark:text-neutral-400">Nothing on the list yet.</p> : (
        <ul className="space-y-1">
          {items.map((item) => {
            const by = done[item.id];
            return (
              <li key={item.id}>
                <button type="button" onClick={() => toggle(item)} aria-pressed={!!by}
                  className="flex w-full items-start gap-3 rounded-xl !bg-transparent px-2.5 py-2 text-left text-sm hover:!bg-neutral-100 dark:hover:!bg-neutral-800">
                  <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md ring-1 ${by ? "bg-emerald-500 text-white ring-emerald-500" : "ring-neutral-300 dark:ring-neutral-600"}`}>{by && <Check className="size-3.5" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block ${by ? "text-slate-500 line-through dark:text-neutral-500" : "text-slate-800 dark:text-neutral-100"}`}>{item.text}</span>
                    {by && <span className="block text-xs text-emerald-700 dark:text-emerald-300">{by.by} · {timeOf(by.at)}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function ChecklistSettings({ settings, change }) {
  const items = settings.items || [];
  const [text, setText] = useState("");
  const add = () => { if (text.trim()) { change({ items: [...items, { id: newItemId(), text: text.trim() }] }); setText(""); } };
  return (
    <div className="space-y-2">
      <div><label className={labelClass}>Title</label><input className={inputClass} maxLength={80} value={settings.title || ""} onChange={(e) => change({ title: e.target.value })} placeholder="Checklist" /></div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={item.id} className="flex gap-1">
            <input className={`${inputClass} !py-1.5`} maxLength={200} value={item.text} aria-label={`Item ${i + 1}`} onChange={(e) => change({ items: items.map((x) => (x.id === item.id ? { ...x, text: e.target.value } : x)) })} />
            <button type="button" className={`${quietButton} !px-2`} onClick={() => change({ items: items.filter((x) => x.id !== item.id) })} aria-label={`Remove ${item.text}`}><Trash2 className="size-4" /></button>
          </li>
        ))}
      </ul>
      <div className="flex gap-1">
        <input className={`${inputClass} !py-1.5`} maxLength={200} value={text} placeholder="Add an item" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className={`${quietButton} !px-2`} onClick={add} aria-label="Add the item"><Plus className="size-4" /></button>
      </div>
    </div>
  );
}

// Seconds a timer has run: what it banked, plus since it was started (on the server's clock)
const ran = (state, now) => (state?.banked || 0) + (state?.started_at ? Math.max(now - new Date(state.started_at).getTime(), 0) / 1000 : 0);

// A countdown everyone shares (a report's three minutes, a break): start, pause, back to the top
export function TimerBlock({ block, size, deck }) {
  const { title, minutes = 3 } = block.settings || {};
  const state = deck.live.block_state?.[block.id];
  const left = minutes * 60 - ran(state, deck.now);
  const running = !!state?.started_at;
  const op = (o) => deck.act("block", { label: title || "the timer", data: { block_id: block.id, op: o } });
  const controls = (
    <div className="flex gap-1">
      <button type="button" className={`${running ? quietButton : primaryButton} !px-3 !py-1.5`} onClick={() => op(running ? "timer_pause" : "timer_start")} aria-label={`${running ? "Pause" : "Start"} ${title || "the timer"}`}>{running ? <Pause className="size-4" /> : <Play className="size-4" />}</button>
      <button type="button" className={`${quietButton} !px-2 !py-1.5`} onClick={() => op("timer_reset")} aria-label={`Reset ${title || "the timer"}`} title="Back to the top"><RotateCcw className="size-4" /></button>
    </div>
  );
  const time = <span className={`font-mono font-semibold tabular-nums ${left < 0 ? "text-rose-600 dark:text-rose-400" : ""}`}>{left < 0 ? `+${mmss(-left)}` : mmss(left)}</span>;
  if (size === "bar") {
    return <div className="flex items-center gap-2"><span className="hidden truncate text-xs text-slate-500 sm:inline dark:text-neutral-400">{title || "Timer"}</span><span className="text-lg">{time}</span>{controls}</div>;
  }
  return (
    <section>
      <h2 className={`${label} mb-2`}>{title || "Timer"}</h2>
      <div className={`${card} flex items-center gap-3`}>
        <span className={size === "main" ? "flex-1 text-5xl" : "flex-1 text-3xl"}>{time}</span>
        {controls}
      </div>
    </section>
  );
}

export function TimerSettings({ settings, change }) {
  return (
    <div className="grid grid-cols-[1fr_6rem] gap-2">
      <div><label className={labelClass}>Title</label><input className={inputClass} maxLength={80} value={settings.title || ""} onChange={(e) => change({ title: e.target.value })} placeholder="Timer" /></div>
      <div><label className={labelClass}>Minutes</label><input className={inputClass} type="number" min={1} max={180} value={settings.minutes || 3} onChange={(e) => change({ minutes: Number(e.target.value) || 1 })} /></div>
    </div>
  );
}

// A deck's own clock (it has no start time): from when a host starts it (`big`: on a card, "side" or "main")
export function DeckClock({ deck, big = false }) {
  const started = deck.live.clock_started_at;
  if (!started) {
    return <div className="flex justify-center"><button type="button" className={`${primaryButton} !px-4`} onClick={() => deck.act("clock_start")} aria-label="Start the clock"><Play className="size-4" /> Start</button></div>;
  }
  const elapsed = Math.max(deck.now - new Date(started).getTime(), 0) / 1000;
  return (
    <div className="flex items-center justify-center gap-2 text-center">
      <div>
        <p className={`${label} !text-[10px] sm:!text-xs`}>Running for</p>
        <p className={`font-mono font-semibold tabular-nums ${big === "main" ? "text-6xl sm:text-7xl" : big ? "text-4xl" : "text-2xl sm:text-3xl"}`}>{mmss(elapsed)}</p>
      </div>
      <button type="button" className={`${quietButton} !px-2 !py-1.5`} onClick={() => window.confirm("Put the clock back to the start?") && deck.act("clock_reset")} aria-label="Reset the clock" title="Back to the start"><RotateCcw className="size-4" /></button>
    </div>
  );
}

// Which quick actions show, and the group's own links (a meeting's Zoom ones show only when it has Zoom)
export function QuickActionsSettings({ settings, change }) {
  const actions = settings.actions || QUICK_ACTIONS.map(([k]) => k);
  const links = settings.links || [];
  const [link, setLink] = useState({ title: "", url: "" });
  const ok = /^https?:\/\/\S+$/i.test(link.url.trim());
  const toggle = (key) => {
    const next = actions.includes(key) ? actions.filter((k) => k !== key) : QUICK_ACTIONS.map(([k]) => k).filter((k) => k === key || actions.includes(k));
    change({ actions: next.length === QUICK_ACTIONS.length ? undefined : next });
  };
  const add = () => { if (ok) { change({ links: [...links, { title: link.title.trim(), url: link.url.trim() }] }); setLink({ title: "", url: "" }); } };
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {QUICK_ACTIONS.map(([key, text]) => (
          <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={actions.includes(key)} onChange={() => toggle(key)} /> {text}</label>
        ))}
      </div>
      <div>
        <p className={labelClass}>Your own links</p>
        <ul className="space-y-1">
          {links.map((l, i) => (
            <li key={i} className="flex items-center gap-1 text-sm">
              <span className="min-w-0 flex-1 truncate">{l.title || l.url}<span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{l.url}</span></span>
              <button type="button" className={`${quietButton} !px-2`} onClick={() => change({ links: links.filter((_, j) => j !== i) })} aria-label={`Remove ${l.title || l.url}`}><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
        <div className="mt-1 grid gap-1">
          <input className={`${inputClass} !py-1.5`} maxLength={80} value={link.title} placeholder="Title, like Intergroup calendar" aria-label="Link title" onChange={(e) => setLink({ ...link, title: e.target.value })} />
          <div className="flex gap-1">
            <input className={`${inputClass} !py-1.5`} type="url" value={link.url} placeholder="https://" aria-label="Link" onChange={(e) => setLink({ ...link, url: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
            <button type="button" className={`${quietButton} !px-2`} onClick={add} disabled={!ok} aria-label="Add the link"><Plus className="size-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
