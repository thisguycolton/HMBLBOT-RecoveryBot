// The Hosting Command Center's pieces, shared by HostDeck's blocks (deck/blocks.jsx) and, for
// one release, the classic page (CommandCenterClassic.jsx)
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlarmClock, ArrowRight, BookOpen, Check, ChevronRight, Clipboard, ClipboardCheck, ExternalLink, Filter, Gavel, History, KeyRound, Link2, Maximize2,
  MessageSquare, ScrollText, Settings, Undo2, UserCheck, Video, X,
} from "lucide-react";
import Avatar from "../Avatar";
import LucideIcon from "../../ui/LucideIcon";
import { primaryButton, quietButton } from "../ui";
import { passcodeLabel, passcodeValue } from "../MeetingPasscode";
import ActivityPanel, { ActivityPicker, ChapterText, activityIcon, shareReading } from "./Activity";
import { ServicePanel, Milestones } from "./Service";
import PostingPreview from "./PostingPreview";
import { copyPosting } from "./chatFormat";
import { activityLabel, copyText, cueLabel, cueTime, fillPosting, fillValues, mmss, readingPosting } from "./lib";
import "./hosting.css";

export const PING_MS = 3000;
// Someone who hasn't checked in for this long shows as away (their tab may be behind Zoom)
export const AWAY_MS = 20000;
// A section's reminder shows from a minute before its time until this long after (or it's done)
export const CUE_EARLY_MS = 60000;
export const CUE_SHOWN_MS = 15 * 60000;
export const SIZES = [16, 18, 20, 23, 26, 30];

export const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private window */ } },
};

// The site's own light/dark switch (Navbar.jsx keeps it in localStorage "theme")
export function useDarkMode() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    store.set("theme", next ? "dark" : "light");
    setDark(next);
  };
  return [dark, toggle];
}

export function useNow(ms) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

// The meeting clock: seconds since the meeting's start time (negative before it starts), on the
// server's clock, so both hosts (and the chat postings page) see the same time whatever their
// computer's clock says. `serverNow` is the server's time with the last answer.
export function useMeetingClock(startsAt, serverNow) {
  const skew = useRef(0);
  useEffect(() => { if (serverNow) skew.current = new Date(serverNow).getTime() - Date.now(); }, [serverNow]);
  const now = useNow(1000) + skew.current;
  return { now, elapsed: startsAt ? (now - new Date(startsAt).getTime()) / 1000 : null };
}

// The bottom bar's clock: a countdown to the start, then the time in, and how long is left
// (`big`: on a card of its own, "side" or "main")
export function MeetingClock({ center, elapsed, compact = false, big = false }) {
  const length = center.starts_at && center.ends_at ? (new Date(center.ends_at) - new Date(center.starts_at)) / 1000 : null;
  if (elapsed == null) return <p className="text-sm text-slate-500 dark:text-neutral-400">No start time</p>;
  const before = elapsed < 0;
  const left = length != null ? length - elapsed : null;
  const caption = before ? `Starts at ${timeOf(center.starts_at, center.meeting.time_zone)}` : left != null && left < 0 ? "Meeting ran over" : "Meeting time";
  return (
    <div className="min-w-0 text-center">
      {!compact && <p className={`${label} !text-[10px] sm:!text-xs`}>{caption}</p>}
      <p className={`font-mono font-semibold tabular-nums ${compact ? "text-lg" : big === "main" ? "text-6xl sm:text-7xl" : big ? "text-4xl" : "text-2xl sm:text-3xl"} ${before ? "text-slate-500 dark:text-neutral-400" : ""}`} aria-live="off" title={caption}>
        {before ? `−${mmss(-elapsed)}` : mmss(elapsed)}
      </p>
      {!compact && !before && left != null && <p className="text-[11px] tabular-nums text-slate-500 dark:text-neutral-400">{left >= 0 ? `${Math.ceil(left / 60)} min left` : `${Math.floor(-left / 60)} min over`}</p>}
    </div>
  );
}

// A time on the viewer's clock, or in the meeting's zone when one is given
export const timeOf = (iso, timeZone) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", ...(timeZone ? { timeZone, timeZoneName: "short" } : {}) }) : "");
export const label = "!text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400";
export const iconButton = "inline-grid size-9 shrink-0 place-items-center rounded-xl !bg-transparent text-slate-600 hover:!bg-neutral-100 disabled:opacity-40 dark:text-neutral-300 dark:hover:!bg-neutral-800";

// The meeting's flow: the script's sections for today (ones left out today aren't listed), where the
// meeting is, which are done, and where the other host is looking. The list is a third of the screen
// high, and scrolls itself so the section the meeting is on is the first one showing (`full`: the
// whole list, in the middle of a deck).
export function Flow({ sections, shown, index, completed, presences, goto, picked, full = false }) {
  const listRef = useRef(null);
  const at = shown.indexOf(index);
  useEffect(() => {
    const list = listRef.current;
    const item = list?.children[at];
    if (item && !full) list.scrollTo({ top: Math.max(item.offsetTop - 2, 0), behavior: "smooth" });
  }, [at, shown.length, full]);
  if (!shown.length) return null;
  return (
    <section>
      <h2 className={`${label} mb-2`}>Meeting flow</h2>
      <ol ref={listRef} className={full ? "space-y-1 p-0.5" : "relative max-h-[33vh] space-y-1 overflow-y-auto overscroll-contain p-0.5"}>
        {shown.map((i, n) => {
          const s = sections[i];
          const here = presences.filter((p) => !p.me && p.section_index === i);
          const done = completed.includes(i);
          return (
            <li key={i}>
              <button type="button" onClick={() => goto(i)} aria-current={i === index ? "step" : undefined}
                title={s.cue ? `${s.title}: reminder ${cueLabel(s.cue)}` : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm ${i === index ? "!bg-accent/10 font-semibold text-accent ring-1 ring-accent/30 dark:!bg-accent/20 dark:text-white" : "!bg-transparent text-slate-700 hover:!bg-neutral-100 dark:text-neutral-300 dark:hover:!bg-neutral-800"}`}>
                <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${i === index ? "bg-accent text-white" : done ? "bg-emerald-500 text-white" : "bg-neutral-200 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"}`}>
                  {done && i !== index ? <Check className="size-4" /> : n + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${done && i !== index ? "text-slate-500 dark:text-neutral-500" : ""}`}>{s.title}</span>
                  {s.when && <span className="flex items-center gap-1 truncate text-[11px] font-normal text-slate-500 dark:text-neutral-400"><Filter className="size-3 shrink-0" />For today's activity</span>}
                </span>
                {s.cue && <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" title={`Reminder ${cueLabel(s.cue)}`}><AlarmClock className="size-3" />{s.cue.from === "start" ? `${s.cue.minutes}′` : `−${Math.abs(s.cue.minutes)}′`}</span>}
                {s.activity && !picked && <span className="size-2 shrink-0 rounded-full bg-amber-500" title="Not picked yet" />}
                {here.map((p) => <Avatar key={p.user_id} person={p} size={20} className="ring-2 ring-white dark:ring-neutral-950" />)}
              </button>
            </li>
          );
        })}
        {/* room under the last sections, so even they can scroll up to the top */}
        {!full && <li aria-hidden="true" className="h-[calc(33vh-3.5rem)]" />}
      </ol>
    </section>
  );
}

export function ScriptView({ center, sections, shown, index, section, live, size, upNextIndex, goto, next, act, openSetup, flow }) {
  const kit = center.kit;
  if (!sections.length) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center">
        <ScrollText className="mx-auto size-10 text-slate-400" />
        <h1 className="mt-3 text-lg font-semibold">No script yet</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-neutral-400">
          {center.deck ? (kit.script_hidden ? "This deck runs from a document you can't read. A record keeper can share it with members in Group conscience > Documents."
            : center.can_edit ? "Pick the document this deck runs from with the gear above. It shows here a section at a time." : "Nobody has picked the document this deck runs from yet.")
            : kit.script_hidden ? "The script for this meeting is a document only record keepers can read. A host coordinator can set it to Hosts in Group conscience > Documents."
            : center.can_edit ? "Pick the group's format or script document, and it shows here a section at a time, cut at its sections (Insert > Add Section in the document) or its headings."
            : "A host coordinator hasn't picked this meeting's script yet. The chat postings and readings still work."}
        </p>
        {center.can_edit && <button type="button" className={`${primaryButton} mt-4`} onClick={openSetup}><Settings className="size-4" /> {center.deck ? "Pick the document" : "Set up this meeting"}</button>}
      </div>
    );
  }
  const done = live.completed.includes(index);
  const upNext = sections[upNextIndex];
  const first = index === shown[0];
  const html = fillValues(section.html, center, live, kit.service_roles);
  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-8 sm:py-8">
      {flow}
      <div className="mb-2 mt-4 flex items-center justify-between lg:mt-0">
        <p className={label}>Currently</p>
        <p className="text-sm tabular-nums text-slate-500 dark:text-neutral-400">{`${shown.indexOf(index) + 1} / ${shown.length}`}</p>
      </div>
      <h1 className="text-2xl font-bold sm:text-3xl">{section.title}</h1>
      {section.cue && (
        <p className="mt-2 flex flex-wrap gap-2 text-sm">
          {section.cue && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"><AlarmClock className="size-3.5" /> {cueLabel(section.cue)}{cueTime(section.cue, center.starts_at, center.ends_at) && ` · ${timeOf(new Date(cueTime(section.cue, center.starts_at, center.ends_at)).toISOString(), center.meeting.time_zone)}`}</span>}
        </p>
      )}
      {/* a meeting's day starts with picking its reading / activity and who does service */}
      {!center.deck && first && !section.activity && !live.activity && <div className="mt-4"><ActivityPicker center={center} act={act} early /></div>}
      {!center.deck && first && !section.activity && <div className="mt-4"><ServicePanel center={center} live={live} act={act} /></div>}
      {html.trim() && <ScriptText html={html} size={size} live={live} act={act} />}
      {section.activity && !center.deck && <div className="mt-4"><ActivityPanel center={center} live={live} act={act} size={size} /></div>}

      <div className="mt-8 border-t border-neutral-200 pt-5 dark:border-neutral-800">
        {upNext && (
          <>
            <p className={`${label} mb-2`}>Next up</p>
            <button type="button" onClick={() => goto(upNextIndex)} className="flex w-full items-center gap-3 rounded-xl !bg-white p-3 text-left shadow-panel ring-1 ring-neutral-200 hover:ring-accent/40 dark:!bg-neutral-900 dark:ring-neutral-800">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs font-semibold text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">{shown.indexOf(upNextIndex) + 1}</span>
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

// A form in the format (Insert > Milestone Form): an empty <div data-hc-form="milestones">
const FORM = /<div[^>]*\bdata-hc-form="([a-z_]+)"[^>]*>\s*<\/div>/gi;

// A stretch of the script's text. Kept as it is until the text itself changes: the Command
// Center re-renders every few seconds, and setting the same HTML again would close any
// collapsible text the host had opened.
const ScriptHtml = React.memo(function ScriptHtml({ html, size }) {
  return <div className="doc-prose hc-script" style={{ fontSize: size }} dangerouslySetInnerHTML={{ __html: html }} />;
});

// A section's text, with the forms in it ready to fill in where they sit
function ScriptText({ html, size, live, act }) {
  const parts = html.split(FORM); // text, form, text, form, ... text
  return (
    <div className="mt-4">
      {parts.map((part, i) => (i % 2
        ? <Milestones key={i} live={live} act={act} inScript />
        : part.trim() ? <ScriptHtml key={i} html={part} size={size} /> : null))}
    </div>
  );
}

// The readings the group keeps at hand: chapters from the library, or links
export function Readings({ kit, open, onOpen }) {
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
export function ReadingView({ reading, size, onClose }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-8 sm:py-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className={`${label} flex-1`}>Reading{reading.book_title ? ` · ${reading.book_title}` : ""}</p>
        <button type="button" className={quietButton} onClick={() => shareReading(reading)} title="Opens the reader in its own window, to share that window in Zoom"><Maximize2 className="size-4" /> Open to share</button>
        <button type="button" className={quietButton} onClick={onClose}><X className="size-4" /> Back to the script</button>
      </div>
      <h1 className="text-2xl font-bold sm:text-3xl">{reading.title}</h1>
      <ChapterText bookSlug={reading.book_slug} chapterSlug={reading.chapter_slug} size={size} />
    </div>
  );
}

// The day's reading / activity at the top of the left column: what's picked, or that it isn't yet
export function ActivityCard({ activity, open, onOpen }) {
  const Icon = activityIcon(activity);
  return (
    <section className="mb-6">
      <h2 className={`${label} mb-2`}>Today's reading / activity</h2>
      <button type="button" onClick={onOpen} aria-pressed={open}
        className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left text-sm ring-1 ${activity ? "!bg-white ring-neutral-200 dark:!bg-neutral-900 dark:ring-neutral-800" : "!bg-amber-50 ring-amber-200 dark:!bg-amber-950/30 dark:ring-amber-800/60"} ${open ? "!ring-2 !ring-accent" : ""}`}>
        <Icon className={`size-5 shrink-0 ${activity ? "text-accent" : "text-amber-600"}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{activity ? activityLabel(activity) : "Not picked yet"}</span>
          <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{activity ? `Picked by ${activity.by}` : "A reading, the Topicificator, a speaker…"}</span>
        </span>
        <ChevronRight className="size-4 text-slate-400" />
      </button>
    </section>
  );
}

// The quick actions a group can pick from (a block's settings.actions; all of them when it has none)
export const QUICK_ACTIONS = [
  ["court", "Send a court verification"], ["zoom_open", "Open the Zoom meeting"], ["zoom_copy", "Copy the Zoom link"],
  ["passcode", "Copy the passcode"], ["host_schedule", "Host schedule"], ["time_capsule", "Time Capsule"],
];

// Links and copy buttons the hosts reach for: the ones the block's settings keep, then its own links.
// In a sidebar a list, in the middle big buttons, in the bar a row of icons.
export function QuickActions({ center, settings = null, size = "side" }) {
  const [copied, setCopied] = useState(null);
  const on = (key) => !settings?.actions || settings.actions.includes(key);
  const passcode = center.meeting.conference_url_notes;
  const zoom = center.meeting.conference_url;
  const slug = center.group.slug;
  const items = [
    on("court") && { key: "court", icon: Gavel, text: "Send a court verification", href: center.court_url },
    zoom && on("zoom_open") && { key: "zoom_open", icon: Video, text: "Open the Zoom meeting", href: zoom },
    zoom && on("zoom_copy") && { key: "zoom_copy", icon: Clipboard, text: "Copy the Zoom link", copy: zoom },
    zoom && passcode && on("passcode") && { key: "passcode", icon: KeyRound, text: `Copy the passcode (${passcodeLabel(passcode)})`, copy: passcodeValue(passcode), wrap: true },
    on("host_schedule") && { key: "host_schedule", icon: UserCheck, text: "Host schedule", href: `/groups/${slug}/meetings`, ours: true },
    on("time_capsule") && { key: "time_capsule", icon: History, text: "Time Capsule", href: `/groups/${slug}/host/capsule?meeting=${center.meeting.id}`, ours: true },
    ...(settings?.links || []).map((l, i) => ({ key: `link-${i}`, icon: Link2, text: l.title || l.url.replace(/^https?:\/\//, ""), href: l.url, ours: true, outside: true })),
  ].filter(Boolean);
  if (!items.length) return null;
  const copy = (item) => copyText(item.copy).then(() => { setCopied(item.key); setTimeout(() => setCopied((k) => (k === item.key ? null : k)), 1500); });
  const linkProps = (item) => ({ href: item.href, target: "_blank", rel: item.ours && !item.outside ? "noopener" : "noopener noreferrer" });

  if (size === "bar") {
    return (
      <div className="flex items-center gap-0.5" role="group" aria-label="Quick actions">
        {items.map((item) => {
          const Icon = copied === item.key ? ClipboardCheck : item.icon;
          const props = { className: iconButton, title: copied === item.key ? "Copied" : item.text, "aria-label": item.text };
          return item.href ? <a key={item.key} {...linkProps(item)} {...props}><Icon className="size-5" /></a>
            : <button key={item.key} type="button" onClick={() => copy(item)} {...props}><Icon className={`size-5 ${copied === item.key ? "text-emerald-500" : ""}`} /></button>;
        })}
      </div>
    );
  }
  if (size === "main") {
    const big = "flex items-center gap-3 rounded-xl !bg-white p-4 text-left text-base font-medium shadow-panel ring-1 ring-neutral-200 hover:ring-accent/40 dark:!bg-neutral-900 dark:ring-neutral-800";
    return (
      <section>
        <h2 className={`${label} mb-2`}>Quick actions</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => {
            const Icon = copied === item.key ? ClipboardCheck : item.icon;
            const inner = <><Icon className={`size-6 shrink-0 ${copied === item.key ? "text-emerald-500" : "text-accent"}`} /><span className="min-w-0 flex-1 break-words">{copied === item.key ? "Copied" : item.text}</span>{item.ours && <ExternalLink className="size-4 text-slate-400" />}</>;
            return item.href ? <a key={item.key} {...linkProps(item)} className={big}>{inner}</a> : <button key={item.key} type="button" className={big} onClick={() => copy(item)}>{inner}</button>;
          })}
        </div>
      </section>
    );
  }
  const row = "flex w-full items-center gap-3 rounded-xl !bg-transparent px-2.5 py-2 text-left text-sm text-slate-700 hover:!bg-neutral-100 dark:text-neutral-300 dark:hover:!bg-neutral-800";
  return (
    <section>
      <h2 className={`${label} mb-2`}>Quick actions</h2>
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          if (item.href) {
            return item.ours
              ? <a key={item.key} {...linkProps(item)} className={row}><Icon className="size-5 shrink-0 text-slate-400" /> <span className="flex-1">{item.text}</span> <ExternalLink className="size-3.5 text-slate-400" /></a>
              : <a key={item.key} {...linkProps(item)} className={row}><Icon className="size-5 shrink-0 text-slate-400" /> {item.text}</a>;
          }
          const done = copied === item.key;
          return (
            <button key={item.key} type="button" className={row} onClick={() => copy(item)}>
              {done ? <ClipboardCheck className="size-5 shrink-0 text-emerald-500" /> : <Icon className="size-5 shrink-0 text-slate-400" />}
              {item.wrap ? <span className="min-w-0 flex-1 break-words">{done ? "Copied" : item.text}</span> : <> {done ? "Copied" : item.text}</>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// The postings to paste into the Zoom chat, in the order they go out. The next one due (by the
// meeting timer) stands out; a copied one says who copied it, for both hosts.
function usePostings(center, live, elapsed, act) {
  const [justCopied, setJustCopied] = useState(null);
  const kitPostings = center.kit.postings;
  // A reading picked from the hosts' own comes with its posting (what its page copies), first in the list
  const reading = useMemo(() => readingPosting(live.activity), [live.activity]);
  const postings = useMemo(() => (reading ? [reading, ...kitPostings] : kitPostings), [reading, kitPostings]);
  const due = useMemo(() => kitPostings.find((p) => elapsed != null && !live.posted[p.id] && p.minute * 60 <= elapsed), [kitPostings, live.posted, elapsed]);
  // The reading's text is already filled in; the kit's postings get the meeting's names
  const filled = (p) => (p.virtual ? p.body : fillPosting(p.body, center, live));
  const copy = async (p) => {
    await copyPosting(filled(p));
    setJustCopied(p.id);
    setTimeout(() => setJustCopied((id) => (id === p.id ? null : id)), 1800);
    act?.("posted", { posting_id: p.id });
  };
  return { postings, due, filled, copy, justCopied };
}

// `expanded`: what each one pastes shows without opening it (in the middle of a deck)
export function ChatPostings({ center, live, elapsed, act, expanded = false }) {
  const [openId, setOpenId] = useState(null);
  const { postings, due, filled, copy, justCopied } = usePostings(center, live, elapsed, act);
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
            const open = expanded ? openId !== p.id : openId === p.id;
            return (
              <li key={p.id} className={`rounded-xl bg-white shadow-panel ring-1 dark:bg-neutral-900 ${isDue ? "ring-2 ring-accent" : "ring-neutral-200 dark:ring-neutral-800"}`}>
                <div className="flex items-center gap-3 p-3">
                  <button type="button" onClick={() => setOpenId(openId === p.id ? null : p.id)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 !bg-transparent p-0 text-left" title="Show what gets pasted">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${posted ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-neutral-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"}`}>
                      <LucideIcon name={p.icon} fallback={MessageSquare} size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-mono text-xs tabular-nums text-slate-500 dark:text-neutral-400">{p.virtual ? <span className="font-sans font-semibold text-accent dark:text-sky-300">With today's reading</span> : mmss(p.minute * 60)}{isDue && <span className="ml-1.5 font-sans font-semibold text-accent dark:text-sky-300">Now</span>}</span>
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
                    <PostingPreview markdown={filled(p)} className="text-sm text-slate-700 dark:text-neutral-200" />
                    {posted && act && <button type="button" className="mt-2 !bg-transparent p-0 text-xs font-medium text-slate-500 hover:underline dark:text-neutral-400" onClick={() => act("unposted", { posting_id: p.id })}>Mark as not posted</button>}
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

// In the bottom bar: the posting that's due (else the next one not copied yet), to copy
export function ChatPostingBar({ center, live, elapsed, act }) {
  const { postings, due, copy, justCopied } = usePostings(center, live, elapsed, act);
  const p = due || postings.find((x) => !live.posted[x.id]);
  if (!postings.length) return <p className="text-sm text-slate-500 dark:text-neutral-400">No chat postings</p>;
  if (!p) return <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300"><ClipboardCheck className="size-4" /> Every posting is copied</p>;
  const isDue = due?.id === p.id;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"><LucideIcon name={p.icon} fallback={MessageSquare} size={16} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[11px] tabular-nums text-slate-500 dark:text-neutral-400">{p.virtual ? "With today's reading" : mmss(p.minute * 60)}{isDue && <span className="ml-1.5 font-sans font-semibold text-accent dark:text-sky-300">Now</span>}</span>
        <span className="block truncate text-sm font-semibold">{p.title}</span>
      </span>
      <button type="button" onClick={() => copy(p)} className={`${isDue ? primaryButton : quietButton} !px-3 !py-1.5`} aria-label={`Copy ${p.title}`}>
        {justCopied === p.id ? <><ClipboardCheck className="size-4" /> Copied</> : <><Clipboard className="size-4" /> Copy</>}
      </button>
    </div>
  );
}

// This date's short link, for the co-host: it opens the same day's Command Center for anyone who
// can host, and the chat postings (no account needed) for anyone else, unless the kit keeps them
// to hosts
export function ShareLink({ link }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}${link.path}`;
  const copy = () => copyText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  return (
    <div className="rounded-xl bg-white p-3 shadow-panel ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
      <h2 className={`${label} mb-1.5 flex items-center gap-1.5`}><Link2 className="size-3.5" /> Share with your co-host</h2>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-sm font-semibold tracking-wide" title={url}>{url.replace(/^https?:\/\//, "")}</code>
        <button type="button" className={`${quietButton} !px-3`} onClick={copy}>{copied ? <><ClipboardCheck className="size-4" /> Copied</> : <><Clipboard className="size-4" /> Copy</>}</button>
      </div>
      <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
        Just for this meeting's date. {link.public_postings ? "Hosts get this HostDeck. Anyone without an account can still see and copy the chat postings." : "It opens this HostDeck for hosts. The chat postings are kept to hosts."}
      </p>
    </div>
  );
}

// Who has the Command Center open and what they're on, who's celebrating, and what the hosts have done
export function People({ center, live, now, act }) {
  return (
    <section className="space-y-5">
      <ShareLink link={center.link} />
      <HostsHere live={live} now={now} />
      <Milestones live={live} act={act} />
      <ActivityLog live={live} />
    </section>
  );
}

// Who has the Command Center open, and what each of them is on
export function HostsHere({ live, now, ownDeck = false }) {
  return (
    <div>
      <h2 className={`${label} mb-2`}>{ownDeck ? "Who's here" : "Hosts here"}</h2>
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
      {live.presences.length < 2 && <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">{ownDeck ? "When someone else opens this deck, you'll see what they're on here." : "When the other host opens this meeting's HostDeck, you'll see what they're on here."}</p>}
    </div>
  );
}

// What the hosts have done so far (nothing shows until they've done something)
export function ActivityLog({ live }) {
  if (!live.log.length) return null;
  return (
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
  );
}
