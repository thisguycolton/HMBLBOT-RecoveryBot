import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, ChevronRight, History, MonitorPlay, Search, UserCheck } from "lucide-react";
import { DAYS, api, clock } from "../lib";
import { Card, ErrorNote, Loading, Pill, Tray, primaryButton, quietButton } from "../ui";
import { inputClass } from "../../ui/styles";
import { timeOf, useNow } from "./parts";

const short = (days) => (days.length === 7 ? "Every day" : days.map((d) => DAYS[d].slice(0, 3)).join(", "));
const dayLabel = (on, today, tomorrow) => {
  const date = new Date(`${on}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  return on === today ? `Today · ${date}` : on === tomorrow ? `Tomorrow · ${date}` : date;
};
// "in 2 h 15 min", "in 3 days"
function until(ms) {
  const min = Math.round(ms / 60000);
  if (min < 1) return "starting now";
  if (min < 60) return `in ${min} min`;
  if (min < 24 * 60) return `in ${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`;
  const days = Math.round(min / (24 * 60));
  return `in ${days} ${days === 1 ? "day" : "days"}`;
}
const hostsOf = (o) => [o.host && `Host: ${o.host}`, o.co_host && `Co-host: ${o.co_host}`].filter(Boolean).join(" · ") || "No hosts on the schedule";
const openPath = (slug, o) => `/${slug}/host/${o.meeting_id}?on=${o.on}`;
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// /groups/:slug/host: pick the meeting (and date) to open HostDeck on, or one of the group's own decks. What's on
// now comes first, then the next one you host, then the group's meetings day by day for the week,
// each opening on its own date (to get ready for one ahead). Every meeting is at the bottom too.
export default function HostingIndex() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [decks, setDecks] = useState(null);
  const now = useNow(30000);
  useEffect(() => { api(`/groups/${slug}/hosting`).then(setData).catch((e) => setError(e.message)); }, [slug]);
  useEffect(() => { api(`/groups/${slug}/decks`).then((d) => setDecks(d.decks)).catch(() => setDecks([])); }, [slug]);

  const occurrences = data?.occurrences || [];
  const live = occurrences.filter((o) => o.live);
  const mine = occurrences.find((o) => o.mine && !o.live);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return occurrences.filter((o) => !o.live && (!q || [o.name, o.host, o.co_host].some((t) => t?.toLowerCase().includes(q))));
  }, [occurrences, query]);
  const byDay = useMemo(() => shown.reduce((days, o) => ({ ...days, [o.on]: [...(days[o.on] || []), o] }), {}), [shown]);

  if (error) return <div className="mx-auto max-w-3xl space-y-4"><Link to={`/${slug}/hosts`} className="text-sm text-slate-500 hover:text-accent">← Hosts</Link><ErrorNote error={error} /></div>;
  if (!data) return <Loading />;
  const today = isoDay(new Date(now));
  const tomorrow = isoDay(new Date(now + 86400000));

  return (
    <div className="mx-auto max-w-3xl space-y-6 !font-sans [&_*]:!font-sans">
      <Link to={`/${slug}/hosts`} className="text-sm text-slate-500 hover:text-accent dark:text-neutral-400">← Hosts</Link>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 !text-2xl font-bold text-slate-900 dark:text-white"><MonitorPlay className="size-6 text-accent" /> HostDeck</h1>
          <p className="mt-1 !text-left text-sm text-slate-600 dark:text-neutral-300">Pick the meeting you're hosting. Each date opens on its own, so you can get one ready ahead of time.</p>
        </div>
        <Link to={`/${slug}/host/capsule`} className={quietButton}><History className="size-4" /> Time Capsule</Link>
      </div>

      {live.length > 0 && (
        <section className="space-y-2">
          <h2 className="!text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Happening now</h2>
          {live.map((o) => <Hero key={`${o.meeting_id}-${o.on}`} slug={slug} o={o} tone="live" caption={`Started at ${timeOf(o.starts_at, o.time_zone)}`} />)}
        </section>
      )}
      {mine && (
        <section className="space-y-2">
          <h2 className="!text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Your next meeting</h2>
          <Hero slug={slug} o={mine} tone="mine" caption={`${new Date(mine.starts_at).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })} at ${timeOf(mine.starts_at, mine.time_zone)} · ${until(new Date(mine.starts_at) - now)}`} />
        </section>
      )}

      <div className="space-y-4">
        {occurrences.length > 6 && (
          <label className="relative block">
            <span className="sr-only">Find a meeting or host</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input className={`${inputClass} !pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a meeting or a host" />
          </label>
        )}
        {Object.keys(byDay).length === 0 && <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">{query ? "No meetings this week match that." : "No meetings this week."}</Card>}
        {Object.entries(byDay).map(([on, list]) => (
          <Tray key={on} label={dayLabel(on, today, tomorrow)}>
            <div className="space-y-1.5">
              {list.map((o) => (
                <Link key={`${o.meeting_id}-${o.on}`} to={openPath(slug, o)} className="block">
                  <Card className="flex items-center gap-3 p-3 hover:ring-2 hover:ring-accent/30">
                    <span className="w-20 shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{timeOf(o.starts_at, o.time_zone).replace(/\s\S+$/, "")}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900 dark:text-white">{o.name} {o.mine && <Pill tone="green">You're hosting</Pill>}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-neutral-400">{hostsOf(o)}</p>
                    </div>
                    <ChevronRight className="size-5 text-slate-400" />
                  </Card>
                </Link>
              ))}
            </div>
          </Tray>
        ))}
      </div>

      <OtherDecks slug={slug} decks={decks} />

      <details className="group">
        <summary className="cursor-pointer list-none text-sm font-medium text-slate-600 hover:text-accent dark:text-neutral-300">
          <ChevronRight className="mr-1 inline size-4 transition-transform group-open:rotate-90" /> Every meeting ({data.meetings.length})
        </summary>
        <div className="mt-2 space-y-1.5">
          {data.meetings.map((m) => (
            <Link key={m.id} to={`/${slug}/host/${m.id}`} className="block">
              <Card className="flex items-center gap-3 p-3 hover:ring-2 hover:ring-accent/30">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 dark:text-white">{m.name}</p>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">{m.days.length ? `${short(m.days)} at ${clock(m.start_minute)}` : m.schedule_label}</p>
                </div>
                <ChevronRight className="size-5 text-slate-400" />
              </Card>
            </Link>
          ))}
        </div>
      </details>
    </div>
  );
}

const PURPOSE_LABELS = { business_meeting: "Business meeting", onboarding: "Host onboarding", event: "Event day", general: "Deck" };

// The group's decks of their own (business meetings, onboarding...), and how to make one
function OtherDecks({ slug, decks }) {
  if (!decks) return null;
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 !text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Other decks</h2>
        {decks.length > 0 && <Link to={`/${slug}/decks`} className="text-xs font-medium text-accent hover:underline">All HostDecks</Link>}
      </div>
      {decks.map((d) => (
        <Link key={d.id} to={`/${slug}/decks/${d.id}`} className="block">
          <Card className="flex items-center gap-3 p-3 hover:ring-2 hover:ring-accent/30">
            <MonitorPlay className="size-5 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900 dark:text-white">{d.name}</p>
              <p className="text-xs text-slate-500 dark:text-neutral-400">{PURPOSE_LABELS[d.purpose] || "Deck"}</p>
            </div>
            <ChevronRight className="size-5 text-slate-400" />
          </Card>
        </Link>
      ))}
      <p className="!text-left text-xs text-slate-500 dark:text-neutral-400">
        {decks.length ? "To make another, " : "A deck can run a business meeting, host onboarding or anything else from one of the group's documents. To make one, "}
        open the document and pick <span className="font-semibold">File &gt; Create New HostDeck</span>.
      </p>
    </section>
  );
}

// A big card for what's on now, or the next meeting you host
function Hero({ slug, o, tone, caption }) {
  return (
    <Link to={openPath(slug, o)} className="block">
      <div className={`flex flex-wrap items-center gap-4 rounded-2xl p-4 shadow-panel ring-1 sm:p-5 ${tone === "live" ? "bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-800/60" : "bg-white ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800"}`}>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            {tone === "live" && <span className="size-2.5 animate-pulse rounded-full bg-emerald-500" />} {o.name}
          </p>
          <p className="text-sm text-slate-600 dark:text-neutral-300">{caption}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400"><UserCheck className="size-3.5" /> {hostsOf(o)}</p>
        </div>
        <span className={primaryButton}>Open <ArrowRight className="size-4" /></span>
      </div>
    </Link>
  );
}
