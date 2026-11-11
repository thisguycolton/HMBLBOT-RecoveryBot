import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarClock, ChevronLeft, ChevronRight, LayoutGrid, List, MapPin, Radio, Search, SlidersHorizontal, Users, Video, X } from "lucide-react";
import { inputClass, labelClass, selectClass } from "../ui/styles";
import { DateField, TimeField, todayValue } from "../ui/DateFields";
import { api, fromTimeValue, toTimeValue, typeLabel } from "./lib";
import { ErrorNote, Loading } from "./ui";
import { LiveBadge, useNow, viewerZoneName, whenLabel } from "./NextMeeting";
import ShareButton from "../share/ShareButton";
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

// Keyboard focus: an instant accent outline, the same on every control here
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:focus-visible:outline-accent-light";

// A compact <select> for the sticky toolbar
const pillSelect = `${selectClass} !h-10 !w-auto shrink-0 !rounded-full !py-0 !pl-3 !text-sm`;

const loadView = () => {
  try { return localStorage.getItem("findMeeting.view") || "grid"; } catch { return "grid"; }
};

export default function FindMeeting() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState(loadView);
  const [showFilters, setShowFilters] = useState(false);
  const top = useRef(null);
  const hero = useRef(null);
  // The slim toolbar shows once the big search has scrolled up out of sight
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const el = hero.current;
    if (!el || !("IntersectionObserver" in window)) return undefined;
    const io = new IntersectionObserver(([e]) => setPinned(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // Escape closes the filters
  useEffect(() => {
    if (!showFilters) return undefined;
    const onKey = (e) => e.key === "Escape" && setShowFilters(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showFilters]);
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

  const extraFilters = ["time", "attendance", "place", "type"].filter((k) => get(k)).length;
  const days = [
    ["week", "Coming week", "Week", { date: "", live: "" }],
    ["live", "Live now", "Live", { date: "", live: "1" }],
    ["today", "Today", "Today", { date: todayValue(), live: "" }],
    ["tomorrow", "Tomorrow", "Tomorrow", { date: tomorrowValue(), live: "" }],
  ];
  const chooseDay = (key) => update(days.find((d) => d[0] === key)[3]);
  const openFilters = () => {
    if (window.matchMedia("(min-width: 640px)").matches) top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setShowFilters(true);
  };

  const dayChip = ([key, label]) => (
    <button key={key} type="button" aria-pressed={dayKey === key} onClick={() => chooseDay(key)}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-[background-color,color,box-shadow] ${focusRing} ${
        dayKey === key
          ? "!bg-accent !text-white ring-accent"
          : "!bg-white text-slate-700 ring-neutral-200 hover:!bg-neutral-50 dark:!bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700 dark:hover:!bg-neutral-800"
      }`}>
      {key === "live" && <Radio className="h-3.5 w-3.5" />}{label}
    </button>
  );

  const filterCount = extraFilters > 0 && (
    <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-white">{extraFilters}</span>
  );

  return (
    <div ref={top} className="mx-auto max-w-6xl scroll-mt-24 space-y-5 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Find a meeting</h1>
          <p className="text-sm text-slate-600 dark:text-neutral-400">
            AA Intergroup's online meetings, local intergroups' in-person ones, and our groups' own. Times are in your time zone ({viewerZoneName()}).
          </p>
        </div>
      </div>

      {/* The big search, the day and a way to the other filters */}
      <div ref={hero} className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-accent dark:text-accent-light" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search meetings"
            placeholder="Search by name, Zoom link or ID"
            className="h-14 w-full rounded-full border border-neutral-200 bg-white pl-14 pr-5 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent sm:text-lg dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500" />
        </div>
        <div className="flex items-center gap-3">
          <div className="-mx-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
            {days.map(dayChip)}
            <div className="w-40 shrink-0">
              <DateField clearable value={dayKey === "date" ? date : ""} min={todayValue()} placeholder="Pick a date"
                onChange={(v) => update({ date: v, live: "" })} />
            </div>
          </div>
          <button type="button" onClick={() => (showFilters ? setShowFilters(false) : setShowFilters(true))} aria-expanded={showFilters} aria-controls="fm-filters"
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full !bg-transparent px-2 py-1.5 text-sm font-semibold text-accent hover:underline dark:text-accent-light ${focusRing}`}>
            <SlidersHorizontal className="h-4 w-4" />
            <span className="sm:hidden">Filters</span>
            <span className="hidden sm:inline">{showFilters ? "Fewer filters" : "More filters"}</span>
            {filterCount}
          </button>
        </div>

        {showFilters && (
          <>
            {/* On a phone the filters are a sheet from the bottom; on wider screens a panel in place */}
            <div className="fixed inset-0 z-[70] bg-black/60 sm:hidden" onClick={() => setShowFilters(false)} aria-hidden="true" />
            <div id="fm-filters" role="group" aria-label="Filters"
              className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-[80] max-sm:max-h-[85vh] max-sm:overflow-y-auto max-sm:rounded-b-none max-sm:rounded-t-[1.75rem] max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] max-sm:shadow-2xl">
              <div className="mb-3 flex items-center justify-between sm:hidden">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Filters</h2>
                <button type="button" onClick={() => setShowFilters(false)} aria-label="Close filters"
                  className={`grid size-9 place-items-center rounded-full !bg-neutral-100 text-slate-600 dark:!bg-neutral-800 dark:text-neutral-300 ${focusRing}`}>
                  <X className="h-4 w-4" />
                </button>
              </div>
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
              <button type="button" onClick={() => setShowFilters(false)}
                className={`mt-5 w-full rounded-full !bg-accent py-3 text-base font-semibold !text-white sm:hidden ${focusRing}`}>
                {data ? `Show ${data.total.toLocaleString()} ${data.total === 1 ? "meeting" : "meetings"}` : "Show meetings"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Once the big search scrolls away, a slim toolbar sticks to the top with the same controls */}
      <div className="sticky top-[calc(var(--nav-h,4rem)+0.75rem)] z-30 !mt-0 h-0">
        <div className={`flex items-center gap-2 rounded-full border border-neutral-200 bg-white/95 p-1.5 shadow-lg transition-[opacity,transform,visibility] duration-200 motion-reduce:transition-none dark:border-neutral-700 dark:bg-neutral-900/95 ${
          pinned ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"
        }`}>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search meetings" placeholder="Search"
              className="h-10 w-full rounded-full border border-neutral-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent dark:border-neutral-700 dark:bg-neutral-950 dark:text-white" />
          </div>
          <div className="hidden shrink-0 rounded-full bg-neutral-100 p-1 sm:inline-flex dark:bg-neutral-800" role="group" aria-label="When">
            {days.map(([key, , short]) => (
              <button key={key} type="button" aria-pressed={dayKey === key} onClick={() => chooseDay(key)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${focusRing} ${
                  dayKey === key ? "!bg-white text-slate-900 shadow-sm dark:!bg-white dark:text-neutral-900" : "!bg-transparent text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
                }`}>
                {short}
              </button>
            ))}
          </div>
          <select aria-label="When" value={dayKey === "date" ? "" : dayKey} onChange={(e) => chooseDay(e.target.value)}
            className={`${pillSelect} sm:hidden`}>
            {dayKey === "date" && <option value="" disabled>{date}</option>}
            {days.map(([key, , short]) => <option key={key} value={key}>{short}</option>)}
          </select>
          <select aria-label="Time of day" value={time.key} disabled={live} onChange={(e) => update({ time: e.target.value, from: "", to: "" })}
            className={`${pillSelect} hidden lg:block`}>
            {TIMES.filter((t) => t.key !== "custom" || time.key === "custom").map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <select aria-label="Where" value={get("attendance")} onChange={(e) => update({ attendance: e.target.value })}
            className={`${pillSelect} hidden lg:block`}>
            <option value="">Online or in person</option>
            <option value="online">Online</option>
            <option value="in_person">In person</option>
          </select>
          <button type="button" onClick={openFilters} aria-label="All filters"
            className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 !bg-white px-3 text-sm font-medium text-slate-700 hover:!bg-neutral-50 dark:border-neutral-700 dark:!bg-neutral-900 dark:text-neutral-200 dark:hover:!bg-neutral-800 ${focusRing}`}>
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden lg:inline">Filters</span>
            {filterCount}
          </button>
        </div>
      </div>

      <ErrorNote error={error} />

      {!data && !error && <Loading variant="schedule" header={false} />}
      {data && (
        <section className={`space-y-3 transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-neutral-400">
              {data.total === 0 ? "No meetings match." : `${data.total.toLocaleString()} ${data.total === 1 ? "meeting" : "meetings"}${live ? " on now" : dayKey === "week" ? " starting 15 minutes from now or later" : ""}, soonest first`}
              {filtersOn > 0 && (
                <button type="button" onClick={() => { setQ(""); setPlace(""); setParams(new URLSearchParams()); }}
                  className={`ml-2 inline-flex items-center gap-1 !bg-transparent p-0 font-medium text-accent hover:underline ${focusRing}`}>
                  <X className="h-3.5 w-3.5" /> Clear filters
                </button>
              )}
            </p>
            <div className="inline-flex overflow-hidden rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-700" role="group" aria-label="Show as">
              {[["grid", LayoutGrid, "Grid"], ["list", List, "List"]].map(([key, Icon, label]) => (
                <button key={key} type="button" aria-pressed={view === key} onClick={() => chooseView(key)} title={label}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium ${focusRing} ${
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.meetings.map((m) => <MeetingCard key={m.key} meeting={m} now={now} />)}
            </div>
          ) : (
            <div className="space-y-1.5 nest-tray rounded-3xl bg-neutral-100 p-1.5 dark:bg-neutral-800/70">
              {data.meetings.map((m) => <MeetingRow key={m.key} meeting={m} now={now} />)}
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
    <div className={`relative overflow-hidden ${group.cover_url ? "bg-neutral-900" : "cover-default"} ${className}`}>
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
function MeetingCard({ meeting: m, now }) {
  const { group } = m;
  const sameName = m.name.trim().toLowerCase() === group.title.trim().toLowerCase();
  return (
    <div className="relative flex flex-col">
    <Link to={group.href}
      className={`group flex flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-panel ring-1 ring-neutral-200 transition-[transform,box-shadow] motion-safe:hover:-translate-y-0.5 hover:ring-accent/60 dark:bg-neutral-900 dark:ring-neutral-800 ${focusRing}`}>
      <Cover group={group} className="h-32">
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 via-black/15 to-transparent p-4">
          <p className="ev-heading line-clamp-2 min-w-0 text-lg font-semibold leading-snug text-white">{group.title}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-white/75">
            {group.here ? <><Users className="h-3 w-3" /> {group.members_count} {group.members_count === 1 ? "member" : "members"}</> : group.source || "AA Intergroup"}
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
    <MeetingShare meeting={m} className={`absolute left-3 top-3 grid size-8 place-items-center rounded-full !bg-black/45 !text-white hover:!bg-black/65 ${focusRing}`} />
    </div>
  );
}

// Share a meeting from the results: its own link when it's one of our groups', else the AA Intergroup listing's
function MeetingShare({ meeting: m, className }) {
  if (!m.share) return null;
  const title = m.name.trim().toLowerCase() === m.group.title.trim().toLowerCase() ? m.name : `${m.name} · ${m.group.title}`;
  return (
    <ShareButton url={m.share.path} title={title} text={`${m.name}: ${m.schedule_label}`} image={m.share.image}
      panelTitle="Share this meeting" iconOnly label="Share this meeting" className={className} />
  );
}

function MeetingRow({ meeting: m, now }) {
  const { group } = m;
  const at = new Date(m.starts_at);
  return (
    <div className="flex items-center gap-1 rounded-xl bg-white pr-1.5 shadow-panel hover:ring-1 hover:ring-accent/50 dark:bg-neutral-900">
    <Link to={group.href}
      className={`group flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2.5 ${focusRing}`}>
      <div className="w-20 shrink-0 text-center">
        <p className="!text-center text-xs font-medium text-slate-500 dark:text-neutral-400">
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
          {m.name.trim().toLowerCase() !== group.title.trim().toLowerCase() && <span className="ml-2 font-normal text-slate-500 dark:text-neutral-400">{group.title}</span>}
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
    <MeetingShare meeting={m} className={`grid size-8 shrink-0 place-items-center rounded-lg !bg-transparent text-slate-400 hover:!bg-neutral-100 hover:text-accent dark:text-neutral-500 dark:hover:!bg-neutral-800 ${focusRing}`} />
    </div>
  );
}

// Prev, a few page numbers around this one (and the first and last), Next
function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const shown = [...new Set([1, page - 1, page, page + 1, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const button = (active) =>
    `inline-flex min-w-9 items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-sm font-medium ring-1 disabled:opacity-40 ${focusRing} ${
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
