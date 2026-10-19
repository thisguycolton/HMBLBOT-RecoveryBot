import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CalendarDays, CalendarPlus, ExternalLink, FileText, Gavel, HandHelping, Landmark, Scale, UserCheck, Users } from "lucide-react";
import { api } from "../lib";
import { Card, ErrorNote, Loading, Pill, Tray, primaryButton } from "../ui";
import { AgendaList, SuggestForm } from "./AgendaParts";
import { KIND_INFO, MOTION_STATUS_LABELS, countLabel, dateLabel, decisionsPath, documentsPath, longDate, meetingsPath, officialsPath, treasuryPath } from "./lib";

// A number across the top of the group dashboard, like the site admin's StatTile
const Stat = ({ to, icon: Icon, label, value, detail }) => (
  <Link to={to} className="block min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5 hover:border-accent/50 dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
    <span className="mb-4 hidden size-11 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-200 sm:grid"><Icon className="size-5" /></span>
    <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400 sm:text-sm"><Icon className="size-3.5 shrink-0 sm:hidden" />{label}</span>
    <span className="mt-1 block text-2xl font-bold tabular-nums text-slate-900 dark:text-white sm:text-3xl">{value}</span>
    {detail && <span className="mt-1 block text-xs text-slate-500 dark:text-neutral-400 sm:text-sm">{detail}</span>}
  </Link>
);

const Row = ({ to, icon: Icon, title, note, right }) => (
  <Link to={to} className="flex items-start gap-3 rounded-xl bg-white p-3 shadow-panel hover:ring-1 hover:ring-accent/40 dark:bg-neutral-900">
    {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-accent" />}
    <span className="min-w-0 flex-1">
      <span className="block font-medium text-slate-900 dark:text-white">{title}</span>
      {note && <span className="block text-xs text-slate-500 dark:text-neutral-400">{note}</span>}
    </span>
    {right}
  </Link>
);

// Group conscience at a glance (/groups/:slug/conscience): the next business meeting with its
// agenda, what's waiting on a record keeper, recent decisions, pinned documents and who needs
// replacing in service
export default function OverviewView({ group }) {
  const slug = group.slug;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => api(`/groups/${slug}/conscience`).then(setData).catch((e) => setError(e.message)), [slug]);
  useEffect(() => { load(); }, [load]);

  if (!data) return error ? <ErrorNote error={error} /> : <Loading />;
  const next = data.next_meeting;
  const waiting = data.waiting;
  const waitingCount = waiting ? waiting.draft_minutes.length + waiting.suggested_items.length + waiting.draft_documents.length + waiting.draft_reports.length : 0;

  const st = data.stats;
  return (
    <div className="space-y-5">
      {st && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Stat to={group.can_manage ? `/${slug}/conscience/members` : `/${slug}/members`} icon={Users} label="Members" value={st.members} detail={st.requests ? `${st.requests} asking to join` : "No one waiting to join"} />
          <Stat to={decisionsPath(slug)} icon={Gavel} label="Standing decisions" value={st.standing_decisions} detail={st.decisions_to_check ? `${st.decisions_to_check} imported, waiting to be checked` : "Everything checked"} />
          <Stat to={meetingsPath(slug)} icon={CalendarDays} label="Business meetings held" value={st.business_meetings} detail={next ? `Next: ${longDate(next.held_on)}` : "None scheduled"} />
          <Stat to={treasuryPath(slug)} icon={Landmark} label="Last treasurer's report" value={st.last_report_on ? new Date(`${st.last_report_on}T00:00:00`).toLocaleDateString([], { month: "short", year: "numeric" }) : "None"} detail={waiting?.draft_reports?.length ? `${waiting.draft_reports.length} in draft` : "Posted reports"} />
        </div>
      )}
      <Tray label="Next business meeting">
        <Card className="space-y-4 p-4 sm:p-5">
          {next ? (
            <>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-[min(100%,15rem)] flex-1">
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">{next.starts_at ? next.when_label : longDate(next.held_on)}</p>
                  {next.meeting && <p className="text-sm text-slate-500 dark:text-neutral-400">After {next.meeting.name}</p>}
                </div>
                {next.event && <a href={next.event.path} className="inline-flex items-center gap-1 text-sm text-accent hover:underline">The event <ExternalLink className="size-3.5" /></a>}
                <Link to={meetingsPath(slug, next.id)} className={primaryButton}><CalendarClock className="size-4" /> Open the meeting</Link>
              </div>
              <div>
                <h3 className="mb-2 !text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Agenda so far</h3>
                <AgendaList items={next.agenda.filter((i) => i.status !== "suggested")} empty="Nothing on the agenda yet." />
              </div>
              <div className="border-t border-neutral-100 pt-4 dark:border-neutral-800">
                <SuggestForm slug={slug} meetingId={next.id} onAdded={load} />
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-sm text-slate-600 dark:text-neutral-300">No business meeting is scheduled.</p>
              {data.can_edit && <Link to={meetingsPath(slug)} className={primaryButton}><CalendarPlus className="size-4" /> Schedule one</Link>}
            </div>
          )}
        </Card>
      </Tray>

      {data.hosts_open && data.hosts_open.open_hosts + data.hosts_open.open_co_hosts > 0 && (
        <Tray label="Hosts">
          <Row to={`/${slug}/hosts`} icon={UserCheck} title={`${data.hosts_open.open_hosts + data.hosts_open.open_co_hosts} host places are open`}
            note={`${data.hosts_open.open_hosts} hosts and ${data.hosts_open.open_co_hosts} co-hosts needed across the week`} />
        </Tray>
      )}

      {waiting && waitingCount > 0 && (
        <Tray label={`Waiting on you (${waitingCount})`}>
          <div className="space-y-1.5">
            {waiting.suggested_items.map((i) => <Row key={`i${i.id}`} to={meetingsPath(slug, i.meeting_id)} icon={CalendarClock} title={`Suggested for ${dateLabel(i.held_on)}: ${i.title}`} note="Put it on the agenda or decline it" />)}
            {waiting.draft_minutes.map((m) => <Row key={`m${m.id}`} to={meetingsPath(slug, m.id)} icon={CalendarClock} title={`Minutes for ${dateLabel(m.held_on)} aren't posted`} note="Still a draft" />)}
            {waiting.draft_documents.map((d) => <Row key={`d${d.id}`} to={documentsPath(slug, d.id)} icon={FileText} title={d.title} note="A draft document" />)}
            {waiting.draft_reports.map((r) => <Row key={`r${r.id}`} to={treasuryPath(slug, r.id)} icon={Scale} title={`Treasurer's report for ${dateLabel(r.period_on)}`} note="Not posted yet" />)}
          </div>
        </Tray>
      )}

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Tray label="Recent decisions" action={<Link to={`/${slug}/conscience/decisions`} className="text-xs font-medium text-accent hover:underline">All decisions</Link>}>
          <div className="space-y-1.5">
            {data.recent_decisions.length === 0 && <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">Nothing decided yet.</Card>}
            {data.recent_decisions.map((m) => (
              <Row key={m.id} to={decisionsPath(slug, m.id)} icon={Scale} title={m.title}
                note={[m.decided_on && dateLabel(m.decided_on), countLabel(m)].filter(Boolean).join(" · ")}
                right={m.status === "failed" ? <Pill tone="amber">{MOTION_STATUS_LABELS[m.status]}</Pill> : !m.standing ? <Pill>Replaced</Pill> : null} />
            ))}
          </div>
        </Tray>

        <div className="space-y-5">
          {data.pinned_documents.length > 0 && (
            <Tray label="Pinned documents" action={<Link to={documentsPath(slug)} className="text-xs font-medium text-accent hover:underline">All documents</Link>}>
              <div className="space-y-1.5">
                {data.pinned_documents.map((d) => <Row key={d.id} to={documentsPath(slug, d.id)} icon={KIND_INFO[d.kind]?.icon || FileText} title={d.title} note={d.excerpt || d.file?.name} />)}
              </div>
            </Tray>
          )}
          {data.service.length > 0 && (
            <Tray label="Elected officials" action={<Link to={officialsPath(slug)} className="text-xs font-medium text-accent hover:underline">All officials</Link>}>
              <div className="space-y-1.5">
                {data.service.map((p) => (
                  <Row key={p.id} to={officialsPath(slug)} icon={HandHelping} title={p.title}
                    note={p.rotation === "vacant" ? "Nobody serves in it now" : `${p.current.name}'s term ends ${dateLabel(p.current.ends_on)}`}
                    right={<Pill tone="amber">{p.rotation === "vacant" ? "Needs someone" : "Term ending"}</Pill>} />
                ))}
              </div>
            </Tray>
          )}
        </div>
      </div>
    </div>
  );
}
