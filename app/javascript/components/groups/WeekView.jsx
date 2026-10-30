import React, { useCallback, useEffect, useState } from "react";
import { BellRing, CalendarX, ChevronLeft, ChevronRight, UserPlus, X } from "lucide-react";
import Toggle from "../ui/Toggle";
import { inputClass } from "../ui/styles";
import { api, clock } from "./lib";
import { parseDay } from "./conscience/lib";
import { Card, ErrorNote, Loading, Pill, Tray, primaryButton, quietButton } from "./ui";

const PLACES = [["host", "Host"], ["co_host", "Co-host"]];
const small = `${quietButton} !px-2 !py-0.5 !text-xs`;
const dayName = (iso, opts = { weekday: "long", month: "short", day: "numeric" }) => parseDay(iso).toLocaleDateString([], opts);
const addDays = (iso, n) => { const d = parseDay(iso); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const gap = (item) => PLACES.some(([role]) => !item[role].name || item[role].request);

// "I can't make it" / "Ask for a sub": one place on one date, sent to the members who can host
function AskForm({ slug, item, role, mine, onDone, onCancel }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const send = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api(`/groups/${slug}/host_sub_requests`, { method: "POST", body: { sub_request: { meeting_id: item.meeting_id, role, on: item.on, note } } });
      onDone();
    } catch (err) { setError(err.message); }
  };
  return (
    <form onSubmit={send} className="mt-2 space-y-2 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950">
      <p className="text-sm font-medium text-slate-800 dark:text-neutral-100">{mine ? "Can't make it" : "Ask for a sub"}: {role === "host" ? "host" : "co-host"} for {item.name}, {dayName(item.on)}</p>
      <ErrorNote error={error} />
      <input className={inputClass} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={mine ? "A note (optional), e.g. I'm out of town" : "A note (optional)"} aria-label="Note" />
      <p className="text-xs text-slate-500 dark:text-neutral-400">The members who can host get a notification. The first to take it is put on for that date.</p>
      <div className="flex justify-end gap-2">
        <button type="button" className={quietButton} onClick={onCancel}>Cancel</button>
        <button type="submit" className={primaryButton}><BellRing className="size-4" /> Send it out</button>
      </div>
    </form>
  );
}

// A coordinator putting someone in one place on one date (a cover): a member from the list, or
// any name typed in
function FillForm({ slug, item, role, members, onDone, onCancel }) {
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const listId = `fill-${item.meeting_id}-${item.on}-${role}`;
  const save = async (e) => {
    e.preventDefault();
    setError(null);
    const member = members.find((m) => m.name.toLowerCase() === name.trim().toLowerCase());
    try {
      await api(`/groups/${slug}/meeting_host_covers`, { method: "POST", body: { cover: { meeting_id: item.meeting_id, role, on: item.on, name: name.trim(), user_id: member?.id || "" } } });
      onDone();
    } catch (err) { setError(err.message); }
  };
  const quick = members.filter((m) => m.can_host).slice(0, 8);
  return (
    <form onSubmit={save} className="mt-2 space-y-2 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950">
      <p className="text-sm font-medium text-slate-800 dark:text-neutral-100">Who's the {role === "host" ? "host" : "co-host"} for {item.name}, {dayName(item.on)}?</p>
      <ErrorNote error={error} />
      {quick.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {quick.map((m) => <button key={m.id} type="button" onClick={() => setName(m.name)} className={name === m.name ? `${primaryButton} !px-2 !py-0.5 !text-xs` : small}>{m.name}</button>)}
        </div>
      )}
      <input className={inputClass} list={listId} required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="A member, or any name" aria-label="Name" autoFocus />
      <datalist id={listId}>{members.map((m) => <option key={m.id} value={m.name} />)}</datalist>
      <p className="text-xs text-slate-500 dark:text-neutral-400">Just for this date. A member you pick hears about it; an open sub request for it is marked filled.</p>
      <div className="flex justify-end gap-2">
        <button type="button" className={quietButton} onClick={onCancel}>Cancel</button>
        <button type="submit" className={primaryButton} disabled={!name.trim()}><UserPlus className="size-4" /> Put them on</button>
      </div>
    </form>
  );
}

// The dates you're down for, soonest first, each a tap from asking for a sub
function MyDates({ dates, slug, onChanged, call }) {
  const [asking, setAsking] = useState(null);
  if (!dates?.length) return null;
  return (
    <Tray label="Your dates">
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {dates.map((d) => {
          const key = `${d.meeting_id}-${d.on}-${d.role}`;
          return (
            <Card key={key} className="w-56 shrink-0 space-y-1.5 p-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{dayName(d.on, { weekday: "short", month: "short", day: "numeric" })} · {clock(d.start_minute)}</p>
              <p className="truncate text-xs text-slate-500 dark:text-neutral-400">{d.role === "host" ? "Host" : "Co-host"} · {d.name}</p>
              {d.request ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone="amber"><BellRing className="size-3" /> Sub asked</Pill>
                  <button type="button" className={small} onClick={() => window.confirm("Call off the request? You'll be there after all.") && call(`host_sub_requests/${d.request.id}`, "DELETE")}>I'll be there</button>
                </div>
              ) : asking === key ? null : (
                <button type="button" className={small} onClick={() => setAsking(key)}><CalendarX className="size-3.5" /> I can't make it</button>
              )}
            </Card>
          );
        })}
      </div>
      {dates.filter((d) => `${d.meeting_id}-${d.on}-${d.role}` === asking).map((d) => (
        <AskForm key="ask" slug={slug} item={{ ...d, name: d.name }} role={d.role} mine onCancel={() => setAsking(null)} onDone={() => { setAsking(null); onChanged(); }} />
      ))}
    </Tray>
  );
}

// The host schedule a week at a time, by date (/api/groups/:slug/meeting_hosts/week): who is in
// each place on each day, covers and sub requests included. Hosts say they can't make a date,
// anyone can take a sub, and coordinators fill a gap right on its date.
export default function WeekView({ group, onChanged }) {
  const slug = group.slug;
  const [start, setStart] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [open, setOpen] = useState(null); // { key, kind: "ask" | "fill" }
  const load = useCallback(() => api(`/groups/${slug}/meeting_hosts/week${start ? `?start=${start}` : ""}`).then(setData).catch((e) => setError(e.message)), [slug, start]);
  useEffect(() => { load(); }, [load]);

  const changed = () => { setOpen(null); load(); onChanged?.(); };
  const call = async (path, method) => {
    setError(null);
    try { await api(`/groups/${slug}/${path}`, { method }); changed(); } catch (e) { setError(e.message); }
  };
  if (!data) return error ? <ErrorNote error={error} /> : <Loading />;
  if (!data.days.some((d) => d.items.length) && !data.my_dates.length && start === null) return null;

  const days = data.days.map((d) => ({ ...d, items: onlyGaps ? d.items.filter((i) => !i.past && gap(i)) : d.items })).filter((d) => d.items.length);
  const thisWeek = data.start <= data.today && data.today <= addDays(data.start, 6);
  const range = `${dayName(data.start, { month: "short", day: "numeric" })} – ${dayName(addDays(data.start, 6), { month: "short", day: "numeric" })}`;

  const place = (item, role, label) => {
    const p = item[role];
    const key = `${item.meeting_id}-${item.on}-${role}`;
    const live = !item.past;
    return (
      <div key={role} className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{label}</p>
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-slate-900 dark:text-white">
          {p.name ? <span className="font-medium">{p.name}{p.mine && <span className="font-normal text-slate-500 dark:text-neutral-400"> (you)</span>}</span> : <Pill tone="amber">Open</Pill>}
          {p.cover && <Pill>Covering</Pill>}
          {p.request && <Pill tone="amber"><BellRing className="size-3" /> Needs a sub</Pill>}
          {p.cover && item.can_edit && live && (
            <button type="button" aria-label="Take the cover off" title="Take the cover off" className="!bg-transparent text-slate-400 hover:text-rose-600" onClick={() => call(`meeting_host_covers/${p.cover_id}`, "DELETE")}><X className="size-3.5" /></button>
          )}
        </p>
        {p.request?.requested_by && <p className="text-xs text-slate-500 dark:text-neutral-400">Asked by {p.request.requested_by}{p.request.note ? ` · ${p.request.note}` : ""}</p>}
        {live && open?.key !== key && (
          <span className="mt-1 flex flex-wrap gap-1">
            {p.request && !p.request.asked_by_me && <button type="button" className={`${primaryButton} !px-2 !py-0.5 !text-xs`} onClick={() => window.confirm(`Cover the ${label.toLowerCase()} place at ${item.name} on ${dayName(item.on)}?`) && call(`host_sub_requests/${p.request.id}/take`, "POST")}>I'll cover it</button>}
            {p.request && (p.request.asked_by_me || item.can_edit) && <button type="button" className={small} onClick={() => call(`host_sub_requests/${p.request.id}`, "DELETE")}>Call off</button>}
            {!p.request && p.mine && <button type="button" className={small} onClick={() => setOpen({ key, kind: "ask" })}><CalendarX className="size-3.5" /> I can't make it</button>}
            {item.can_edit && <button type="button" className={small} onClick={() => setOpen({ key, kind: "fill" })}><UserPlus className="size-3.5" /> {p.name ? "Swap" : "Fill"}</button>}
            {item.can_edit && !p.request && !p.mine && <button type="button" className={small} onClick={() => setOpen({ key, kind: "ask" })}><BellRing className="size-3.5" /> Ask for a sub</button>}
          </span>
        )}
      </div>
    );
  };

  const forms = (item) => PLACES.map(([role]) => {
    const key = `${item.meeting_id}-${item.on}-${role}`;
    if (open?.key !== key) return null;
    return open.kind === "fill"
      ? <FillForm key={key} slug={slug} item={item} role={role} members={data.members || []} onDone={changed} onCancel={() => setOpen(null)} />
      : <AskForm key={key} slug={slug} item={item} role={role} mine={item[role].mine} onDone={changed} onCancel={() => setOpen(null)} />;
  });

  return (
    <div className="space-y-5">
      <MyDates dates={data.my_dates} slug={slug} onChanged={changed} call={call} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button type="button" className={`${quietButton} !px-2`} aria-label="The week before" onClick={() => setStart(addDays(data.start, -7))}><ChevronLeft className="size-4" /></button>
          <p className="min-w-[9.5rem] text-center text-sm font-semibold text-slate-900 dark:text-white">{range}</p>
          <button type="button" className={`${quietButton} !px-2`} aria-label="The week after" onClick={() => setStart(addDays(data.start, 7))}><ChevronRight className="size-4" /></button>
        </div>
        {!thisWeek && <button type="button" className={small} onClick={() => setStart(data.today)}>This week</button>}
        <span className="flex-1" />
        {data.can_edit && <Toggle checked={onlyGaps} onChange={setOnlyGaps} label="Gaps only" />}
      </div>
      <ErrorNote error={error} />
      {days.length === 0 && <Card className="p-5 text-sm text-slate-600 dark:text-neutral-300">{onlyGaps ? "No gaps this week: every place has someone in it." : "No meetings this week."}</Card>}
      {days.map((day) => (
        <Tray key={day.on} label={<>{dayName(day.on)}{day.on === data.today && <span className="ml-2 rounded-full bg-accent px-2 py-px text-[0.65rem] text-white">Today</span>}</>}>
          <div className="space-y-1.5">
            {day.items.map((item) => (
              <Card key={item.meeting_id} className={`p-3 ${item.past ? "opacity-60" : ""}`}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-start">
                  <p className="col-span-2 font-medium text-slate-900 sm:col-span-1 dark:text-white">{clock(item.start_minute)} · {item.name}</p>
                  {PLACES.map(([role, label]) => place(item, role, label))}
                </div>
                {forms(item)}
              </Card>
            ))}
          </div>
        </Tray>
      ))}
    </div>
  );
}
