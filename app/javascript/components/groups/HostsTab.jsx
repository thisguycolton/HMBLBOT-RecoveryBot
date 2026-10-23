import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BellRing, CalendarClock, CalendarX, Link2, MonitorPlay, Plus, Printer, ScrollText, Trash2, UserCheck, UserMinus, UserPlus, X } from "lucide-react";
import Toggle from "../ui/Toggle";
import usePrintable, { printTitled } from "../../lib/usePrintable";
import { inputClass, labelClass, selectClass } from "../ui/styles";
import { DAYS, api, clock } from "./lib";
import { dateLabel, documentsPath, longDate } from "./conscience/lib";
import { Card, ErrorNote, Loading, Pill, Tray, dangerButton, primaryButton, quietButton } from "./ui";

const ROLES = [["host", "Host"], ["co_host", "Co-host"]];
const SHORT = { host: "Host", co_host: "Co-host" };
const today = () => new Date().toLocaleDateString("en-CA");

// Putting someone in a place (the host's or the co-host's) at a meeting, from a date, and for all
// the days the meeting runs if that's the same person
function AssignForm({ slug, slot, role, members, onDone, onCancel, setData }) {
  const [form, setForm] = useState({ name: "", user_id: "", starts_on: today(), ends_on: "", all_days: false });
  const [error, setError] = useState(null);
  const pick = (e) => {
    const m = members.find((x) => String(x.id) === e.target.value);
    setForm((f) => ({ ...f, user_id: e.target.value, name: m ? m.name : f.name }));
  };
  const save = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      setData(await api(`/groups/${slug}/meeting_hosts`, { method: "POST", body: { meeting_host: { ...form, meeting_id: slot.id, role } } }));
      onDone();
    } catch (err) { setError(err.message); }
  };
  const field = (id, label, input) => <div><label htmlFor={id} className={labelClass}>{label}</label>{input}</div>;
  return (
    <form onSubmit={save} className="mt-2 space-y-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950">
      <p className="text-sm font-medium text-slate-800 dark:text-neutral-100">{SHORT[role]} for {slot.name}, {DAYS[slot.day_of_week]} at {clock(slot.start_minute)}</p>
      <ErrorNote error={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        {field(`h-user-${slot.id}-${role}`, "A member", <select id={`h-user-${slot.id}-${role}`} className={selectClass} value={form.user_id} onChange={pick}><option value="">Someone else</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}{m.can_host ? " (can host)" : ""}</option>)}</select>)}
        {field(`h-name-${slot.id}-${role}`, "Name on the schedule", <input id={`h-name-${slot.id}-${role}`} required maxLength={80} className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="First name, last initial" />)}
        {field(`h-from-${slot.id}-${role}`, "From", <input id={`h-from-${slot.id}-${role}`} type="date" required className={inputClass} value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} />)}
        {field(`h-to-${slot.id}-${role}`, "Until (optional)", <input id={`h-to-${slot.id}-${role}`} type="date" className={inputClass} value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} />)}
      </div>
      <p className="-mt-1 text-xs text-slate-500 dark:text-neutral-400">Whoever is in this place now ends the day before. A member is told they've been put on.</p>
      {slot.series_ids.length > 1 && <Toggle checked={form.all_days} onChange={(v) => setForm({ ...form, all_days: v })} label={`Every day this meeting runs (${slot.series_ids.length} days)`} description={`${slot.name} at ${clock(slot.start_minute)}, all week`} />}
      <div className="flex justify-end gap-2"><button type="button" className={quietButton} onClick={onCancel}>Cancel</button><button type="submit" className={primaryButton}><UserPlus className="size-4" /> Put them on</button></div>
    </form>
  );
}

// Connecting a name on the schedule to a member's account, everywhere that name is written, so
// they're told about changes, can turn on reminders and get the host tools. A member whose name
// matches is picked to start with.
function LinkForm({ slug, person, members, onDone, onCancel, setData }) {
  const match = members.find((m) => m.name.trim().toLowerCase() === person.name.trim().toLowerCase());
  const [userId, setUserId] = useState(String(person.user_id || match?.id || ""));
  const [error, setError] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      setData(await api(`/groups/${slug}/meeting_hosts/link`, { method: "POST", body: { name: person.name, user_id: userId || null } }));
      onDone();
    } catch (err) { setError(err.message); }
  };
  return (
    <form onSubmit={save} className="mt-2 space-y-2 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950">
      <label htmlFor={`link-${person.id}`} className={labelClass}>Whose account is “{person.name}”?</label>
      <select id={`link-${person.id}`} className={selectClass} value={userId} onChange={(e) => setUserId(e.target.value)}>
        <option value="">Not connected to an account</option>
        {members.map((m) => <option key={m.id} value={m.id}>{m.name}{match?.id === m.id ? " (same name)" : ""}</option>)}
      </select>
      <p className="text-xs text-slate-500 dark:text-neutral-400">Every place and cover written as “{person.name}” is connected. They're told, and can turn on reminders in their account settings.</p>
      <ErrorNote error={error} />
      <div className="flex justify-end gap-2"><button type="button" className={quietButton} onClick={onCancel}>Cancel</button><button type="submit" className={primaryButton}><Link2 className="size-4" /> Save</button></div>
    </form>
  );
}

// Someone covering one date (a swap)
function CoverForm({ slug, slot, members, onDone, onCancel, setData }) {
  const [form, setForm] = useState({ role: "host", on: slot.next_on || today(), name: "", user_id: "" });
  const [error, setError] = useState(null);
  const pick = (e) => {
    const m = members.find((x) => String(x.id) === e.target.value);
    setForm((f) => ({ ...f, user_id: e.target.value, name: m ? m.name : f.name }));
  };
  const save = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      setData(await api(`/groups/${slug}/meeting_host_covers`, { method: "POST", body: { cover: { ...form, meeting_id: slot.id } } }));
      onDone();
    } catch (err) { setError(err.message); }
  };
  return (
    <form onSubmit={save} className="mt-2 space-y-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950">
      <p className="text-sm font-medium text-slate-800 dark:text-neutral-100">Cover one date of {slot.name} ({DAYS[slot.day_of_week]}s, {clock(slot.start_minute)})</p>
      <ErrorNote error={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor={`c-role-${slot.id}`} className={labelClass}>Covering as</label><select id={`c-role-${slot.id}`} className={selectClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label htmlFor={`c-on-${slot.id}`} className={labelClass}>On</label><input id={`c-on-${slot.id}`} type="date" required className={inputClass} value={form.on} onChange={(e) => setForm({ ...form, on: e.target.value })} /></div>
        <div><label htmlFor={`c-user-${slot.id}`} className={labelClass}>A member</label><select id={`c-user-${slot.id}`} className={selectClass} value={form.user_id} onChange={pick}><option value="">Someone else</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
        <div><label htmlFor={`c-name-${slot.id}`} className={labelClass}>Name on the schedule</label><input id={`c-name-${slot.id}`} required maxLength={80} className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="First name, last initial" /></div>
      </div>
      <div className="flex justify-end gap-2"><button type="button" className={quietButton} onClick={onCancel}>Cancel</button><button type="submit" className={primaryButton}>Save</button></div>
    </form>
  );
}

// "Need a sub": a host coordinator, or the host or co-host who won't be there (`roles` is then
// just their own places), asks the members who can host to fill one place on one date
function SubForm({ slug, slot, roles = ROLES, mine = false, onDone, onCancel, setData }) {
  const [form, setForm] = useState({ role: roles[0][0], on: slot.next_on || today(), note: "" });
  const [error, setError] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      setData(await api(`/groups/${slug}/host_sub_requests`, { method: "POST", body: { sub_request: { ...form, meeting_id: slot.id } } }));
      onDone();
    } catch (err) { setError(err.message); }
  };
  return (
    <form onSubmit={save} className="mt-2 space-y-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950">
      <p className="text-sm font-medium text-slate-800 dark:text-neutral-100">{mine ? "Can't make it to" : "Ask for a sub at"} {slot.name} ({DAYS[slot.day_of_week]}s, {clock(slot.start_minute)})</p>
      <ErrorNote error={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor={`s-role-${slot.id}`} className={labelClass}>Place to fill</label><select id={`s-role-${slot.id}`} className={selectClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{roles.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label htmlFor={`s-on-${slot.id}`} className={labelClass}>On</label><input id={`s-on-${slot.id}`} type="date" required min={today()} className={inputClass} value={form.on} onChange={(e) => setForm({ ...form, on: e.target.value })} /></div>
        <div className="sm:col-span-2"><label htmlFor={`s-note-${slot.id}`} className={labelClass}>Note (optional)</label><input id={`s-note-${slot.id}`} maxLength={300} className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={mine ? "e.g. I'm out of town" : "e.g. Kim is out of town"} /></div>
      </div>
      <p className="-mt-1 text-xs text-slate-500 dark:text-neutral-400">The members who can host get a notification (every member, if nobody is marked as able to host). The first to take it is put on for that date.</p>
      <div className="flex justify-end gap-2"><button type="button" className={quietButton} onClick={onCancel}>Cancel</button><button type="submit" className={primaryButton}><BellRing className="size-4" /> Send it out</button></div>
    </form>
  );
}

// The open "Need a sub" requests, at the top of the tab, for every member to take
function SubRequests({ requests, edit, call }) {
  if (!requests?.length) return null;
  return (
    <Card className="space-y-2 p-3 ring-1 ring-amber-300/60 dark:ring-amber-500/40">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><BellRing className="size-4 text-amber-500" /> {requests.length === 1 ? "A sub is needed" : `${requests.length} subs are needed`}</p>
      <ul className="space-y-2">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 rounded-lg bg-neutral-50 p-2.5 sm:flex-row sm:items-center dark:bg-neutral-950">
            <div className="min-w-0 flex-1 text-sm">
              <p className="text-slate-900 dark:text-white"><span className="font-medium">{SHORT[r.role]}</span> for {r.meeting_name}, {longDate(r.on)} at {clock(r.start_minute)}</p>
              {(r.note || r.requested_by) && <p className="text-xs text-slate-500 dark:text-neutral-400">{[r.note, r.requested_by && `asked by ${r.requested_by}`].filter(Boolean).join(" · ")}</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" className={`${primaryButton} flex-1 !py-1.5 !text-sm sm:flex-none`} onClick={() => window.confirm(`Cover the ${SHORT[r.role].toLowerCase()} place at ${r.meeting_name} on ${longDate(r.on)}?`) && call(`host_sub_requests/${r.id}/take`, "POST")}>I'll cover it</button>
              {(edit || r.asked_by_me) && <button type="button" className={`${quietButton} !py-1.5 !text-sm`} onClick={() => window.confirm("Call off this request?") && call(`host_sub_requests/${r.id}`, "DELETE")}>Call off</button>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// The group's format and scripts, for whoever is about to run a meeting
function Formats({ slug, formats }) {
  if (!formats?.length) return null;
  return (
    <Card className="flex flex-wrap items-center gap-2 p-3">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><ScrollText className="size-4 text-accent" /> Our format</span>
      {formats.map((d) => (
        <Link key={d.id} to={documentsPath(slug, d.id)} className={`${quietButton} !px-2.5 !py-1 !text-sm`}>
          {d.title}{d.visibility === "hosts" && <UserCheck className="size-3.5 text-slate-400" aria-label="Kept for hosts" />}
        </Link>
      ))}
    </Card>
  );
}

// Host coordinators mark which members can host or co-host: they read the format kept for hosts
// and are the ones asked when a host won't be there
function WhoCanHost({ slug, members, reload }) {
  const [error, setError] = useState(null);
  const toggle = async (m) => {
    setError(null);
    try {
      await api(`/groups/${slug}/memberships/${m.membership_id}`, { method: "PATCH", body: { can_host: !m.can_host } });
      await reload();
    } catch (e) { setError(e.message); }
  };
  const count = members.filter((m) => m.can_host).length;
  return (
    <Tray label={`Who can host (${count})`}>
      <Card className="space-y-2 p-3">
        <p className="text-sm text-slate-600 dark:text-neutral-300">Members marked here can read the format kept for hosts, and hear about it when a host or co-host won't be there.</p>
        <ErrorNote error={error} />
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <button key={m.id} type="button" aria-pressed={m.can_host} onClick={() => toggle(m)}
              className={`${quietButton} !px-2.5 !py-1 !text-sm ${m.can_host ? "!bg-emerald-100 !text-emerald-800 dark:!bg-emerald-900/40 dark:!text-emerald-200" : ""}`}>
              {m.can_host && <UserCheck className="size-3.5" />} {m.name}
            </button>
          ))}
        </div>
      </Card>
    </Tray>
  );
}

// The host and co-host of every weekly meeting (/groups/:slug/hosts), by day. The schedule is for
// members; group admins and the people they marked as scheduling hosts change it.
export default function HostsTab({ group }) {
  usePrintable();
  const slug = group.slug;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [open, setOpen] = useState(null); // { slotId, role | "cover" | "sub" | "mine" }
  const load = useCallback(() => api(`/groups/${slug}/meeting_hosts`).then(setData).catch((e) => setError(e.message)), [slug]);
  useEffect(() => { load(); }, [load]);
  if (!data) return error ? <ErrorNote error={error} /> : <Loading />;

  const edit = data.can_edit;
  const call = async (path, method, body) => {
    setError(null);
    try { setData(await api(`/groups/${slug}/${path}`, { method, body })); } catch (e) { setError(e.message); }
  };
  const isOpen = (slot) => !slot.host && !slot.host_lined_up || !slot.co_host && !slot.co_host_lined_up;
  const slots = data.slots.filter((s) => !onlyOpen || isOpen(s));
  const s = data.summary;
  const openTotal = s.open_hosts + s.open_co_hosts;

  const cell = (slot, role) => {
    const person = slot[role];
    const later = slot[`${role}_lined_up`];
    const showing = open?.slotId === slot.id && open?.role === role;
    return (
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{SHORT[role]}</p>
        {person ? (
          <p className="text-sm text-slate-900 dark:text-white">
            <span className="font-medium">{person.name}</span>
            {person.linked && <UserCheck className="ml-1 inline size-3.5 align-[-2px] text-emerald-600 dark:text-emerald-400" aria-label="Connected to their account" title="Connected to their account" />}
            {person.ends_on && <span className="text-xs text-slate-500 dark:text-neutral-400"> until {dateLabel(person.ends_on)}</span>}
          </p>
        ) : later ? <p className="text-sm italic text-slate-500 dark:text-neutral-400">Starts {dateLabel(later.starts_on)}</p>
          : <Pill tone="amber">Open</Pill>}
        {person && later && <p className="text-xs text-slate-500 dark:text-neutral-400">Then {later.name} from {dateLabel(later.starts_on)}</p>}
        {edit && !showing && (
          <span className="mt-1 flex flex-wrap gap-1">
            <button type="button" className={`${quietButton} !px-2 !py-0.5 !text-xs`} onClick={() => setOpen({ slotId: slot.id, role })}><UserPlus className="size-3.5" /> {person || later ? "Change" : "Put someone on"}</button>
            {person && data.members?.length > 0 && <button type="button" className={`${quietButton} !px-2 !py-0.5 !text-xs`} onClick={() => setOpen({ slotId: slot.id, role: `link-${role}` })}><Link2 className="size-3.5" /> {person.linked ? "Account" : "Connect account"}</button>}
            {person && <button type="button" className={`${quietButton} !px-2 !py-0.5 !text-xs`} title="Ends today" onClick={() => window.confirm(`${person.name} steps down as ${SHORT[role].toLowerCase()}?`) && call(`meeting_hosts/${person.id}`, "PATCH", { meeting_host: { ends_on: today() } })}><UserMinus className="size-3.5" /> Step down</button>}
            {person && <button type="button" aria-label={`Remove ${person.name}`} className={`${dangerButton} !px-1.5 !py-0.5`} onClick={() => window.confirm(`Remove ${person.name} from the schedule, as if they never were ${SHORT[role].toLowerCase()}?`) && call(`meeting_hosts/${person.id}`, "DELETE")}><Trash2 className="size-3.5" /></button>}
          </span>
        )}
      </div>
    );
  };

  const row = (slot) => (
    <Card key={slot.id} className="p-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-start">
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-white">{clock(slot.start_minute)} · {slot.name}
            {data.can_host && <Link to={`/${slug}/host/${slot.id}`} className="ml-1.5 inline-flex align-middle text-slate-400 hover:text-accent" aria-label={`HostDeck for ${slot.name}`} title="HostDeck"><MonitorPlay className="size-4" /></Link>}
          </p>
          {slot.next_on && (slot.next_host || slot.next_co_host) && (
            <p className="text-xs text-slate-500 dark:text-neutral-400">Next, {dateLabel(slot.next_on)}: {[slot.next_host && `${slot.next_host.name}${slot.next_host.cover ? " (covering)" : ""}`, slot.next_co_host && `${slot.next_co_host.name}${slot.next_co_host.cover ? " (covering)" : ""}`].filter(Boolean).join(" and ")}</p>
          )}
          {edit && (
            <span className="mt-1 flex flex-wrap gap-1">
              <button type="button" className={`${quietButton} !px-2 !py-0.5 !text-xs`} onClick={() => setOpen({ slotId: slot.id, role: "sub" })}><BellRing className="size-3.5" /> Need a sub</button>
              <button type="button" className={`${quietButton} !px-2 !py-0.5 !text-xs`} onClick={() => setOpen({ slotId: slot.id, role: "cover" })}><CalendarClock className="size-3.5" /> Cover a date</button>
            </span>
          )}
          {!edit && slot.mine?.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-1">
              <button type="button" className={`${quietButton} !px-2 !py-0.5 !text-xs`} onClick={() => setOpen({ slotId: slot.id, role: "mine" })}><CalendarX className="size-3.5" /> I can't make it</button>
            </span>
          )}
        </div>
        {cell(slot, "host")}
        {cell(slot, "co_host")}
      </div>
      {slot.covers.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-neutral-100 pt-2 text-xs text-slate-600 dark:border-neutral-800 dark:text-neutral-300">
          {slot.covers.map((c) => (
            <li key={c.id} className="flex items-center gap-2">{c.name} covers the {SHORT[c.role].toLowerCase()} on {longDate(c.on)}
              {edit && <button type="button" aria-label="Take the cover off" className="!bg-transparent text-slate-400 hover:text-rose-600" onClick={() => call(`meeting_host_covers/${c.id}`, "DELETE")}><X className="size-3.5" /></button>}
            </li>
          ))}
        </ul>
      )}
      {open?.slotId === slot.id && open.role === "sub" && <SubForm slug={slug} slot={slot} setData={setData} onDone={() => setOpen(null)} onCancel={() => setOpen(null)} />}
      {open?.slotId === slot.id && open.role === "mine" && <SubForm slug={slug} slot={slot} mine roles={ROLES.filter(([k]) => slot.mine.includes(k))} setData={setData} onDone={() => setOpen(null)} onCancel={() => setOpen(null)} />}
      {open?.slotId === slot.id && open.role.startsWith("link-") && <LinkForm slug={slug} person={slot[open.role.slice(5)]} members={data.members || []} setData={setData} onDone={() => setOpen(null)} onCancel={() => setOpen(null)} />}
      {open?.slotId === slot.id && !["cover", "sub", "mine"].includes(open.role) && !open.role.startsWith("link-") && <AssignForm slug={slug} slot={slot} role={open.role} members={data.members || []} setData={setData} onDone={() => setOpen(null)} onCancel={() => setOpen(null)} />}
      {open?.slotId === slot.id && open.role === "cover" && <CoverForm slug={slug} slot={slot} members={data.members || []} setData={setData} onDone={() => setOpen(null)} onCancel={() => setOpen(null)} />}
    </Card>
  );

  const days = DAYS.map((name, d) => ({ name, d, slots: slots.filter((x) => x.day_of_week === d) })).filter((x) => x.slots.length);
  const named = (p, later) => p?.name || later?.name || "";
  return (
    <div className="space-y-5">
      <div className="print:hidden space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 basis-full text-sm text-slate-600 sm:basis-auto sm:flex-1 dark:text-neutral-300">
            {data.slots.length === 0 ? "The group has no weekly meetings yet. Add them on the Meetings tab, then put a host and co-host on each."
              : openTotal === 0 ? `Every one of the ${s.places} places has someone in it.`
              : <><strong className="text-slate-900 dark:text-white">{openTotal}</strong> of {s.places} places are open: {s.open_hosts} {s.open_hosts === 1 ? "host" : "hosts"} and {s.open_co_hosts} {s.open_co_hosts === 1 ? "co-host" : "co-hosts"}.</>}
          </p>
          {data.slots.length > 0 && <Toggle checked={onlyOpen} onChange={setOnlyOpen} label="Only meetings with an open place" />}
          {data.slots.length > 0 && <button type="button" className={quietButton} onClick={() => printTitled(`${group.title} hosts`)}><Printer className="size-4" /> Print</button>}
          {data.can_host && <Link to={`/${slug}/host`} className={primaryButton}><MonitorPlay className="size-4" /> HostDeck</Link>}
        </div>
        <ErrorNote error={error} />
        <SubRequests requests={data.sub_requests} edit={edit} call={call} />
        <Formats slug={slug} formats={data.formats} />
        {days.map((day) => <Tray key={day.d} label={day.name}><div className="space-y-1.5">{day.slots.map(row)}</div></Tray>)}
        {slots.length === 0 && data.slots.length > 0 && <Card className="p-5 text-sm text-slate-600 dark:text-neutral-300">Every place is filled.</Card>}
        {edit && data.members?.length > 0 && <WhoCanHost slug={slug} members={data.members} reload={load} />}
      </div>

      <article className="meeting-print hidden print:block">
        <h1>{group.title}: hosts</h1>
        <p className="meeting-print__meta">Who hosts and co-hosts each meeting</p>
        {DAYS.map((name, d) => {
          const day = data.slots.filter((x) => x.day_of_week === d);
          return day.length === 0 ? null : (
            <div key={d}>
              <h2>{name}</h2>
              <table><thead><tr><th>Time</th><th>Meeting</th><th>Host</th><th>Co-host</th></tr></thead>
                <tbody>{day.map((x) => <tr key={x.id}><td>{clock(x.start_minute)}</td><td>{x.name}</td><td>{named(x.host, x.host_lined_up) || "Open"}</td><td>{named(x.co_host, x.co_host_lined_up) || "Open"}</td></tr>)}</tbody></table>
            </div>
          );
        })}
      </article>
    </div>
  );
}
