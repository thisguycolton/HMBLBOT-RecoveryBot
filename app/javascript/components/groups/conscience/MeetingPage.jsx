import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronDown, ChevronLeft, ChevronUp, ExternalLink, GripVertical, Pencil, Plus, Printer, Save, Scale, Trash2, Vote, X } from "lucide-react";
import { inputClass, selectClass } from "../../ui/styles";
import usePrintable, { printTitled } from "../../../lib/usePrintable";
import { api } from "../lib";
import { Card, ErrorNote, Loading, Message, Pill, Tray, dangerButton, primaryButton, quietButton } from "../ui";
import { AgendaList, ItemPill, SuggestForm } from "./AgendaParts";
import DecisionForm from "./DecisionForm";
import MeetingForm from "./MeetingForm";
import MinutesEditor from "./MinutesEditor";
import { AGENDA_KINDS, AGENDA_KIND_LABELS, MINUTES_STATUSES, MOTION_STATUS_LABELS, countLabel, dateLabel, decisionsPath, longDate, meetingsPath } from "./lib";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The skeleton of the minutes, from what the meeting had on its agenda and decided
function minutesFromAgenda(meeting, group) {
  const who = [meeting.chair && `chaired by ${meeting.chair}`, meeting.secretary && `minutes by ${meeting.secretary}`, meeting.attendance_count != null && `${meeting.attendance_count} present`].filter(Boolean).join(", ");
  const items = meeting.agenda.filter((i) => i.status !== "suggested");
  const parts = [`<h2>Call to order</h2><p>${esc(group.title)} business meeting, ${esc(longDate(meeting.held_on))}${who ? ` (${esc(who)})` : ""}.</p>`];
  items.forEach((item) => {
    parts.push(`<h3>${esc(item.title)}</h3>`);
    const decided = meeting.motions.filter((m) => m.agenda_item_id === item.id);
    if (decided.length === 0) parts.push("<p></p>");
    decided.forEach((m) => parts.push(`<p><strong>${esc(MOTION_STATUS_LABELS[m.status])}:</strong> ${esc(m.title)}${countLabel(m) ? ` (${esc(countLabel(m))})` : ""}.</p>`));
  });
  parts.push("<h2>Closing</h2><p>Next business meeting: </p>");
  return parts.join("");
}

function AgendaItemRow({ item, index, last, canEdit, slug, meeting, reload, setError, drag, onRecord }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: item.title, details: item.details, kind: item.kind, status: item.status });
  const base = `/groups/${slug}/business_meetings/${meeting.id}/agenda_items/${item.id}`;
  const call = async (method, body) => {
    setError(null);
    try { await api(base, { method, body: body && { agenda_item: body } }); await reload(); } catch (e) { setError(e.message); }
  };
  const mine = item.mine && item.status === "suggested";

  if (editing) {
    return (
      <li className="space-y-2 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950">
        <input aria-label="Title" maxLength={160} className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <div className="grid gap-2 sm:grid-cols-2">
          <select aria-label="Kind" className={selectClass} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{AGENDA_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
          {canEdit && <select aria-label="Status" className={selectClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="on_agenda">On the agenda</option><option value="tabled">Tabled</option><option value="done">Done</option><option value="suggested">Suggested</option>
          </select>}
        </div>
        <textarea aria-label="Details" rows={2} maxLength={2000} className={inputClass} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
        <div className="flex gap-2">
          <button type="button" className={primaryButton} onClick={async () => { await call("PATCH", form); setEditing(false); }}><Check className="size-4" /> Save</button>
          <button type="button" className={quietButton} onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </li>
    );
  }

  return (
    <li draggable={canEdit && item.status !== "suggested"} onDragStart={() => drag.start(item.id)} onDragOver={(e) => canEdit && e.preventDefault()} onDrop={() => drag.drop(item.id)}
      className="flex gap-2 rounded-xl bg-white p-3 shadow-panel dark:bg-neutral-900">
      {canEdit && item.status !== "suggested" && <GripVertical className="mt-1 size-4 shrink-0 cursor-grab text-slate-400" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {item.status !== "suggested" && <span className="text-xs font-semibold text-accent">{index + 1}.</span>}
          <span className={`font-medium text-slate-900 dark:text-white ${item.status === "done" ? "line-through decoration-slate-400" : ""}`}>{item.title}</span>
          <ItemPill item={item} />
        </div>
        <p className="text-xs text-slate-500 dark:text-neutral-400">{AGENDA_KIND_LABELS[item.kind]}{item.submitted_by ? ` · from ${item.submitted_by}` : ""}</p>
        {item.details && <p className="mt-1 whitespace-pre-line text-sm text-slate-600 dark:text-neutral-300">{item.details}</p>}
        {(canEdit || mine) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {canEdit && item.status === "suggested" && <button type="button" className={`${primaryButton} !px-2.5 !py-1 !text-xs`} onClick={() => call("PATCH", { status: "on_agenda" })}><Plus className="size-3.5" /> Add to the agenda</button>}
            {canEdit && item.status !== "suggested" && <button type="button" className={`${quietButton} !px-2 !py-1 !text-xs`} onClick={() => onRecord(item)}><Vote className="size-3.5" /> Record a decision</button>}
            {(canEdit || mine) && <button type="button" className={`${quietButton} !px-2 !py-1 !text-xs`} onClick={() => setEditing(true)}><Pencil className="size-3.5" /> Change</button>}
            {canEdit && item.status !== "suggested" && <>
              <button type="button" aria-label="Move up" disabled={index === 0} className={`${quietButton} !px-1.5 !py-1`} onClick={() => drag.move(item.id, -1)}><ChevronUp className="size-3.5" /></button>
              <button type="button" aria-label="Move down" disabled={last} className={`${quietButton} !px-1.5 !py-1`} onClick={() => drag.move(item.id, 1)}><ChevronDown className="size-3.5" /></button>
            </>}
            <button type="button" className={`${dangerButton} !px-2 !py-1 !text-xs`} onClick={() => (item.status !== "suggested" || !canEdit || window.confirm("Decline this suggestion?")) && call("DELETE")}>
              {canEdit && item.status === "suggested" ? <><X className="size-3.5" /> Decline</> : mine ? "Take it back" : <Trash2 className="size-3.5" />}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

// /conscience/meetings/:id: the agenda on one side (record keepers add, reorder and cross off items,
// and record decisions right there) and the minutes on the other. Prints as a clean sheet.
export default function MeetingPage({ group, id }) {
  usePrintable();
  const slug = group.slug;
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [minutesStatus, setMinutesStatus] = useState("draft");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(null);
  const [allMotions, setAllMotions] = useState([]);
  const [regular, setRegular] = useState([]);
  const editorRef = useRef(null);
  const dragId = useRef(null);

  const load = useCallback(() => api(`/groups/${slug}/business_meetings/${id}`).then((m) => {
    setMeeting(m);
    return m;
  }).catch((e) => setError(e.message)), [slug, id]);
  useEffect(() => {
    setMeeting(null);
    setDirty(false);
    load().then((m) => { if (m) { setMinutes(m.minutes || ""); setMinutesStatus(m.minutes_status); } });
  }, [load]);
  useEffect(() => {
    if (!meeting?.can_edit) return;
    api(`/groups/${slug}/motions`).then((d) => setAllMotions(d.motions)).catch(() => {});
    api(`/groups/${slug}/business_meetings`).then((d) => setRegular(d.regular_meetings)).catch(() => {});
  }, [slug, meeting?.can_edit]);
  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (error && !meeting) return <Message title="That meeting isn't here" text={error}><Link to={meetingsPath(slug)} className="mt-4 inline-block text-sm text-accent hover:underline">Back to meetings</Link></Message>;
  if (!meeting) return <Loading />;

  const canEdit = meeting.can_edit;
  const patch = async (attrs, done) => {
    setError(null);
    try {
      const saved = await api(`/groups/${slug}/business_meetings/${id}`, { method: "PATCH", body: { business_meeting: attrs } });
      setMeeting(saved);
      done?.(saved);
      return saved;
    } catch (e) {
      setError(e.message);
    }
  };
  const saveMinutes = async () => {
    setSaving(true);
    const saved = await patch({ minutes, minutes_status: minutesStatus });
    setSaving(false);
    if (saved) { setDirty(false); setNotice(minutesStatus === "draft" ? "Minutes saved as a draft." : "Minutes saved. Members can read them."); }
  };
  const startMinutes = () => {
    if (minutes.trim() && !window.confirm("Replace what's in the minutes with a skeleton from the agenda?")) return;
    editorRef.current?.commands.setContent(minutesFromAgenda(meeting, group), true);
  };
  const remove = async () => {
    if (!window.confirm("Delete this meeting, its agenda and its minutes? The decisions made at it stay in the log.")) return;
    try { await api(`/groups/${slug}/business_meetings/${id}`, { method: "DELETE" }); navigate(meetingsPath(slug)); } catch (e) { setError(e.message); }
  };

  const agenda = meeting.agenda;
  const onAgenda = agenda.filter((i) => i.status !== "suggested");
  const suggested = agenda.filter((i) => i.status === "suggested");
  const reorder = async (ids) => {
    try {
      const d = await api(`/groups/${slug}/business_meetings/${id}/agenda_items/reorder`, { method: "POST", body: { ids } });
      setMeeting((m) => ({ ...m, agenda: [...d.agenda] }));
    } catch (e) { setError(e.message); }
  };
  const drag = {
    start: (itemId) => { dragId.current = itemId; },
    drop: (targetId) => {
      const from = dragId.current;
      dragId.current = null;
      if (!from || from === targetId) return;
      const ids = onAgenda.map((i) => i.id).filter((x) => x !== from);
      ids.splice(ids.indexOf(targetId), 0, from);
      reorder(ids);
    },
    move: (itemId, step) => {
      const ids = onAgenda.map((i) => i.id);
      const at = ids.indexOf(itemId);
      ids.splice(at + step, 0, ids.splice(at, 1)[0]);
      reorder(ids);
    },
  };
  const eventPath = meeting.event?.path;
  const minutesVisible = canEdit || meeting.minutes_status !== "draft";

  return (
    <div className="space-y-5">
      <Link to={meetingsPath(slug)} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline print:hidden"><ChevronLeft className="size-4" /> Business meetings</Link>
      <div className="space-y-5 print:hidden">
        <ErrorNote error={error} />
        {notice && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</p>}

        {editing ? (
          <MeetingForm group={group} meeting={meeting} regular={regular} onCancel={() => setEditing(false)} onSaved={(m) => { setMeeting((old) => ({ ...old, ...m })); setEditing(false); load(); }} />
        ) : (
          <Card className="p-5">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="!text-xl font-semibold text-slate-900 dark:text-white">Business meeting, {meeting.starts_at ? meeting.when_label : longDate(meeting.held_on)}</h2>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-neutral-300">
                  {meeting.status === "planned" && <Pill tone="accent">Planned</Pill>}
                  {meeting.status === "held" && <Pill tone="green">Held</Pill>}
                  {meeting.status === "cancelled" && <Pill>Cancelled</Pill>}
                  {meeting.visibility === "keepers" && <Pill tone="amber">Record keepers only</Pill>}
                  {meeting.meeting && <span>After {meeting.meeting.name}</span>}
                  {meeting.chair && <span>Chair: {meeting.chair}</span>}
                  {meeting.secretary && <span>Secretary: {meeting.secretary}</span>}
                  {meeting.attendance_count != null && <span>{meeting.attendance_count} came</span>}
                </p>
                {eventPath && (
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <a href={eventPath} className="inline-flex items-center gap-1 text-accent hover:underline">The event <ExternalLink className="size-3.5" /></a>
                    {canEdit && meeting.status === "planned" && <a href={`/schedule_polls/new?event=${meeting.event.token}`} className="inline-flex items-center gap-1 text-accent hover:underline">Pick a date with a poll <ExternalLink className="size-3.5" /></a>}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={quietButton} onClick={() => printTitled(`Business meeting ${meeting.held_on}`)}><Printer className="size-4" /> Print</button>
                {canEdit && <button type="button" className={quietButton} onClick={() => setEditing(true)}><Pencil className="size-4" /> Details</button>}
                {canEdit && meeting.status === "planned" && <button type="button" className={primaryButton} onClick={() => patch({ status: "held" })}><Check className="size-4" /> Mark as held</button>}
                {canEdit && meeting.status === "planned" && <button type="button" className={quietButton} onClick={() => window.confirm("Cancel this meeting?") && patch({ status: "cancelled" })}>Cancel it</button>}
                {meeting.can_delete && <button type="button" className={dangerButton} onClick={remove}><Trash2 className="size-4" /> Delete</button>}
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <div className="min-w-0 space-y-5">
            <Tray label={`Agenda (${onAgenda.length})`}>
              <ol className="space-y-1.5">
                {onAgenda.length === 0 && <li><Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">{canEdit ? "Nothing on the agenda yet. Add an item below, or approve a suggestion." : "Nothing on the agenda yet. You can suggest an item below."}</Card></li>}
                {onAgenda.map((item, i) => (
                  <React.Fragment key={item.id}>
                    <AgendaItemRow item={item} index={i} last={i === onAgenda.length - 1} canEdit={canEdit} slug={slug} meeting={meeting} reload={load} setError={setError} drag={drag} onRecord={setRecording} />
                    {recording?.id === item.id && (
                      <li><DecisionForm group={group} motions={allMotions} onCancel={() => setRecording(null)} onSaved={async () => { setRecording(null); await load(); }}
                        preset={{ title: item.title, text: item.details, decided_on: meeting.held_on, business_meeting_id: meeting.id, agenda_item_id: item.id }} /></li>
                    )}
                  </React.Fragment>
                ))}
              </ol>
            </Tray>

            {suggested.length > 0 && (
              <Tray label={canEdit ? `Suggested by members (${suggested.length})` : "Suggestions"}>
                <ol className="space-y-1.5">
                  {suggested.map((item) => (
                    <AgendaItemRow key={item.id} item={item} index={0} last canEdit={canEdit} slug={slug} meeting={meeting} reload={load} setError={setError} drag={drag} onRecord={setRecording} />
                  ))}
                </ol>
              </Tray>
            )}

            {(canEdit || meeting.can_suggest) && (
              <Tray label={canEdit ? "Add an item" : "Suggest an item"}>
                <Card className="p-3"><SuggestForm slug={slug} meetingId={meeting.id} onAdded={load} compact /></Card>
                {!canEdit && <p className="px-2 pb-1 pt-2 text-xs text-slate-500 dark:text-neutral-400">The group's record keepers will see it and put it on the agenda.</p>}
              </Tray>
            )}

            {meeting.motions.length > 0 && (
              <Tray label="Decided at this meeting">
                <div className="space-y-1.5">
                  {meeting.motions.map((m) => (
                    <Link key={m.id} to={decisionsPath(slug, m.id)} className="flex items-start gap-3 rounded-xl bg-white p-3 shadow-panel hover:ring-1 hover:ring-accent/40 dark:bg-neutral-900">
                      <Scale className="mt-0.5 size-4 shrink-0 text-accent" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-slate-900 dark:text-white">{m.title}</span>
                        <span className="block text-xs text-slate-500 dark:text-neutral-400">{MOTION_STATUS_LABELS[m.status]}{countLabel(m) ? ` · ${countLabel(m)}` : ""}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </Tray>
            )}
          </div>

          <div className="min-w-0 space-y-3">
            <Tray label="Minutes" action={meeting.minutes_status !== "draft" && <Pill tone="green">{meeting.minutes_status === "approved" ? "Approved" : "Posted"}{meeting.minutes_approved_at ? ` ${dateLabel(meeting.minutes_approved_at)}` : meeting.minutes_posted_at ? ` ${dateLabel(meeting.minutes_posted_at)}` : ""}</Pill>}>
              {canEdit ? (
                <div className="space-y-3 p-1">
                  <MinutesEditor html={meeting.minutes || ""} onChange={(html) => { setMinutes(html); setDirty(true); setNotice(null); }} onReady={(e) => { editorRef.current = e; }} />
                  <p className="text-xs text-slate-500 dark:text-neutral-400">First names and last initials only.</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select aria-label="Minutes status" className={`${selectClass} !w-auto max-w-full`} value={minutesStatus} onChange={(e) => { setMinutesStatus(e.target.value); setDirty(true); }}>
                      {MINUTES_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                    <span className="min-w-0 basis-full text-xs text-slate-500 dark:text-neutral-400 sm:basis-auto">{MINUTES_STATUSES.find((s) => s.key === minutesStatus)?.note}</span>
                    <button type="button" className={quietButton} onClick={startMinutes}>Start from the agenda</button>
                    <button type="button" disabled={saving || !dirty} className={`${primaryButton} ml-auto`} onClick={saveMinutes}><Save className="size-4" /> {saving ? "Saving…" : dirty ? "Save minutes" : "Saved"}</button>
                  </div>
                </div>
              ) : minutesVisible && meeting.minutes?.trim() ? (
                <Card className="bg-white p-4 sm:p-5"><div className="doc-prose" dangerouslySetInnerHTML={{ __html: meeting.minutes }} /></Card>
              ) : (
                <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">The minutes aren't posted yet.</Card>
              )}
            </Tray>
          </div>
        </div>
      </div>

      {/* The paper copy: header, agenda, decisions, minutes */}
      <article className="hidden print:block meeting-print">
        <h1>{group.title} business meeting</h1>
        <p className="meeting-print__meta">{longDate(meeting.held_on)}{meeting.starts_at ? `, ${meeting.when_label.split(" · ")[1]}` : ""}
          {[meeting.chair && `Chair: ${meeting.chair}`, meeting.secretary && `Secretary: ${meeting.secretary}`, meeting.attendance_count != null && `${meeting.attendance_count} present`].filter(Boolean).map((t) => ` · ${t}`).join("")}</p>
        <h2>Agenda</h2>
        <AgendaList items={onAgenda} />
        {meeting.motions.length > 0 && (
          <>
            <h2>Decisions</h2>
            <ul>{meeting.motions.map((m) => <li key={m.id}><strong>{MOTION_STATUS_LABELS[m.status]}:</strong> {m.title}{countLabel(m) ? ` (${countLabel(m)})` : ""}{m.text && <div className="meeting-print__wording">{m.text}</div>}</li>)}</ul>
          </>
        )}
        {minutesVisible && (minutes || meeting.minutes)?.trim() && (
          <>
            <h2>Minutes{meeting.minutes_status === "approved" ? " (approved)" : meeting.minutes_status === "draft" ? " (draft)" : ""}</h2>
            <div className="doc-prose" dangerouslySetInnerHTML={{ __html: canEdit ? minutes : meeting.minutes }} />
          </>
        )}
      </article>
    </div>
  );
}
