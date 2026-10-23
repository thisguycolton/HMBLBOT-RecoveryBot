import React, { useEffect, useMemo, useState } from "react";
import { Download, GitCompare, PencilLine, RotateCcw, X } from "lucide-react";
import { markdownToHtml } from "../../book/Markdown";
import { changedHtml, diffDocuments, diffStats } from "../../../lib/documentDiff";
import { timeAgo } from "../page/lib";
import Avatar from "../Avatar";
import { api } from "../lib";
import { Loading, primaryButton, quietButton } from "../ui";
import { fileUrl, sizeLabel } from "./lib";

// A document's version history, like a simple git: each Save version is a numbered version
// with who saved it and their note (GroupDocumentVersion). Here: the list of versions as cards
// (HistoryPane), what changed between any two (VersionDiff), and the box that saves a new
// version with its note (SaveVersionDialog).

const htmlOf = async (v) => (v.body_format === "markdown" ? markdownToHtml(v.body) : v.body || "");

// What a version did, in a few words, when its saver left no note
export function versionNote(v) {
  if (v.message) return v.message;
  if (v.kind === "created") return "Started the document";
  if (v.kind === "restored") return `Restored version ${v.restored_from ?? ""}`.trim();
  return null;
}

export function Stats({ stats, className = "" }) {
  const { words_added: added, words_removed: removed, sections } = stats;
  if (!added && !removed && !sections?.length) return null;
  return (
    <p className={`text-xs text-slate-500 dark:text-neutral-400 ${className}`}>
      <span className="font-medium text-emerald-700 dark:text-emerald-400">+{added}</span>{" "}
      <span className="font-medium text-rose-700 dark:text-rose-400">−{removed}</span> words
      {sections?.length > 0 && <> · {sections.join(", ")}</>}
    </p>
  );
}

// The versions, newest first. The working copy (changes not saved as a version yet) leads.
export function HistoryPane({ versions, dirty, working, selected, onPick, onCompareWorking, canEdit, onRestore, slug, docId }) {
  if (!versions) return <Loading />;
  const head = versions[0];
  return (
    <div className="space-y-2">
      {dirty && (
        <button type="button" onClick={onCompareWorking}
          className={`block w-full rounded-xl p-3 text-left ring-1 transition ${selected === "working" ? "bg-accent/5 ring-2 ring-accent" : "border border-dashed border-neutral-300 bg-white ring-0 hover:border-accent/60 dark:border-neutral-700 dark:bg-neutral-900"}`}>
          <span className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-200 text-slate-600 dark:bg-neutral-700 dark:text-neutral-200"><PencilLine className="size-4" /></span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900 dark:text-white">Working copy</span>
              <span className="block text-xs text-slate-500 dark:text-neutral-400">Not saved as a version yet{head ? ` · changes since version ${head.number}` : ""}</span>
            </span>
          </span>
          {working && <Stats stats={working} className="mt-1.5 pl-[42px]" />}
        </button>
      )}
      {versions.map((v) => {
        const note = versionNote(v);
        const others = v.contributors.filter((p) => p.id !== v.user?.id);
        const isSelected = selected === v.id;
        return (
          <div key={v.id} className={`rounded-xl bg-white ring-1 transition dark:bg-neutral-900 ${isSelected ? "ring-2 ring-accent" : "ring-neutral-200 hover:ring-accent/50 dark:ring-neutral-800"}`}>
            <button type="button" onClick={() => onPick(v)} className="block w-full !bg-transparent p-3 text-left" aria-pressed={isSelected}>
              <span className="flex items-start gap-2.5">
                <Avatar person={v.user || { name: "?" }} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
                    <span className="font-semibold text-slate-900 dark:text-white">v{v.number} · {v.user?.name || "Someone"}</span>
                    <span className="text-xs text-slate-500 dark:text-neutral-400" title={new Date(v.created_at).toLocaleString()}>{timeAgo(v.created_at)}</span>
                    {v === head && <span className="rounded-full bg-emerald-100 px-1.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">Current</span>}
                  </span>
                  {note ? <span className="mt-0.5 block text-sm text-slate-700 dark:text-neutral-200">{note}</span>
                    : <span className="mt-0.5 block text-sm italic text-slate-400 dark:text-neutral-500">No note</span>}
                  {others.length > 0 && <span className="mt-0.5 block text-xs text-slate-500 dark:text-neutral-400">With {others.map((p) => p.name).join(", ")}</span>}
                  <Stats stats={v} className="mt-0.5" />
                  {v.file && <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-neutral-400">File: {v.file.name}</span>}
                </span>
              </span>
            </button>
            {isSelected && (v.file || (canEdit && v !== head)) && (
              <div className="flex flex-wrap gap-2 border-t border-neutral-100 px-3 py-2 dark:border-neutral-800">
                {v.file && <a href={fileUrl(slug, docId, `?version_id=${v.id}&download=1`)} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"><Download className="size-3.5" /> {v.file.name} ({sizeLabel(v.file.size)})</a>}
                {canEdit && v !== head && <button type="button" onClick={() => onRestore(v)} className="inline-flex items-center gap-1.5 !bg-transparent p-0 text-xs font-medium text-accent hover:underline"><RotateCcw className="size-3.5" /> Restore this version</button>}
              </div>
            )}
          </div>
        );
      })}
      {versions.length === 1 && !dirty && <p className="px-1 text-xs text-slate-500 dark:text-neutral-400">This is the first version. Each time someone saves a change, it's added here with their note.</p>}
    </div>
  );
}

// Unchanged blocks between changes fold away, keeping one either side for context
function fold(items, whole) {
  if (whole) return items.map((item) => ({ item }));
  const near = items.map((item, i) => item.kind !== "same" || [-1, 1].some((d) => items[i + d] && items[i + d].kind !== "same"));
  const out = [];
  items.forEach((item, i) => {
    if (near[i]) out.push({ item });
    else if (out[out.length - 1]?.folded) out[out.length - 1].folded.push(item);
    else out.push({ folded: [item] });
  });
  return out;
}

const KIND_CLASS = { added: "doc-diff-added", removed: "doc-diff-removed", changed: "doc-diff-changed", formatted: "doc-diff-changed" };

// What changed from one version (or nothing, for the first) to another, or to the working copy
export function VersionDiff({ slug, docId, versions, from, to, workingHtml, onFrom, onClose, canEdit, onRestore }) {
  const [whole, setWhole] = useState(false);
  const [texts, setTexts] = useState({});
  const [opened, setOpened] = useState({});
  const [error, setError] = useState(null);
  const head = versions[0];
  const toVersion = to === "working" ? null : versions.find((v) => v.id === to);
  const fromVersion = versions.find((v) => v.id === from) || null;

  useEffect(() => {
    let live = true;
    const need = [from, to].filter((id) => id && id !== "working" && texts[id] === undefined);
    Promise.all(need.map((id) => api(`/groups/${slug}/documents/${docId}/versions/${id}`).then(htmlOf).then((html) => [id, html])))
      .then((pairs) => { if (live && pairs.length) setTexts((t) => ({ ...t, ...Object.fromEntries(pairs) })); })
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [slug, docId, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const oldHtml = from ? texts[from] : "";
  const newHtml = to === "working" ? workingHtml : texts[to];
  const ready = oldHtml !== undefined && newHtml !== undefined;
  const items = useMemo(() => (ready ? diffDocuments(oldHtml, newHtml) : null), [ready, oldHtml, newHtml]);
  const changes = items ? items.filter((i) => i.kind !== "same").length : 0;
  const label = (v) => (v ? `v${v.number} (${v.user?.name || "someone"}, ${timeAgo(v.created_at)})` : "nothing");

  return (
    <article className="doc-paper doc-diff" aria-label="What changed">
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-4 text-sm text-slate-600 print:hidden dark:border-neutral-700 dark:text-neutral-300">
        <span className="flex w-full items-center gap-2">
          <GitCompare className="size-4 text-accent" />
          <strong className="text-slate-900 dark:text-white">What changed</strong>
          <button type="button" onClick={onClose} title="Back to the document" aria-label="Back to the document" className="ml-auto inline-flex items-center gap-1 rounded-lg !bg-transparent px-2 py-1 text-xs font-medium text-accent hover:!bg-neutral-200/70 dark:hover:!bg-neutral-700/60"><X className="size-4" /> Back to the document</button>
        </span>
        <span>
          <select aria-label="Compare from" value={from ?? ""} onChange={(e) => onFrom(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-neutral-300 bg-white px-1.5 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800">
            <option value="">nothing (the start)</option>
            {versions.filter((v) => v.id !== to).map((v) => <option key={v.id} value={v.id}>{label(v)}</option>)}
          </select>
          {" → "}
          <strong className="text-slate-900 dark:text-white">{to === "working" ? "your working copy" : label(toVersion)}</strong>
        </span>
        <span className="inline-flex overflow-hidden rounded-lg ring-1 ring-neutral-300 dark:ring-neutral-600">
          {[["Changes only", false], ["Whole document", true]].map(([text, value]) => (
            <button key={text} type="button" onClick={() => setWhole(value)} aria-pressed={whole === value}
              className={`!rounded-none px-2.5 py-1 text-xs font-medium ${whole === value ? "!bg-accent/15 text-accent" : "!bg-transparent text-slate-600 dark:text-neutral-300"}`}>{text}</button>
          ))}
        </span>
      </div>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      {!items ? <Loading /> : (
        <>
          {toVersion && (toVersion.message || toVersion.kind !== "saved") && <p className="mb-4 rounded-xl bg-neutral-100 px-3 py-2 text-sm text-slate-700 dark:bg-neutral-800 dark:text-neutral-200">“{versionNote(toVersion)}”</p>}
          {changes === 0 && <p className="mb-4 text-sm italic text-slate-500">The text is the same{toVersion?.file || fromVersion?.file ? " (only the attached file or title changed)" : ""}.</p>}
          {fromVersion && toVersion && fromVersion.title !== toVersion.title && (
            <p className="mb-4 text-sm">Title: <del className="doc-diff-del">{fromVersion.title}</del> <ins className="doc-diff-ins">{toVersion.title}</ins></p>
          )}
          <div className="doc-prose">
            {fold(items, whole).map((row, i) => (row.folded ? (
              opened[i] ? row.folded.map((item, k) => <div key={`${i}-${k}`} dangerouslySetInnerHTML={{ __html: item.block.html }} />) : (
                <button key={i} type="button" onClick={() => setOpened((o) => ({ ...o, [i]: true }))}
                  className="my-3 block w-full rounded-lg !bg-neutral-100 px-3 py-1.5 text-left font-sans text-xs text-slate-500 hover:text-accent dark:!bg-neutral-800 dark:text-neutral-400">
                  ⋯ {row.folded.length} unchanged {row.folded.length === 1 ? "paragraph" : "paragraphs"} ⋯
                </button>
              )
            ) : (
              <div key={i} className={KIND_CLASS[row.item.kind] || ""} data-note={row.item.kind === "formatted" ? "Formatting changed" : undefined}
                dangerouslySetInnerHTML={{ __html: row.item.kind === "changed" ? changedHtml(row.item) : row.item.block.html }} />
            )))}
          </div>
          {canEdit && toVersion && toVersion !== head && (
            <div className="mt-8 border-t border-neutral-200 pt-4 print:hidden dark:border-neutral-700">
              <button type="button" onClick={() => onRestore(toVersion)} className={quietButton}><RotateCcw className="size-4" /> Restore version {toVersion.number}</button>
            </div>
          )}
        </>
      )}
    </article>
  );
}

// The box Save opens for a change to a document's text: a note for the version, and what changed
export function SaveVersionDialog({ number, headHtml, workingHtml, onSave, onCancel, saving }) {
  const [message, setMessage] = useState("");
  const stats = useMemo(() => (headHtml === undefined ? null : diffStats(headHtml, workingHtml)), [headHtml, workingHtml]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const submit = (e) => { e.preventDefault(); if (!saving) onSave(message.trim()); };
  return (
    <div className="fixed inset-0 z-[2400] grid place-items-center bg-black/30 p-4 print:hidden" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="save-version-title"
        className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700">
        <div>
          <h2 id="save-version-title" className="text-lg font-semibold text-slate-900 dark:text-white">Save version {number}</h2>
          <p className="text-sm text-slate-500 dark:text-neutral-400">Everyone who can see the history sees who saved it and your note.</p>
        </div>
        <label className="block">
          <span className="sr-only">What changed?</span>
          <textarea autoFocus rows={2} maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(e); }}
            placeholder="What changed? (optional) e.g. Updated the 7th Tradition link per the October vote"
            className="w-full resize-none rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-white" />
        </label>
        {stats ? <Stats stats={stats} /> : <p className="text-xs text-slate-500">Working out what changed…</p>}
        {stats && !stats.words_added && !stats.words_removed && <p className="text-xs text-slate-500 dark:text-neutral-400">Only the title, formatting or attached file changed.</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={quietButton}>Cancel</button>
          <button type="submit" disabled={saving} className={primaryButton}>{saving ? "Saving…" : "Save version"}</button>
        </div>
      </form>
    </div>
  );
}

export { htmlOf as versionHtml };
