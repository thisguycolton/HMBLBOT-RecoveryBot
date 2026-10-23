import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ClipboardCheck, History, PartyPopper, UserCheck, Users } from "lucide-react";
import { api } from "../lib";
import { Card, ErrorNote, Loading, quietButton } from "../ui";
import { selectClass } from "../../ui/styles";
import { activityIcon } from "./Activity";
import { timeOf } from "./parts";

const label = "!text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400";

// /groups/:slug/host/capsule (?meeting=ID for one meeting): the RecoveryBot Time Capsule. Every
// meeting the hosts ran from the Command Center, newest first: the reading or activity they picked
// (and the topics drawn), who did service, who celebrated, and what the hosts did.
export default function TimeCapsule() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const meeting = params.get("meeting") || "";
  const [meetings, setMeetings] = useState([]);
  const [sessions, setSessions] = useState(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { api(`/groups/${slug}/hosting`).then((d) => setMeetings(d.meetings)).catch(() => {}); }, [slug]);
  useEffect(() => {
    setError(null);
    api(`/groups/${slug}/hosting/capsule?page=${page}${meeting ? `&meeting_id=${meeting}` : ""}`)
      .then((d) => { setSessions((list) => (page === 1 ? d.sessions : [...(list || []), ...d.sessions])); setMore(d.more); })
      .catch((e) => setError(e.message));
  }, [slug, meeting, page]);
  const pick = (id) => { setSessions(null); setPage(1); setParams(id ? { meeting: id } : {}); };

  return (
    <div className="mx-auto max-w-3xl space-y-5 !font-sans [&_*]:!font-sans">
      <Link to={`/${slug}/host`} className="text-sm text-slate-500 hover:text-accent dark:text-neutral-400">← HostDeck</Link>
      <div>
        <h1 className="flex items-center gap-2 !text-2xl font-bold text-slate-900 dark:text-white"><History className="size-6 text-accent" /> Time Capsule</h1>
        <p className="mt-1 !text-left text-sm text-slate-600 dark:text-neutral-300">The meetings hosts ran from HostDeck: what was read, the topics, who did service and who celebrated. Only the group's hosts see this.</p>
      </div>
      {meetings.length > 1 && (
        <select aria-label="Meeting" className={`${selectClass} sm:!w-auto`} value={meeting} onChange={(e) => pick(e.target.value)}>
          <option value="">Every meeting</option>
          {meetings.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      )}
      <ErrorNote error={error} />
      {!sessions ? <Loading /> : sessions.length === 0 ? (
        <Card className="p-5 text-sm text-slate-600 dark:text-neutral-400">Nothing here yet. Once hosts pick a reading or activity, fill in service or add milestones in HostDeck, the meeting is kept here.</Card>
      ) : (
        <ol className="relative space-y-4 border-l-2 border-neutral-200 pl-5 dark:border-neutral-800">
          {sessions.map((s) => <Entry key={s.id} s={s} />)}
        </ol>
      )}
      {more && <button type="button" className={`${quietButton} w-full`} onClick={() => setPage(page + 1)}>Show older meetings</button>}
    </div>
  );
}

function Entry({ s }) {
  const Icon = activityIcon(s.activity);
  const topics = s.activity?.kind === "topics" ? s.activity.topics || [] : [];
  const hosts = [s.hosts.host && `Host: ${s.hosts.host}`, s.hosts.co_host && `Co-host: ${s.hosts.co_host}`].filter(Boolean).join(" · ");
  return (
    <li className="relative">
      <span className="absolute -left-[1.85rem] top-4 size-3 rounded-full bg-accent ring-4 ring-neutral-50 dark:ring-neutral-950" aria-hidden="true" />
      <Card className="space-y-3 p-4">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {new Date(`${s.on}T12:00:00`).toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
          <p className="text-xs text-slate-500 dark:text-neutral-400">{s.meeting.name}{s.starts_at && ` · ${timeOf(s.starts_at, s.time_zone)}`}{hosts && <> · <UserCheck className="mb-0.5 inline size-3" /> {hosts}</>}</p>
        </div>
        {s.activity ? (
          <div className="flex items-start gap-3 rounded-xl bg-accent/5 p-3 dark:bg-accent/15">
            <Icon className="mt-0.5 size-5 shrink-0 text-accent" />
            <div className="min-w-0">
              <p className="font-medium text-slate-900 dark:text-white">{s.activity_label}</p>
              {s.activity.book_title && <p className="text-xs text-slate-500 dark:text-neutral-400">{s.activity.book_title}</p>}
              {s.activity.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-neutral-300">{s.activity.note}</p>}
              {topics.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">{topics.map((t) => <li key={t.id} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-slate-700 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700">{t.number ? `${t.number}. ` : ""}{t.title}</li>)}</ul>
              )}
              {s.activity.by && <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Picked by {s.activity.by}</p>}
            </div>
          </div>
        ) : <p className="text-sm italic text-slate-500 dark:text-neutral-400">No reading or activity was picked.</p>}
        {s.service.length > 0 && (
          <div>
            <p className={`${label} mb-1 flex items-center gap-1`}><Users className="size-3.5" /> Service</p>
            <p className="text-sm text-slate-700 dark:text-neutral-200">{s.service.map((x) => `${x.label}: ${x.name}`).join(" · ")}</p>
          </div>
        )}
        {s.milestones.length > 0 && (
          <div>
            <p className={`${label} mb-1 flex items-center gap-1`}><PartyPopper className="size-3.5" /> Celebrated</p>
            <ul className="flex flex-wrap gap-1.5">{s.milestones.map((m, i) => <li key={i} className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">{m.name}{m.length && ` · ${m.length}`}</li>)}</ul>
          </div>
        )}
        {(s.log.length > 0 || s.posted > 0) && (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-accent dark:text-neutral-400">
              <ClipboardCheck className="mb-0.5 mr-1 inline size-3.5" />What the hosts did{s.posted > 0 && ` · ${s.posted} chat ${s.posted === 1 ? "posting" : "postings"} copied`}
            </summary>
            <ul className="mt-2 space-y-1">
              {s.log.map((l, i) => (
                <li key={i} className="flex gap-2 text-slate-700 dark:text-neutral-300">
                  <span className="w-16 shrink-0 text-xs tabular-nums leading-5 text-slate-500">{timeOf(l.at, s.time_zone).replace(/\s\S+$/, "")}</span>
                  <span><span className="font-medium">{l.by}</span> {l.text.charAt(0).toLowerCase() + l.text.slice(1)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>
    </li>
  );
}
