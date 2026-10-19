import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Globe, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Markdown from "../../book/Markdown";
import { inputClass, selectClass } from "../../ui/styles";
import { api } from "../lib";
import { Card, ErrorNote, Loading, Pill, Tray, dangerButton, primaryButton, quietButton } from "../ui";
import DecisionForm from "./DecisionForm";
import BulkBar, { RowCheck } from "./BulkBar";
import { CATEGORIES, MOTION_STATUS_LABELS, STATUS_TONES, VOTE_METHOD_SHORT, countLabel, dateLabel, longDate, meetingsPath } from "./lib";

const FILTERS = [
  ["standing", "Standing"],
  ["all", "All decisions"],
  ["failed", "Failed"],
  ["unfinished", "Unfinished"],
  ["procedure", "Procedure"],
];
// Only record keepers see these
const KEEPER_FILTERS = [["to_check", "To check"]];
const isDecision = (m) => m.kind === "main" || m.kind === "rescind";

// One line for a motion made about another: "Amend: Make it larger, passed (6 for, 2 against)"
function Aside({ m }) {
  return (
    <li className="text-sm text-slate-600 dark:text-neutral-300">
      <span className="font-medium text-slate-800 dark:text-neutral-100">{m.kind_label}</span>
      {m.title && m.title !== m.kind_label ? `: ${m.title}` : ""} <Pill tone={STATUS_TONES[m.status]}>{MOTION_STATUS_LABELS[m.status]}</Pill>
      {countLabel(m) ? <span className="text-xs text-slate-500 dark:text-neutral-400"> {countLabel(m)}</span> : null}
      {m.committee && <span className="text-xs text-slate-500 dark:text-neutral-400"> · to {m.committee}</span>}
      {m.postponed_to && <span className="text-xs text-slate-500 dark:text-neutral-400"> · until {m.postponed_to}</span>}
    </li>
  );
}

function Decision({ slug, motion: m, parent, children, open, canEdit, canDelete, onEdit, onDelete, selected, onSelect }) {
  const replaced = m.status === "passed" && isDecision(m) && !m.standing;
  const counts = countLabel(m);
  return (
    <Card className={`flex gap-2.5 p-3 ${selected ? "ring-2 ring-accent/60" : ""}`}>
      {onSelect && <RowCheck checked={selected} onChange={onSelect} label={`Select “${m.title}”`} />}
      <details open={open} id={`decision-${m.id}`} className="min-w-0 flex-1">
        <summary className="cursor-pointer">
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 align-top">
            <span className={`font-medium text-slate-900 dark:text-white ${replaced ? "line-through decoration-slate-400" : ""}`}>{m.title}</span>
            {!isDecision(m) && <Pill>{m.kind_label}</Pill>}
            {m.kind === "rescind" && <Pill tone="accent">Rescinds</Pill>}
            {m.status !== "passed" && <Pill tone={STATUS_TONES[m.status]}>{MOTION_STATUS_LABELS[m.status]}</Pill>}
            {m.amended_text && <Pill>As amended</Pill>}
            {m.visibility === "public" && <Pill tone="green"><Globe className="size-3" /> Public</Pill>}
            {m.needs_review && <Pill tone="amber">To check</Pill>}
            {m.ignore_rules && <Pill>No Robert's Rules</Pill>}
            {m.warnings?.length > 0 && <AlertTriangle className="size-4 text-amber-600" aria-label="Doesn't follow the rules" />}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-neutral-400">
            {m.decided_on ? dateLabel(m.decided_on) : "Not decided yet"}{counts ? ` · ${counts}` : ""}{m.vote_method ? ` · ${VOTE_METHOD_SHORT[m.vote_method]}` : ""}
            {replaced && m.replaced_by && ` · Replaced${m.replaced_by.title ? ` by “${m.replaced_by.title}”` : ""}${m.replaced_by.decided_on ? ` on ${dateLabel(m.replaced_by.decided_on)}` : ""}`}
            {parent && ` · On “${parent.title}”`}
          </span>
        </summary>
        <div className="mt-3 space-y-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          {m.text.trim() && <Markdown source={m.text} className="ev-md text-sm text-slate-800 dark:text-neutral-200" />}
          {m.amended_text.trim() && (
            <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{m.kind === "amend" ? "As it now reads" : "As amended"}</p>
              <Markdown source={m.amended_text} className="ev-md text-sm text-slate-800 dark:text-neutral-200" />
            </div>
          )}
          {(m.moved_by || m.seconded_by) && (
            <p className="text-sm text-slate-600 dark:text-neutral-300">{m.moved_by && <>Moved by {m.moved_by}</>}{m.moved_by && m.seconded_by && ", "}{m.seconded_by && <>seconded by {m.seconded_by}</>}</p>
          )}
          {m.note && <p className="whitespace-pre-line text-sm text-slate-600 dark:text-neutral-300">{m.note}</p>}
          {(m.committee || m.postponed_to) && m.status !== "passed" && (
            <p className="text-sm text-slate-600 dark:text-neutral-300">{m.committee && <>Referred to {m.committee}. </>}{m.postponed_to && <>Postponed until {m.postponed_to}.</>}</p>
          )}
          {m.meeting && <p className="text-sm text-slate-600 dark:text-neutral-300">Made at the <Link to={meetingsPath(slug, m.meeting.id)} className="text-accent hover:underline">business meeting on {longDate(m.meeting.held_on)}</Link></p>}
          {m.replaces && (
            <p className="text-sm text-slate-600 dark:text-neutral-300">Replaces <a href={`#decision-${m.replaces.id}`} className="text-accent hover:underline">{m.replaces.title}</a>{m.replaces.decided_on ? ` (${dateLabel(m.replaces.decided_on)})` : ""}</p>
          )}
          {m.minority_opinion.trim() && (
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide">Minority opinion</p>
              <Markdown source={m.minority_opinion} className="ev-md" />
            </div>
          )}
          {children.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Motions on it</p>
              <ul className="space-y-1">{children.map((c) => <Aside key={c.id} m={c} />)}</ul>
            </div>
          )}
          {m.warnings?.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{m.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          )}
          {(canEdit || canDelete) && (
            <div className="flex flex-wrap gap-2">
              {canEdit && <button type="button" onClick={() => onEdit(m)} className={quietButton}><Pencil className="size-4" /> Change</button>}
              {canDelete && <button type="button" onClick={() => onDelete(m)} className={dangerButton}><Trash2 className="size-4" /> Delete</button>}
            </div>
          )}
        </div>
      </details>
    </Card>
  );
}

// The decisions log (/groups/:slug/conscience/decisions): what the group decided, with the count and
// what it replaced, standing decisions first by kind. The other motions made around them
// (amendments, tabling, referrals...) are under "Procedure" and inside the motion they applied to.
// Record keepers record and change them, and can type in past ones to backfill the history.
export default function DecisionsView({ group }) {
  const slug = group.slug;
  const [params] = useSearchParams();
  const openId = Number(params.get("open")) || null;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("standing");
  const [category, setCategory] = useState("");
  const [when, setWhen] = useState(""); // "" | "imported" | "older" | "imported_or_older" | "this_month"
  const [editing, setEditing] = useState(null); // "new" | a motion
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const q = query.trim();
    return api(`/groups/${slug}/motions${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(setData).catch((e) => setError(e.message));
  }, [slug, query]);
  useEffect(() => {
    const t = setTimeout(load, query ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  // Arriving from a link to one decision: show it, even if the filter would hide it
  useEffect(() => {
    if (!openId || !data) return;
    const target = data.motions.find((m) => m.id === openId);
    if (target && !(isDecision(target) ? filter === "all" || (filter === "standing" && target.standing) : filter === "procedure")) setFilter(isDecision(target) ? "all" : "procedure");
    setTimeout(() => document.getElementById(`decision-${openId}`)?.scrollIntoView({ block: "center" }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, !!data]);

  const index = useMemo(() => {
    const byId = new Map();
    const kids = new Map();
    (data?.motions || []).forEach((m) => { byId.set(m.id, m); if (m.parent_id) kids.set(m.parent_id, [...(kids.get(m.parent_id) || []), m]); });
    return { byId, kids };
  }, [data]);

  const shown = useMemo(() => {
    if (!data) return [];
    const monthStart = new Date().toLocaleDateString("en-CA").slice(0, 8) + "01";
    const older = (m) => !!m.decided_on && m.decided_on < monthStart;
    return data.motions.filter((m) => {
      if (when === "imported" && !m.imported) return false;
      if (when === "older" && !older(m)) return false;
      if (when === "imported_or_older" && !(m.imported || older(m))) return false;
      if (when === "this_month" && !(m.decided_on && m.decided_on >= monthStart)) return false;
      if (filter === "to_check") return m.needs_review;
      if (filter === "procedure") return !isDecision(m);
      if (!isDecision(m)) return false;
      if (category && m.category !== category) return false;
      if (filter === "standing") return m.standing;
      if (filter === "failed") return m.status === "failed";
      if (filter === "unfinished") return ["tabled", "referred", "postponed"].includes(m.status);
      return true;
    });
  }, [data, filter, category, when]);

  const remove = async (m) => {
    const note = m.replaces ? ` “${m.replaces.title}” will be standing again.` : "";
    if (!window.confirm(`Delete “${m.title}” from the log? This can't be undone.${note}`)) return;
    try {
      await api(`/groups/${slug}/motions/${m.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!data) return error ? <ErrorNote error={error} /> : <Loading />;
  const canEdit = data.can_edit;
  const toggle = (id, on) => setSelected((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });
  const picked = shown.filter((m) => selected.has(m.id));
  const runBulk = async (action, value) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/groups/${slug}/motions/bulk`, { method: "POST", body: { ids: picked.map((m) => m.id), do: action, value } });
      setSelected(new Set());
      await load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const bulkActions = [
    { key: "ignore_rules", label: "Ignore Robert's Rules warnings" },
    { key: "follow_rules", label: "Follow Robert's Rules again" },
    { key: "mark_checked", label: "Mark as checked (members can see them)" },
    { key: "category", label: "Change the kind to…", values: CATEGORIES.map((c) => [c.key, c.label]) },
    { key: "visibility", label: "Who can see them…", values: [["members", "Members"], ["public", "Anyone (public)"]] },
    ...(data.can_delete ? [{ key: "delete", label: "Delete", danger: true, confirm: (n) => `Delete ${n} ${n === 1 ? "decision" : "decisions"} from the log? This can't be undone.` }] : []),
  ];
  const saved = async () => { setEditing(null); await load(); };
  const form = (m) => <DecisionForm key={m?.id || "new"} group={group} motion={m} motions={data.motions} kinds={data.kinds} groups={data.groups} onSaved={saved} onCancel={() => setEditing(null)} />;
  const row = (m) => (
    editing && editing !== "new" && editing.id === m.id ? form(m) : (
      <Decision key={m.id} slug={slug} motion={m} parent={index.byId.get(m.parent_id)} children={index.kids.get(m.id) || []} open={m.id === openId} canEdit={canEdit} canDelete={data.can_delete} onEdit={setEditing} onDelete={remove}
        selected={selected.has(m.id)} onSelect={canEdit ? (on) => toggle(m.id, on) : null} />
    )
  );

  const grouped = filter === "standing" && !query.trim() && !when;
  const decisionsCount = data.motions.filter(isDecision).length;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input type="search" aria-label="Search decisions" className={`${inputClass} !pl-9`} placeholder="Search decisions" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {canEdit && <button type="button" onClick={() => setEditing("new")} className={primaryButton}><Plus className="size-4" /> Record a motion</button>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Show" className="flex flex-wrap rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
          {[...FILTERS, ...(canEdit && data.motions.some((m) => m.needs_review) ? KEEPER_FILTERS : [])].map(([key, label]) => (
            <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === key ? "!bg-white text-slate-900 shadow-sm dark:!bg-neutral-950 dark:text-white" : "!bg-transparent text-slate-500 hover:text-slate-800 dark:text-neutral-400"}`}>{label}</button>
          ))}
        </div>
        {filter !== "procedure" && (
          <select aria-label="Kind of decision" className={`${selectClass} !w-auto`} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All kinds</option>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        )}
        <select aria-label="When" className={`${selectClass} !w-auto`} value={when} onChange={(e) => setWhen(e.target.value)}>
          <option value="">Any time</option>
          <option value="this_month">This month</option>
          <option value="older">Before this month</option>
          {data.motions.some((m) => m.imported) && <option value="imported">Imported from old minutes</option>}
          {data.motions.some((m) => m.imported) && <option value="imported_or_older">Imported or before this month</option>}
        </select>
      </div>
      <ErrorNote error={error} />
      {canEdit && <BulkBar count={picked.length} total={shown.length} onSelectAll={() => setSelected(new Set(shown.map((m) => m.id)))} onClear={() => setSelected(new Set())} actions={bulkActions} onRun={runBulk} busy={busy} />}

      {editing === "new" && form(null)}

      {shown.length === 0 && (
        <Card className="p-5 text-sm text-slate-600 dark:text-neutral-300">
          {decisionsCount === 0 && filter !== "procedure"
            ? (canEdit ? "No decisions yet. Record what the group has decided, including past decisions, so nobody has to remember “we voted on that in 2023”." : "The group hasn't shared its decisions yet.")
            : "Nothing matches."}
        </Card>
      )}

      {grouped
        ? CATEGORIES.filter((c) => shown.some((m) => m.category === c.key)).map((c) => (
            <Tray key={c.key} label={c.label}><div className="space-y-1.5">{shown.filter((m) => m.category === c.key).map(row)}</div></Tray>
          ))
        : shown.length > 0 && <Tray label={`${shown.length} ${filter === "procedure" ? (shown.length === 1 ? "motion" : "motions") : shown.length === 1 ? "decision" : "decisions"}`}><div className="space-y-1.5">{shown.map(row)}</div></Tray>}
      {!canEdit && !group.is_member && !group.is_site_admin && decisionsCount > 0 && (
        <p className="text-xs text-slate-500 dark:text-neutral-400">Members see all of the group's decisions.</p>
      )}
    </div>
  );
}
