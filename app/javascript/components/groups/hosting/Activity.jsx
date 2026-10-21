import React, { useEffect, useState } from "react";
import { BookMarked, BookOpen, CalendarDays, Dices, ExternalLink, Hash, Maximize2, Mic, Plus, Repeat, RefreshCw, Shuffle, Sparkles, TriangleAlert, Wind, X } from "lucide-react";
import { api } from "../lib";
import { inputClass, labelClass, selectClass } from "../../ui/styles";
import { ErrorNote, Loading, primaryButton, quietButton } from "../ui";
import FilterPick from "../../ui/FilterPick";
import { ACTIVITY_TITLE, activityLabel, chapterHtml, readerHref } from "./lib";

const label = "!text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400";
const KIND_ICONS = { reading: BookOpen, my_reading: BookMarked, daily: CalendarDays, topics: Dices, speaker: Mic, meditation: Wind, other: Sparkles };
export const activityIcon = (activity) => KIND_ICONS[activity?.kind] || Sparkles;

const getJson = (url) => fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("That chapter isn't in the library anymore."))));

// A library chapter as plain text to read from (and share on screen)
export function ChapterText({ bookSlug, chapterSlug, size }) {
  const [html, setHtml] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    setHtml(null);
    setError(null);
    getJson(`/api/books/${encodeURIComponent(bookSlug)}/chapters/${encodeURIComponent(chapterSlug)}`)
      .then((c) => setHtml(chapterHtml(c.tiptap_json)))
      .catch((e) => setError(e.message));
  }, [bookSlug, chapterSlug]);
  if (error) return <ErrorNote error={error} />;
  if (html == null) return <Loading />;
  return <div className="doc-prose hc-script mt-4" style={{ fontSize: size }} dangerouslySetInnerHTML={{ __html: html }} />;
}

export const shareReading = (r) => window.open(readerHref(r), "hosting-reading", "popup,width=1100,height=850");

// The script's reading / activity spot: the hosts pick what fills it today (it's shared with the
// other host), then read it from here. The format leaves the choice to the host.
export default function ActivityPanel({ center, live, act, size }) {
  const activity = live.activity;
  if (!activity) return <ActivityPicker center={center} act={act} />;

  const Icon = activityIcon(activity);
  const change = () => window.confirm("Pick something else for the reading / activity? Both hosts will see the change.") && act("clear_activity");
  const isReading = activity.kind === "reading" || activity.kind === "daily";
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent dark:bg-accent/20 dark:text-sky-200">
        <Icon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-medium">{activityLabel(activity)}</span>
        {activity.by && <span className="text-xs opacity-80">picked by {activity.by}</span>}
        {activity.kind === "my_reading" && activity.reading_published && <button type="button" className={`${quietButton} !px-2.5 !py-1 !text-xs`} onClick={() => shareReading({ url: activity.reading_path })} title="Opens the reading in its own window, to share that window in Zoom"><Maximize2 className="size-3.5" /> Open to share</button>}
        {isReading && <button type="button" className={`${quietButton} !px-2.5 !py-1 !text-xs`} onClick={() => shareReading(activity)} title="Opens the reader in its own window, to share that window in Zoom"><Maximize2 className="size-3.5" /> Open to share</button>}
        <button type="button" className={`${quietButton} !px-2.5 !py-1 !text-xs`} onClick={change}><Repeat className="size-3.5" /> Change</button>
      </div>

      {isReading && (
        <>
          <h2 className="mt-5 text-xl font-bold sm:text-2xl">{activity.title}</h2>
          {activity.book_title && <p className="text-sm text-slate-500 dark:text-neutral-400">{activity.book_title}</p>}
          <ChapterText bookSlug={activity.book_slug} chapterSlug={activity.chapter_slug} size={size} />
        </>
      )}
      {activity.kind === "my_reading" && <MyReading center={center} activity={activity} size={size} />}
      {activity.kind === "topics" && <Topics activity={activity} act={act} size={size} />}
      {["speaker", "meditation", "other"].includes(activity.kind) && (
        <>
          {activity.title && <h2 className="mt-5 text-xl font-bold sm:text-2xl">{activity.title}</h2>}
          {activity.note && <p className="mt-3 whitespace-pre-wrap" style={{ fontSize: size }}>{activity.note}</p>}
        </>
      )}
    </div>
  );
}

// Topics drawn from a Topicificator set, the latest one big, for both hosts
function Topics({ activity, act, size }) {
  const [number, setNumber] = useState("");
  const topics = activity.topics || [];
  const latest = topics[topics.length - 1];
  const byNumber = (e) => {
    e.preventDefault();
    if (!number.trim()) return;
    act("draw_topic", { number: number.trim() });
    setNumber("");
  };
  return (
    <div className="mt-5">
      {latest ? (
        <div className="rounded-2xl bg-white p-5 text-center shadow-panel ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
          {latest.number && <p className={label}>Topic {latest.number}</p>}
          <p className="mt-1 font-bold" style={{ fontSize: Math.round(size * 1.6) }}>{latest.title}</p>
          {latest.subtitle && <p className="mt-2 text-slate-600 dark:text-neutral-300" style={{ fontSize: size }}>{latest.subtitle}</p>}
        </div>
      ) : (
        <p className="text-sm text-slate-600 dark:text-neutral-300">Draw a topic from {activity.topic_set_name || "the set"}, at random or by its number.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={primaryButton} onClick={() => act("draw_topic")}><Shuffle className="size-4" /> {latest ? "Draw another" : "Draw a topic"}</button>
        <form onSubmit={byNumber} className="flex items-center gap-1.5">
          <label htmlFor="topic-number" className="sr-only">Topic number</label>
          <input id="topic-number" inputMode="numeric" className={`${inputClass} !w-24`} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Number" />
          <button type="submit" className={quietButton} disabled={!number.trim()}><Hash className="size-4" /> Pick</button>
        </form>
        <a href="/topicificator" target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">Open the Topicificator</a>
      </div>
      {topics.length > 1 && (
        <div className="mt-4">
          <p className={`${label} mb-1.5`}>Drawn today</p>
          <ul className="flex flex-wrap gap-1.5">
            {topics.slice(0, -1).reverse().map((t) => (
              <li key={t.id} className="inline-flex items-center gap-1 rounded-full bg-neutral-200 py-0.5 pl-2.5 pr-1 text-sm text-slate-700 dark:bg-neutral-800 dark:text-neutral-200">
                {t.title}
                <button type="button" aria-label={`Take ${t.title} off`} className="inline-grid size-5 place-items-center rounded-full !bg-transparent text-slate-500 hover:text-rose-600" onClick={() => act("drop_topic", { index: t.id })}><X className="size-3" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const tile = "flex items-start gap-3 rounded-xl !bg-white p-3 text-left shadow-panel ring-1 ring-neutral-200 hover:ring-accent/50 dark:!bg-neutral-900 dark:ring-neutral-800";
function Tile({ icon: Icon, title, text, onClick, pressed }) {
  return (
    <button type="button" className={`${tile} ${pressed ? "!ring-2 !ring-accent" : ""}`} onClick={onClick} aria-pressed={pressed}>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-neutral-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"><Icon className="size-5" /></span>
      <span className="min-w-0"><span className="block font-semibold">{title}</span>{text && <span className="block text-xs text-slate-500 dark:text-neutral-400">{text}</span>}</span>
    </button>
  );
}

// What can fill the spot: today's page of each daily book, a chapter from the literature, the
// Topicificator, a speaker, a meditation, or anything else
// Also on the script's first page, above the service form, until it's picked (`early`)
export function ActivityPicker({ center, act, early = false }) {
  const options = center.activity_options || { daily: [], books: [], topic_sets: [] };
  const [mode, setMode] = useState(null);
  const pick = (activity) => act("activity", { activity, label: ACTIVITY_TITLE });
  return (
    <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-800/60">
      <p className="font-semibold text-slate-900 dark:text-white">{early ? "Choose your meeting's reading / activity" : "Pick today's reading or activity"}</p>
      <p className="mt-0.5 text-sm text-slate-600 dark:text-neutral-300">{early ? "Pick it now, or when you get to it in the script. " : ""}Whatever you pick shows {early ? "at its spot in the script" : "here"} for both hosts, and fills <code className="text-xs">{"{{activity}}"}</code> in chat postings.</p>
      {center.previous?.length > 0 && (
        <div className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-600 dark:bg-neutral-900/60 dark:text-neutral-300">
          <span className="font-semibold">Recently at this meeting: </span>
          {center.previous.map((p, i) => (
            <span key={p.on}>{i > 0 && " · "}{p.label}{p.topics.length > 1 ? ` (+${p.topics.length - 1} more)` : ""} <span className="text-slate-400">({new Date(`${p.on}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })})</span></span>
          ))}
        </div>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.daily.map((d) => (
          <Tile key={d.book_slug} icon={CalendarDays} title={`Today's ${d.book_title.replace(/^The /, "")}`} text={d.title}
            onClick={() => pick({ kind: "daily", book_slug: d.book_slug, chapter_slug: d.chapter_slug, title: d.title, book_title: d.book_title })} />
        ))}
        <Tile icon={BookMarked} title="One of my readings" text="A reading saved on your account" onClick={() => setMode("my_reading")} pressed={mode === "my_reading"} />
        <Tile icon={BookOpen} title="A reading from the literature" text="A chapter of an approved book" onClick={() => setMode("reading")} pressed={mode === "reading"} />
        {options.topic_sets.length > 0 && <Tile icon={Dices} title="Topicificator" text="Draw topics for discussion" onClick={() => setMode("topics")} pressed={mode === "topics"} />}
        <Tile icon={Mic} title="Speaker" text="Someone shares their story" onClick={() => setMode("speaker")} pressed={mode === "speaker"} />
        <Tile icon={Wind} title="Meditation" onClick={() => setMode("meditation")} pressed={mode === "meditation"} />
        <Tile icon={Sparkles} title="Something else" onClick={() => setMode("other")} pressed={mode === "other"} />
      </div>
      {mode === "my_reading" && <MyReadingPick center={center} onPick={pick} />}
      {mode === "reading" && <ChapterPick books={options.books} onPick={pick} />}
      {mode === "topics" && <TopicSetPick sets={options.topic_sets} onPick={pick} />}
      {["speaker", "meditation", "other"].includes(mode) && <NotePick key={mode} kind={mode} onPick={pick} />}
    </div>
  );
}

const readingsUrl = (center, rest) => `/groups/${center.group.slug}/hosting/${center.meeting.id}/${rest}?on=${center.on}`;

// The signed-in host's own readings (the ones on /readings/mine), to pick one for today. The reading
// comes with the posting its page copies, in the chat postings. A new one is made on its own page, and
// the list reloads when the host comes back to this one.
function MyReadingPick({ center, onPick }) {
  const [readings, setReadings] = useState(null);
  const [error, setError] = useState(null);
  const [id, setId] = useState("");
  const load = () => api(readingsUrl(center, "my_readings")).then((r) => { setReadings(r.readings); setError(null); }).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    const onShow = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [center.group.slug, center.meeting.id, center.on]);
  const reading = readings?.find((r) => String(r.id) === id);
  return (
    <div className="mt-3 space-y-2">
      <ErrorNote error={error} />
      {readings && readings.length === 0 && <p className="text-sm text-slate-600 dark:text-neutral-300">You haven't saved a reading yet. Make one, then come back here.</p>}
      {readings && readings.length > 0 && (
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="act-my-reading" className={labelClass}>Your readings</label>
            <FilterPick id="act-my-reading" value={id} onChange={(v) => setId(String(v))} placeholder="Type to find a reading" empty="None of your readings match"
              options={readings.map((r) => ({ value: String(r.id), label: `${r.title || "Untitled"}${r.status !== "published" ? ` (${r.status})` : ""}`, hint: r.meeting_name }))} />
          </div>
          <button type="button" className={`${primaryButton} mt-[1.375rem]`} disabled={!reading} onClick={() => onPick({ kind: "my_reading", reading_id: reading.id })}>Use it</button>
        </div>
      )}
      {readings === null && !error && <Loading />}
      {reading && reading.status !== "published" && <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-200"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> This reading is a {reading.status}. The link in the chat only opens for you until you publish it.</p>}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <a href="/readings/new" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline"><Plus className="size-3.5" /> Create a new reading <ExternalLink className="size-3" /></a>
        <button type="button" className="inline-flex items-center gap-1 !bg-transparent p-0 text-slate-600 hover:underline dark:text-neutral-300" onClick={load}><RefreshCw className="size-3.5" /> Refresh the list</button>
      </div>
    </div>
  );
}

// One of the hosts' own readings, in the middle: its text and, under it, the example topics. It is
// fetched from the Command Center (it only gives the one picked for today, so another host's draft
// is readable here without its page being open to them).
function MyReading({ center, activity, size }) {
  const [reading, setReading] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    setReading(null);
    setError(null);
    api(readingsUrl(center, "reading")).then(setReading).catch((e) => setError(e.message));
  }, [center.group.slug, center.meeting.id, center.on, activity.reading_id]);
  return (
    <>
      <h2 className="mt-5 text-xl font-bold sm:text-2xl">{activity.title}</h2>
      {!activity.reading_published && (
        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-amber-50 p-2.5 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><TriangleAlert className="mt-0.5 size-4 shrink-0" /> This reading isn't published, so the link in the chat only opens for its owner. Publish it to share the link.</p>
      )}
      {error && <div className="mt-3"><ErrorNote error={error} /></div>}
      {!reading && !error && <Loading />}
      {reading && (
        <>
          <div className="doc-prose hc-script mt-4" style={{ fontSize: size }} dangerouslySetInnerHTML={{ __html: reading.html ?? chapterHtml(reading.tiptap) }} />
          {reading.source && <p className="mt-3 italic text-slate-600 dark:text-neutral-300" style={{ fontSize: size }}>{reading.source}</p>}
          {reading.topics_html && (
            <div className="mt-6 rounded-2xl bg-white p-4 shadow-panel ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
              <p className={`${label} mb-2`}>Example topics for sharing</p>
              <div className="doc-prose hc-script" style={{ fontSize: size }} dangerouslySetInnerHTML={{ __html: reading.topics_html }} />
            </div>
          )}
        </>
      )}
    </>
  );
}

function ChapterPick({ books, onPick }) {
  const [bookSlug, setBookSlug] = useState(books[0]?.slug || "");
  const [chapters, setChapters] = useState(null);
  const [chapterSlug, setChapterSlug] = useState("");
  useEffect(() => {
    setChapters(null);
    setChapterSlug("");
    if (bookSlug) getJson(`/api/books/${encodeURIComponent(bookSlug)}/chapters`).then((l) => setChapters(Array.isArray(l) ? l : [])).catch(() => setChapters([]));
  }, [bookSlug]);
  if (!books.length) return <p className="mt-3 text-sm text-slate-600 dark:text-neutral-300">There are no books in the library yet.</p>;
  const chapter = chapters?.find((c) => c.slug === chapterSlug);
  const book = books.find((b) => b.slug === bookSlug);
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-start">
      <div><label htmlFor="act-book" className={labelClass}>Book</label><select id="act-book" className={selectClass} value={bookSlug} onChange={(e) => setBookSlug(e.target.value)}>{books.map((b) => <option key={b.slug} value={b.slug}>{b.title}</option>)}</select></div>
      <div><label htmlFor="act-chapter" className={labelClass}>Chapter</label>
        <FilterPick id="act-chapter" value={chapterSlug} onChange={setChapterSlug} disabled={!chapters} placeholder={chapters ? "Type to find a chapter" : "Loading…"} empty="No chapters match"
          options={(chapters || []).map((c) => ({ value: c.slug, label: c.title || c.label || c.slug }))} />
      </div>
      <button type="button" className={`${primaryButton} sm:mt-[1.375rem]`} disabled={!chapter}
        onClick={() => onPick({ kind: "reading", book_slug: bookSlug, chapter_slug: chapter.slug, title: chapter.title || chapter.label || chapter.slug, book_title: book?.title })}>Use it</button>
    </div>
  );
}

function TopicSetPick({ sets, onPick }) {
  const [id, setId] = useState(String(sets[0]?.id || ""));
  const set = sets.find((s) => String(s.id) === id);
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1"><label htmlFor="act-set" className={labelClass}>Topic set</label><select id="act-set" className={selectClass} value={id} onChange={(e) => setId(e.target.value)}>{sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <button type="button" className={primaryButton} disabled={!set} onClick={() => onPick({ kind: "topics", topic_set_id: set.id, topic_set_name: set.name })}>Use it</button>
    </div>
  );
}

const NOTE_LABELS = {
  speaker: ["Speaker's name", "First name, last initial", "Anything to say about them (optional)"],
  meditation: ["Title (optional)", "e.g. Eleventh Step meditation", "Notes or what to read (optional)"],
  other: ["What it is", "e.g. Step study: Step Three", "Notes (optional)"],
};

function NotePick({ kind, onPick }) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [titleLabel, placeholder, noteLabel] = NOTE_LABELS[kind];
  const needsTitle = kind !== "meditation";
  return (
    <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); onPick({ kind, title, note }); }}>
      <div><label htmlFor="act-title" className={labelClass}>{titleLabel}</label><input id="act-title" className={inputClass} maxLength={160} required={needsTitle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder} /></div>
      <div><label htmlFor="act-note" className={labelClass}>{noteLabel}</label><textarea id="act-note" rows={3} maxLength={1000} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <button type="submit" className={primaryButton} disabled={needsTitle && !title.trim()}>Use it</button>
    </form>
  );
}
