import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CalendarDays, ChevronDown, Search, Sparkles, Video } from "lucide-react";
import Avatar from "../groups/Avatar";
import MeetingPasscode from "../groups/MeetingPasscode";
import { api } from "../groups/lib";
import { Card, ErrorNote, Loading } from "../groups/ui";
import FeedItem from "../notes/FeedItem";
import NoteEditor from "../notes/NoteEditor";
import InstallNudge from "../site/InstallNudge";

const sideTitle = "mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400";

// The home page after signing in (/people): your notes and highlights and those of the
// people you follow, two thirds of the page, and a third with what's coming up in your
// groups (next meetings, sobriety birthdays, events), folded away on phones.
export default function PeopleIndex() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.title = "Home | RecoveryBot";
    api("/people").then(setData).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setMatches(null); return undefined; }
    const timer = setTimeout(() => api(`/people?q=${encodeURIComponent(term)}`).then((d) => setMatches(d.matches)).catch(() => {}), 250);
    return () => clearTimeout(timer);
  }, [q]);

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;

  const replace = (item) => setData((d) => ({ ...d, feed: d.feed.map((i) => (i.kind === item.kind && i.id === item.id ? { ...i, ...item } : i)) }));
  const remove = (kind) => (id) => setData((d) => ({ ...d, feed: d.feed.filter((i) => !(i.kind === kind && i.id === id)) }));
  const up = data.coming_up;
  const count = (up?.meetings.length || 0) + (up?.birthdays.length || 0) + (up?.events.length || 0);

  return (
    <div className="mx-auto max-w-6xl !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <div className="grid gap-6 lg:grid-cols-3">
        <aside className="order-1 min-w-0 lg:order-2">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
            className="flex w-full items-center gap-2 rounded-2xl !bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 shadow-panel dark:!bg-neutral-800/70 dark:text-white lg:hidden">
            <Sparkles className="size-4 text-accent" /> Coming up
            {count > 0 && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent dark:bg-accent/25 dark:text-sky-200">{count}</span>}
            <ChevronDown className={`ml-auto size-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          <div className={`${open ? "mt-3 block" : "hidden"} space-y-4 lg:sticky lg:top-[calc(var(--nav-h,56px)+1.5rem)] lg:mt-0 lg:block`}>
            <ComingUp up={up} />
          </div>
        </aside>

        <main className="order-2 min-w-0 space-y-5 lg:order-1 lg:col-span-2">
          <InstallNudge />
          <header className="flex flex-wrap items-center gap-3">
            <h1 className="flex-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Notes</h1>
            <Link to="/me" className="inline-flex items-center gap-2 rounded-xl !bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-panel ring-1 ring-neutral-200 hover:ring-accent/50 dark:!bg-neutral-800 dark:text-white dark:ring-neutral-700">
              <Avatar person={data.me} size={24} /> Your profile
            </Link>
          </header>

          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find someone by name"
              className="w-full rounded-xl border-0 bg-white py-2.5 pl-9 pr-3 text-slate-900 shadow-sm ring-1 ring-neutral-200 placeholder:text-slate-400 focus:ring-2 focus:ring-accent dark:bg-neutral-900 dark:text-white dark:ring-neutral-700" />
          </label>

          {matches ? (
            matches.length === 0 ? <Card className="p-5 text-center text-sm text-slate-500">Nobody by that name.</Card> : (
              <Card className="divide-y divide-neutral-200/70 dark:divide-neutral-700/60">
                {matches.map((p) => (
                  <Link key={p.id} to={`/${p.username}`} className="flex items-center gap-3 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
                    <Avatar person={p} size={36} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-900 dark:text-white">{p.name}</span>
                      <span className="block truncate text-xs text-slate-500">@{p.username}</span>
                    </span>
                  </Link>
                ))}
              </Card>
            )
          ) : (
            <div className="wb space-y-4">
              <Card className="p-4">
                <NoteEditor groups={data.groups} defaultVisibility={data.default_note_visibility} max={data.note_max} imagesMax={data.images_max}
                  placeholder="What's on your mind today? Select words to format them, and add photos if you like."
                  onSaved={(note) => setData((d) => ({ ...d, feed: [note, ...d.feed] }))} />
              </Card>
              {data.feed.length === 0 ? (
                <Card className="p-6 text-center text-sm text-slate-500 dark:text-neutral-400">
                  {data.following_count === 0
                    ? "Your notes show here, with what the people you follow share. Follow people from their profiles (tap someone in a group)."
                    : "Nothing new yet."}
                </Card>
              ) : (
                <div className="wb-feed">
                  {data.feed.map((item) => (
                    <FeedItem key={`${item.kind}-${item.id}`} item={item} showAuthor groups={data.groups} max={data.note_max} imagesMax={data.images_max}
                      onChange={replace} onRemove={remove(item.kind)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const when = (iso) => new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const dayLabel = (iso) => {
  const date = new Date(`${iso}T00:00:00`);
  const days = Math.round((date - new Date(new Date().toDateString())) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return date.toLocaleDateString([], { weekday: days < 7 ? "long" : undefined, month: "short", day: "numeric" });
};

function ComingUp({ up }) {
  if (!up) return null;
  if (!up.has_groups) {
    return (
      <Card className="p-4 text-sm text-slate-600 dark:text-neutral-300">
        Join a group to see its next meetings, members' birthdays and events here.
        <a href="/groups/find" className="mt-2 block font-semibold text-accent hover:underline">Find your group</a>
      </Card>
    );
  }
  return (
    <>
      <section>
        <h2 className={sideTitle}><CalendarClock className="size-3.5" /> Next meetings</h2>
        <Card className="divide-y divide-neutral-200/70 dark:divide-neutral-700/60">
          {up.meetings.length === 0 && <p className="p-4 text-sm text-slate-500">Your groups haven't listed meetings yet.</p>}
          {up.meetings.map((m) => {
            const now = new Date(m.next_start) <= new Date();
            return (
              <div key={m.id} className="flex items-center gap-3 p-3">
                <a href={`/groups/${m.group.slug}/meetings`} className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900 hover:text-accent dark:text-white">{m.name}</span>
                  <span className={`block truncate text-xs ${now ? "font-semibold text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-neutral-400"}`}>
                    {now ? "On now" : when(m.next_start)}
                  </span>
                  {m.name !== m.group.title && <span className="block truncate text-xs text-slate-400">{m.group.title}</span>}
                </a>
                {m.conference_url && <MeetingPasscode notes={m.conference_url_notes} copy className="shrink-0 !text-xs text-slate-500 dark:text-neutral-400" />}
                {m.conference_url && (
                  <a href={m.conference_url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg !bg-accent px-2.5 py-1 text-xs font-semibold !text-white hover:opacity-90">
                    <Video className="size-3.5" /> Join
                  </a>
                )}
              </div>
            );
          })}
        </Card>
      </section>

      <section>
        <h2 className={sideTitle}><Sparkles className="size-3.5" /> Birthdays</h2>
        <Card className="divide-y divide-neutral-200/70 dark:divide-neutral-700/60">
          {up.birthdays.length === 0 && <p className="p-4 text-sm text-slate-500">No sobriety birthdays in the next month. Members who show their sobriety date show up here.</p>}
          {up.birthdays.map((b) => (
            <a key={b.id} href={`/people/${b.username}`} className="flex items-center gap-3 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
              <Avatar person={b} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-900 dark:text-white">{b.name}</span>
                <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{b.years} {b.years === 1 ? "year" : "years"}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${b.today ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" : "text-slate-500 dark:text-neutral-400"}`}>
                {b.today ? "🎉 Today" : dayLabel(b.date)}
              </span>
            </a>
          ))}
        </Card>
      </section>

      <section>
        <h2 className={sideTitle}><CalendarDays className="size-3.5" /> Events</h2>
        <Card className="divide-y divide-neutral-200/70 dark:divide-neutral-700/60">
          {up.events.length === 0 && <p className="p-4 text-sm text-slate-500">Nothing coming up.</p>}
          {up.events.map((e) => (
            <a key={e.token} href={`/events/${e.token}`} className="flex items-center gap-3 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
              <span className={`size-10 shrink-0 overflow-hidden rounded-lg ${e.cover_url ? "" : "bg-gradient-to-br from-accent via-sky-600 to-indigo-700"}`}>
                {e.cover_url && <img src={e.cover_url} alt="" className="size-full object-cover" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-slate-900 dark:text-white">{e.title}</span>
                <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{e.when_label || "Date to be decided"}</span>
                <span className="block truncate text-xs text-slate-400">{e.group.title}</span>
              </span>
            </a>
          ))}
        </Card>
      </section>
    </>
  );
}
