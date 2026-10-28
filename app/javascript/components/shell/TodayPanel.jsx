import React, { useEffect, useState } from "react";
import { BellRing, CalendarClock, CalendarDays, ChevronRight, Repeat, RotateCcw, Sparkles, Video, X } from "lucide-react";
import { milestoneStatus } from "../../lib/milestones";
import Avatar from "../groups/Avatar";
import { soberFor } from "../groups/lib";
import MeetingPasscode from "../groups/MeetingPasscode";
import { isOnNow, refreshNav } from "./useShell";

const sideTitle = "mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-neutral-400";
const row = "border-b border-neutral-200/80 py-3 first:pt-0 last:border-0 dark:border-neutral-800";

const when = (iso) => new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const dayLabel = (iso) => {
  const date = new Date(`${iso}T00:00:00`);
  const days = Math.round((date - new Date(new Date().toDateString())) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return date.toLocaleDateString([], { weekday: days < 7 ? "long" : undefined, month: "short", day: "numeric" });
};

const partOfDay = (hour = new Date().getHours()) => {
  if (hour >= 4 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
};

// "Good afternoon, Colton", and under it their day count with the next milestone (or a nudge
// to add a sobriety date), which opens their chips
function Greeting({ me }) {
  if (!me) return null;
  const status = milestoneStatus(me.sobriety_date);
  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Good {partOfDay()}{me.first_name ? `, ${me.first_name}` : ""}</h2>
      {status ? (
        <a href="/recovery" className="mt-3 flex items-center gap-3 rounded-2xl bg-accent/10 px-4 py-3 !text-slate-900 hover:bg-accent/15 dark:bg-accent/20 dark:!text-white">
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-accent">Your day count</span>
            <span className="block text-2xl font-bold tabular-nums">
              {status.days === 0 ? "Day one" : <>{status.days.toLocaleString()}<span className="text-base font-semibold"> {status.days === 1 ? "day" : "days"}</span></>}
            </span>
            <span className="block text-sm text-slate-600 dark:text-neutral-300">
              {status.today ? `Happy ${status.today.label}! 🎉` : [status.days >= 90 && soberFor(me.sobriety_date), status.next && `${status.next.inDays} ${status.next.inDays === 1 ? "day" : "days"} to ${status.next.label}`].filter(Boolean).join(" · ")}
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-slate-400" />
        </a>
      ) : (
        <a href="/users/edit" className="mt-2 block text-sm text-slate-500 hover:text-accent dark:text-neutral-400">Add your sobriety date to see your day count here.</a>
      )}
    </section>
  );
}

const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content || "";
const send = (method, body) =>
  fetch("/api/today_dismissals", {
    method, credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-CSRF-Token": csrf() },
    body: JSON.stringify(body),
  }).then(() => refreshNav()).catch(() => {});

function AttentionItem({ item, faded, action }) {
  return (
    <li className={`${row} flex items-start gap-2`}>
      <a href={item.href} className={`flex min-w-0 flex-1 items-start gap-3 ${faded ? "opacity-60" : ""}`}>
        <span className={`mt-2 size-2 shrink-0 rounded-full ${item.urgent && !faded ? "bg-amber-500" : "bg-accent/60"}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-snug text-slate-900 dark:text-white">{item.title}</span>
          <span className="block text-sm text-slate-500 dark:text-neutral-400">{[item.on && dayLabel(item.on), item.note].filter(Boolean).join(" · ")}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">{item.role}</span>
            <span className="truncate">{item.group.title}</span>
          </span>
        </span>
      </a>
      {action}
    </li>
  );
}

// What needs them in each role they hold, across their groups (TodayDuties): soonest and
// most pressing first. Each can be cleared (×); "Cleared" below lists those to restore. An
// item comes back by itself when it changes.
function Attention({ items, cleared, anyRoles }) {
  const [open, setOpen] = useState(items || []);
  const [done, setDone] = useState(cleared || []);
  const [showCleared, setShowCleared] = useState(false);
  useEffect(() => { setOpen(items || []); setDone(cleared || []); }, [items, cleared]);
  if (!open.length && !done.length && !anyRoles) return null;

  const clear = (item) => {
    setOpen((list) => list.filter((i) => i.key !== item.key));
    setDone((list) => [item, ...list]);
    send("POST", { key: item.key, title: item.title });
  };
  const restore = (item) => {
    setDone((list) => list.filter((i) => i.key !== item.key));
    setOpen((list) => [...list, item]);
    send("DELETE", { key: item.key });
  };
  const iconButton = "mt-0.5 inline-flex shrink-0 items-center justify-center rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200";

  return (
    <section>
      <h2 className={sideTitle}><BellRing className="size-4" /> Needs your attention</h2>
      {!open.length && <p className="text-sm text-slate-500">{done.length ? "All clear." : "Nothing needs you right now."}</p>}
      <ul>
        {open.map((item) => (
          <AttentionItem key={item.key} item={item}
            action={<button type="button" onClick={() => clear(item)} className={iconButton} aria-label={`Clear: ${item.title}`} title="Clear"><X className="size-4" /></button>} />
        ))}
      </ul>
      {done.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setShowCleared((v) => !v)} aria-expanded={showCleared}
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-accent dark:text-neutral-400">
            <ChevronRight className={`size-4 transition-transform ${showCleared ? "rotate-90" : ""}`} />
            {showCleared ? "Hide cleared" : `Show cleared (${done.length})`}
          </button>
          {showCleared && (
            <ul className="mt-2">
              {done.map((item) => (
                <AttentionItem key={item.key} item={item} faded
                  action={<button type="button" onClick={() => restore(item)} title="Restore"
                    className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-accent hover:bg-accent/10">
                    <RotateCcw className="size-3.5" /> Restore
                  </button>} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// Who is filling in at the coming meetings they host, fill in at, or coordinate
function Covers({ covers }) {
  if (!covers?.length) return null;
  return (
    <section>
      <h2 className={sideTitle}><Repeat className="size-4" /> Filling in</h2>
      <ul>
        {covers.map((c) => (
          <li key={c.id} className={row}>
            <a href={c.href} className="block">
              <span className="block font-semibold leading-snug text-slate-900 dark:text-white">{c.text}</span>
              <span className="block truncate text-sm text-slate-500 dark:text-neutral-400">
                {dayLabel(c.on)} · {new Date(c.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {c.group.title}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// What's coming up for them and in their groups (PeopleHome, by way of /api/nav): a greeting
// with their day count, what needs them in their roles, who is filling in for whom, the next
// meetings with their Join buttons, members' sobriety birthdays and events. The home feed's
// side panel, and the Today sheet from the calendar in the phone bar.
export default function TodayPanel({ today }) {
  if (!today) return <p className="text-sm text-slate-500 dark:text-neutral-400">Loading…</p>;
  if (!today.has_groups) {
    return (
      <div className="space-y-8 !font-sans">
        <Greeting me={today.me} />
        <div className="text-sm text-slate-600 dark:text-neutral-300">
          Join a group to see its next meetings, members' birthdays and events here.
          <a href="/groups/find" className="mt-2 block font-semibold text-accent hover:underline">Find your group</a>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-8 !font-sans">
      <Greeting me={today.me} />
      <Attention items={today.attention} cleared={today.cleared} anyRoles={today.any_roles} />
      <Covers covers={today.covers} />
      <section>
        <h2 className={sideTitle}><CalendarClock className="size-4" /> Next meetings</h2>
        {today.meetings.length === 0 && <p className="text-sm text-slate-500">Your groups haven't listed meetings yet.</p>}
        <ul>
          {today.meetings.map((m) => {
            const now = isOnNow(m);
            return (
              <li key={m.id} className={`${row} flex items-start gap-3`}>
                <div className="min-w-0 flex-1">
                  <a href={`/groups/${m.group.slug}/meetings`} className="block truncate text-base font-semibold !text-slate-900 hover:!text-accent dark:!text-white">{m.name}</a>
                  <span className={`block truncate text-sm ${now ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-neutral-400"}`}>
                    {now ? "On now" : when(m.next_start)}
                  </span>
                  {m.name !== m.group.title && <span className="block truncate text-xs text-slate-400">{m.group.title}</span>}
                  {m.conference_url_notes && <MeetingPasscode notes={m.conference_url_notes} copy className="mt-1 !text-xs text-slate-500 dark:text-neutral-400" />}
                </div>
                {m.conference_url && (
                  <a href={m.conference_url} data-meeting-join={m.id} target="_blank" rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl !bg-accent px-3 py-2 text-sm font-semibold !text-white shadow-sm hover:opacity-90">
                    <Video className="size-4" /> Join
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className={sideTitle}><Sparkles className="size-4" /> Birthdays</h2>
        {today.birthdays.length === 0 && <p className="text-sm text-slate-500">No sobriety birthdays in the next month.</p>}
        <ul>
          {today.birthdays.map((b) => (
            <li key={b.id} className={row}>
              <a href={`/people/${b.username}`} className="flex items-center gap-3">
                <Avatar person={b} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900 dark:text-white">{b.name}</span>
                  <span className="block truncate text-sm text-slate-500 dark:text-neutral-400">{b.years} {b.years === 1 ? "year" : "years"}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-sm ${b.today ? "bg-amber-100 font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" : "text-slate-500 dark:text-neutral-400"}`}>
                  {b.today ? "🎉 Today" : dayLabel(b.date)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className={sideTitle}><CalendarDays className="size-4" /> Events</h2>
        {today.events.length === 0 && <p className="text-sm text-slate-500">Nothing coming up.</p>}
        <ul>
          {today.events.map((e) => (
            <li key={e.token} className={row}>
              <a href={`/events/${e.token}`} className="flex items-start gap-3">
                <span className={`size-12 shrink-0 overflow-hidden rounded-xl ${e.cover_url ? "" : "bg-gradient-to-br from-accent via-sky-600 to-indigo-700"}`}>
                  {e.cover_url && <img src={e.cover_url} alt="" className="size-full object-cover" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-900 dark:text-white">{e.title}</span>
                  <span className="block truncate text-sm text-slate-500 dark:text-neutral-400">{e.when_label || "Date to be decided"}</span>
                  <span className="block truncate text-sm text-accent">{e.group.title}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
