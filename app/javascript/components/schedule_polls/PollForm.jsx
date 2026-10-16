import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Ban, CalendarClock, CircleCheck, Plus, Search, Settings2, Trash2, UserPlus, X } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { inputClass, labelClass, selectClass } from "../ui/styles";
import { DateField, DateTimeField } from "../ui/DateFields";
import { showToast } from "../../lib/toast";
import WeekGrid from "./WeekGrid";
import { DAY_MINUTES, VISIBILITY_LABELS, addDays, api, clock, dayParts, daysBetween, makeNow } from "./lib";
import { Message } from "./PollPage";

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
const ZONES = [
  ["America/Phoenix", "Phoenix (no daylight saving)"],
  ["America/Los_Angeles", "Pacific"],
  ["America/Denver", "Mountain"],
  ["America/Chicago", "Central"],
  ["America/New_York", "Eastern"],
];

// The room's own meetings, so a new poll starts with them blocked out
const ROOM_MEETINGS = [9, 12, 18, 21].map((h) => ({ kind: "daily", start: h * 60, end: h * 60 + 60, label: "Meeting" }));

const todayIn = (zone) => new Date().toLocaleDateString("en-CA", { timeZone: zone });

function blankPoll() {
  const start = addDays(todayIn("America/Phoenix"), 1);
  return {
    title: "",
    description: "",
    time_zone: "America/Phoenix",
    starts_on: start,
    ends_on: addDays(start, 6),
    closes_at: `${addDays(start, 6)}T23:59`,
    duration_minutes: 60,
    choices_count: 3,
    slot_minutes: 30,
    day_start_minute: 8 * 60,
    day_end_minute: 23 * 60,
    results_visibility: "after_vote",
    blocks: ROOM_MEETINGS,
    members: [],
  };
}

const minuteOptions = (step, from = 0, to = DAY_MINUTES) => {
  const out = [];
  for (let m = from; m <= to; m += step) out.push(m);
  return out;
};

export default function PollForm() {
  const { token } = useParams();
  const navigate = useNavigate();
  const editing = !!token;
  const [form, setForm] = useState(editing ? null : blankPoll());
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const closesTouched = useRef(editing);

  useEffect(() => {
    if (!editing) {
      api("").then((d) => !d.can_create && setError("Only admins can make schedule polls for now.")).catch((e) => setError(e.message));
      return;
    }
    api(`/${token}`)
      .then((d) => {
        if (!d.can_manage) return setError("Only the poll's organizers can edit it.");
        setMeta(d);
        setForm({
          title: d.title, description: d.description || "", time_zone: d.time_zone, starts_on: d.starts_on, ends_on: d.ends_on,
          closes_at: d.closes_at, duration_minutes: d.duration_minutes, choices_count: d.choices_count, slot_minutes: d.slot_minutes,
          day_start_minute: d.day_start_minute, day_end_minute: d.day_end_minute, results_visibility: d.results_visibility,
          blocks: d.blocks, members: d.members.map(({ user_id, role, name, email }) => ({ user_id, role, name, email })),
        });
      })
      .catch((e) => setError(e.message));
  }, [token, editing]);

  const now = useMemo(() => makeNow(meta?.now_local || `${todayIn(form?.time_zone || "America/Phoenix")}T00:00`), [meta, form?.time_zone]);

  if (error) return <Message title="Can't edit this poll" text={error}><Link to="/" className="mt-4 inline-block text-sm text-accent hover:underline">Back to schedule polls</Link></Message>;
  if (!form) return <p className="py-16 text-center !font-sans text-sm text-slate-500">Loading…</p>;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const days = daysBetween(form.starts_on, form.ends_on);

  const setStart = (value) => {
    if (!value) return;
    const length = Math.max(0, days.length - 1);
    const patch = { starts_on: value, ends_on: addDays(value, length) };
    if (!closesTouched.current) patch.closes_at = `${patch.ends_on}T23:59`;
    set(patch);
  };
  const setEnd = (value) => {
    if (!value) return;
    set(closesTouched.current ? { ends_on: value } : { ends_on: value, closes_at: `${value}T23:59` });
  };

  const setBlock = (i, patch) => set({ blocks: form.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { poll: { ...form, members: form.members.map(({ user_id, role }) => ({ user_id, role })) } };
      const data = editing ? await api(`/${token}`, { method: "PATCH", body }) : await api("", { method: "POST", body });
      showToast(editing ? "Poll saved." : "Poll created. Share the link to get votes.", { tone: "success" });
      navigate(`/${data.token}`);
    } catch (err) {
      showToast(err.message, { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const previewPoll = { ...form, day_end_minute: Math.max(form.day_end_minute, form.day_start_minute + 60) };
  const validRange = form.ends_on >= form.starts_on && days.length <= 14;

  return (
    <form onSubmit={save} className="space-y-4 !font-sans [&_*]:!font-sans">
      <div className="grid items-start gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Shell>
            <ShellBand icon={CalendarClock} title={editing ? "Edit schedule poll" : "New schedule poll"} subtitle="Find a time that works for everyone" />
            <ShellPanel position="middle" className="space-y-4 p-4">
              <Field label="Title" id="title">
                <input id="title" required className={inputClass} value={form.title} maxLength={120}
                  placeholder="RecoveryBot workshop: what's new" onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <Field label="Details (optional)" id="description">
                <textarea id="description" rows={3} className={inputClass} value={form.description}
                  placeholder="What it's about, where it is…" onChange={(e) => set({ description: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="First day" id="starts_on">
                  <DateField id="starts_on" value={form.starts_on} onChange={(v) => v && setStart(v)} />
                </Field>
                <Field label="Last day" id="ends_on">
                  <DateField id="ends_on" value={form.ends_on} min={form.starts_on} max={addDays(form.starts_on, 13)}
                    onChange={(v) => v && setEnd(v)} />
                </Field>
              </div>
              <Field label="Voting closes" id="closes_at" hint="Defaults to the end of the last day. People can only pick times that haven't passed yet.">
                <DateTimeField id="closes_at" value={form.closes_at}
                  onChange={(v) => { if (!v) return; closesTouched.current = true; set({ closes_at: v }); }} />
              </Field>
            </ShellPanel>
            <ShellPanel position="middle" className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Event length" id="duration">
                  <select id="duration" className={selectClass} value={form.duration_minutes} onChange={(e) => set({ duration_minutes: Number(e.target.value) })}>
                    {DURATIONS.map((m) => <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? "" : "s"}`}</option>)}
                  </select>
                </Field>
                <Field label="Ranked picks" id="choices">
                  <select id="choices" className={selectClass} value={form.choices_count} onChange={(e) => set({ choices_count: Number(e.target.value) })}>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n === 1 ? "1 (no ranking)" : `Top ${n}`}</option>)}
                  </select>
                </Field>
                <Field label="Earliest start" id="day_start">
                  <select id="day_start" className={selectClass} value={form.day_start_minute} onChange={(e) => set({ day_start_minute: Number(e.target.value) })}>
                    {minuteOptions(60, 0, 23 * 60).map((m) => <option key={m} value={m}>{clock(m)}</option>)}
                  </select>
                </Field>
                <Field label="Latest end" id="day_end">
                  <select id="day_end" className={selectClass} value={form.day_end_minute} onChange={(e) => set({ day_end_minute: Number(e.target.value) })}>
                    {minuteOptions(60, 60, DAY_MINUTES).map((m) => <option key={m} value={m}>{clock(m)}</option>)}
                  </select>
                </Field>
                <Field label="Start times every" id="slot">
                  <select id="slot" className={selectClass} value={form.slot_minutes} onChange={(e) => set({ slot_minutes: Number(e.target.value) })}>
                    {[15, 30, 60].map((m) => <option key={m} value={m}>{m === 60 ? "hour" : `${m} minutes`}</option>)}
                  </select>
                </Field>
                <Field label="Time zone" id="zone">
                  <select id="zone" className={selectClass} value={form.time_zone} onChange={(e) => set({ time_zone: e.target.value })}>
                    {ZONES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
              </div>
              <fieldset>
                <legend className={labelClass}>Results</legend>
                <div className="space-y-1.5">
                  {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                    <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-neutral-200">
                      <input type="radio" name="results_visibility" value={value} checked={form.results_visibility === value}
                        onChange={() => set({ results_visibility: value })} className="accent-[var(--color-accent)]" />
                      {label}
                    </label>
                  ))}
                  <p className="text-xs text-slate-500 dark:text-neutral-400">Organizers always see results.</p>
                </div>
              </fieldset>
            </ShellPanel>
            <ShellPanel position="bottom" className="p-4">
              <People members={form.members} onChange={(members) => set({ members })} />
            </ShellPanel>
          </Shell>
        </div>

        <div className="space-y-4">
          <Shell>
            <ShellBand icon={Ban} title="Times that don't work" subtitle="Hatched on the calendar; nobody can pick a time that overlaps them" />
            <ShellPanel position="bottom" className="space-y-2 p-4">
              {form.blocks.length === 0 && <p className="text-sm text-slate-500 dark:text-neutral-400">Every time is open.</p>}
              {form.blocks.map((b, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select aria-label="Which days" className={`${selectClass} !w-auto`} value={b.kind === "once" ? b.date : "daily"}
                    onChange={(e) => setBlock(i, e.target.value === "daily" ? { kind: "daily", date: undefined } : { kind: "once", date: e.target.value })}>
                    <option value="daily">Every day</option>
                    {days.map((d) => <option key={d} value={d}>{dayParts(d).long}</option>)}
                    {b.kind === "once" && !days.includes(b.date) && <option value={b.date}>{b.date}</option>}
                  </select>
                  <select aria-label="From" className={`${selectClass} !w-auto`} value={b.start} onChange={(e) => setBlock(i, { start: Number(e.target.value) })}>
                    {minuteOptions(15, 0, DAY_MINUTES - 15).map((m) => <option key={m} value={m}>{clock(m)}</option>)}
                  </select>
                  <span className="text-sm text-slate-500">to</span>
                  <select aria-label="Until" className={`${selectClass} !w-auto`} value={b.end} onChange={(e) => setBlock(i, { end: Number(e.target.value) })}>
                    {minuteOptions(15, 15, DAY_MINUTES).map((m) => <option key={m} value={m}>{clock(m)}</option>)}
                  </select>
                  <input aria-label="Label" className={`${inputClass} !w-32 flex-1`} placeholder="Label" value={b.label || ""} maxLength={60}
                    onChange={(e) => setBlock(i, { label: e.target.value })} />
                  <button type="button" aria-label="Remove" className="rounded-md p-1.5 text-slate-500 hover:bg-neutral-100 hover:text-red-600 dark:hover:bg-neutral-800"
                    onClick={() => set({ blocks: form.blocks.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button type="button" className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-medium text-accent hover:bg-accent-tint dark:hover:bg-accent/20"
                onClick={() => set({ blocks: [...form.blocks, { kind: "daily", start: 12 * 60, end: 13 * 60, label: "" }] })}>
                <Plus className="h-4 w-4" /> Add a time that doesn't work
              </button>
            </ShellPanel>
          </Shell>
          {validRange ? (
            <WeekGrid poll={previewPoll} now={now()} interactive={false} />
          ) : (
            <p className="text-sm text-red-600">The last day has to be on or after the first day, and at most 14 days later.</p>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-40 -mx-4 flex items-center justify-end gap-2 border-t border-neutral-200 bg-stone-100/90 px-4 py-3 backdrop-blur dark:border-neutral-700 dark:bg-stone-800/90">
        <Link to={editing ? `/${token}` : "/"} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700">Cancel</Link>
        <button type="submit" disabled={saving || !validRange}
          className="inline-flex items-center gap-2 rounded-xl !bg-accent px-4 py-2 text-sm font-semibold text-white shadow-panel hover:opacity-90 disabled:opacity-50">
          <CircleCheck className="h-4 w-4" /> {saving ? "Saving…" : editing ? "Save poll" : "Create poll"}
        </button>
      </div>
      {editing && meta?.ballots_count > 0 && (
        <p className="text-right text-xs text-slate-500">{meta.ballots_count} people have voted. Votes already cast stay as they are if you change the times.</p>
      )}
    </form>
  );
}

function Field({ label, id, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">{hint}</p>}
    </div>
  );
}

// Tag RecoveryBot accounts: collaborators help run the poll, voters are asked to vote.
// Both get a notification and an email when the poll is saved.
function People({ members, onChange }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState([]);

  useEffect(() => {
    if (!q.trim()) return setFound([]);
    const timer = setTimeout(() => {
      api(`/people?q=${encodeURIComponent(q.trim())}`).then(setFound).catch(() => setFound([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [q]);

  const add = (person) => {
    if (!members.some((m) => m.user_id === person.user_id)) onChange([...members, { ...person, role: "invitee" }]);
    setQ("");
  };

  return (
    <div className="space-y-2">
      <p className={labelClass}><UserPlus className="mr-1 inline h-3.5 w-3.5" /> Tag people</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input className={`${inputClass} !pl-9`} value={q} placeholder="Search RecoveryBot accounts" onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (found[0]) add(found[0]); } }} />
        {found.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/5 dark:bg-neutral-900">
            {found.map((p) => (
              <li key={p.user_id}>
                <button type="button" onClick={() => add(p)} className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  <span className="font-medium text-slate-800 dark:text-neutral-100">{p.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{p.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {members.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-neutral-400">Anyone with the link can vote. Tagged people also get a notification and an email.</p>
      ) : (
        <ul className="space-y-1.5">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-neutral-100" title={m.email}>{m.name}</span>
              <select aria-label={`${m.name}'s role`} value={m.role} className={`${selectClass} !w-auto !py-1`}
                onChange={(e) => onChange(members.map((x) => (x.user_id === m.user_id ? { ...x, role: e.target.value } : x)))}>
                <option value="invitee">Voter</option>
                <option value="collaborator">Collaborator</option>
              </select>
              <button type="button" aria-label={`Remove ${m.name}`} className="rounded-md p-1 text-slate-500 hover:text-red-600"
                onClick={() => onChange(members.filter((x) => x.user_id !== m.user_id))}>
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
          <li className="pt-1 text-xs text-slate-500 dark:text-neutral-400"><Settings2 className="mr-1 inline h-3 w-3" />Collaborators can do everything but delete the poll.</li>
        </ul>
      )}
    </div>
  );
}
