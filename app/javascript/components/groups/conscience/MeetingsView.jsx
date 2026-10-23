import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarPlus, FileCheck2, FileText, FileUp, MonitorPlay, Search } from "lucide-react";
import { api } from "../lib";
import { Card, ErrorNote, Loading, Pill, Tray, primaryButton, quietButton } from "../ui";
import MeetingForm from "./MeetingForm";
import MinutesImport from "./MinutesImport";
import RulesTable from "./RulesTable";
import { inputClass, selectClass } from "../../ui/styles";
import { KIND_INFO, dateLabel, documentsPath, longDate, meetingsPath } from "./lib";

// The words of a search, for marking them in the text that matched
const searchWords = (query) => [...new Set(query.toLowerCase().match(/[\p{L}\p{N}'’&$#-]+/gu) || [])];

const escapeRegExp = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function Marked({ text, words }) {
  if (!words.length) return text;
  const pattern = new RegExp(`(${words.map(escapeRegExp).join("|")})`, "giu");
  return text.split(pattern).map((part, i) => (i % 2 ? <mark key={i} className="rounded bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-500/30">{part}</mark> : part));
}

function Row({ slug, m, keeper, words }) {
  const minutes = m.minutes_status === "draft" ? (keeper && m.status === "held" ? <Pill tone="amber">Minutes in draft</Pill> : null) : <Pill tone="green"><FileCheck2 className="size-3" /> Minutes {m.minutes_status}</Pill>;
  return (
    <Link to={meetingsPath(slug, m.id)} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-white p-3 shadow-panel hover:ring-1 hover:ring-accent/40 dark:bg-neutral-900">
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-slate-900 dark:text-white">{m.starts_at ? m.when_label : longDate(m.held_on)}</span>
        <span className="block text-xs text-slate-500 dark:text-neutral-400">
          {[m.meeting && `After ${m.meeting.name}`, `${m.agenda_count} on the agenda`, m.motions_count ? `${m.motions_count} ${m.motions_count === 1 ? "decision" : "decisions"}` : null, m.attendance_count != null ? `${m.attendance_count} came` : null].filter(Boolean).join(" · ")}
        </span>
      </span>
      {m.status === "cancelled" && <Pill tone="slate">Cancelled</Pill>}
      {m.status === "planned" && <Pill tone="accent">Planned</Pill>}
      {m.visibility === "keepers" && <Pill tone="amber">Record keepers</Pill>}
      {minutes}
      {m.hits?.length > 0 && (
        <span className="block w-full space-y-1 border-t border-neutral-100 pt-2 dark:border-neutral-800">
          {m.hits.map((h, i) => (
            <span key={i} className="block text-sm text-slate-600 dark:text-neutral-300">
              <span className="mr-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-neutral-500">{h.label}</span>
              <Marked text={h.text} words={words} />
            </span>
          ))}
        </span>
      )}
    </Link>
  );
}

// What a search of the business meetings turns up: meetings by their minutes, agenda and
// decisions, and the group's documents too (they're often what a meeting talked about)
function SearchResults({ slug, query, keeper }) {
  const [found, setFound] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    const q = encodeURIComponent(query);
    let live = true;
    const t = setTimeout(() => {
      Promise.all([api(`/groups/${slug}/business_meetings?q=${q}`), api(`/groups/${slug}/documents?q=${q}`)])
        .then(([meetings, documents]) => live && (setError(null), setFound({ query, meetings: meetings.meetings, documents: documents.documents })))
        .catch((e) => live && setError(e.message));
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [slug, query]);

  if (error) return <ErrorNote error={error} />;
  if (!found) return <Loading />;
  const words = searchWords(found.query);
  const { meetings, documents } = found;
  return (
    <div className={`space-y-5 ${found.query === query ? "" : "opacity-60"}`}>
      <Tray label={`${meetings.length} ${meetings.length === 1 ? "meeting" : "meetings"}`}>
        <div className="space-y-1.5">
          {meetings.length === 0 && <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">No minutes, agenda or decisions mention “{found.query}”.</Card>}
          {meetings.map((m) => <Row key={m.id} slug={slug} m={m} keeper={keeper} words={words} />)}
        </div>
      </Tray>
      <Tray label={`${documents.length} ${documents.length === 1 ? "document" : "documents"}`}>
        <div className="space-y-1.5">
          {documents.length === 0 && <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">No documents mention “{found.query}”.</Card>}
          {documents.map((d) => (
            <Link key={d.id} to={documentsPath(slug, d.id)} className="flex items-start gap-3 rounded-xl bg-white p-3 shadow-panel hover:ring-1 hover:ring-accent/40 dark:bg-neutral-900">
              <FileText className="mt-0.5 size-4 shrink-0 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-slate-900 dark:text-white"><Marked text={d.title} words={words} /></span>
                <span className="block text-xs text-slate-500 dark:text-neutral-400">{[KIND_INFO[d.kind]?.label, d.file?.name, `Updated ${dateLabel(d.updated_at)}`].filter(Boolean).join(" · ")}</span>
                {d.excerpt && <span className="mt-0.5 block truncate text-sm text-slate-600 dark:text-neutral-300"><Marked text={d.excerpt} words={words} /></span>}
              </span>
            </Link>
          ))}
        </div>
      </Tray>
    </div>
  );
}

// The group's quorum, from its bylaws: a number of people or a share of the members. Group admins
// set it; a meeting with fewer people than that is flagged, and so is business done without one.
function QuorumCard({ group, quorum, canSet, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState(quorum.percent ? "percent" : "count");
  const [value, setValue] = useState(quorum.percent || quorum.count || "");
  const [error, setError] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const n = value === "" ? null : Number(value);
      await api(`/groups/${group.slug}`, { method: "PATCH", body: { group: { quorum_count: mode === "count" ? n : null, quorum_percent: mode === "percent" ? n : null } } });
      setEditing(false);
      onSaved();
    } catch (err) { setError(err.message); }
  };
  return (
    <Card className="flex flex-wrap items-center gap-3 p-3">
      <p className="min-w-0 flex-1 text-sm text-slate-700 dark:text-neutral-200">
        <span className="font-medium text-slate-900 dark:text-white">Quorum:</span>{" "}
        {quorum.needed ? `${quorum.needed} ${quorum.needed === 1 ? "person" : "people"}${quorum.percent ? ` (${quorum.percent}% of the members)` : ""}` : "not set"}
        <span className="text-xs text-slate-500 dark:text-neutral-400"> · what the bylaws ask for; business needs one</span>
      </p>
      {canSet && !editing && <button type="button" className={quietButton} onClick={() => setEditing(true)}>{quorum.needed ? "Change" : "Set it"}</button>}
      {editing && (
        <form onSubmit={save} className="flex w-full flex-wrap items-center gap-2">
          <select aria-label="Quorum is" className={`${selectClass} !w-auto`} value={mode} onChange={(e) => setMode(e.target.value)}><option value="count">A number of people</option><option value="percent">A share of the members (%)</option></select>
          <input aria-label="Quorum" type="number" min="1" max={mode === "percent" ? 100 : 9999} className={`${inputClass} !w-28`} value={value} onChange={(e) => setValue(e.target.value)} />
          <button type="submit" className={primaryButton}>Save</button>
          <button type="button" className={quietButton} onClick={() => setEditing(false)}>Cancel</button>
          {error && <span role="alert" className="text-xs text-rose-700">{error}</span>}
        </form>
      )}
    </Card>
  );
}

// Business meetings (/conscience/meetings): coming up first, then past ones with their minutes
// The group's business meeting decks (HostDeck), so everyone at the meeting can follow along,
// not only the members who host
function BusinessDecks({ slug }) {
  const [decks, setDecks] = useState([]);
  useEffect(() => { api(`/groups/${slug}/decks`).then((d) => setDecks(d.decks.filter((x) => x.purpose === "business_meeting"))).catch(() => {}); }, [slug]);
  if (!decks.length) return null;
  return (
    <Tray label="Run it in HostDeck">
      <div className="space-y-1.5">
        {decks.map((d) => (
          <Link key={d.id} to={`/${slug}/decks/${d.id}`} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-panel hover:ring-1 hover:ring-accent/40 dark:bg-neutral-900">
            <MonitorPlay className="size-5 shrink-0 text-accent" />
            <span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-white">{d.name}</span>
            <span className="text-xs text-slate-500 dark:text-neutral-400">Everyone in the group can open it</span>
          </Link>
        ))}
      </div>
    </Tray>
  );
}

export default function MeetingsView({ group }) {
  const slug = group.slug;
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [scheduling, setScheduling] = useState(false);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState("");
  const load = useCallback(() => api(`/groups/${slug}/business_meetings`).then(setData).catch((e) => setError(e.message)), [slug]);
  useEffect(() => { load(); }, [load]);

  if (!data) return error ? <ErrorNote error={error} /> : <Loading />;
  const today = new Date().toLocaleDateString("en-CA");
  const coming = data.meetings.filter((m) => m.status === "planned" && m.held_on >= today).reverse();
  const past = data.meetings.filter((m) => !coming.includes(m));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-slate-600 dark:text-neutral-300">Each business meeting has an agenda anyone in the group can add to, and minutes once they're posted.</p>
        {data.can_edit && !importing && <button type="button" onClick={() => setImporting(true)} className={quietButton}><FileUp className="size-4" /> Import old minutes</button>}
        {data.can_edit && !scheduling && <button type="button" onClick={() => setScheduling(true)} className={primaryButton}><CalendarPlus className="size-4" /> Schedule a meeting</button>}
      </div>
      {importing && <MinutesImport group={group} onClose={() => setImporting(false)} onDone={load} />}
      {scheduling && (
        <MeetingForm group={group} regular={data.regular_meetings} canMakeEvents={data.can_make_events} onCancel={() => setScheduling(false)} onSaved={(m) => navigate(meetingsPath(slug, m.id))} />
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input type="search" aria-label="Search minutes, agendas, decisions and documents" className={`${inputClass} !pl-9`} placeholder="Search minutes, agendas, decisions and documents" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {query.trim() ? <SearchResults slug={slug} query={query.trim()} keeper={data.can_edit} /> : (
      <>
      <QuorumCard group={group} quorum={data.quorum} canSet={data.can_make_events} onSaved={load} />
      <BusinessDecks slug={slug} />
      {data.meetings.length === 0 && (
        <Card className="p-5 text-sm text-slate-600 dark:text-neutral-300">
          {data.can_edit ? "No business meetings yet. Schedule the next one, or add one that already happened to keep its minutes here." : "No business meetings have been scheduled yet."}
        </Card>
      )}
      {coming.length > 0 && <Tray label="Coming up"><div className="space-y-1.5">{coming.map((m) => <Row key={m.id} slug={slug} m={m} keeper={data.can_edit} />)}</div></Tray>}
      {past.length > 0 && <Tray label="Past meetings"><div className="space-y-1.5">{past.map((m) => <Row key={m.id} slug={slug} m={m} keeper={data.can_edit} />)}</div></Tray>}
      <RulesTable kinds={data.kinds} groups={data.groups} />
      </>
      )}
    </div>
  );
}
