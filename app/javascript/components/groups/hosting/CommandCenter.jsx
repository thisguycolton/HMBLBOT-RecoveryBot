import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Clipboard, ClipboardCheck, ExternalLink, Gavel, Link2, Maximize2,
  MessageSquare, Minus, Moon, Pause, Play, Plus, RotateCcw, ScrollText, Settings, Sun, Undo2, UserCheck, Users, Video, X,
} from "lucide-react";
import { api } from "../lib";
import Avatar from "../Avatar";
import GroupLogo from "../GroupLogo";
import LucideIcon from "../../ui/LucideIcon";
import { ErrorNote, Loading, Message, primaryButton, quietButton } from "../ui";
import KitEditor from "./KitEditor";
import { chapterHtml, copyText, fillPosting, mmss, readerHref, scriptSections } from "./lib";
import "./hosting.css";

const PING_MS = 3000;
// Someone who hasn't checked in for this long shows as away (their tab may be behind Zoom)
const AWAY_MS = 20000;
const SIZES = [16, 18, 20, 23, 26, 30];

const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private window */ } },
};

// The site's own light/dark switch (Navbar.jsx keeps it in localStorage "theme")
function useDarkMode() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    store.set("theme", next ? "dark" : "light");
    setDark(next);
  };
  return [dark, toggle];
}

function useNow(ms) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

// A time on the viewer's clock, or in the meeting's zone when one is given
const timeOf = (iso, timeZone) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", ...(timeZone ? { timeZone, timeZoneName: "short" } : {}) }) : "");
const label = "!text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400";
const iconButton = "inline-grid size-9 shrink-0 place-items-center rounded-xl !bg-transparent text-slate-600 hover:!bg-neutral-100 disabled:opacity-40 dark:text-neutral-300 dark:hover:!bg-neutral-800";

// /groups/:slug/host/:meetingId: the tools a meeting's host and co-host run it with. The script
// is in the middle, a section at a time; the meeting's flow, readings and quick actions on the
// left; chat postings and who else is here on the right; the timer along the bottom. Where they
// are, the timer and what's been posted are shared: the page checks in every few seconds.
export default function CommandCenter() {
  const { slug, meetingId } = useParams();
  const [center, setCenter] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [live, setLive] = useState(null);
  const receivedAt = useRef(Date.now());
  const [sections, setSections] = useState([]);
  const [reading, setReading] = useState(null); // a kit reading open in the middle
  const [panel, setPanel] = useState("script"); // on a phone: script | chat | readings | people
  const [setup, setSetup] = useState(false);
  const [dark, toggleDark] = useDarkMode();
  const [size, setSize] = useState(() => Number(store.get("hosting-text-size", 20)) || 20);
  const now = useNow(1000);

  const applyLive = useCallback((next) => {
    if (!next) return;
    setLive((prev) => {
      if (prev && next.version < prev.version) return { ...prev, presences: next.presences };
      receivedAt.current = Date.now();
      return next;
    });
  }, []);

  const load = useCallback(() => api(`/groups/${slug}/hosting/${meetingId}`).then((c) => { setCenter(c); applyLive(c.live); }).catch((e) => setError(e)), [slug, meetingId, applyLive]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let gone = false;
    scriptSections(center?.kit?.script).then((s) => !gone && setSections(s));
    return () => { gone = true; };
  }, [center?.kit?.script]);

  useEffect(() => {
    document.title = center ? `Hosting ${center.meeting.name}` : "Hosting Command Center";
  }, [center]);

  const index = Math.min(live?.section_index || 0, Math.max(sections.length - 1, 0));
  const section = sections[index];

  // What the other host sees beside my name
  const activity = setup ? "Setting up the kit" : reading ? `Sharing ${reading.title}` : panel === "chat" ? "Looking at chat postings"
    : section ? `On ${section.title}` : "Here";

  const ping = useCallback(() => {
    api(`/groups/${slug}/hosting/${meetingId}/ping`, { method: "POST", body: { activity, section_index: index } }).then(applyLive).catch(() => {});
  }, [slug, meetingId, activity, index, applyLive]);
  useEffect(() => {
    if (!center) return undefined;
    ping();
    const t = setInterval(ping, PING_MS);
    return () => clearInterval(t);
  }, [center, ping]);

  const act = async (what, extra = {}) => {
    setActionError(null);
    try {
      applyLive(await api(`/groups/${slug}/hosting/${meetingId}/act`, { method: "POST", body: { act: what, ...extra } }));
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
    goto(index + 1);
  };

  // Arrow keys move through the script (not while typing)
  useEffect(() => {
    const onKey = (e) => {
      if (setup || e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable) return;
      if (e.key === "ArrowRight") goto(index + 1);
      if (e.key === "ArrowLeft") goto(index - 1);
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

  const elapsed = live.timer.elapsed + (live.timer.running ? (now - receivedAt.current) / 1000 : 0);
  const changeSize = (step) => {
    const i = Math.min(Math.max(SIZES.indexOf(size) + step, 0), SIZES.length - 1);
    setSize(SIZES[i]);
    store.set("hosting-text-size", SIZES[i]);
  };
  const others = live.presences.filter((p) => !p.me && now - new Date(p.last_seen_at).getTime() < AWAY_MS);
  const hosts = [center.hosts.host && `Host: ${center.hosts.host}`, center.hosts.co_host && `Co-host: ${center.hosts.co_host}`].filter(Boolean).join(" · ");
  const kit = center.kit;

  const flow = <Flow sections={sections} index={index} completed={live.completed} presences={live.presences} goto={goto} />;
  const readings = <Readings kit={kit} open={reading} onOpen={(r) => { setReading(r); setPanel("script"); }} />;
  const actions = <QuickActions center={center} />;
  const chat = <ChatPostings center={center} live={live} elapsed={elapsed} act={act} />;
  const people = <People live={live} now={now} />;

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

      <div className="grid min-h-0 flex-1 lg:grid-cols-[17rem_minmax(0,1fr)_22rem]">
        <aside className={`min-h-0 overflow-y-auto border-neutral-200 p-4 lg:block lg:border-r dark:border-neutral-800 ${panel === "readings" ? "block" : "hidden"}`}>
          <div className="space-y-6">
            <div className="hidden lg:block">{flow}</div>
            {readings}
            {actions}
          </div>
        </aside>

        <main className={`min-h-0 overflow-y-auto lg:block ${panel === "script" ? "block" : "hidden"}`}>
          {reading ? (
            <ReadingView reading={reading} size={size} onClose={() => setReading(null)} />
          ) : (
            <ScriptView center={center} sections={sections} index={index} section={section} live={live} size={size}
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
        <button type="button" className={`${quietButton} sm:!px-4`} onClick={() => goto(index - 1)} disabled={index === 0 || !sections.length} aria-label="Previous section">
          <ArrowLeft className="size-4" /> <span className="hidden sm:inline">Previous</span>
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className={`${label} !text-[10px] sm:!text-xs`}>{live.timer.running || elapsed > 0 ? "Meeting elapsed" : center.starts_at ? `Starts at ${timeOf(center.starts_at, center.meeting.time_zone)}` : "Meeting timer"}</p>
          <p className="font-mono text-2xl font-semibold tabular-nums sm:text-3xl" aria-live="off">{mmss(elapsed)}</p>
        </div>
        <div className="flex items-center gap-1">
          {!live.timer.running && elapsed > 0 && (
            <button type="button" className={iconButton} onClick={() => window.confirm("Reset the meeting timer to 00:00 for both hosts?") && act("timer_reset")} aria-label="Reset the timer" title="Reset the timer"><RotateCcw className="size-4" /></button>
          )}
          <button type="button" className={`${quietButton} sm:!px-4`} onClick={() => act(live.timer.running ? "timer_pause" : "timer_start")}>
            {live.timer.running ? <><Pause className="size-4" /> <span className="hidden sm:inline">Pause timer</span></> : <><Play className="size-4" /> <span className="hidden sm:inline">{elapsed > 0 ? "Resume timer" : "Start timer"}</span></>}
          </button>
        </div>
        <button type="button" className={`${primaryButton} sm:!px-5`} onClick={next} disabled={index >= sections.length - 1} aria-label="Next section">
          <span className="hidden sm:inline">Next</span> <ArrowRight className="size-4" />
        </button>
      </footer>

      {setup && <KitEditor center={center} onClose={() => setSetup(false)} onSaved={(c) => { setCenter(c); applyLive(c.live); }} />}
    </div>
  );
}

// The meeting's flow: the script's sections, where the meeting is, which are done, and where the
// other host is looking
function Flow({ sections, index, completed, presences, goto }) {
  if (!sections.length) return null;
  return (
    <section>
      <h2 className={`${label} mb-2`}>Meeting flow</h2>
      <ol className="space-y-1">
        {sections.map((s, i) => {
          const here = presences.filter((p) => !p.me && p.section_index === i);
          const done = completed.includes(i);
          return (
            <li key={i}>
              <button type="button" onClick={() => goto(i)} aria-current={i === index ? "step" : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm ${i === index ? "!bg-accent/10 font-semibold text-accent ring-1 ring-accent/30 dark:!bg-accent/20 dark:text-white" : "!bg-transparent text-slate-700 hover:!bg-neutral-100 dark:text-neutral-300 dark:hover:!bg-neutral-800"}`}>
                <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${i === index ? "bg-accent text-white" : done ? "bg-emerald-500 text-white" : "bg-neutral-200 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"}`}>
                  {done && i !== index ? <Check className="size-4" /> : i + 1}
                </span>
                <span className={`min-w-0 flex-1 truncate ${done && i !== index ? "text-slate-500 dark:text-neutral-500" : ""}`}>{s.title}</span>
                {here.map((p) => <Avatar key={p.user_id} person={p} size={20} className="ring-2 ring-white dark:ring-neutral-950" />)}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ScriptView({ center, sections, index, section, live, size, goto, next, act, openSetup, flow }) {
  const kit = center.kit;
  if (!sections.length) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center">
        <ScrollText className="mx-auto size-10 text-slate-400" />
        <h1 className="mt-3 text-lg font-semibold">No script yet</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-neutral-400">
          {kit.script_hidden ? "The script for this meeting is a document only record keepers can read. A host coordinator can set it to Hosts in Group conscience > Documents."
            : center.can_edit ? "Pick the group's format or script document, and it shows here a section at a time, cut at its headings."
            : "A host coordinator hasn't picked this meeting's script yet. The chat postings and readings still work."}
        </p>
        {center.can_edit && <button type="button" className={`${primaryButton} mt-4`} onClick={openSetup}><Settings className="size-4" /> Set up this meeting</button>}
      </div>
    );
  }
  const done = live.completed.includes(index);
  const upNext = sections[index + 1];
  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-8 sm:py-8">
      {flow}
      <div className="mb-2 mt-4 flex items-center justify-between lg:mt-0">
        <p className={label}>Currently</p>
        <p className="text-sm tabular-nums text-slate-500 dark:text-neutral-400">{index + 1} / {sections.length}</p>
      </div>
      <h1 className="text-2xl font-bold sm:text-3xl">{section.title}</h1>
      <div className="doc-prose hc-script mt-4" style={{ fontSize: size }} dangerouslySetInnerHTML={{ __html: section.html }} />

      <div className="mt-8 border-t border-neutral-200 pt-5 dark:border-neutral-800">
        {upNext && (
          <>
            <p className={`${label} mb-2`}>Next up</p>
            <button type="button" onClick={() => goto(index + 1)} className="flex w-full items-center gap-3 rounded-xl !bg-white p-3 text-left shadow-panel ring-1 ring-neutral-200 hover:ring-accent/40 dark:!bg-neutral-900 dark:ring-neutral-800">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs font-semibold text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">{index + 2}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{upNext.title}</span>
              <ChevronRight className="size-5 text-slate-400" />
            </button>
          </>
        )}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" className={`${quietButton} !py-2.5 ${done ? "!text-emerald-700 dark:!text-emerald-300" : ""}`}
            onClick={() => act(done ? "uncomplete" : "complete", { index, label: section.title })}>
            {done ? <><Undo2 className="size-4" /> Done (undo)</> : <><Check className="size-4" /> Mark complete</>}
          </button>
          <button type="button" className={`${primaryButton} !py-2.5`} onClick={next} disabled={!upNext}>
            {upNext ? <>Next section <ArrowRight className="size-4" /></> : "Last section"}
          </button>
        </div>
      </div>
    </div>
  );
}

// The readings the group keeps at hand: chapters from the library, or links
function Readings({ kit, open, onOpen }) {
  return (
    <section>
      <h2 className={`${label} mb-2`}>Meeting readings</h2>
      {kit.readings.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-neutral-400">No readings picked for this meeting.</p>
      ) : (
        <ul className="space-y-1">
          {kit.readings.map((r, i) => (
            <li key={i}>
              {r.url ? (
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-slate-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
                  <Link2 className="size-5 shrink-0 text-slate-400" /> <span className="min-w-0 flex-1 truncate">{r.title}</span> <ExternalLink className="size-3.5 text-slate-400" />
                </a>
              ) : (
                <button type="button" onClick={() => onOpen(r)} aria-pressed={open === r}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm ${open === r ? "!bg-accent/10 text-accent dark:!bg-accent/20 dark:text-white" : "!bg-transparent text-slate-700 hover:!bg-neutral-100 dark:text-neutral-300 dark:hover:!bg-neutral-800"}`}>
                  <BookOpen className="size-5 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1"><span className="block truncate">{r.title}</span>{r.book_title && <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{r.book_title}</span>}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// A library chapter in the middle, big enough to share on screen, or opened in its own window
function ReadingView({ reading, size, onClose }) {
  const [html, setHtml] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    setHtml(null);
    setError(null);
    fetch(`/api/books/${encodeURIComponent(reading.book_slug)}/chapters/${encodeURIComponent(reading.chapter_slug)}`, { headers: { Accept: "application/json" }, credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("That chapter isn't in the library anymore."))))
      .then((c) => setHtml(chapterHtml(c.tiptap_json)))
      .catch((e) => setError(e.message));
  }, [reading]);
  const share = () => window.open(readerHref(reading), "hosting-reading", "popup,width=1100,height=850");
  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-8 sm:py-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className={`${label} flex-1`}>Reading{reading.book_title ? ` · ${reading.book_title}` : ""}</p>
        <button type="button" className={quietButton} onClick={share} title="Opens the reader in its own window, to share that window in Zoom"><Maximize2 className="size-4" /> Open to share</button>
        <button type="button" className={quietButton} onClick={onClose}><X className="size-4" /> Back to the script</button>
      </div>
      <h1 className="text-2xl font-bold sm:text-3xl">{reading.title}</h1>
      <ErrorNote error={error} />
      {html == null && !error ? <Loading /> : <div className="doc-prose hc-script mt-4" style={{ fontSize: size }} dangerouslySetInnerHTML={{ __html: html || "" }} />}
    </div>
  );
}

function QuickActions({ center }) {
  const [copied, setCopied] = useState(false);
  const row = "flex w-full items-center gap-3 rounded-xl !bg-transparent px-2.5 py-2 text-left text-sm text-slate-700 hover:!bg-neutral-100 dark:text-neutral-300 dark:hover:!bg-neutral-800";
  const zoom = center.meeting.conference_url;
  return (
    <section>
      <h2 className={`${label} mb-2`}>Quick actions</h2>
      <div className="space-y-1">
        <a href={center.court_url} target="_blank" rel="noopener noreferrer" className={row}><Gavel className="size-5 shrink-0 text-slate-400" /> Send a court verification</a>
        {zoom && <a href={zoom} target="_blank" rel="noopener noreferrer" className={row}><Video className="size-5 shrink-0 text-slate-400" /> Open the Zoom meeting</a>}
        {zoom && (
          <button type="button" className={row} onClick={() => copyText(zoom).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
            {copied ? <ClipboardCheck className="size-5 shrink-0 text-emerald-500" /> : <Clipboard className="size-5 shrink-0 text-slate-400" />} {copied ? "Copied" : "Copy the Zoom link"}
          </button>
        )}
        <Link to={`/${center.group.slug}/hosts`} className={row}><UserCheck className="size-5 shrink-0 text-slate-400" /> Host schedule</Link>
      </div>
    </section>
  );
}

// The postings to paste into the Zoom chat, in the order they go out. The next one due (by the
// meeting timer) stands out; a copied one says who copied it, for both hosts.
function ChatPostings({ center, live, elapsed, act }) {
  const [justCopied, setJustCopied] = useState(null);
  const [openId, setOpenId] = useState(null);
  const postings = center.kit.postings;
  const due = useMemo(() => postings.find((p) => !live.posted[p.id] && p.minute * 60 <= elapsed), [postings, live.posted, elapsed]);
  const copy = async (p) => {
    await copyText(fillPosting(p.body, center));
    setJustCopied(p.id);
    setTimeout(() => setJustCopied((id) => (id === p.id ? null : id)), 1800);
    act("posted", { posting_id: p.id });
  };
  return (
    <section>
      <h2 className={`${label} mb-2`}>Chat postings</h2>
      {postings.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-neutral-400">{center.can_edit ? "Add what the hosts paste into the chat (the welcome, the Preamble, the 7th Tradition) with the gear above." : "No chat postings set up for this meeting."}</p>
      ) : (
        <ul className="space-y-2">
          {postings.map((p) => {
            const posted = live.posted[p.id];
            const isDue = due?.id === p.id;
            const open = openId === p.id;
            return (
              <li key={p.id} className={`rounded-xl bg-white shadow-panel ring-1 dark:bg-neutral-900 ${isDue ? "ring-2 ring-accent" : "ring-neutral-200 dark:ring-neutral-800"}`}>
                <div className="flex items-center gap-3 p-3">
                  <button type="button" onClick={() => setOpenId(open ? null : p.id)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 !bg-transparent p-0 text-left" title="Show what gets pasted">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${posted ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-neutral-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"}`}>
                      <LucideIcon name={p.icon} fallback={MessageSquare} size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-mono text-xs tabular-nums text-slate-500 dark:text-neutral-400">{mmss(p.minute * 60)}{isDue && <span className="ml-1.5 font-sans font-semibold text-accent dark:text-sky-300">Now</span>}</span>
                      <span className="block truncate font-semibold">{p.title}</span>
                      {posted && <span className="block truncate text-xs text-emerald-700 dark:text-emerald-300">Copied by {posted.by} · {timeOf(posted.at)}</span>}
                    </span>
                  </button>
                  <button type="button" onClick={() => copy(p)} className={`${isDue ? primaryButton : quietButton} !px-3`}>
                    {justCopied === p.id ? <><ClipboardCheck className="size-4" /> Copied</> : <><Clipboard className="size-4" /> Copy</>}
                  </button>
                </div>
                {open && (
                  <div className="border-t border-neutral-100 px-3 pb-3 pt-2 dark:border-neutral-800">
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-700 dark:text-neutral-200">{fillPosting(p.body, center)}</pre>
                    {posted && <button type="button" className="mt-2 !bg-transparent p-0 text-xs font-medium text-slate-500 hover:underline dark:text-neutral-400" onClick={() => act("unposted", { posting_id: p.id })}>Mark as not posted</button>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Who has the Command Center open and what they're on, and what the hosts have done
function People({ live, now }) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className={`${label} mb-2`}>Hosts here</h2>
        <ul className="space-y-2">
          {live.presences.map((p) => {
            const away = now - new Date(p.last_seen_at).getTime() >= AWAY_MS;
            return (
              <li key={p.user_id} className="flex items-center gap-3">
                <span className={`size-2.5 shrink-0 rounded-full ${away ? "bg-slate-300 dark:bg-neutral-600" : "bg-emerald-500"}`} title={away ? "Away" : "Here"} />
                <Avatar person={p} size={36} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.name}{p.me && <span className="font-normal text-slate-500 dark:text-neutral-400"> (you)</span>}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-neutral-400">{away ? "Away" : p.activity || "Here"}</p>
                </div>
              </li>
            );
          })}
        </ul>
        {live.presences.length < 2 && <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">When the other host opens this meeting's Command Center, you'll see what they're on here.</p>}
      </div>
      {live.log.length > 0 && (
        <div>
          <h2 className={`${label} mb-2`}>Done so far</h2>
          <ul className="space-y-1.5 text-sm">
            {live.log.map((l, i) => (
              <li key={`${l.at}-${i}`} className="flex gap-2">
                <span className="w-16 shrink-0 text-xs tabular-nums leading-5 text-slate-500 dark:text-neutral-400">{timeOf(l.at)}</span>
                <span className="min-w-0 text-slate-700 dark:text-neutral-200"><span className="font-medium">{l.by}</span> {l.text.charAt(0).toLowerCase() + l.text.slice(1)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
