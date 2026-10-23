import React, { useState } from "react";
import { AlarmClock, ArrowRight, BookOpen, Check, ChevronRight, ExternalLink, Link2, PartyPopper, Plus, Clipboard, ClipboardCheck } from "lucide-react";
import Avatar from "../../Avatar";
import { inputClass } from "../../../ui/styles";
import { primaryButton, quietButton } from "../../ui";
import { activityIcon } from "../Activity";
import { activityLabel, copyText, cueLabel } from "../lib";
import { AWAY_MS, MeetingClock, label, timeOf } from "../parts";
import { DeckClock } from "./keepingBlocks";

// The sizes HostDeck's blocks didn't have in the Command Center: a block's card for a sidebar or
// the middle, or its short version for the bottom bar (blocks.jsx picks one by `size`)

const card = "rounded-xl bg-white p-3 shadow-panel ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800";
const muted = "text-sm text-slate-500 dark:text-neutral-400";

// The flow as a row of steps: where the meeting is, which are done, each one a click away
export function FlowBar({ deck }) {
  const { sections, shown, index, live } = deck;
  if (!shown.length) return null;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="hidden min-w-0 max-w-[14rem] truncate text-sm font-semibold sm:inline">{sections[index]?.title}</span>
      <ol className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1" aria-label="Meeting flow">
        {shown.map((i, n) => {
          const done = live.completed.includes(i);
          return (
            <li key={i}>
              <button type="button" onClick={() => deck.goto(i)} aria-current={i === index ? "step" : undefined} title={`${n + 1}. ${sections[i].title}`} aria-label={`${n + 1}. ${sections[i].title}`}
                className={`grid size-6 place-items-center rounded-full text-[10px] font-semibold ${i === index ? "!bg-accent text-white ring-2 ring-accent/30" : done ? "!bg-emerald-500 text-white" : "!bg-neutral-200 text-slate-600 hover:!bg-neutral-300 dark:!bg-neutral-800 dark:text-neutral-300"}`}>
                {done && i !== index ? <Check className="size-3" /> : n + 1}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Where the meeting is and what's next, with a button to go on
export function NowNext({ deck, size }) {
  const { sections, section, index } = deck;
  const to = deck.nextIndex(index, 1);
  const next = sections[to];
  if (!section) return size === "bar" ? null : <p className={muted}>The script's sections show here.</p>;
  if (size === "bar") {
    return (
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="min-w-0 flex-1 truncate"><span className={label}>Now</span> <strong>{section.title}</strong>{next && <span className="text-slate-500 dark:text-neutral-400"> · Next: {next.title}</span>}</span>
        <button type="button" className={`${primaryButton} !px-3 !py-1.5`} onClick={deck.next} disabled={!next} aria-label="Next section">Next <ArrowRight className="size-4" /></button>
      </div>
    );
  }
  return (
    <section>
      <h2 className={`${label} mb-2`}>Now</h2>
      <div className={card}>
        <p className={size === "main" ? "text-2xl font-bold" : "font-semibold"}>{section.title}</p>
        {next ? (
          <button type="button" onClick={deck.next} className="mt-2 flex w-full items-center gap-2 rounded-lg !bg-neutral-100 px-2.5 py-2 text-left text-sm hover:!bg-neutral-200 dark:!bg-neutral-800 dark:hover:!bg-neutral-700">
            <span className="text-slate-500 dark:text-neutral-400">Next</span> <span className="min-w-0 flex-1 truncate font-medium">{next.title}</span> <ChevronRight className="size-4 text-slate-400" />
          </button>
        ) : <p className={`mt-2 ${muted}`}>That's the last section.</p>}
      </div>
    </section>
  );
}

// The clock on a card of its own
export function ClockCard({ deck, size }) {
  return (
    <section>
      <h2 className={`${label} mb-2`}>{deck.center.deck ? "Clock" : "Meeting clock"}</h2>
      <div className={`${card} ${size === "main" ? "py-8" : "py-4"}`}>
        {deck.center.deck ? <DeckClock deck={deck} big={size} /> : <MeetingClock center={deck.center} elapsed={deck.elapsed} big={size} />}
      </div>
    </section>
  );
}

// Every reminder still to come, the ones whose time has come first and in amber
export function RemindersList({ deck }) {
  const { upcoming, now, center } = deck;
  if (!upcoming.length) return null;
  return (
    <section>
      <h2 className={`${label} mb-2`}>Reminders</h2>
      <ul className="space-y-1">
        {upcoming.map(({ sec, i, at }) => {
          const due = now >= at - 60000;
          return (
            <li key={i}>
              <button type="button" onClick={() => deck.goto(i)}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm ${due ? "!bg-amber-100 text-amber-950 dark:!bg-amber-900/50 dark:text-amber-50" : "!bg-transparent text-slate-700 hover:!bg-neutral-100 dark:text-neutral-300 dark:hover:!bg-neutral-800"}`}>
                <AlarmClock className={`size-4 shrink-0 ${due ? "animate-pulse" : "text-slate-400"}`} />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{sec.title}</span><span className="block truncate text-xs opacity-80">{cueLabel(sec.cue)}</span></span>
                <span className="shrink-0 text-xs tabular-nums opacity-80">{timeOf(new Date(at).toISOString(), center.meeting.time_zone)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Today's reading / activity in one line, with a button to open it
export function ActivityBar({ deck }) {
  const activity = deck.live.activity;
  const Icon = activityIcon(activity);
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <Icon className={`size-5 shrink-0 ${activity ? "text-accent" : "text-amber-600"}`} />
      <span className="min-w-0 flex-1 truncate"><span className={label}>Today</span> {activity ? <strong>{activityLabel(activity)}</strong> : <span className="text-amber-700 dark:text-amber-300">Not picked yet</span>}</span>
      <button type="button" className={`${quietButton} !px-3 !py-1.5`} onClick={deck.openActivity}>{activity ? "Open" : "Pick"}</button>
    </div>
  );
}

// The kit's readings as cards, two across
export function ReadingsGrid({ deck }) {
  const { readings } = deck.center.kit;
  const box = "flex w-full items-center gap-3 rounded-xl !bg-white p-3 text-left text-sm shadow-panel ring-1 ring-neutral-200 hover:ring-accent/40 dark:!bg-neutral-900 dark:ring-neutral-800";
  return (
    <section>
      <h2 className={`${label} mb-2`}>Meeting readings</h2>
      {readings.length === 0 ? <p className={muted}>No readings picked for this meeting.</p> : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {readings.map((r, i) => (
            <li key={i}>
              {r.url ? (
                <a href={r.url} target="_blank" rel="noopener noreferrer" className={box}><Link2 className="size-6 shrink-0 text-accent" /><span className="min-w-0 flex-1 truncate font-medium">{r.title}</span><ExternalLink className="size-4 text-slate-400" /></a>
              ) : (
                <button type="button" onClick={() => deck.openReading(r)} className={`${box} ${deck.reading === r ? "!ring-2 !ring-accent" : ""}`}>
                  <BookOpen className="size-6 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.title}</span>{r.book_title && <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{r.book_title}</span>}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// The share link, short, to copy
export function ShareLinkBar({ deck }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}${deck.center.link.path}`;
  const copy = () => copyText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Link2 className="size-4 shrink-0 text-slate-400" />
      <code className="min-w-0 flex-1 truncate font-mono text-sm font-semibold" title={url}>{url.replace(/^https?:\/\//, "")}</code>
      <button type="button" className={`${quietButton} !px-3 !py-1.5`} onClick={copy} aria-label="Copy the share link">{copied ? <ClipboardCheck className="size-4" /> : <Clipboard className="size-4" />} {copied ? "Copied" : "Copy"}</button>
    </div>
  );
}

// Who's here, as a row of faces
export function HostsBar({ deck }) {
  const { live, now } = deck;
  return (
    <div className="flex min-w-0 items-center gap-1.5" aria-label="Who's here">
      {live.presences.map((p) => {
        const away = now - new Date(p.last_seen_at).getTime() >= AWAY_MS;
        return (
          <span key={p.user_id} className={`relative ${away ? "opacity-50" : ""}`} title={`${p.name}${p.me ? " (you)" : ""}: ${away ? "Away" : p.activity || "Here"}`}>
            <Avatar person={p} size={30} />
            <span className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-white dark:ring-neutral-900 ${away ? "bg-slate-300 dark:bg-neutral-600" : "bg-emerald-500"}`} />
          </span>
        );
      })}
    </div>
  );
}

// Who's celebrating, and a quick way to add someone
export function MilestonesBar({ deck }) {
  const [name, setName] = useState("");
  const list = deck.live.milestones || [];
  const add = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    deck.act("milestone_add", { data: { name: name.trim(), length: "" } });
    setName("");
  };
  return (
    <form onSubmit={add} className="flex min-w-0 items-center gap-2 text-sm">
      <PartyPopper className="size-4 shrink-0 text-slate-400" />
      <span className="min-w-0 flex-1 truncate">
        {list.length ? list.map((m, i) => <span key={m.id} className={m.done ? "text-slate-400 line-through" : ""}>{i > 0 && ", "}{m.name}{m.length && ` (${m.length})`}</span>) : <span className="text-slate-500 dark:text-neutral-400">Nobody celebrating yet</span>}
      </span>
      <input aria-label="Screen name" className={`${inputClass} !w-32 !px-2 !py-1`} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Add someone" />
      <button type="submit" className={`${quietButton} !px-2 !py-1.5`} disabled={!name.trim()} aria-label="Add a milestone"><Plus className="size-4" /></button>
    </form>
  );
}

// The last thing the hosts did, ticker style
export function LogBar({ deck }) {
  const last = deck.live.log[deck.live.log.length - 1];
  if (!last) return null;
  return (
    <p className="min-w-0 truncate text-sm" title={`${deck.live.log.length} done so far`}>
      <span className="mr-2 text-xs tabular-nums text-slate-500 dark:text-neutral-400">{timeOf(last.at)}</span>
      <span className="font-medium">{last.by}</span> {last.text.charAt(0).toLowerCase() + last.text.slice(1)}
    </p>
  );
}
