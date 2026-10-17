import React, { useCallback, useEffect, useState } from "react";
import { Archive, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { inputClass, labelClass, selectClass } from "../../ui/styles";
import { api } from "../lib";
import { Card, ErrorNote, Loading, Pill, Tray, dangerButton, primaryButton, quietButton } from "../ui";
import { NAMES_REMINDER, dateLabel } from "./lib";

const today = () => new Date().toLocaleDateString("en-CA");

function PositionForm({ slug, position, onSaved, onCancel }) {
  const [form, setForm] = useState({ title: position?.title ?? "", description: position?.description ?? "", term_months: position?.term_months ?? "", sobriety_months: position?.sobriety_months ?? "" });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api(`/groups/${slug}/service_positions${position ? `/${position.id}` : ""}`, { method: position ? "PATCH" : "POST", body: { service_position: form } });
      onSaved();
    } catch (err) { setError(err.message); }
  };
  return (
    <Card className="p-4">
      <form onSubmit={save} className="space-y-3">
        <ErrorNote error={error} />
        <div><label htmlFor="sp-title" className={labelClass}>Position</label><input id="sp-title" required autoFocus maxLength={80} className={inputClass} value={form.title} onChange={set("title")} placeholder="e.g. Treasurer" /></div>
        <div><label htmlFor="sp-desc" className={labelClass}>What it involves</label><textarea id="sp-desc" rows={3} maxLength={2000} className={inputClass} value={form.description} onChange={set("description")} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="sp-term" className={labelClass}>A term lasts (months)</label><input id="sp-term" type="number" min="1" max="120" className={inputClass} value={form.term_months ?? ""} onChange={set("term_months")} placeholder="No set length" /></div>
          <div><label htmlFor="sp-sober" className={labelClass}>Sober at least (months)</label><input id="sp-sober" type="number" min="0" max="600" className={inputClass} value={form.sobriety_months ?? ""} onChange={set("sobriety_months")} placeholder="No minimum" /></div>
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

// Service positions (/conscience/service): what each involves, who holds it and until when, with a
// heads-up as a term ends. Record keepers change it; members read it.
export default function ServiceView({ group }) {
  const slug = group.slug;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // "new" | a position id
  const [placing, setPlacing] = useState(null); // position id
  const load = useCallback(() => api(`/groups/${slug}/service_positions`).then(setData).catch((e) => setError(e.message)), [slug]);
  useEffect(() => { load(); }, [load]);
  if (!data) return error ? <ErrorNote error={error} /> : <Loading />;

  const call = async (path, method, body) => {
    setError(null);
    try { await api(`/groups/${slug}/service_positions${path}`, { method, body }); await load(); } catch (e) { setError(e.message); }
  };
  const active = data.positions.filter((p) => !p.archived);
  const archived = data.positions.filter((p) => p.archived);
  const done = async () => { setEditing(null); setPlacing(null); await load(); };

  const card = (p) => (
    editing === p.id ? <PositionForm key={p.id} slug={slug} position={p} onSaved={done} onCancel={() => setEditing(null)} /> : (
      <Card key={p.id} className="p-4">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="flex flex-wrap items-center gap-2 !text-base font-semibold text-slate-900 dark:text-white">
              {p.title}
              {p.rotation === "vacant" && <Pill tone="amber">Needs someone</Pill>}
              {p.rotation === "due" && <Pill tone="amber">Term ending</Pill>}
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-slate-600 dark:text-neutral-300">Who serves the group, for how long. Record keepers and the person serving hear when a term is nearly up.</p>
        {data.can_edit && editing !== "new" && <button type="button" onClick={() => setEditing("new")} className={primaryButton}><Plus className="size-4" /> Add a position</button>}
      </div>
      <ErrorNote error={error} />
      {editing === "new" && <PositionForm slug={slug} onSaved={done} onCancel={() => setEditing(null)} />}
      {active.length === 0 && editing !== "new" && <Card className="p-5 text-sm text-slate-600 dark:text-neutral-300">{data.can_edit ? "No service positions yet. Add the chair, secretary, treasurer, GSR and whatever else your group has." : "The group hasn't listed its service positions yet."}</Card>}
      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">{active.map(card)}</div>
      {archived.length > 0 && <Tray label="Retired positions"><div className="grid gap-1.5 lg:grid-cols-2">{archived.map(card)}</div></Tray>}
    </div>
  );
}
