import React from "react";
import { CalendarClock, CalendarDays, Sparkles, Video } from "lucide-react";
import Avatar from "../groups/Avatar";
import MeetingPasscode from "../groups/MeetingPasscode";
import { isOnNow } from "./useShell";

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

// What's coming up in your groups (PeopleHome, by way of /api/nav): the next meetings with
// their Join buttons, members' sobriety birthdays and events. The home feed's side panel, and
// the Today sheet from the calendar in the phone bar.
export default function TodayPanel({ today }) {
  if (!today) return <p className="text-sm text-slate-500 dark:text-neutral-400">Loading…</p>;
  if (!today.has_groups) {
    return (
      <div className="text-sm text-slate-600 dark:text-neutral-300">
        Join a group to see its next meetings, members' birthdays and events here.
        <a href="/groups/find" className="mt-2 block font-semibold text-accent hover:underline">Find your group</a>
      </div>
    );
  }
  return (
    <div className="space-y-8 !font-sans">
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
