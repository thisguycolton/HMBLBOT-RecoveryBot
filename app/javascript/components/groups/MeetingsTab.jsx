import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarPlus, Check, DownloadCloud, ExternalLink, Link2, Link2Off, Pencil, Phone, Plus, RefreshCw, Search, Trash2, Video, X } from "lucide-react";
import { inputClass, labelClass } from "../ui/styles";
import SegmentedControl from "../ui/SegmentedControl";
import { DAYS, ZONES, api, clock, fromTimeValue, localHint, toTimeValue, typeLabel, zoneLabel } from "./lib";
import { Card, ErrorNote, Pill, Tray, dangerButton, primaryButton, quietButton } from "./ui";

// Types offered as checkboxes when adding a meeting by hand
const COMMON_TYPES = ["O", "C", "D", "SP", "B", "ST", "LIT", "12x12", "MED", "BE", "W", "M", "LGBTQ", "Y"];

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

// Weekly meetings are stored one per day (as OIAA lists them); the same meeting on
// several days shows as one card
const seriesKey = (m) =>
  [m.name, m.start_minute, m.end_minute, m.time_zone, m.conference_url || "", m.conference_url_notes || "", m.oiaa_slug || "",
    (m.types || []).join(","), m.notes || "", m.location || "", m.oiaa_missing].join("|");

function toSeries(weekly) {
  const byKey = new Map();
  weekly.forEach((m) => {
    const key = seriesKey(m);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(m);
  });
  return [...byKey.values()]
    .map((meetings) => meetings.sort((a, b) => a.day_of_week - b.day_of_week))
    .sort((a, b) => a[0].day_of_week - b[0].day_of_week || a[0].start_minute - b[0].start_minute);
}

export function daysLabel(days) {
  const set = [...new Set(days)].sort();
  if (set.length === 7) return "Every day";
  if (set.join() === "1,2,3,4,5") return "Weekdays";
  if (set.join() === "0,6") return "Weekends";
  if (set.length === 1) return `${DAYS[set[0]]}s`;
  return set.map((d) => SHORT_DAYS[d]).join(", ");
}

function scheduleLabel(series) {
  const m = series[0];
  if (series.length === 1 || m.recurrence !== "weekly") return m.schedule_label;
  const zone = m.schedule_label.split(" ").pop();
  return `${daysLabel(series.map((x) => x.day_of_week))}, ${clock(m.start_minute)}${m.end_minute != null ? `–${clock(m.end_minute)}` : ""} ${zone}`;
}

// A group's meetings: weekly by weekday, then one-time ones. Group admins add them by
// hand (with OIAA matches offered as they type), import them from OIAA, and refresh.
export default function MeetingsTab({ group, setGroup, reload, isNew }) {
  const [editing, setEditing] = useState(null); // "new" | [meetings of one series]
  const [importing, setImporting] = useState(isNew && group.meetings.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const manage = group.can_manage;
  const linkedCount = group.meetings.filter((m) => m.oiaa_slug).length;

  const replaceMeetings = (meetings) => setGroup((g) => ({ ...g, meetings }));

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const data = await api(`/groups/${group.slug}/meetings/refresh`, { method: "POST" });
      setGroup((g) => ({ ...g, meetings: data.meetings, oiaa_synced_at: data.oiaa_synced_at }));
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const weekly = group.meetings.filter((m) => m.recurrence === "weekly");
  const once = group.meetings.filter((m) => m.recurrence === "once");
  const upcoming = once.filter((m) => !m.past);
  const past = once.filter((m) => m.past);

  return (
    <div className="space-y-5">
      {manage && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => { setEditing("new"); setImporting(false); }} className={primaryButton}>
            <Plus className="h-4 w-4" /> Add a meeting
          </button>
          <button type="button" onClick={() => { setImporting(true); setEditing(null); }} className={quietButton}>
            <DownloadCloud className="h-4 w-4" /> Import from OIAA
          </button>
          {linkedCount > 0 && (
            <button type="button" disabled={refreshing} onClick={refresh} className={quietButton}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Refreshing…" : "Refresh from OIAA"}
            </button>
          )}
          {group.oiaa_synced_at && linkedCount > 0 && (
            <span className="text-xs text-slate-500 dark:text-neutral-400">
              OIAA checked {new Date(group.oiaa_synced_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
          )}
        </div>
      )}
      <ErrorNote error={error} />

      {editing && (
        <MeetingEditor
          group={group}
          series={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
      {importing && (
        <ImportPanel group={group} onClose={() => setImporting(false)} onImported={(meetings) => { replaceMeetings(meetings); setImporting(false); }} />
      )}

      {group.meetings.length === 0 && !editing && !importing && (
        <Card className="p-6 text-center text-sm text-slate-600 dark:text-neutral-400">
          <CalendarPlus className="mx-auto mb-2 h-6 w-6 text-slate-400" />
          No meetings yet.{manage ? " Add one, or import the group's meetings from OIAA." : ""}
        </Card>
      )}

      {weekly.length > 0 && (
        <Tray label="Every week">
          <div className="space-y-1.5">
            {toSeries(weekly).map((series) => (
              <MeetingCard key={series.map((m) => m.id).join("-")} series={series} group={group} manage={manage} onEdit={() => setEditing(series)} onChanged={reload} />
            ))}
          </div>
        </Tray>
      )}
      {upcoming.length > 0 && (
        <Tray label="Coming up">
          <div className="space-y-1.5">
            {upcoming.map((m) => <MeetingCard key={m.id} series={[m]} group={group} manage={manage} onEdit={() => setEditing([m])} onChanged={reload} />)}
          </div>
        </Tray>
      )}
      {past.length > 0 && manage && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-slate-500 dark:text-neutral-400">Past one-time meetings ({past.length})</summary>
          <div className="mt-2 space-y-1.5">
            {past.map((m) => <MeetingCard key={m.id} series={[m]} group={group} manage={manage} onEdit={() => setEditing([m])} onChanged={reload} />)}
          </div>
        </details>
      )}
    </div>
  );
}

function MeetingCard({ series, group, manage, onEdit, onChanged }) {
  const [error, setError] = useState(null);
  const meeting = series[0];
  const label = scheduleLabel(series);
  // the next of the series' days, for "… your time"
  const soonest = [...series].sort((a, b) => new Date(a.next_start) - new Date(b.next_start))[0];
  const hint = localHint(soonest);

  const each = async (fn) => {
    setError(null);
    try {
      await Promise.all(series.map(fn));
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };
  const unlink = () =>
    window.confirm("Stop following OIAA for this meeting? Its details stay, and you can edit them yourself.") &&
    each((m) => api(`/groups/${group.slug}/meetings/${m.id}/unlink`, { method: "POST" }));
  const remove = () =>
    window.confirm(`Delete “${meeting.name}” (${label})?`) &&
    each((m) => api(`/groups/${group.slug}/meetings/${m.id}`, { method: "DELETE" }));

  return (
    <Card className="p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-white">{meeting.name}</p>
          <p className="text-sm text-slate-600 dark:text-neutral-300">
            {label}
            {hint && <span className="text-slate-400 dark:text-neutral-500"> · {hint}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {meeting.oiaa_slug && !meeting.oiaa_missing && (
            meeting.oiaa_url ? (
              <a href={meeting.oiaa_url} target="_blank" rel="noreferrer"><Pill tone="green"><Link2 className="h-3 w-3" /> OIAA</Pill></a>
            ) : <Pill tone="green"><Link2 className="h-3 w-3" /> OIAA</Pill>
          )}
          {meeting.oiaa_missing && <Pill tone="amber"><AlertTriangle className="h-3 w-3" /> No longer listed on OIAA</Pill>}
        </div>
      </div>

      {meeting.types?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {meeting.types.map((t) => <Pill key={t}>{typeLabel(t)}</Pill>)}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {meeting.conference_url && (
          <a href={meeting.conference_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
            <Video className="h-4 w-4" /> Join online
          </a>
        )}
        {meeting.conference_url_notes && <span className="text-slate-500 dark:text-neutral-400">{meeting.conference_url_notes}</span>}
        {meeting.conference_phone && (
          <a href={`tel:${meeting.conference_phone}`} className="inline-flex items-center gap-1 text-slate-600 hover:text-accent dark:text-neutral-300">
            <Phone className="h-4 w-4" /> {meeting.conference_phone}
          </a>
        )}
        {(meeting.location || meeting.formatted_address) && (
          <span className="text-slate-600 dark:text-neutral-300">{[meeting.location, meeting.formatted_address].filter(Boolean).join(", ")}</span>
        )}
      </div>
      {meeting.notes && <p className="mt-2 whitespace-pre-line text-sm text-slate-600 dark:text-neutral-300">{meeting.notes}</p>}

      {manage && (
        <div className="mt-3 flex flex-wrap gap-1 border-t border-neutral-100 pt-2 dark:border-neutral-800">
          <button type="button" onClick={onEdit} className={`${quietButton} !py-1`}><Pencil className="h-3.5 w-3.5" /> Edit</button>
          {meeting.oiaa_slug && <button type="button" onClick={unlink} className={`${quietButton} !py-1`}><Link2Off className="h-3.5 w-3.5" /> Unlink from OIAA</button>}
          <button type="button" onClick={remove} className={`${dangerButton} !py-1`}><Trash2 className="h-3.5 w-3.5" /> Delete</button>
        </div>
      )}
      <ErrorNote error={error} />
    </Card>
  );
}

const blankMeeting = (group) => ({
  recurrence: "weekly", name: group.title, day_of_week: "", start_minute: null, end_minute: null, starts_at: "", ends_at: "",
  time_zone: group.time_zone, conference_url: "", conference_url_notes: "", conference_phone: "", location: "", formatted_address: "",
  notes: "", types: [],
});

// Add or edit a meeting (a weekly one can be on several days). While the details are
// typed, likely OIAA listings show underneath; picking one links the meeting and fills it
// in from OIAA.
function MeetingEditor({ group, series, onClose, onSaved }) {
  const meeting = series?.[0] || null;
  const [form, setForm] = useState(() =>
    meeting
      ? { ...blankMeeting(group), ...meeting, days: series.map((m) => m.day_of_week).filter((d) => d != null) }
      : { ...blankMeeting(group), days: [] }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const linked = Boolean(meeting?.oiaa_slug);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleDay = (d) => set({ days: form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d].sort() });

  const matchQuery = useMemo(() => {
    if (linked) return null;
    const params = new URLSearchParams({ group_name: group.title, name: form.name || "", conference_url: form.conference_url || "", time_zone: form.time_zone });
    if (form.recurrence === "weekly" && form.days.length > 0 && form.start_minute != null) {
      params.set("day", form.days[0]);
      params.set("start_minute", form.start_minute);
    }
    return params.toString();
  }, [linked, group.title, form.name, form.conference_url, form.time_zone, form.recurrence, form.days, form.start_minute]);

  const [matches, setMatches] = useState([]);
  useEffect(() => {
    if (!matchQuery) return undefined;
    const timer = setTimeout(() => {
      api(`/oiaa/matches?${matchQuery}`).then((d) => setMatches(d.matches)).catch(() => setMatches([]));
    }, 450);
    return () => clearTimeout(timer);
  }, [matchQuery]);
  const alreadyHere = new Set(group.meetings.map((m) => m.oiaa_slug).filter(Boolean));

  const { days, ...fields } = form;
  const base = `/groups/${group.slug}/meetings`;

  const run = async (work) => {
    setSaving(true);
    setError(null);
    try {
      await work();
      onSaved();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  const save = () => run(async () => {
    if (!meeting) {
      if (fields.recurrence === "weekly" && days.length === 0) throw new Error("Pick the days it meets.");
      await api(base, { method: "POST", body: { meeting: fields, days } });
      return;
    }
    if (linked || fields.recurrence === "once") {
      // linked: only notes and place change; one-time: a single meeting
      await Promise.all(series.map((m) => api(`${base}/${m.id}`, { method: "PATCH", body: { meeting: { ...fields, day_of_week: m.day_of_week } } })));
      return;
    }
    if (days.length === 0) throw new Error("Pick the days it meets.");
    const existing = new Map(series.map((m) => [m.day_of_week, m]));
    await Promise.all([
      ...series.filter((m) => days.includes(m.day_of_week)).map((m) => api(`${base}/${m.id}`, { method: "PATCH", body: { meeting: { ...fields, day_of_week: m.day_of_week } } })),
      ...series.filter((m) => !days.includes(m.day_of_week)).map((m) => api(`${base}/${m.id}`, { method: "DELETE" })),
    ]);
    const added = days.filter((d) => !existing.has(d));
    if (added.length) await api(base, { method: "POST", body: { meeting: fields, days: added } });
  });

  // Link to an OIAA listing: it brings its own days and details; our notes and place stay
  const useListing = (match) => run(async () => {
    await api(base, { method: "POST", body: { meeting: fields, oiaa_slug: match.slug } });
    if (series) await Promise.all(series.map((m) => api(`${base}/${m.id}`, { method: "DELETE" })));
  });

  return (
    <Card className="space-y-4 p-4 ring-2 ring-accent/30">
      <div className="flex items-center justify-between gap-2">
        <h2 className="!text-base font-semibold text-slate-900 dark:text-white">{meeting ? `Edit ${meeting.name}` : "Add a meeting"}</h2>
        <button type="button" onClick={onClose} className="!bg-transparent p-1 text-slate-400 hover:text-slate-700" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>

      {linked ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          This meeting's schedule and links come from OIAA and stay in step with it. You can add your own notes and location here,
          or unlink it to edit everything yourself.
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-700">
            <SegmentedControl
              options={[{ value: "weekly", label: "Every week" }, { value: "once", label: "One time" }]}
              value={form.recurrence}
              onChange={(recurrence) => set({ recurrence })}
            />
          </div>
          <div>
            <label htmlFor="m-name" className={labelClass}>Name</label>
            <input id="m-name" required className={inputClass} value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          {form.recurrence === "weekly" ? (
            <>
            <fieldset>
              <legend className={labelClass}>Days</legend>
              <div className="flex flex-wrap gap-1.5">
                {LETTERS.map((letter, d) => {
                  const on = form.days.includes(d);
                  return (
                    <button key={d} type="button" aria-pressed={on} aria-label={DAYS[d]} title={DAYS[d]} onClick={() => toggleDay(d)}
                      className={`size-9 rounded-full text-sm font-semibold ring-1 ${on ? "!bg-accent text-white ring-accent" : "!bg-white text-slate-700 ring-neutral-200 hover:!bg-neutral-50 dark:!bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-700"}`}>
                      {letter}
                    </button>
                  );
                })}
                <button type="button" onClick={() => set({ days: form.days.length === 7 ? [] : [0, 1, 2, 3, 4, 5, 6] })} className="!bg-transparent px-2 text-xs font-medium text-accent hover:underline">
                  {form.days.length === 7 ? "Clear" : "Every day"}
                </button>
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="m-start" className={labelClass}>Starts</label>
                <input id="m-start" type="time" className={inputClass} value={toTimeValue(form.start_minute)} onChange={(e) => set({ start_minute: fromTimeValue(e.target.value) })} />
              </div>
              <div>
                <label htmlFor="m-end" className={labelClass}>Ends</label>
                <input id="m-end" type="time" className={inputClass} value={toTimeValue(form.end_minute)} onChange={(e) => set({ end_minute: fromTimeValue(e.target.value) })} />
              </div>
              <ZoneSelect value={form.time_zone} onChange={(time_zone) => set({ time_zone })} />
            </div>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="m-starts-at" className={labelClass}>Starts</label>
                <input id="m-starts-at" type="datetime-local" className={inputClass} value={form.starts_at || ""} onChange={(e) => set({ starts_at: e.target.value })} />
              </div>
              <div>
                <label htmlFor="m-ends-at" className={labelClass}>Ends</label>
                <input id="m-ends-at" type="datetime-local" className={inputClass} value={form.ends_at || ""} min={form.starts_at} onChange={(e) => set({ ends_at: e.target.value })} />
              </div>
              <ZoneSelect value={form.time_zone} onChange={(time_zone) => set({ time_zone })} />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <label htmlFor="m-url" className={labelClass}>Video link</label>
              <input id="m-url" type="url" className={inputClass} placeholder="https://zoom.us/j/…" value={form.conference_url || ""} onChange={(e) => set({ conference_url: e.target.value })} />
            </div>
            <div>
              <label htmlFor="m-pass" className={labelClass}>Passcode / notes</label>
              <input id="m-pass" className={inputClass} value={form.conference_url_notes || ""} onChange={(e) => set({ conference_url_notes: e.target.value })} />
            </div>
            <div>
              <label htmlFor="m-phone" className={labelClass}>Dial-in</label>
              <input id="m-phone" type="tel" className={inputClass} value={form.conference_phone || ""} onChange={(e) => set({ conference_phone: e.target.value })} />
            </div>
          </div>
          <fieldset>
            <legend className={labelClass}>Type</legend>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_TYPES.map((code) => {
                const on = form.types.includes(code);
                return (
                  <button key={code} type="button" aria-pressed={on}
                    onClick={() => set({ types: on ? form.types.filter((t) => t !== code) : [...form.types, code] })}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${on ? "!bg-accent text-white ring-accent" : "!bg-white text-slate-700 ring-neutral-200 hover:!bg-neutral-50 dark:!bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-700"}`}>
                    {typeLabel(code)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="m-location" className={labelClass}>Place (in person)</label>
          <input id="m-location" className={inputClass} placeholder="Building or room" value={form.location || ""} onChange={(e) => set({ location: e.target.value })} />
        </div>
        <div>
          <label htmlFor="m-address" className={labelClass}>Address</label>
          <input id="m-address" className={inputClass} value={form.formatted_address || ""} onChange={(e) => set({ formatted_address: e.target.value })} />
        </div>
      </div>
      <div>
        <label htmlFor="m-notes" className={labelClass}>Notes</label>
        <textarea id="m-notes" rows={2} className={inputClass} value={form.notes || ""} onChange={(e) => set({ notes: e.target.value })} />
      </div>

      {!linked && matches.length > 0 && (
        <div className="rounded-xl bg-neutral-100 p-1.5 dark:bg-neutral-800/70">
          <p className="px-2 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Is it one of these on OIAA?</p>
          <div className="space-y-1.5">
            {matches.map((m) => {
              const taken = alreadyHere.has(m.slug) && !series?.some((x) => x.oiaa_slug === m.slug);
              return (
                <div key={m.slug} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 dark:bg-neutral-900">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white">{m.name}{m.group_name && m.group_name !== m.name ? <span className="font-normal text-slate-500"> · {m.group_name}</span> : null}</p>
                    <p className="text-xs text-slate-500 dark:text-neutral-400">
                      {m.schedule_label} · <span className="text-emerald-700 dark:text-emerald-300">{m.reasons.join(", ")}</span>
                    </p>
                  </div>
                  {taken ? (
                    <Pill>Already one of this group's meetings</Pill>
                  ) : (
                    <button type="button" disabled={saving} onClick={() => useListing(m)} className={`${quietButton} !py-1.5`}>
                      <Link2 className="h-4 w-4" /> Use this listing
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="px-2 pb-1 pt-2 text-xs text-slate-500 dark:text-neutral-400">
            Using a listing fills in its details from OIAA and keeps them up to date. Your notes and place are kept.
          </p>
        </div>
      )}

      <ErrorNote error={error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={quietButton}>Cancel</button>
        <button type="button" disabled={saving} onClick={() => save()} className={primaryButton}>
          <Check className="h-4 w-4" /> {saving ? "Saving…" : meeting ? "Save" : matches.length > 0 ? "Save as our own" : "Add meeting"}
        </button>
      </div>
    </Card>
  );
}

function ZoneSelect({ value, onChange }) {
  const known = ZONES.some(([z]) => z === value);
  return (
    <div>
      <label htmlFor="m-zone" className={labelClass}>Time zone</label>
      <select id="m-zone" className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {!known && <option value={value}>{zoneLabel(value)}</option>}
        {ZONES.map(([z, label]) => <option key={z} value={z}>{label}</option>)}
      </select>
    </div>
  );
}

// Search OIAA's directory and import ticked listings, one weekly meeting per day listed
function ImportPanel({ group, onClose, onImported }) {
  const [q, setQ] = useState(group.title);
  const [results, setResults] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const already = new Set(group.meetings.map((m) => m.oiaa_slug).filter(Boolean));

  const search = async (e) => {
    e?.preventDefault();
    setError(null);
    try {
      const data = await api(`/oiaa/search?q=${encodeURIComponent(q)}`);
      setResults(data);
    } catch (err) {
      setError(err.message);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { search(); }, []);

  const toggle = (slug) => setPicked((s) => {
    const next = new Set(s);
    next.has(slug) ? next.delete(slug) : next.add(slug);
    return next;
  });

  const doImport = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await api(`/groups/${group.slug}/meetings/import`, { method: "POST", body: { slugs: [...picked] } });
      onImported(data.meetings);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3 p-4 ring-2 ring-accent/30">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="!text-base font-semibold text-slate-900 dark:text-white">Import from OIAA</h2>
          <p className="text-sm text-slate-500 dark:text-neutral-400">Search OIAA's meeting list by name, or paste a Zoom link or meeting ID.</p>
        </div>
        <button type="button" onClick={onClose} className="!bg-transparent p-1 text-slate-400 hover:text-slate-700" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>
      <form onSubmit={search} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className={`${inputClass} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Meeting or group name" />
        </div>
        <button type="submit" className={quietButton}>Search</button>
      </form>
      <ErrorNote error={error} />
      {results && results.meetings.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-neutral-400">
          {results.synced_at ? "Nothing on OIAA matches that." : "OIAA's meeting list hasn't loaded yet. Try again in a minute."}
        </p>
      )}
      {results && results.meetings.length > 0 && (
        <ul className="max-h-96 divide-y divide-neutral-100 overflow-y-auto rounded-xl ring-1 ring-neutral-200 dark:divide-neutral-800 dark:ring-neutral-700">
          {results.meetings.map((m) => {
            const here = already.has(m.slug);
            return (
              <li key={m.slug}>
                <label className={`flex items-start gap-3 p-3 ${here ? "opacity-60" : "cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/60"}`}>
                  <input type="checkbox" className="mt-1 accent-[var(--color-accent)]" disabled={here} checked={here || picked.has(m.slug)} onChange={() => toggle(m.slug)} />
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-900 dark:text-white">{m.name}</span>
                    <span className="block text-xs text-slate-500 dark:text-neutral-400">
                      {m.schedule_label}{m.group_name ? ` · ${m.group_name}` : ""}{here ? " · already imported" : ""}
                    </span>
                  </span>
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="ml-auto shrink-0 text-slate-400 hover:text-accent" aria-label="Open on OIAA">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={quietButton}>Cancel</button>
        <button type="button" disabled={busy || picked.size === 0} onClick={doImport} className={primaryButton}>
          <DownloadCloud className="h-4 w-4" /> {busy ? "Importing…" : `Import ${picked.size || ""}`.trim()}
        </button>
      </div>
    </Card>
  );
}
