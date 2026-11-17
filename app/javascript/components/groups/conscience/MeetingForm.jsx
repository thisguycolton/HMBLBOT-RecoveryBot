import React, { useState } from "react";
import { Save } from "lucide-react";
import Toggle from "../../ui/Toggle";
import { inputClass, labelClass, selectClass } from "../../ui/styles";
import { api } from "../lib";
import { Card, ErrorNote, primaryButton, quietButton } from "../ui";
import { MEETING_STATUSES, NAMES_REMINDER } from "./lib";

// Scheduling a business meeting (record keepers), or changing one's details. A group admin can
// also have an event made to announce it, which can pick its date with a poll.
export default function MeetingForm({ group, meeting = null, regular = [], canMakeEvents = false, onSaved, onCancel }) {
  const [form, setForm] = useState({
    held_on: meeting?.held_on ?? "", starts_time: meeting?.starts_time ?? "", status: meeting?.status ?? "planned",
    visibility: meeting?.visibility ?? "members", chair_name: meeting?.chair ?? "", secretary_name: meeting?.secretary ?? "",
    attendance_count: meeting?.attendance_count ?? "", meeting_id: meeting?.meeting?.id ?? "",
    called_to_order_time: meeting?.called_to_order_time ?? "", adjourned_time: meeting?.adjourned_time ?? "",
  });
  const [createEvent, setCreateEvent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const path = `/groups/${group.slug}/business_meetings${meeting ? `/${meeting.id}` : ""}`;
      const saved = await api(path, { method: meeting ? "PATCH" : "POST", body: { business_meeting: form, create_event: createEvent } });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const field = (id, label, input, hint) => (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      {input}
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">{hint}</p>}
    </div>
  );

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={save} className="space-y-4">
        <h3 className="!text-base font-semibold text-slate-900 dark:text-white">{meeting ? "Change the meeting" : "Schedule a business meeting"}</h3>
        <ErrorNote error={error} />
        <div className="grid gap-3 sm:grid-cols-3">
          {field("bm-date", "Date", <input id="bm-date" type="date" required autoFocus={!meeting} className={inputClass} value={form.held_on} onChange={set("held_on")} />)}
          {field("bm-time", "Time", <input id="bm-time" type="time" className={inputClass} value={form.starts_time} onChange={set("starts_time")} />, `In ${group.time_zone.split("/").pop().replace("_", " ")} time`)}
          {meeting
            ? field("bm-status", "Status", <select id="bm-status" className={selectClass} value={form.status} onChange={set("status")}>{MEETING_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>)
            : field("bm-visibility", "Who can see it", <select id="bm-visibility" className={selectClass} value={form.visibility} onChange={set("visibility")}><option value="members">Members</option><option value="keepers">Record keepers</option></select>)}
        </div>
        {regular.length > 0 && field("bm-follows", "It follows", (
          <select id="bm-follows" className={selectClass} value={form.meeting_id ?? ""} onChange={set("meeting_id")}>
            <option value="">No particular meeting</option>
            {regular.map((m) => <option key={m.id} value={m.id}>After {m.name}</option>)}
          </select>
        ))}
        {meeting && (
          <div className="grid gap-3 sm:grid-cols-3">
            {field("bm-chair", "Chair", <input id="bm-chair" maxLength={80} className={inputClass} value={form.chair_name} onChange={set("chair_name")} placeholder="First name, last initial" />)}
            {field("bm-secretary", "Secretary", <input id="bm-secretary" maxLength={80} className={inputClass} value={form.secretary_name} onChange={set("secretary_name")} placeholder="First name, last initial" />)}
            {field("bm-attendance", "How many came", <input id="bm-attendance" type="number" min="0" max="9999" className={inputClass} value={form.attendance_count} onChange={set("attendance_count")} />)}
          </div>
        )}
        {meeting && (
          <div className="grid gap-3 sm:grid-cols-2">
            {field("bm-open", "Called to order", <input id="bm-open" type="time" className={inputClass} value={form.called_to_order_time} onChange={set("called_to_order_time")} />)}
            {field("bm-close", "Adjourned", <input id="bm-close" type="time" className={inputClass} value={form.adjourned_time} onChange={set("adjourned_time")} />)}
          </div>
        )}
        {meeting && <p className="-mt-2 text-xs text-slate-500 dark:text-neutral-400">{NAMES_REMINDER}</p>}
        {!meeting && canMakeEvents && (
          <Toggle checked={createEvent} onChange={setCreateEvent} label="Also make an event for it"
            description="A draft event with the live agenda in it, with RSVPs and a flyer. You can pick the date with a poll from there." />
        )}
        {!meeting && <p className="text-xs text-slate-500 dark:text-neutral-400">Members are told once it's scheduled.</p>}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
          <button type="button" onClick={onCancel} className={quietButton}>Cancel</button>
          <button type="submit" disabled={saving || !form.held_on} className={primaryButton}><Save className="size-4" /> {saving ? "Saving…" : meeting ? "Save" : "Schedule it"}</button>
        </div>
      </form>
    </Card>
  );
}
