import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarPlus, FileCheck2 } from "lucide-react";
import { api } from "../lib";
import { Card, ErrorNote, Loading, Pill, Tray, primaryButton } from "../ui";
import MeetingForm from "./MeetingForm";
import { dateLabel, longDate, meetingsPath } from "./lib";

function Row({ slug, m, keeper }) {
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
    </Link>
  );
}

// Business meetings (/conscience/meetings): coming up first, then past ones with their minutes
export default function MeetingsView({ group }) {
  const slug = group.slug;
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [scheduling, setScheduling] = useState(false);
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
        {data.can_edit && !scheduling && <button type="button" onClick={() => setScheduling(true)} className={primaryButton}><CalendarPlus className="size-4" /> Schedule a meeting</button>}
      </div>
      {scheduling && (
        <MeetingForm group={group} regular={data.regular_meetings} canMakeEvents={data.can_make_events} onCancel={() => setScheduling(false)} onSaved={(m) => navigate(meetingsPath(slug, m.id))} />
      )}
      {data.meetings.length === 0 && (
        <Card className="p-5 text-sm text-slate-600 dark:text-neutral-300">
          {data.can_edit ? "No business meetings yet. Schedule the next one, or add one that already happened to keep its minutes here." : "No business meetings have been scheduled yet."}
        </Card>
      )}
      {coming.length > 0 && <Tray label="Coming up"><div className="space-y-1.5">{coming.map((m) => <Row key={m.id} slug={slug} m={m} keeper={data.can_edit} />)}</div></Tray>}
      {past.length > 0 && <Tray label="Past meetings"><div className="space-y-1.5">{past.map((m) => <Row key={m.id} slug={slug} m={m} keeper={data.can_edit} />)}</div></Tray>}
    </div>
  );
}
