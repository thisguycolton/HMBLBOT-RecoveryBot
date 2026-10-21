import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { CalendarClock, ChevronLeft, ChevronRight, LayoutGrid, List, MapPin, Radio, Search, SlidersHorizontal, Users, Video, X } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { inputClass, labelClass, selectClass } from "../ui/styles";
import { DateField, TimeField, todayValue } from "../ui/DateFields";
import { api, fromTimeValue, toTimeValue, typeLabel } from "./lib";
import { ErrorNote, Loading, quietButton } from "./ui";
import { LiveBadge, useNow, viewerZoneName, whenLabel } from "./NextMeeting";
import MeetingPasscode from "./MeetingPasscode";

// /groups/meetings: "Find a meeting". Every meeting AA Intergroup lists and the groups'
// own, filtered by words, day, time of day (the viewer's), where and type, soonest first.
// Filters live in the URL, so coming back from a group's page keeps them. Each result is
// a small version of the group's page and opens it.

const viewerZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Phoenix";

// Parts of the day, as minutes after midnight in the viewer's zone
const TIMES = [
  { key: "", label: "Any time" },
  { key: "morning", label: "Morning (5 AM–noon)", from: 300, to: 720 },
  { key: "afternoon", label: "Afternoon (noon–5 PM)", from: 720, to: 1020 },
  { key: "evening", label: "Evening (5–9 PM)", from: 1020, to: 1260 },
  { key: "night", label: "Late night (9 PM–5 AM)", from: 1260, to: 300 },
  { key: "custom", label: "Between…" },
];

const TYPES = ["O", "C", "D", "SP", "B", "ST", "12x12", "BE", "MED", "W", "M", "LGBTQ", "Y", "S", "ASL", "A"];

const tomorrowValue = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const loadView = () => {
  try { return localStorage.getItem("findMeeting.view") || "grid"; } catch { return "grid"; }
};

export default function FindMeeting() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState(loadView);
  const [showFilters, setShowFilters] = useState(false);
  const top = useRef(null);
  const now = useNow(15000);

  const get = (key) => params.get(key) || "";
  // Change filters (and go back to page 1 unless the page is what changed)
  const update = (changes) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(changes).forEach(([k, v]) => (v === "" || v == null ? next.delete(k) : next.set(k, v)));
      if (!("page" in changes)) next.delete("page");
      return next;
    }, { replace: !("page" in changes) });
  };

  // Typed filters wait for a pause
  const [q, setQ] = useState(get("q"));
  const [place, setPlace] = useState(get("place"));
  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim() !== get("q") || place.trim() !== get("place")) update({ q: q.trim(), place: place.trim() });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, place]);

  const timeKey = get("time");
  const time = TIMES.find((t) => t.key === timeKey) || TIMES[0];
  const query = useMemo(() => {
    const out = new URLSearchParams({ time_zone: viewerZone() });
    ["q", "date", "live", "attendance", "place", "type", "page"].forEach((k) => params.get(k) && out.set(k, params.get(k)));
    if (time.key === "custom") {
      if (params.get("from")) out.set("from", params.get("from"));
      if (params.get("to")) out.set("to", params.get("to"));
    } else if (time.from != null) {
      out.set("from", time.from);
      out.set("to", time.to);
    }
    return out.toString();
  }, [params, time]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    api(`/meeting_search?${query}`)
      .then((d) => current && setData(d))
      .catch((e) => current && setError(e.message))
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, [query]);

  useEffect(() => { document.title = "Find a meeting | RecoveryBot"; }, []);

  const chooseView = (v) => {
    setView(v);
    try { localStorage.setItem("findMeeting.view", v); } catch { /* private window */ }
  };
  const goToPage = (page) => {
    update({ page: page > 1 ? page : "" });
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const date = get("date");
  const live = get("live") === "1";
  const dayKey = live ? "live" : !date ? "week" : date === todayValue() ? "today" : date === tomorrowValue() ? "tomorrow" : "date";
  const filtersOn = ["q", "date", "live", "time", "attendance", "place", "type"].filter((k) => get(k)).length;
  const back = `${location.pathname}${location.search}`;

  const dayChip = (key, label, changes) => (
    <button key={key} type="button" aria-pressed={dayKey === key} onClick={() => update(changes)}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ${
        dayKey === key
          ? "!bg-accent !text-white ring-accent"
          : "!bg-white text-slate-700 ring-neutral-200 hover:!bg-neutral-50 dark:!bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700 dark:hover:!bg-neutral-800"
      }`}>
      {label}
    </button>
  );

  return (
    <div ref={top} className="mx-auto max-w-6xl scroll-mt-24 space-y-5 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {document.body.dataset.groups === "true" ? (
            <Link to="/" className="text-sm text-slate-500 hover:text-accent dark:text-neutral-400">← Groups</Link>
          ) : (
            <a href="/" className="text-sm text-slate-500 hover:text-accent dark:text-neutral-400">← Home</a>
          )}
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Find a meeting</h1>
          <p className="text-sm text-slate-600 dark:text-neutral-400">
            AA Intergroup's meetings and our groups' own. Times are in your time zone ({viewerZoneName()}).
          </p>
        </div>
      </div>

      <Shell>
        <ShellBand icon={Search} title="What are you looking for?" />
        <ShellPanel position="middle" className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className={`${inputClass} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search meetings"
                placeholder="Meeting or group name, or a Zoom link or meeting ID" />
            </div>
            <button type="button" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}
              className={`${quietButton} sm:hidden`}>
              <SlidersHorizontal className="h-4 w-4" /> Filters{filtersOn > 0 ? ` (${filtersOn})` : ""}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {dayChip("week", "Coming week", { date: "", live: "" })}
            {dayChip("live", <><Radio className="h-3.5 w-3.5" /> Live now</>, { date: "", live: "1" })}
            {dayChip("today", "Today", { date: todayValue(), live: "" })}
            {dayChip("tomorrow", "Tomorrow", { date: tomorrowValue(), live: "" })}
            <div className="w-44">
              <DateField clearable value={dayKey === "date" ? date : ""} min={todayValue()} placeholder="Pick a date"
                onChange={(v) => update({ date: v, live: "" })} />
            </div>
          </div>
        </ShellPanel>
        <ShellPanel position="bottom" className={`p-4 ${showFilters ? "" : "hidden sm:block"}`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="fm-time" className={labelClass}>Time of day</label>
              <select id="fm-time" className={selectClass} value={time.key} disabled={live}
                onChange={(e) => update({ time: e.target.value, from: "", to: "" })}>
                {TIMES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              {time.key === "custom" && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <TimeField clearable placeholder="From" value={toTimeValue(get("from") === "" ? null : Number(get("from")))}
                    onChange={(v) => update({ from: fromTimeValue(v) ?? "", time: "custom" })} />
                  <TimeField clearable placeholder="To" value={toTimeValue(get("to") === "" ? null : Number(get("to")))}
                    onChange={(v) => update({ to: fromTimeValue(v) ?? "", time: "custom" })} />
                </div>
              )}
            </div>
            <div>
              <label htmlFor="fm-where" className={labelClass}>Where</label>
              <select id="fm-where" className={selectClass} value={get("attendance")} onChange={(e) => update({ attendance: e.target.value })}>
                <option value="">Online or in person</option>
                <option value="online">Online</option>
                <option value="in_person">In person</option>
              </select>
            </div>
            <div>
              <label htmlFor="fm-place" className={labelClass}>Location</label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input id="fm-place" className={`${inputClass} pl-9`} value={place} onChange={(e) => setPlace(e.target.value)}
                  placeholder="City, region or time zone" />
              </div>
            </div>
            <div>
              <label htmlFor="fm-type" className={labelClass}>Type</label>
              <select id="fm-type" className={selectClass} value={get("type")} onChange={(e) => update({ type: e.target.value })}>
                <option value="">Any type</option>
                {TYPES.map((code) => <option key={code} value={code}>{typeLabel(code)}</option>)}
              </select>
            </div>
          </div>
        </ShellPanel>
      </Shell>

      <ErrorNote error={error} />

      {!data && !error && <Loading />}
      {data && (
        <section className={`space-y-3 transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-neutral-400">
              {data.total === 0 ? "No meetings match." : `${data.total.toLocaleString()} ${data.total === 1 ? "meeting" : "meetings"}${live ? " on now" : ""}, soonest first`}
              {filtersOn > 0 && (
                <button type="button" onClick={() => { setQ(""); setPlace(""); setParams(new URLSearchParams()); }}
                  className="ml-2 inline-flex items-center gap-1 !bg-transparent p-0 font-medium text-accent hover:underline">
                  <X className="h-3.5 w-3.5" /> Clear filters
                </button>
              )}
            </p>
            <div className="inline-flex overflow-hidden rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-700" role="group" aria-label="Show as">
              {[["grid", LayoutGrid, "Grid"], ["list", List, "List"]].map(([key, Icon, label]) => (
                <button key={key} type="button" aria-pressed={view === key} onClick={() => chooseView(key)} title={label}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium ${
                    view === key ? "!bg-accent-tint text-accent-ink dark:!bg-accent/35 dark:text-white" : "!bg-white text-slate-600 dark:!bg-neutral-900 dark:text-neutral-300"
                  }`}>
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
          </div>

          {data.total === 0 ? (
            <div className="rounded-2xl bg-neutral-100 p-8 text-center text-sm text-slate-600 dark:bg-neutral-800/70 dark:text-neutral-400">
              {data.ready ? "Try another day or time, or fewer filters." : "AA Intergroup's list is loading. Try again in a minute."}
            </div>
          ) : view === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.meetings.map((m) => <MeetingCard key={m.key} meeting={m} now={now} back={back} />)}
            </div>
          ) : (
            <div className="space-y-1.5 rounded-2xl bg-neutral-100 p-1.5 dark:bg-neutral-800/70">
              {data.meetings.map((m) => <MeetingRow key={m.key} meeting={m} now={now} back={back} />)}
            </div>
          )}

          <Pagination page={data.page} pages={data.pages} onPage={goToPage} />
        </section>
      )}
    </div>
  );
}

// The group's cover (or the site's blue), like the top of its page
function Cover({ group, className = "", children }) {
  return (
    <div className={`relative overflow-hidden ${group.cover_url ? "bg-neutral-900" : "bg-gradient-to-br from-accent via-sky-600 to-indigo-700"} ${className}`}>
      {group.cover_url && <img src={group.cover_url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />}
      {children}
    </div>
  );
}

const start = (m) => new Date(m.starts_at).getTime();
const end = (m) => new Date(m.ends_at).getTime();

function Where({ meeting }) {
  const online = meeting.attendance !== "in_person";
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-sm text-slate-600 dark:text-neutral-300">
      {online ? <Video className="h-4 w-4 shrink-0 text-slate-400" /> : <MapPin className="h-4 w-4 shrink-0 text-slate-400" />}
      <span className="truncate">
        {meeting.attendance === "hybrid" ? `Online and at ${meeting.place || "a location"}` : online ? "Online" : meeting.place || "In person"}
      </span>
    </p>
  );
}

function Types({ types, max }) {
  if (!types?.length) return null;
  return (
    <p className="flex flex-wrap gap-1">
      {types.slice(0, max).map((code) => (
        <span key={code} className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent dark:bg-accent/25 dark:text-white">{typeLabel(code)}</span>
      ))}
      {types.length > max && <span className="px-1 text-[11px] text-slate-400">+{types.length - max}</span>}
    </p>
  );
}

// A small group page: its cover and name, then the meeting
function MeetingCard({ meeting: m, now, back }) {
  const { group } = m;
  const sameName = m.name.trim().toLowerCase() === group.title.trim().toLowerCase();
  return (
    <Link to={group.href} state={{ back }}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-panel ring-1 ring-neutral-200 transition hover:-translate-y-0.5 hover:ring-accent/60 dark:bg-neutral-900 dark:ring-neutral-800">
      <Cover group={group} className="h-32">
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/25 to-transparent p-4">
          <p className="ev-heading line-clamp-2 text-xl font-extrabold leading-tight tracking-tight text-white">{group.title}</p>
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-white/80">
            {group.here ? <><Users className="h-3 w-3" /> {group.members_count} {group.members_count === 1 ? "member" : "members"}</> : "AA Intergroup"}
          </p>
        </div>
        <LiveBadge start={start(m)} end={end(m)} now={now} className="absolute right-3 top-3" />
      </Cover>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {!sameName && <p className="line-clamp-1 font-semibold text-slate-900 group-hover:text-accent dark:text-white">{m.name}</p>}
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-white">
          <CalendarClock className="h-4 w-4 shrink-0 text-accent" /> {whenLabel(m.starts_at, now)}
        </p>
        <Where meeting={m} />
        {m.conference_url && <MeetingPasscode notes={m.conference_url_notes} className="text-slate-600 dark:text-neutral-300" />}
        <Types types={m.types} max={4} />
        {(group.description || m.notes) && (
          <p className="line-clamp-2 text-xs text-slate-500 dark:text-neutral-400">{group.description || m.notes}</p>
        )}
        <p className="mt-auto pt-1 text-[11px] text-slate-400 dark:text-neutral-500">{m.schedule_label}</p>
      </div>
    </Link>
  );
}

function MeetingRow({ meeting: m, now, back }) {
  const { group } = m;
  const at = new Date(m.starts_at);
  return (
    <Link to={group.href} state={{ back }}
      className="group flex items-center gap-3 rounded-xl bg-white p-2.5 shadow-panel hover:ring-1 hover:ring-accent/50 dark:bg-neutral-900">
      <div className="w-20 shrink-0 text-center">
        <p className="!text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
          {whenLabel(m.starts_at, now).split(",")[0]}
        </p>
        <p className="!text-center text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
          {at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </p>
      </div>
      <Cover group={group} className="hidden size-12 shrink-0 rounded-lg sm:block" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900 group-hover:text-accent dark:text-white">
          {m.name}
          {m.name.trim().toLowerCase() !== group.title.trim().toLowerCase() && <span className="font-normal text-slate-500 dark:text-neutral-400"> · {group.title}</span>}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Where meeting={m} />
          {m.conference_url && <MeetingPasscode notes={m.conference_url_notes} className="!text-xs text-slate-500 dark:text-neutral-400" />}
          <span className="hidden md:block"><Types types={m.types} max={3} /></span>
        </div>
      </div>
      <LiveBadge start={start(m)} end={end(m)} now={now} className={start(m) <= now ? "" : "!bg-neutral-100 !text-slate-700 dark:!bg-neutral-800 dark:!text-neutral-200"} />
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-neutral-600" />
    </Link>
  );
}

// Prev, a few page numbers around this one (and the first and last), Next
function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const shown = [...new Set([1, page - 1, page, page + 1, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const button = (active) =>
    `inline-flex min-w-9 items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-sm font-medium ring-1 disabled:opacity-40 ${
      active ? "!bg-accent !text-white ring-accent" : "!bg-white text-slate-700 ring-neutral-200 hover:!bg-neutral-50 dark:!bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700"
    }`;
  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5 pt-2" aria-label="Pages">
      <button type="button" className={button(false)} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft className="h-4 w-4" /> Previous
      </button>
      {shown.map((p, i) => (
        <React.Fragment key={p}>
          {i > 0 && p - shown[i - 1] > 1 && <span className="px-1 text-slate-400">…</span>}
          <button type="button" className={button(p === page)} aria-current={p === page ? "page" : undefined} onClick={() => onPage(p)}>{p}</button>
        </React.Fragment>
      ))}
      <button type="button" className={button(false)} disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
