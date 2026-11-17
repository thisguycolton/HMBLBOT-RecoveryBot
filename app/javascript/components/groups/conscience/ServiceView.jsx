import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, Pencil, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { inputClass, labelClass, selectClass } from "../../ui/styles";
import { api } from "../lib";
import { Card, ErrorNote, Loading, Pill, Tray, dangerButton, primaryButton, quietButton } from "../ui";
import { NAMES_REMINDER, dateLabel } from "./lib";
import SlotPicker, { coverageLabel } from "../SlotPicker";

const today = () => new Date().toLocaleDateString("en-CA");

const ROLES = [["", "Nothing extra"], ["can_keep_records", "Record keeper: the agenda, minutes and documents"], ["can_keep_treasury", "Treasurer: the treasurer's reports"], ["can_schedule_hosts", "Host coordinator: the host schedule"]];
const ROLE_LABELS = { can_keep_records: "record keeper", can_keep_treasury: "treasurer", can_schedule_hosts: "host coordinator" };
const ROLE_TITLES = { can_keep_records: "Record keeper", can_keep_treasury: "Treasurer", can_schedule_hosts: "Host coordinator" };

// Common offices to start from (Manage > Offices, and the setup guide's Offices step through
// setup/offices.js): each fills in the form, to change before saving
export const PRESETS = [
  { label: "Secretary", hint: "record keeper", about: "Keeps the agenda, minutes and the group's documents.", form: { title: "Secretary", description: "Keeps the minutes and the agenda for business meetings, and the group's documents.", term_months: 6, sobriety_months: 6, grants: "can_keep_records", on_agenda: true, agenda_lines: "Report: {name}\n{last_month} minutes" } },
  { label: "Treasurer", hint: "treasurer's reports", about: "Keeps the money and posts a report each month.", form: { title: "Treasurer", description: "Counts the basket, pays the rent and the group's bills, and gives the treasurer's report.", term_months: 12, sobriety_months: 12, grants: "can_keep_treasury", on_agenda: true, agenda_lines: "Report: {name}" } },
  { label: "Host Coordinator", hint: "pick time slots", about: "Fills the host schedule and finds subs.", form: { title: "Host Coordinator", description: "Finds hosts and co-hosts for the meetings and fills the empty places.", term_months: 6, sobriety_months: 3, grants: "can_schedule_hosts", host_meeting_ids: null } },
  { label: "GSR", hint: "nothing extra", about: "Carries the group's voice to the district.", form: { title: "GSR", description: "General Service Representative: takes the group's voice to district and area meetings and brings the news back.", term_months: 24, sobriety_months: 12, grants: "", on_agenda: true, agenda_lines: "GSR report: {name}" } },
  { label: "Chair", hint: "nothing extra", about: "Runs the business meeting.", form: { title: "Chair", description: "Chairs the business meetings.", term_months: 6, sobriety_months: 6, grants: "" } },
  { label: "Blank office", hint: "", form: {} },
];

function PositionForm({ slug, position, onSaved, onCancel, canSetRoles, slots = [], preset = {}, fromGrant = null }) {
  const [form, setForm] = useState({
    title: position?.title ?? "", description: position?.description ?? "", term_months: position?.term_months ?? "", sobriety_months: position?.sobriety_months ?? "", on_agenda: position?.on_agenda ?? false, agenda_heading: position?.agenda_heading ?? "", agenda_lines: position?.agenda_lines ?? "", grants: position?.grants ?? "",
    // null: the whole group
    host_meeting_ids: position?.host_meeting_ids?.length ? position.host_meeting_ids : null,
    ...preset,
  });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const { host_meeting_ids: ids, grants, ...rest } = form;
      const service_position = canSetRoles ? { ...rest, grants, ...(grants === "can_schedule_hosts" ? { host_meeting_ids: ids || [] } : {}) } : rest;
      await api(`/groups/${slug}/service_positions${position ? `/${position.id}` : ""}`, { method: position ? "PATCH" : "POST", body: { service_position, ...(fromGrant ? { from_membership_id: fromGrant.membership_id } : {}) } });
      onSaved();
    } catch (err) { setError(err.message); }
  };
  return (
    <Card className="p-4">
      <form onSubmit={save} className="space-y-3">
        <ErrorNote error={error} />
        {fromGrant && <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-100">{fromGrant.name} holds this office from today, so their {ROLE_LABELS[fromGrant.grants]} role comes from it from now on.</p>}
        <div><label htmlFor="sp-title" className={labelClass}>Office</label><input id="sp-title" required autoFocus maxLength={80} className={inputClass} value={form.title} onChange={set("title")} placeholder="e.g. Treasurer" /></div>
        <div><label htmlFor="sp-desc" className={labelClass}>What it involves</label><textarea id="sp-desc" rows={3} maxLength={2000} className={inputClass} value={form.description} onChange={set("description")} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="sp-term" className={labelClass}>A term lasts (months)</label><input id="sp-term" type="number" min="1" max="120" className={inputClass} value={form.term_months ?? ""} onChange={set("term_months")} placeholder="No set length" /></div>
          <div><label htmlFor="sp-sober" className={labelClass}>Sober at least (months)</label><input id="sp-sober" type="number" min="0" max="600" className={inputClass} value={form.sobriety_months ?? ""} onChange={set("sobriety_months")} placeholder="No minimum" /></div>
        </div>
        {canSetRoles && (
          <div>
            <label htmlFor="sp-role" className={labelClass}>What it can do</label>
            <select id="sp-role" className={selectClass} value={form.grants} onChange={set("grants")}>{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Whoever holds the office can do this, and stops when their term ends or passes to the next person (unless another office of theirs allows it too). It needs the holder linked to their account.</p>
            {form.grants === "can_schedule_hosts" && (
              <div className="mt-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950">
                <p className="mb-2 text-sm font-medium text-slate-900 dark:text-white">Which meetings it coordinates</p>
                <SlotPicker slots={slots} value={form.host_meeting_ids} onChange={(ids) => setForm((f) => ({ ...f, host_meeting_ids: ids }))} idPrefix={`sp-${position?.id || "new"}`} />
              </div>
            )}
          </div>
        )}
        <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
            <input type="checkbox" checked={form.on_agenda} onChange={(e) => setForm((f) => ({ ...f, on_agenda: e.target.checked, agenda_lines: e.target.checked && !f.agenda_lines.trim() ? "Report: {name}" : f.agenda_lines }))} />
            Give it a section on every business meeting agenda
          </label>
          {form.on_agenda && (
            <div className="mt-2 space-y-2">
              <div><label htmlFor="sp-heading" className={labelClass}>Agenda heading</label><input id="sp-heading" maxLength={80} className={inputClass} value={form.agenda_heading} onChange={set("agenda_heading")} placeholder={form.title || "The office's name"} /><p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Offices with the same heading share one section. Give all four host coordinators "Host Coordinators" and a line like "9 am: {"{name}"}".</p></div>
              <label htmlFor="sp-lines" className={labelClass}>What goes under it (one line each)</label>
              <textarea id="sp-lines" rows={4} maxLength={2000} className={`${inputClass} font-mono text-sm`} value={form.agenda_lines} onChange={set("agenda_lines")} placeholder={"Report: {name}\nContributions\nReserve $100.00"} />
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">{"{name}"} becomes whoever holds the office on the meeting's day. {"{month}"} and {"{last_month}"} become the meeting's month and the one before ({"\"{last_month} minutes\" prints \"Oct minutes\""}). </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className={quietButton}>Cancel</button><button type="submit" className={primaryButton}>Save</button></div>
      </form>
    </Card>
  );
}

function TermForm({ slug, position, members, onSaved, onCancel }) {
  const [form, setForm] = useState({ name: "", user_id: "", starts_on: today(), ends_on: "" });
  const [error, setError] = useState(null);
  const pick = (e) => {
    const user = members.find((m) => String(m.id) === e.target.value);
    setForm((f) => ({ ...f, user_id: e.target.value, name: user ? user.name : f.name }));
  };
  const save = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api(`/groups/${slug}/service_positions/${position.id}/terms`, { method: "POST", body: { term: form } });
      onSaved();
    } catch (err) { setError(err.message); }
  };
  return (
    <form onSubmit={save} className="mt-3 space-y-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950">
      <ErrorNote error={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`t-user-${position.id}`} className={labelClass}>A member</label>
          <select id={`t-user-${position.id}`} className={selectClass} value={form.user_id} onChange={pick}><option value="">Someone else</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">A member hears when their term is nearly up.</p>
        </div>
        <div><label htmlFor={`t-name-${position.id}`} className={labelClass}>Name on the record</label><input id={`t-name-${position.id}`} required maxLength={80} className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="First name, last initial" /><p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">{NAMES_REMINDER}</p></div>
        <div><label htmlFor={`t-start-${position.id}`} className={labelClass}>Starts</label><input id={`t-start-${position.id}`} type="date" required className={inputClass} value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} /></div>
        <div><label htmlFor={`t-end-${position.id}`} className={labelClass}>Ends</label><input id={`t-end-${position.id}`} type="date" className={inputClass} value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} /><p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">{position.term_months ? `Blank means ${position.term_months} months.` : "Blank means no end date."} Whoever held it before ends the day before.</p></div>
      </div>
      <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className={quietButton}>Cancel</button><button type="submit" className={primaryButton}>Put them in</button></div>
    </form>
  );
}

// The group's elected officials (/conscience/officials; chair, secretary, treasurer, GSR...): what each
// office involves, who holds it and until when, with a heads-up as a term ends. Record keepers
// change it; members read it. (Meeting hosts are a separate schedule: on the Meetings page.)
export default function ServiceView({ group, manage = false }) {
  const slug = group.slug;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // "new" | a position id
  const [preset, setPreset] = useState({}); // what a new office starts with
  const [fromGrant, setFromGrant] = useState(null); // a role given by hand, becoming an office
  const [placing, setPlacing] = useState(null); // position id
  const load = useCallback(() => api(`/groups/${slug}/service_positions`).then(setData).catch((e) => setError(e.message)), [slug]);
  useEffect(() => { load(); }, [load]);
  if (!data) return error ? <ErrorNote error={error} /> : <Loading variant="trays" />;

  const call = async (path, method, body) => {
    setError(null);
    try { await api(`/groups/${slug}/service_positions${path}`, { method, body }); await load(); } catch (e) { setError(e.message); }
  };
  const active = data.positions.filter((p) => !p.archived);
  const archived = data.positions.filter((p) => p.archived);
  const done = async () => { setEditing(null); setPlacing(null); setFromGrant(null); await load(); };
  const startNew = (form = {}, grant = null) => { setPreset(form); setFromGrant(grant); setEditing("new"); };
  const cancelNew = () => { setEditing(null); setFromGrant(null); };

  const card = (p) => (
    editing === p.id ? <PositionForm key={p.id} slug={slug} position={p} canSetRoles={data.can_set_roles} slots={data.slots} onSaved={done} onCancel={() => setEditing(null)} /> : (
      <Card key={p.id} className="p-4">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1 basis-56">
            <h3 className="flex flex-wrap items-center gap-2 !text-base font-semibold text-slate-900 dark:text-white">
              {p.title}
              {p.rotation === "vacant" && <Pill tone="amber">Needs someone</Pill>}
              {p.rotation === "due" && <Pill tone="amber">Term ending</Pill>}
              {p.on_agenda && !p.archived && <Pill tone="accent">On the agenda</Pill>}
              {p.grants && <Pill tone="green">{ROLE_TITLES[p.grants]}{p.grants === "can_schedule_hosts" && data.slots ? ` · ${coverageLabel(p.host_meeting_ids, data.slots)}` : ""}</Pill>}
              {manage && !p.grants && !p.archived && <Pill>Nothing extra</Pill>}
            </h3>
            <p className="text-xs text-slate-500 dark:text-neutral-400">{[p.term_months && `${p.term_months}-month term`, p.sobriety_months != null && `${p.sobriety_months} months sober`].filter(Boolean).join(" · ")}</p>
          </div>
          {data.can_edit && (
            <div className="flex flex-wrap gap-1">
              <button type="button" className={`${quietButton} !px-2 !py-1 !text-xs`} onClick={() => setEditing(p.id)}><Pencil className="size-3.5" /> Change</button>
              <button type="button" className={`${quietButton} !px-2 !py-1 !text-xs`} onClick={() => call(`/${p.id}`, "PATCH", { service_position: { archived: !p.archived } })}><Archive className="size-3.5" /> {p.archived ? "Bring back" : "Retire"}</button>
              <button type="button" className={`${dangerButton} !px-2 !py-1 !text-xs`} onClick={() => window.confirm(`Delete ${p.title} and everyone who held it?`) && call(`/${p.id}`, "DELETE")}><Trash2 className="size-3.5" /></button>
            </div>
          )}
        </div>
        {p.description && <p className="mt-2 whitespace-pre-line text-sm text-slate-600 dark:text-neutral-300">{p.description}</p>}
        <div className="mt-3 rounded-xl bg-neutral-50 p-3 text-sm dark:bg-neutral-950">
          {p.current ? (
            <p><span className="font-medium text-slate-900 dark:text-white">{p.current.name}</span> <span className="text-slate-500 dark:text-neutral-400">since {dateLabel(p.current.starts_on)}{p.current.ends_on ? `, until ${dateLabel(p.current.ends_on)}` : ""}</span></p>
          ) : <p className="italic text-slate-500 dark:text-neutral-400">Nobody serves in it now.</p>}
          {p.current && !p.current.linked && data.can_edit && data.members.length > 0 && (
            <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-neutral-300">
              <span className="min-w-0 basis-48">{p.grants ? `Link ${p.current.name} to their account so they can do what the office allows:` : `Link ${p.current.name} to their account (they'll hear when their term is up):`}</span>
              <select aria-label={`Link ${p.current.name} to an account`} className={`${selectClass} !w-auto !py-1 !text-xs`} value="" onChange={(e) => e.target.value && call(`/${p.id}/terms/${p.current.id}`, "PATCH", { term: { user_id: e.target.value } })}>
                <option value="">Pick a member</option>
                {data.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          )}
          {data.can_edit && !p.archived && placing !== p.id && <button type="button" onClick={() => setPlacing(p.id)} className={`${quietButton} mt-2 !px-2.5 !py-1 !text-xs`}><UserPlus className="size-3.5" /> {p.current ? "Next person" : "Put someone in"}</button>}
          {placing === p.id && <TermForm slug={slug} position={p} members={data.members} onSaved={done} onCancel={() => setPlacing(null)} />}
        </div>
        {p.history.length > 0 && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 dark:text-neutral-400">Who served before ({p.history.length})</summary>
            <ul className="mt-1 space-y-0.5 text-slate-600 dark:text-neutral-300">
              {p.history.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2">{t.name} <span className="text-xs text-slate-500 dark:text-neutral-400">{dateLabel(t.starts_on)}{t.ends_on ? ` to ${dateLabel(t.ends_on)}` : ""}</span>
                  {data.can_edit && <button type="button" aria-label={`Remove ${t.name}'s term`} className="!bg-transparent text-xs text-rose-700 hover:underline dark:text-rose-300" onClick={() => window.confirm("Remove this entry?") && call(`/${p.id}/terms/${t.id}`, "DELETE")}>Remove</button>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>
    )
  );

  const newForm = editing === "new" && <PositionForm key={`new-${fromGrant?.membership_id || preset.title || ""}`} slug={slug} canSetRoles={data.can_set_roles} slots={data.slots} preset={preset} fromGrant={fromGrant} onSaved={done} onCancel={cancelNew} />;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-slate-600 dark:text-neutral-300 basis-56">
          {manage ? "Every permission comes from an office. Give someone an office and they can do what it allows; when their term passes to the next person, so does the permission. Group admins can do everything."
            : "The group's elected officials and how long each serves. Record keepers and the person serving hear when a term is nearly up. Meeting hosts are on the Meetings page."}
        </p>
        {data.can_edit && editing !== "new" && <button type="button" onClick={() => startNew()} className={primaryButton}><Plus className="size-4" /> Add an office</button>}
      </div>
      <ErrorNote error={error} />
      {manage && data.can_edit && editing !== "new" && (
        <Card className="p-4">
          <p className="mb-2 text-sm font-medium text-slate-900 dark:text-white">Start from a common office</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((x) => (
              <button key={x.label} type="button" className={`${quietButton} !px-3 !py-1.5 !text-sm`} onClick={() => startNew(x.form)}>
                {x.label}{x.hint && <span className="text-slate-500 dark:text-neutral-400"> · {x.hint}</span>}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">Each fills in the title, what it involves, a usual term and what it can do. Change anything before saving.</p>
        </Card>
      )}
      {newForm}
      {manage && data.admins && (
        <Card className="flex flex-wrap items-start gap-3 p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1 basis-56">
            <h3 className="flex flex-wrap items-center gap-2 !text-base font-semibold text-slate-900 dark:text-white">Group admin <Pill tone="accent">Everything</Pill></h3>
            <p className="text-sm text-slate-700 dark:text-neutral-200">{data.admins.join(", ")}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Admins can do everything below, plus Manage. Make someone an admin in <Link to={`/${slug}/members`} className="font-medium text-accent hover:underline">Members</Link>.</p>
          </div>
        </Card>
      )}
      {active.length === 0 && editing !== "new" && <Card className="p-5 text-sm text-slate-600 dark:text-neutral-300">{data.can_edit ? "No offices yet. Add the chair, secretary, treasurer, GSR and whatever else your group elects." : "The group hasn't listed its elected officials yet."}</Card>}
      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">{active.map(card)}</div>
      {manage && data.hand_grants?.length > 0 && (
        <Tray label={`Given by hand, the old way (${data.hand_grants.length})`}>
          <div className="space-y-1.5">
            <p className="px-1 text-sm text-slate-600 dark:text-neutral-300">These were given in Members before offices gave permissions. They keep working. Make each one an office so it ends with a term like the rest.</p>
            {data.hand_grants.map((g) => (
              <Card key={`${g.membership_id}-${g.grants}`} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-medium text-slate-900 dark:text-white">{g.name}</p>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">{ROLE_TITLES[g.grants]}{g.grants === "can_schedule_hosts" && data.slots ? ` · ${coverageLabel(g.host_meeting_ids, data.slots)}` : ""}</p>
                </div>
                <button type="button" className={`${primaryButton} !px-2.5 !py-1 !text-xs`}
                  onClick={() => startNew({ title: ROLE_TITLES[g.grants] === "Record keeper" ? "Secretary" : ROLE_TITLES[g.grants], grants: g.grants, host_meeting_ids: g.host_meeting_ids.length ? g.host_meeting_ids : null }, g)}>
                  Make it an office
                </button>
                <button type="button" className={`${dangerButton} !px-2.5 !py-1 !text-xs`}
                  onClick={async () => {
                    if (!window.confirm(`Take the ${ROLE_LABELS[g.grants]} role back from ${g.name}?`)) return;
                    setError(null);
                    try { await api(`/groups/${slug}/memberships/${g.membership_id}`, { method: "PATCH", body: { [g.grants]: false } }); await load(); } catch (e) { setError(e.message); }
                  }}>
                  Take it back
                </button>
              </Card>
            ))}
          </div>
        </Tray>
      )}
      {manage && (
        <Tray label="Hosts">
          <Card className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1 basis-56">
              <p className="font-medium text-slate-900 dark:text-white">Can host</p>
              <p className="text-xs text-slate-500 dark:text-neutral-400">Not an office: a list of members who can host or co-host. Host coordinators keep it up to date.</p>
            </div>
            <Link to={`/${slug}/meetings#who-can-host`} className={`${quietButton} !px-2.5 !py-1 !text-xs`}>Edit the list</Link>
          </Card>
        </Tray>
      )}
      {archived.length > 0 && <Tray label="Offices no longer used"><div className="grid gap-1.5 lg:grid-cols-2">{archived.map(card)}</div></Tray>}
    </div>
  );
}
