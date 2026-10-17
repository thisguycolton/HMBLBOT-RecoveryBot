import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarPlus, FileCheck2 } from "lucide-react";
import { api } from "../lib";
import { Card, ErrorNote, Loading, Pill, Tray, primaryButton, quietButton } from "../ui";
import MeetingForm from "./MeetingForm";
import RulesTable from "./RulesTable";
import { inputClass, selectClass } from "../../ui/styles";
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
      <QuorumCard group={group} quorum={data.quorum} canSet={data.can_make_events} onSaved={load} />
      {data.meetings.length === 0 && (
        <Card className="p-5 text-sm text-slate-600 dark:text-neutral-300">
          {data.can_edit ? "No business meetings yet. Schedule the next one, or add one that already happened to keep its minutes here." : "No business meetings have been scheduled yet."}
        </Card>
      )}
      {coming.length > 0 && <Tray label="Coming up"><div className="space-y-1.5">{coming.map((m) => <Row key={m.id} slug={slug} m={m} keeper={data.can_edit} />)}</div></Tray>}
      {past.length > 0 && <Tray label="Past meetings"><div className="space-y-1.5">{past.map((m) => <Row key={m.id} slug={slug} m={m} keeper={data.can_edit} />)}</div></Tray>}
      <RulesTable kinds={data.kinds} groups={data.groups} />
    </div>
  );
}
