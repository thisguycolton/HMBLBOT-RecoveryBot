import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, KeyRound, Plus, ShieldCheck, UserRound } from "lucide-react";
import { inputClass, labelClass, selectClass } from "../../ui/styles";
import { api } from "../lib";
import { ErrorNote, Loading, Pill, primaryButton, quietButton } from "../ui";
import { GRANT_LABELS, OFFICE_PRESETS, grantSentence } from "./offices";

// today in the group's time zone, so a term starting "today" is current there
const today = (zone) => new Date().toLocaleDateString("en-CA", { timeZone: zone });
const sameTitle = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Step 3 of the setup guide: pick the group's offices from the usual ones (or make your own),
// see what each lets its holder do on the site, and say who holds it now. Uses the same API as
// Manage > Offices and Group conscience > Officials (ServicePosition, ServiceTerm), so it all
// shows up there. The pre-made offices are Manage > Offices' own (setup/offices.js).
export default function OfficesStep({ group, footer }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const slug = group.slug;

  const load = useCallback(() => api(`/groups/${slug}/service_positions`).then(setData).catch((e) => setError(e.message)), [slug]);
  useEffect(() => { load(); }, [load]);

  const add = async (office) => {
    setBusy(office.key || office.title);
    setError(null);
    try {
      const { key, hint, ...fields } = office; // eslint-disable-line no-unused-vars
      await api(`/groups/${slug}/service_positions`, { method: "POST", body: { service_position: fields } });
      await load();
    } catch (e) { setError(e.message); }
    setBusy(null);
  };

  if (!data) return error ? <ErrorNote error={error} /> : <Loading variant="list" />;
  const positions = data.positions.filter((p) => !p.archived);
  const presetTitles = OFFICE_PRESETS.map((p) => p.title);
  const own = positions.filter((p) => !presetTitles.some((t) => sameTitle(t, p.title)));

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-2xl bg-neutral-50 p-3 text-sm text-slate-700 ring-1 ring-neutral-200 dark:bg-neutral-950 dark:text-neutral-300 dark:ring-neutral-800">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent dark:text-sky-300" />
        <p>Group admins can do everything. Offices are how you share the work: put someone in an office and they get the access it carries. When the next person takes over, it moves to them.</p>
      </div>
      <ErrorNote error={error} />

      <ul className="!m-0 space-y-2 !p-0">
        {OFFICE_PRESETS.map((preset) => {
          const position = positions.find((p) => sameTitle(p.title, preset.title));
          return (
            <OfficeRow key={preset.key} title={preset.title} hint={preset.hint} grants={position ? position.grants : preset.grants}
              position={position} members={data.members} slug={slug} zone={group.time_zone} onChanged={load}
              action={!position && (
                <button type="button" disabled={!!busy} onClick={() => add(preset)} className={quietButton}>
                  <Plus className="size-4" /> {busy === preset.key ? "Adding…" : "Add"}
                </button>
              )} />
          );
        })}
        {own.map((p) => (
          <OfficeRow key={p.id} title={p.title} hint={p.description} grants={p.grants} position={p} members={data.members} slug={slug} zone={group.time_zone} onChanged={load} />
        ))}
      </ul>

      <CustomOffice busy={!!busy} onAdd={(fields) => add(fields)} />

      <p className="text-xs text-slate-500 dark:text-neutral-400">
        Terms, sobriety minimums, agenda reports and a host coordinator's time slots can be changed later in{" "}
        <Link to={`/${slug}/manage/offices`} className="text-accent hover:underline">Manage &gt; Offices</Link>.
      </p>
      {footer({ canContinue: positions.length > 0 })}
    </div>
  );
}

function OfficeRow({ title, hint, grants, position, members, slug, zone, onChanged, action }) {
  const [picking, setPicking] = useState(false);
  const holder = position?.current;
  return (
    <li className={`list-none rounded-2xl p-3 ring-1 ${position ? "bg-white ring-emerald-200 dark:bg-neutral-900 dark:ring-emerald-900" : "bg-neutral-50 ring-neutral-200 dark:bg-neutral-950 dark:ring-neutral-800"}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            {title} {position && <Pill tone="green"><Check className="size-3" /> Added</Pill>}
          </p>
          {hint && <p className="text-xs text-slate-500 dark:text-neutral-400">{hint}</p>}
          <p className={`mt-1.5 inline-flex items-center gap-1.5 text-xs ${grants ? "text-accent dark:text-sky-300" : "text-slate-500 dark:text-neutral-400"}`}>
            <KeyRound className="size-3.5" /> {grantSentence(grants)}
          </p>
        </div>
        {action}
        {position && !picking && (
          holder ? (
            <button type="button" onClick={() => setPicking(true)} className={`${quietButton} !text-xs`}><UserRound className="size-3.5" /> {holder.name}</button>
          ) : (
            <button type="button" onClick={() => setPicking(true)} className={`${quietButton} !text-xs`}><UserRound className="size-3.5" /> Who holds it?</button>
          )
        )}
      </div>
      {picking && <HolderForm slug={slug} zone={zone} position={position} members={members} onCancel={() => setPicking(false)} onSaved={() => { setPicking(false); onChanged(); }} />}
    </li>
  );
}

// Who holds an office from today: a member (so they get its access) or just a name
function HolderForm({ slug, zone, position, members, onCancel, onSaved }) {
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    const member = members.find((m) => String(m.id) === userId);
    const holderName = member ? member.name : name.trim();
    if (!holderName) { setError("Pick a member or type a name."); return; }
    setBusy(true);
    setError(null);
    try {
      await api(`/groups/${slug}/service_positions/${position.id}/terms`, { method: "POST", body: { term: { name: holderName, user_id: member ? member.id : "", starts_on: today(zone) } } });
      onSaved();
    } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <form onSubmit={save} className="mt-3 space-y-2 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950">
      <ErrorNote error={error} />
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor={`holder-${position.id}`} className={labelClass}>A member</label>
          <select id={`holder-${position.id}`} className={selectClass} value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Someone not on RecoveryBot yet</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        {!userId && (
          <div>
            <label htmlFor={`holder-name-${position.id}`} className={labelClass}>Their name</label>
            <input id={`holder-name-${position.id}`} maxLength={80} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="First name, last initial" />
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500 dark:text-neutral-400">
        {userId ? "They get the office's access from today." : "Once they join, connect their account in Manage > Offices and they get its access."}
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={quietButton}>Cancel</button>
        <button type="submit" disabled={busy} className={primaryButton}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

// An office of the group's own (coffee maker, literature person, Intergroup rep...)
function CustomOffice({ busy, onAdd }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [grants, setGrants] = useState("");
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={quietButton}><Plus className="size-4" /> Another office</button>;
  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onAdd({ title: title.trim(), grants });
    setTitle("");
    setGrants("");
    setOpen(false);
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200 dark:bg-neutral-950 dark:ring-neutral-800">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="custom-office" className={labelClass}>Office</label>
          <input id="custom-office" autoFocus maxLength={80} className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Literature Chair" />
        </div>
        <div>
          <label htmlFor="custom-grants" className={labelClass}>Whoever holds it can</label>
          <select id="custom-grants" className={selectClass} value={grants} onChange={(e) => setGrants(e.target.value)}>
            <option value="">Nothing extra on the site</option>
            {Object.entries(GRANT_LABELS).map(([k, v]) => <option key={k} value={k}>{v.can}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className={quietButton}>Cancel</button>
        <button type="submit" disabled={busy || !title.trim()} className={primaryButton}>Add office</button>
      </div>
    </form>
  );
}
