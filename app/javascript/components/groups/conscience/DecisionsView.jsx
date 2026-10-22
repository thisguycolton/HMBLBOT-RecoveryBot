import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ChevronDown, Globe, MessagesSquare, Pencil, Plus, Regex, Search, Trash2, X } from "lucide-react";
import Markdown from "../../book/Markdown";
import { inputClass, selectClass } from "../../ui/styles";
import { api } from "../lib";
import { Card, ErrorNote, Loading, Pill, Tray, dangerButton, linkButton, primaryButton, quietButton } from "../ui";
import DecisionForm from "./DecisionForm";
import BulkBar, { RowCheck } from "./BulkBar";
import { relatedIndex, searchableText, toRegex } from "./related";
import { buildThreads } from "./threads";
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

// One line in the list; clicking it opens the decision in the side pane. The first line of a
// thread also says how many more are in it and how it last came out, and opens or closes it.
function DecisionRow({ motion: m, current, onOpen, selected, onSelect, dim, thread }) {
  const replaced = isReplaced(m);
  const counts = countLabel(m);
  return (
    <Card className={`flex gap-2.5 p-3 ${selected ? "ring-2 ring-accent/60" : ""} ${current ? "!bg-accent-tint dark:!bg-accent/25" : ""} ${dim && !current ? "opacity-60" : ""}`}>
      {onSelect && <RowCheck checked={selected} onChange={onSelect} label={`Select “${m.title}”`} />}
      <button type="button" id={`decision-${m.id}`} onClick={() => onOpen(m.id)} aria-current={current ? "true" : undefined}
        className="min-w-0 flex-1 !bg-transparent p-0 text-left">
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 align-top">
          <span className={`font-medium text-slate-900 dark:text-white ${replaced ? "line-through decoration-slate-400" : ""}`}>{m.title}</span>
          <Badges m={m} />
        </span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-neutral-400">
          {m.decided_on ? dateLabel(m.decided_on) : "Not decided yet"}{counts ? ` · ${counts}` : ""}{m.vote_method ? ` · ${VOTE_METHOD_SHORT[m.vote_method]}` : ""}
          {replaced && m.replaced_by && ` · Replaced${m.replaced_by.title ? ` by “${m.replaced_by.title}”` : ""}${m.replaced_by.decided_on ? ` on ${dateLabel(m.replaced_by.decided_on)}` : ""}`}
        </span>
        {thread?.latest && <span className="mt-0.5 block text-xs text-slate-500 dark:text-neutral-400">Last: {thread.latest.kind_label === "Main motion" ? "" : `${thread.latest.kind_label.toLowerCase()}, `}{MOTION_STATUS_LABELS[thread.latest.status].toLowerCase()}{thread.latest.decided_on ? ` ${dateLabel(thread.latest.decided_on)}` : ""}</span>}
      </button>
      {thread && (
        <button type="button" onClick={thread.onToggle} aria-expanded={thread.open} title={thread.open ? "Hide the thread" : "Show the thread"}
          className="flex shrink-0 items-center gap-1 self-start rounded-lg !bg-neutral-100 px-2 py-1 text-xs font-semibold text-slate-600 hover:!bg-neutral-200 dark:!bg-neutral-800 dark:text-neutral-300 dark:hover:!bg-neutral-700">
          <MessagesSquare className="size-3.5" /> {thread.count} <ChevronDown className={`size-3.5 transition-transform ${thread.open ? "rotate-180" : ""}`} />
        </button>
      )}
    </Card>
  );
}

// A whole thread in the list: its first motion, and when open everything under it, nested
function ThreadRows({ thread, kids, open, onToggle, row }) {
  const { root, members, latest } = thread;
  const more = members.length - 1;
  const seen = new Set();
  const node = (m, depth) => {
    if (seen.has(m.id)) return null;
    seen.add(m.id);
    const children = (kids.get(m.id) || []).filter((k) => !seen.has(k.id));
    return (
      <div key={m.id} className="space-y-1.5">
        {depth === 0
          ? row(m, more > 0 ? { count: more, open, onToggle, latest: latest.id !== root.id ? latest : null } : null)
          : row(m, null)}
        {children.length > 0 && (depth > 0 || open) && (
          <div className="ml-3 space-y-1.5 border-l-2 border-neutral-300 pl-2 dark:border-neutral-700 sm:ml-5 sm:pl-3">{children.map((k) => node(k, depth + 1))}</div>
        )}
      </div>
    );
  };
  return node(root, 0);
}

// The open motion's whole thread, in the side pane
function ThreadCard({ thread, currentId, onOpen }) {
  return (
    <div>
      <p className={paneLabel}>The thread</p>
      <ul className="-mx-2">
        {thread.members.map(({ motion: o, depth }) => (
          <li key={o.id} style={{ paddingLeft: `${Math.min(depth, 6) * 0.9}rem` }}>
            <button type="button" onClick={() => onOpen(o.id)} aria-current={o.id === currentId ? "true" : undefined}
              className={`w-full rounded-lg px-2 py-1.5 text-left ${o.id === currentId ? "!bg-accent-tint dark:!bg-accent/25" : "!bg-transparent hover:!bg-neutral-100 dark:hover:!bg-neutral-800"} ${depth ? "border-l-2 border-neutral-200 dark:border-neutral-700" : ""}`}>
              <span className={`block text-sm font-medium text-slate-900 dark:text-white ${isReplaced(o) ? "line-through decoration-slate-400" : ""}`}>{o.title}</span>
              <span className="block text-xs text-slate-500 dark:text-neutral-400">
                {o.kind_label} · {MOTION_STATUS_LABELS[o.status]}{o.decided_on ? ` · ${dateLabel(o.decided_on)}` : ""}{countLabel(o) ? ` · ${countLabel(o)}` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const isReplaced = (m) => m.status === "passed" && isDecision(m) && !m.standing && !m.one_time;

function Badges({ m }) {
  return (
    <>
      {!isDecision(m) && <Pill>{m.kind_label}</Pill>}
      {m.kind === "rescind" && <Pill tone="accent">Rescinds</Pill>}
      <Pill tone={STATUS_TONES[m.status]}>{MOTION_STATUS_LABELS[m.status]}</Pill>
      {m.amended_text && <Pill>As amended</Pill>}
      {m.visibility === "public" && <Pill tone="green"><Globe className="size-3" /> Public</Pill>}
      {m.needs_review && <Pill tone="amber">To check</Pill>}
      {m.one_time && m.status === "passed" && <Pill>One-time</Pill>}
      {m.ignore_rules && <Pill>No Robert's Rules</Pill>}
      {m.warnings?.length > 0 && <AlertTriangle className="size-4 text-amber-600" aria-label="Doesn't follow the rules" />}
    </>
  );
}

const paneLabel = "mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400";
const inlineLink = "!bg-transparent p-0 text-left text-accent hover:underline";

// The open decision, in the side pane: everything about it, then what else it might be related to
function DecisionDetail({ slug, motion: m, parent, thread, canEdit, canDelete, onEdit, onDelete, onOpen, onClose, finder }) {
  const replaced = isReplaced(m);
  const counts = countLabel(m);
  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <div className="flex items-start gap-2 border-b border-neutral-100 p-4 dark:border-neutral-800">
          <div className="min-w-0 flex-1">
            <h2 className={`!text-lg font-semibold text-slate-900 dark:text-white ${replaced ? "line-through decoration-slate-400" : ""}`}>{m.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
              {CATEGORIES.find((c) => c.key === m.category)?.label || m.kind_label}
              {" · "}{m.decided_on ? longDate(m.decided_on) : "Not decided yet"}{counts ? ` · ${counts}` : ""}{m.vote_method ? ` · ${VOTE_METHOD_SHORT[m.vote_method]}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5"><Badges m={m} /></div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`${quietButton} !p-2`}><X className="size-4" /></button>
        </div>
        <div className="space-y-3 p-4">
          {m.text.trim() ? <Markdown source={m.text} className="ev-md text-sm text-slate-800 dark:text-neutral-200" /> : <p className="text-sm text-slate-500 dark:text-neutral-400">No wording recorded.</p>}
          {m.amended_text.trim() && (
            <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950">
              <p className={paneLabel}>{m.kind === "amend" ? "As it now reads" : "As amended"}</p>
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
          {parent && <p className="text-sm text-slate-600 dark:text-neutral-300">Made on <button type="button" className={inlineLink} onClick={() => onOpen(parent.id)}>{parent.title}</button></p>}
          {m.replaces && (
            <p className="text-sm text-slate-600 dark:text-neutral-300">Replaces <button type="button" className={inlineLink} onClick={() => onOpen(m.replaces.id)}>{m.replaces.title}</button>{m.replaces.decided_on ? ` (${dateLabel(m.replaces.decided_on)})` : ""}</p>
          )}
          {replaced && m.replaced_by && (
            <p className="text-sm text-slate-600 dark:text-neutral-300">Replaced by {m.replaced_by.id ? <button type="button" className={inlineLink} onClick={() => onOpen(m.replaced_by.id)}>{m.replaced_by.title || "a later decision"}</button> : (m.replaced_by.title || "a later decision")}{m.replaced_by.decided_on ? ` on ${dateLabel(m.replaced_by.decided_on)}` : ""}</p>
          )}
          {m.minority_opinion.trim() && (
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide">Minority opinion</p>
              <Markdown source={m.minority_opinion} className="ev-md" />
            </div>
          )}
          {m.warnings?.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{m.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 p-3 dark:border-neutral-800">
          <button type="button" onClick={onClose} className={quietButton}><ArrowLeft className="size-4" /> Back</button>
          <div className="flex-1" />
          {canDelete && <button type="button" onClick={() => onDelete(m)} className={dangerButton}><Trash2 className="size-4" /> Delete</button>}
          {canEdit && <button type="button" onClick={() => onEdit(m)} className={quietButton}><Pencil className="size-4" /> Change</button>}
        </div>
      </Card>
      {thread.members.length > 1 && <Card className="p-4"><ThreadCard thread={thread} currentId={m.id} onOpen={onOpen} /></Card>}
      <RelatedDecisions key={m.id} motion={m} finder={finder} onOpen={onOpen} skip={new Set(thread.members.map((x) => x.motion.id))} />
    </div>
  );
}

// "Might be related": a similarity ranking over every motion's words, and a pattern search
// prefilled with this one's most telling words, for when the ranking misses something
function RelatedDecisions({ motion: m, finder, onOpen, skip }) {
  const suggested = useMemo(() => finder.index.keyTerms(m.id).join("|"), [finder, m.id]);
  const [pattern, setPattern] = useState(suggested);
  // the rest of its own thread is listed above, so it isn't repeated here
  const similar = useMemo(() => finder.index.related(m.id, { skip }), [finder, m.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const { re, error } = toRegex(pattern);
  const matches = useMemo(() => (re ? finder.motions.filter((o) => o.id !== m.id && re.test(searchableText(o))) : []), [re?.source, finder, m.id]);
  const line = (o, extra) => (
    <li key={o.id}>
      <button type="button" onClick={() => onOpen(o.id)} className="w-full rounded-lg !bg-transparent px-2 py-1.5 text-left hover:!bg-neutral-100 dark:hover:!bg-neutral-800">
        <span className={`block text-sm font-medium text-slate-900 dark:text-white ${isReplaced(o) ? "line-through decoration-slate-400" : ""}`}>{o.title}</span>
        <span className="block text-xs text-slate-500 dark:text-neutral-400">
          {o.decided_on ? dateLabel(o.decided_on) : "Not decided yet"}{!isDecision(o) ? ` · ${o.kind_label}` : ""}{o.status !== "passed" ? ` · ${MOTION_STATUS_LABELS[o.status]}` : isReplaced(o) ? " · Replaced" : ""}{extra}
        </span>
      </button>
    </li>
  );
  return (
    <Card className="space-y-4 p-4">
      <div>
        <p className={paneLabel}>Might be related</p>
        {similar.length === 0
          ? <p className="text-sm text-slate-500 dark:text-neutral-400">Nothing else uses the same words.</p>
          : <ul className="-mx-2">{similar.map((r) => line(r.motion, r.shared.length ? ` · shares “${r.shared.join("”, “")}”` : ""))}</ul>}
      </div>
      <div className="border-t border-neutral-100 pt-4 dark:border-neutral-800">
        <label htmlFor="related-pattern" className={paneLabel}>Search every decision for</label>
        <div className="relative">
          <Regex className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input id="related-pattern" type="search" spellCheck={false} className={`${inputClass} !pl-9 font-mono !text-[13px]`} value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="camera|video" />
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
          {error || <>A regular expression, ignoring case. <code>|</code> means or, <code>.*</code> anything in between; e.g. <code>camera|video</code> or <code>7th.*tradition</code>.</>}
          {pattern !== suggested && suggested && <> <button type="button" className={`${linkButton} !text-xs`} onClick={() => setPattern(suggested)}>Reset</button></>}
        </p>
        {re && (matches.length === 0
          ? <p className="mt-2 text-sm text-slate-500 dark:text-neutral-400">No other decision matches.</p>
          : <ul className="-mx-2 mt-2">{matches.slice(0, 50).map((o) => line(o, ""))}{matches.length > 50 && <li className="px-2 text-xs text-slate-500">and {matches.length - 50} more</li>}</ul>)}
      </div>
    </Card>
  );
}

// The decisions log (/groups/:slug/conscience/decisions): what the group decided, with the count and
// what it replaced, standing decisions first by kind. The other motions made around them
// (amendments, tabling, referrals...) are under "Procedure", and nested in the thread of the motion
// they applied to (see threads.js).
// Record keepers record and change them, and can type in past ones to backfill the history.
// Clicking one opens it in a side pane (?open=ID), with the decisions that might be related to it.
export default function DecisionsView({ group }) {
  const slug = group.slug;
  const [params, setParams] = useSearchParams();
  const openId = Number(params.get("open")) || null;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [usePattern, setUsePattern] = useState(false);
  const [filter, setFilter] = useState("standing");
  const [category, setCategory] = useState("");
  const [when, setWhen] = useState(""); // "" | "imported" | "older" | "imported_or_older" | "this_month" | "range"
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [editing, setEditing] = useState(null); // "new" | a motion
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [threadOpen, setThreadOpen] = useState(() => new Map()); // root id -> opened or closed by hand
  const arrived = useRef(false);

  // The whole log comes down at once; searching and the related list both work on it here
  const load = useCallback(() => api(`/groups/${slug}/motions`).then(setData).catch((e) => setError(e.message)), [slug]);
  useEffect(() => { load(); }, [load]);

  const open = (id) => {
    setEditing(null);
    setParams((p) => { const n = new URLSearchParams(p); n.set("open", id); return n; });
    setTimeout(() => document.getElementById(`decision-${id}`)?.scrollIntoView({ block: "nearest" }), 50);
  };
  const close = () => {
    setEditing(null);
    setParams((p) => { const n = new URLSearchParams(p); n.delete("open"); return n; });
  };

  const index = useMemo(() => {
    const byId = new Map((data?.motions || []).map((m) => [m.id, m]));
    return { byId, ...buildThreads(data?.motions || []) };
  }, [data]);
  const finder = useMemo(() => ({ motions: data?.motions || [], index: relatedIndex(data?.motions || []) }), [data]);

  // Whether one motion is what the filters ask for ("any": only the search and dates). A thread is
  // listed when any motion in it is.
  const { re: pattern, error: patternError } = usePattern ? toRegex(query) : { re: null, error: null };
  const matcher = useCallback((show) => {
    const monthStart = new Date().toLocaleDateString("en-CA").slice(0, 8) + "01";
    const older = (m) => !!m.decided_on && m.decided_on < monthStart;
    const q = query.trim().toLowerCase();
    return (m) => {
      if (usePattern ? pattern && !pattern.test(searchableText(m)) : q && !searchableText(m).toLowerCase().includes(q)) return false;
      if (when === "imported" && !m.imported) return false;
      if (when === "older" && !older(m)) return false;
      if (when === "imported_or_older" && !(m.imported || older(m))) return false;
      if (when === "this_month" && !(m.decided_on && m.decided_on >= monthStart)) return false;
      if (when === "range" && (from || until) && !(m.decided_on && (!from || m.decided_on >= from) && (!until || m.decided_on <= until))) return false;
      if (show === "any") return true;
      if (show === "to_check") return m.needs_review;
      if (show === "procedure") return !isDecision(m);
      if (!isDecision(m)) return false;
      if (category && m.category !== category) return false;
      if (show === "standing") return m.standing;
      if (show === "failed") return m.status === "failed";
      if (show === "unfinished") return ["tabled", "referred", "postponed"].includes(m.status);
      return true;
    };
  }, [query, usePattern, pattern?.source, category, when, from, until]); // eslint-disable-line react-hooks/exhaustive-deps
  const matches = useMemo(() => matcher(filter), [matcher, filter]);
  // In a listed thread, the motions the search or dates leave out are dimmed (the tabs only pick threads)
  const found = useMemo(() => matcher("any"), [matcher]);
  const shown = useMemo(() => index.threads.filter((t) => t.members.some((x) => matches(x.motion))), [index, matches]);
  const narrowed = !!(query.trim() || when);

  // Arriving from a link to one decision: show its thread, open, even if the filter would hide it
  useEffect(() => {
    if (!openId || !data || arrived.current) return;
    arrived.current = true;
    const target = index.byId.get(openId);
    const thread = target && index.threads.find((t) => t.members.some((x) => x.motion.id === openId));
    if (thread && !thread.members.some((x) => matches(x.motion))) setFilter(thread.members.some((x) => isDecision(x.motion)) ? "all" : "procedure");
    setTimeout(() => document.getElementById(`decision-${openId}`)?.scrollIntoView({ block: "center" }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, !!data]);

  const remove = async (m) => {
    const note = m.replaces ? ` “${m.replaces.title}” will be standing again.` : "";
    if (!window.confirm(`Delete “${m.title}” from the log? This can't be undone.${note}`)) return;
    try {
      await api(`/groups/${slug}/motions/${m.id}`, { method: "DELETE" });
      if (m.id === openId) close();
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!data) return error ? <ErrorNote error={error} /> : <Loading />;
  const canEdit = data.can_edit;
  const current = openId ? index.byId.get(openId) : null;
  const currentThread = current ? index.threads.find((t) => t.members.some((x) => x.motion.id === current.id)) : null;
  // A thread opens by itself when the open motion is inside it, or a search found something inside it
  const isOpen = (t) => (threadOpen.has(t.root.id) ? threadOpen.get(t.root.id)
    : (t === currentThread && current.id !== t.root.id) || (narrowed && t.members.some((x) => x.depth > 0 && matches(x.motion))));
  const toggleThread = (t) => setThreadOpen((o) => new Map(o).set(t.root.id, !isOpen(t)));
  const toggle = (id, on) => setSelected((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });
  const listed = shown.flatMap((t) => t.members.map((x) => x.motion).filter(matches));
  const picked = listed.filter((m) => selected.has(m.id));
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
    ...(group.follows_roberts_rules !== false ? [
      { key: "ignore_rules", label: "Ignore Robert's Rules warnings" },
      { key: "follow_rules", label: "Follow Robert's Rules again" },
    ] : []),
    { key: "one_time", label: "Mark as one-time (not standing)" },
    { key: "standing", label: "Make standing again (not one-time)" },
    { key: "status", label: "Set how it came out…", values: Object.entries(MOTION_STATUS_LABELS) },
    { key: "mark_checked", label: "Mark as checked (members can see them)" },
    { key: "category", label: "Change the kind to…", values: CATEGORIES.map((c) => [c.key, c.label]) },
    { key: "visibility", label: "Who can see them…", values: [["members", "Members"], ["public", "Anyone (public)"]] },
    ...(data.can_delete ? [{ key: "delete", label: "Delete", danger: true, confirm: (n) => `Delete ${n} ${n === 1 ? "decision" : "decisions"} from the log? This can't be undone.` }] : []),
  ];
  const saved = async () => { setEditing(null); await load(); };
  const form = (m) => <DecisionForm key={m?.id || "new"} group={group} motion={m} motions={data.motions} kinds={data.kinds} groups={data.groups} onSaved={saved} onCancel={() => setEditing(null)} />;
  const row = (m, thread) => (
    <DecisionRow key={m.id} motion={m} current={m.id === openId} onOpen={open} dim={!found(m)} thread={thread}
      selected={selected.has(m.id)} onSelect={canEdit ? (on) => toggle(m.id, on) : null} />
  );
  const threadRows = (t) => <ThreadRows key={t.root.id} thread={t} kids={index.kids} open={isOpen(t)} onToggle={() => toggleThread(t)} row={row} />;
  // A thread goes under the kind of its first motion the filters ask for
  const threadCategory = (t) => (t.members.find((x) => matches(x.motion)) || t.members[0]).motion.category;

  const grouped = filter === "standing" && !query.trim() && !when;
  const decisionsCount = data.motions.filter(isDecision).length;
  // On a narrow screen the pane takes the list's place while something is open, like the Topicificator
  const paneOpen = !!(editing || current);
  return (
    <div className="@container">
      <div className="grid items-start gap-5 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={`min-w-0 space-y-5 ${paneOpen ? "hidden @4xl:block" : ""}`}>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[12rem] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input type="search" aria-label="Search decisions" spellCheck={!usePattern} className={`${inputClass} !pl-9 !pr-12 ${usePattern ? "font-mono !text-[13px]" : ""}`} placeholder={usePattern ? "Pattern, e.g. camera|video" : "Search decisions"} value={query} onChange={(e) => setQuery(e.target.value)} />
                <button type="button" aria-pressed={usePattern} onClick={() => setUsePattern((v) => !v)} title="Search with a regular expression"
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 font-mono text-xs font-semibold ${usePattern ? "!bg-accent text-white" : "!bg-transparent text-slate-500 hover:!bg-neutral-100 dark:text-neutral-400 dark:hover:!bg-neutral-800"}`}>
                  .*
                </button>
              </div>
              {canEdit && <button type="button" onClick={() => setEditing("new")} className={primaryButton}><Plus className="size-4" /> Record a motion</button>}
            </div>
            {usePattern && <p className={`text-xs ${patternError ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-neutral-400"}`}>{patternError || "Searching with a regular expression, ignoring case, in the title, wording, notes and names."}</p>}
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
              <option value="range">Between dates…</option>
            </select>
            {when === "range" && (
              <span className="flex flex-wrap items-center gap-1.5 text-sm text-slate-600 dark:text-neutral-300">
                <input type="date" aria-label="From" className={`${inputClass} !w-auto`} value={from} max={until || undefined} onChange={(e) => setFrom(e.target.value)} />
                <span>to</span>
                <input type="date" aria-label="Until" className={`${inputClass} !w-auto`} value={until} min={from || undefined} onChange={(e) => setUntil(e.target.value)} />
                {(from || until) && <button type="button" className={`${quietButton} !px-2 !py-1 !text-xs`} onClick={() => { setFrom(""); setUntil(""); }}>Clear</button>}
              </span>
            )}
          </div>
          <ErrorNote error={error} />
          {canEdit && <BulkBar count={picked.length} total={listed.length} onSelectAll={() => setSelected(new Set(listed.map((m) => m.id)))} onClear={() => setSelected(new Set())} actions={bulkActions} onRun={runBulk} busy={busy} />}

          {shown.length === 0 && (
            <Card className="p-5 text-sm text-slate-600 dark:text-neutral-300">
              {decisionsCount === 0 && filter !== "procedure"
                ? (canEdit ? "No decisions yet. Record what the group has decided, including past decisions, so nobody has to remember “we voted on that in 2023”." : "The group hasn't shared its decisions yet.")
                : "Nothing matches."}
            </Card>
          )}

          {grouped
            ? CATEGORIES.filter((c) => shown.some((t) => threadCategory(t) === c.key)).map((c) => (
                <Tray key={c.key} label={c.label}><div className="space-y-1.5">{shown.filter((t) => threadCategory(t) === c.key).map(threadRows)}</div></Tray>
              ))
            : shown.length > 0 && <Tray label={`${listed.length} ${filter === "procedure" ? (listed.length === 1 ? "motion" : "motions") : listed.length === 1 ? "decision" : "decisions"}${shown.length < listed.length ? ` in ${shown.length} ${shown.length === 1 ? "thread" : "threads"}` : ""}`}><div className="space-y-1.5">{shown.map(threadRows)}</div></Tray>}
          {!canEdit && !group.is_member && !group.is_site_admin && decisionsCount > 0 && (
            <p className="text-xs text-slate-500 dark:text-neutral-400">Members see all of the group's decisions.</p>
          )}
        </div>

        {/* The side pane stays in view on its own scroll while the list scrolls past */}
        <aside aria-label="Decision" className={`min-w-0 @4xl:sticky @4xl:top-20 @4xl:max-h-[calc(100dvh-6rem)] @4xl:overflow-y-auto @4xl:overscroll-contain @4xl:rounded-2xl ${paneOpen ? "" : "hidden @4xl:block"}`}>
          {editing ? form(editing === "new" ? null : editing) : current ? (
            <DecisionDetail slug={slug} motion={current} parent={index.byId.get(current.parent_id)} thread={currentThread}
              canEdit={canEdit} canDelete={data.can_delete} onEdit={setEditing} onDelete={remove} onOpen={open} onClose={close} finder={finder} />
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-neutral-200 p-10 text-center text-sm text-slate-500 dark:border-neutral-800 dark:text-neutral-400">
              {openId ? "That decision isn't in the log, or you can't see it." : "Choose a decision to read it, see what it replaced, and find others that might be related."}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
