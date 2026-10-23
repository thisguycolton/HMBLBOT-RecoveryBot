import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AlarmClock, ArrowLeft, ArrowRight, BookOpen, MessageSquare, Minus, Moon, Plus, ScrollText, Settings, Sun, UserCheck, Users, X } from "lucide-react";
import { api } from "../lib";
import GroupLogo from "../GroupLogo";
import { ErrorNote, Loading, Message, primaryButton, quietButton } from "../ui";
import KitEditor from "./KitEditor";
import ActivityPanel from "./Activity";
import ServiceReadings from "./ServiceReadings";
import { ACTIVITY_TITLE, cueLabel, cueTime, scriptSections, skipReason } from "./lib";
import {
  AWAY_MS, ActivityCard, CUE_EARLY_MS, CUE_SHOWN_MS, ChatPostings, Flow, MeetingClock, PING_MS, People, QuickActions, ReadingView, Readings, SIZES, ScriptView,
  iconButton, store, timeOf, useDarkMode, useMeetingClock,
} from "./parts";
import "./hosting.css";

// The Command Center as it was before HostDeck, kept for one release behind ?classic=1 in case
// the HostDeck version of it gets something wrong. Delete it (and the switch in CommandCenter.jsx)
// once HostDeck has run a release without trouble.
// /groups/:slug/host/:meetingId: the tools a meeting's host and co-host run it with. The script
// is in the middle, a section at a time; the meeting's flow, readings and quick actions on the
// left; chat postings and who else is here on the right; the timer along the bottom. Where they
// are, the timer and what's been posted are shared: the page checks in every few seconds.
export default function CommandCenterClassic() {
  const { slug, meetingId } = useParams();
  // ?on=: the date a short link (/h/CODE) opened, so both hosts stay on that day
  const [params] = useSearchParams();
  const on = /^\d{4}-\d{2}-\d{2}$/.test(params.get("on") || "") ? params.get("on") : null;
  const base = `/groups/${slug}/hosting/${meetingId}`;
  const q = on ? `?on=${on}` : "";
  const [center, setCenter] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [live, setLive] = useState(null);
  const [sections, setSections] = useState([]);
  const [reading, setReading] = useState(null); // a kit reading open in the middle, or "activity"
  const [panel, setPanel] = useState("script"); // on a phone: script | chat | readings | people
  const [setup, setSetup] = useState(false);
  const [dark, toggleDark] = useDarkMode();
  const [size, setSize] = useState(() => Number(store.get("hosting-text-size", 20)) || 20);
  const [dismissed, setDismissed] = useState([]); // reminders this host closed
  const { now, elapsed } = useMeetingClock(center?.starts_at, live?.server_now);

  const applyLive = useCallback((next) => {
    if (!next) return;
    setLive((prev) => {
      if (prev && next.version < prev.version) return { ...prev, presences: next.presences };
      return next;
    });
  }, []);

  const load = useCallback(() => api(`${base}${q}`).then((c) => { setCenter(c); applyLive(c.live); }).catch((e) => setError(e)), [base, q, applyLive]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let gone = false;
    scriptSections(center?.kit?.script, center?.kit?.activity_anchor, center?.kit?.intro_title).then((s) => !gone && setSections(s));
    return () => { gone = true; };
  }, [center?.kit?.script, center?.kit?.activity_anchor, center?.kit?.intro_title]);

  useEffect(() => {
    document.title = center ? `Hosting ${center.meeting.name}` : "Hosting Command Center";
  }, [center]);

  // Sections that aren't for today (their days, or the day's activity) are left out completely:
  // not in the flow, the counts, or Next / Previous
  const weekday = center ? new Date(`${center.on}T12:00:00`).getDay() : 0;
  const skips = useMemo(() => sections.map((sec) => skipReason(sec, { activity: live?.activity, weekday })), [sections, live?.activity, weekday]);
  const shown = useMemo(() => sections.map((_, i) => i).filter((i) => !skips[i]), [sections, skips]);
  const nextIndex = (from, by) => {
    for (let i = from + by; i >= 0 && i < sections.length; i += by) if (!skips[i]) return i;
    return -1;
  };
  // The meeting is on a section that's left out today (the activity changed under it): show the
  // next one that isn't, or the one before when it was the last
  const stored = Math.min(live?.section_index || 0, Math.max(sections.length - 1, 0));
  const index = !skips[stored] || !shown.length ? stored : [nextIndex(stored, 1), nextIndex(stored, -1)].find((i) => i >= 0);
  const section = sections[index];

  // What the other host sees beside my name
  const activity = setup ? "Setting up the kit" : reading === "activity" ? `On ${ACTIVITY_TITLE}` : reading ? `Sharing ${reading.title}` : panel === "chat" ? "Looking at chat postings"
    : section ? `On ${section.title}` : "Here";

  const ping = useCallback(() => {
    api(`${base}/ping${q}`, { method: "POST", body: { activity, section_index: index } }).then(applyLive).catch(() => {});
  }, [base, q, activity, index, applyLive]);
  useEffect(() => {
    if (!center) return undefined;
    ping();
    const t = setInterval(ping, PING_MS);
    return () => clearInterval(t);
  }, [center, ping]);

  const act = async (what, extra = {}) => {
    setActionError(null);
    try {
      applyLive(await api(`${base}/act${q}`, { method: "POST", body: { act: what, ...extra } }));
    } catch (e) { setActionError(e.message); }
  };
  const goto = (i) => {
    if (i < 0 || i >= sections.length) return;
    setReading(null);
    setPanel("script");
    act("goto", { index: i, label: sections[i].title });
  };
  const next = () => {
    if (!live.completed.includes(index)) act("complete", { index, label: section?.title });
    goto(nextIndex(index, 1));
  };

  // Arrow keys move through the script (not while typing)
  useEffect(() => {
    const onKey = (e) => {
      if (setup || e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable) return;
      if (e.key === "ArrowRight") goto(nextIndex(index, 1));
      if (e.key === "ArrowLeft") goto(nextIndex(index, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 px-4 dark:bg-neutral-950">
        <Message title={error.status === 403 ? "This is for the group's hosts" : "That meeting isn't here"} text={error.message}>
          <Link to={`/${slug}/hosts`} className="mt-4 inline-block text-sm text-accent hover:underline">Back to the group</Link>
        </Message>
      </div>
    );
  }
  if (!center || !live) return <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950"><Loading /></div>;

  const changeSize = (step) => {
    const i = Math.min(Math.max(SIZES.indexOf(size) + step, 0), SIZES.length - 1);
    setSize(SIZES[i]);
    store.set("hosting-text-size", SIZES[i]);
  };
  const others = live.presences.filter((p) => !p.me && now - new Date(p.last_seen_at).getTime() < AWAY_MS);
  const hosts = [center.hosts.host && `Host: ${center.hosts.host}`, center.hosts.co_host && `Co-host: ${center.hosts.co_host}`].filter(Boolean).join(" · ");
  const kit = center.kit;

  // Sections with a reminder whose time has come (from a minute before), not done or closed yet
  const cues = sections.map((sec, i) => ({ sec, i, at: cueTime(sec.cue, center.starts_at, center.ends_at) }))
    .filter(({ i, at }) => at && !skips[i] && !live.completed.includes(i) && !dismissed.includes(i) && now >= at - CUE_EARLY_MS && now < at + CUE_SHOWN_MS);
  const flow = <Flow sections={sections} shown={shown} index={index} completed={live.completed} presences={live.presences} goto={goto} picked={!!live.activity} />;
  // Today's reading / activity: its place in the script, or on its own when the script has none
  const openActivity = () => {
    const spot = sections.findIndex((x, i) => x.activity && !skips[i]);
    if (spot >= 0) goto(spot);
    else { setReading("activity"); setPanel("script"); }
  };
  const readings = (
    <>
      <ActivityCard activity={live.activity} open={reading === "activity" || !!section?.activity} onOpen={openActivity} />
      <Readings kit={kit} open={reading} onOpen={(r) => { setReading(r); setPanel("script"); }} />
      <ServiceReadings slug={slug} />
    </>
  );
  const actions = <QuickActions center={center} />;
  const chat = <ChatPostings center={center} live={live} elapsed={elapsed} act={act} />;
  const people = <People center={center} live={live} now={now} act={act} />;

  return (
    <div className={`hc-root flex h-dvh flex-col bg-neutral-50 !font-sans text-slate-900 dark:bg-neutral-950 dark:text-white ${dark ? "doc-dark" : ""}`}>
      <header className="flex shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2 sm:gap-3 sm:px-4 dark:border-neutral-800 dark:bg-neutral-900">
        <Link to={`/${slug}/hosts`} className={iconButton} aria-label="Back to the group's hosts" title="Back to the group"><ArrowLeft className="size-5" /></Link>
        <GroupLogo group={center.group} className="hidden size-8 text-xs sm:grid" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold sm:text-base">Hosting Command Center</p>
          <p className="truncate text-xs text-slate-500 dark:text-neutral-400">
            {center.meeting.name} · {new Date(`${center.on}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
            {center.starts_at && ` at ${timeOf(center.starts_at, center.meeting.time_zone)}`}
          </p>
        </div>
        <span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${others.length ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-neutral-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"}`}
          title={others.length ? `${others.map((p) => p.name).join(", ")} here too` : "Nobody else has this open"}>
          <span className={`size-2 rounded-full ${others.length ? "animate-pulse bg-emerald-500" : "bg-slate-400"}`} /> {others.length ? "Live" : "Only you"}
        </span>
        {hosts && <span className="hidden max-w-xs truncate text-sm text-slate-600 lg:inline dark:text-neutral-300"><UserCheck className="mr-1 inline size-4" />{hosts}</span>}
        <div className="flex items-center">
          <button type="button" className={iconButton} onClick={() => changeSize(-1)} disabled={size === SIZES[0]} aria-label="Smaller script text" title="Smaller text"><Minus className="size-4" /></button>
          <button type="button" className={iconButton} onClick={() => changeSize(1)} disabled={size === SIZES[SIZES.length - 1]} aria-label="Bigger script text" title="Bigger text"><Plus className="size-4" /></button>
          <button type="button" className={iconButton} onClick={toggleDark} aria-label={dark ? "Light mode" : "Dark mode"} title={dark ? "Light mode" : "Dark mode"}>{dark ? <Sun className="size-5" /> : <Moon className="size-5" />}</button>
          {center.can_edit && <button type="button" className={iconButton} onClick={() => setSetup(true)} aria-label="Set up the kit" title="Set up the script, postings and readings"><Settings className="size-5" /></button>}
        </div>
      </header>

      {/* On a phone, one column at a time */}
      <nav className="flex shrink-0 gap-1 border-b border-neutral-200 bg-white px-2 lg:hidden dark:border-neutral-800 dark:bg-neutral-900" aria-label="Command Center sections">
        {[["script", "Script", ScrollText], ["chat", "Chat", MessageSquare], ["readings", "Readings", BookOpen], ["people", "Hosts", Users]].map(([key, text, Icon]) => (
          <button key={key} type="button" onClick={() => setPanel(key)} aria-pressed={panel === key}
            className={`-mb-px inline-flex flex-1 items-center justify-center gap-1.5 border-b-2 !bg-transparent px-2 py-2.5 text-sm font-medium ${panel === key ? "border-accent text-accent" : "border-transparent text-slate-600 dark:text-neutral-400"}`}>
            <Icon className="size-4" /> {text}{key === "people" && others.length > 0 && <span className="size-1.5 rounded-full bg-emerald-500" />}
          </button>
        ))}
      </nav>

      {actionError && <div className="px-4 pt-2"><ErrorNote error={actionError} /></div>}
      {cues.map(({ sec, i, at }) => (
        <div key={i} role="alert" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-amber-950 dark:border-amber-700/60 dark:bg-amber-900/50 dark:text-amber-50">
          <AlarmClock className="size-5 shrink-0 animate-pulse" />
          <p className="min-w-0 flex-1 text-sm"><strong>{now < at ? `Coming up: ${sec.title}` : `It's time: ${sec.title}`}</strong> <span className="opacity-80">· {cueLabel(sec.cue)}</span></p>
          {index !== i && <button type="button" className={`${primaryButton} !px-3 !py-1.5`} onClick={() => goto(i)}>Go there <ArrowRight className="size-4" /></button>}
          <button type="button" className="inline-grid size-8 place-items-center rounded-lg !bg-transparent hover:!bg-amber-200/70 dark:hover:!bg-amber-800/60" onClick={() => setDismissed((d) => [...d, i])} aria-label={`Close the reminder for ${sec.title}`}><X className="size-4" /></button>
        </div>
      ))}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[17rem_minmax(0,1fr)_22rem]">
        <aside className={`min-h-0 overflow-y-auto border-neutral-200 p-4 lg:block lg:border-r dark:border-neutral-800 ${panel === "readings" ? "block" : "hidden"}`}>
          <div className="space-y-6">
            <div className="hidden lg:block">{flow}</div>
            {readings}
            {actions}
          </div>
        </aside>

        <main className={`min-h-0 overflow-y-auto lg:block ${panel === "script" ? "block" : "hidden"}`}>
          {reading === "activity" ? (
            <div className="mx-auto max-w-3xl px-4 py-5 sm:px-8 sm:py-8">
              <div className="mb-3 flex items-center gap-2"><h1 className="flex-1 text-2xl font-bold sm:text-3xl">{ACTIVITY_TITLE}</h1><button type="button" className={quietButton} onClick={() => setReading(null)}><X className="size-4" /> Back to the script</button></div>
              <ActivityPanel center={center} live={live} act={act} size={size} />
            </div>
          ) : reading ? (
            <ReadingView reading={reading} size={size} onClose={() => setReading(null)} />
          ) : (
            <ScriptView center={center} sections={sections} shown={shown} index={index} section={section} live={live} size={size} upNextIndex={nextIndex(index, 1)}
              goto={goto} next={next} act={act} openSetup={() => setSetup(true)} flow={<div className="lg:hidden">{flow}</div>} />
          )}
        </main>

        <aside className={`min-h-0 overflow-y-auto border-neutral-200 p-4 lg:block lg:border-l dark:border-neutral-800 ${panel === "chat" || panel === "people" ? "block" : "hidden"}`}>
          <div className="space-y-6">
            <div className={panel === "people" ? "hidden lg:block" : ""}>{chat}</div>
            <div className={panel === "chat" ? "hidden lg:block" : ""}>{people}</div>
          </div>
        </aside>
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t border-neutral-200 bg-white px-3 py-2 sm:gap-3 sm:px-4 sm:py-3 dark:border-neutral-800 dark:bg-neutral-900">
        <button type="button" className={`${quietButton} sm:!px-4`} onClick={() => goto(nextIndex(index, -1))} disabled={nextIndex(index, -1) < 0} aria-label="Previous section">
          <ArrowLeft className="size-4" /> <span className="hidden sm:inline">Previous</span>
        </button>
        <div className="min-w-0 flex-1"><MeetingClock center={center} elapsed={elapsed} /></div>
        <button type="button" className={`${primaryButton} sm:!px-5`} onClick={next} disabled={nextIndex(index, 1) < 0} aria-label="Next section">
          <span className="hidden sm:inline">Next</span> <ArrowRight className="size-4" />
        </button>
      </footer>

      {setup && <KitEditor center={center} onClose={() => setSetup(false)} onSaved={(c) => { setCenter(c); applyLive(c.live); }} />}
    </div>
  );
}
