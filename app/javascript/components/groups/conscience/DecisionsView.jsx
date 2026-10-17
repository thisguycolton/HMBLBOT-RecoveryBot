import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Globe, Lock, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Markdown from "../../book/Markdown";
import { inputClass, selectClass } from "../../ui/styles";
import { api } from "../lib";
import { Card, ErrorNote, Loading, Pill, Tray, dangerButton, primaryButton, quietButton } from "../ui";
import DecisionForm from "./DecisionForm";
import { CATEGORIES, CATEGORY_INFO, MOTION_STATUS_LABELS, countLabel, dateLabel } from "./lib";

const FILTERS = [
  ["standing", "Standing"],
  ["all", "All"],
  ["failed", "Failed"],
  ["tabled", "Tabled"],
];

function Decision({ motion: m, open, canEdit, canDelete, onEdit, onDelete }) {
  const replaced = m.status === "passed" && !m.standing;
  const counts = countLabel(m);
  return (
    <Card className="p-3">
      <details open={open} id={`decision-${m.id}`}>
        <summary className="cursor-pointer">
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 align-top">
            <span className={`font-medium text-slate-900 dark:text-white ${replaced ? "line-through decoration-slate-400" : ""}`}>{m.title}</span>
            {m.status !== "passed" && <Pill tone={m.status === "failed" ? "amber" : "slate"}>{MOTION_STATUS_LABELS[m.status]}</Pill>}
            {m.visibility === "public" && <Pill tone="green"><Globe className="size-3" /> Public</Pill>}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-neutral-400">
            {m.decided_on ? dateLabel(m.decided_on) : "Not decided yet"}{counts ? ` · ${counts}` : ""}
            {replaced && m.replaced_by && ` · Replaced${m.replaced_by.title ? ` by “${m.replaced_by.title}”` : ""}${m.replaced_by.decided_on ? ` on ${dateLabel(m.replaced_by.decided_on)}` : ""}`}
          </span>
        </summary>
        <div className="mt-3 space-y-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          {m.text.trim() && <Markdown source={m.text} className="ev-md text-sm text-slate-800 dark:text-neutral-200" />}
          {(m.moved_by || m.seconded_by) && (
            <p className="text-sm text-slate-600 dark:text-neutral-300">
              {m.moved_by && <>Moved by {m.moved_by}</>}{m.moved_by && m.seconded_by && ", "}{m.seconded_by && <>seconded by {m.seconded_by}</>}
            </p>
          )}
          {m.replaces && (
            <p className="text-sm text-slate-600 dark:text-neutral-300">
              Replaces <a href={`#decision-${m.replaces.id}`} className="text-accent hover:underline">{m.replaces.title}</a>{m.replaces.decided_on ? ` (${dateLabel(m.replaces.decided_on)})` : ""}
            </p>
          )}
          {m.minority_opinion.trim() && (
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide">Minority opinion</p>
              <Markdown source={m.minority_opinion} className="ev-md" />
            </div>
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

// The decisions log (/groups/:slug/conscience/decisions): what the group voted on, with the
// count and what it replaced. Standing decisions first, by kind. Record keepers record and
// change them, and can type in past ones to backfill the history.
export default function DecisionsView({ group }) {
  const slug = group.slug;
  const [params] = useSearchParams();
  const openId = Number(params.get("open")) || null;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("standing");
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState(null); // "new" | a decision

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
    if (target && filter === "standing" && !target.standing) setFilter("all");
    setTimeout(() => document.getElementById(`decision-${openId}`)?.scrollIntoView({ block: "center" }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, !!data]);

  const shown = useMemo(() => {
    if (!data) return [];
    return data.motions.filter((m) => {
      if (category && m.category !== category) return false;
      if (filter === "standing") return m.standing;
      if (filter === "failed") return m.status === "failed";
      if (filter === "tabled") return m.status === "tabled";
      return true;
    });
  }, [data, filter, category]);

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
  const saved = async () => { setEditing(null); await load(); };
  const row = (m) => (
    editing && editing !== "new" && editing.id === m.id ? (
      <DecisionForm key={m.id} group={group} motion={m} motions={data.motions} onSaved={saved} onCancel={() => setEditing(null)} />
    ) : (
      <Decision key={m.id} motion={m} open={m.id === openId} canEdit={canEdit} canDelete={data.can_delete} onEdit={setEditing} onDelete={remove} />
    )
  );

  const grouped = filter === "standing" && !query.trim();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input type="search" aria-label="Search decisions" className={`${inputClass} !pl-9`} placeholder="Search decisions" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {canEdit && <button type="button" onClick={() => setEditing("new")} className={primaryButton}><Plus className="size-4" /> Record a decision</button>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Show" className="flex rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
          {FILTERS.map(([key, label]) => (
            <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === key ? "!bg-white text-slate-900 shadow-sm dark:!bg-neutral-950 dark:text-white" : "!bg-transparent text-slate-500 hover:text-slate-800 dark:text-neutral-400"}`}>{label}</button>
          ))}
        </div>
        <select aria-label="Kind of decision" className={`${selectClass} !w-auto`} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All kinds</option>
          {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>
      <ErrorNote error={error} />

      {editing === "new" && <DecisionForm group={group} motions={data.motions} onSaved={saved} onCancel={() => setEditing(null)} />}

      {shown.length === 0 && (
        <Card className="p-5 text-sm text-slate-600 dark:text-neutral-300">
          {data.motions.length === 0
            ? (canEdit ? "No decisions yet. Record what the group has voted on, including past decisions, so nobody has to remember “we voted on that in 2023”." : "The group hasn't shared its decisions yet.")
            : "Nothing matches."}
        </Card>
      )}

      {grouped
        ? CATEGORIES.filter((c) => shown.some((m) => m.category === c.key)).map((c) => (
            <Tray key={c.key} label={c.label}><div className="space-y-1.5">{shown.filter((m) => m.category === c.key).map(row)}</div></Tray>
          ))
        : shown.length > 0 && <Tray label={`${shown.length} ${shown.length === 1 ? "decision" : "decisions"}`}><div className="space-y-1.5">{shown.map(row)}</div></Tray>}
      {data.motions.length > 0 && !group.is_member && !group.is_site_admin && (
        <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400"><Lock className="size-3.5" /> Members see all of the group's decisions.</p>
      )}
    </div>
  );
}
