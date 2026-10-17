import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, FileText, Globe, Lock, Pin, Plus, Search, Upload } from "lucide-react";
import { inputClass } from "../../ui/styles";
import { api } from "../lib";
import { Card, ErrorNote, Loading, Pill, Tray, primaryButton } from "../ui";
import { FILE_ACCEPT, KINDS, KIND_INFO, VISIBILITY_LABELS, dateLabel, documentsPath } from "./lib";

export function StatusPills({ doc }) {
  return (
    <>
      {doc.visibility === "public" && <Pill tone="green"><Globe className="size-3" /> Public</Pill>}
      {doc.visibility === "keepers" && <Pill tone="amber"><Lock className="size-3" /> {VISIBILITY_LABELS.keepers}</Pill>}
      {doc.status !== "current" && <Pill tone="slate">{doc.status === "draft" ? "Draft" : "Archived"}</Pill>}
    </>
  );
}

function DocRow({ slug, doc, showKind }) {
  const Icon = KIND_INFO[doc.kind]?.icon || FileText;
  return (
    <Link to={documentsPath(slug, doc.id)} className="flex items-start gap-3 rounded-xl bg-white p-3 shadow-panel hover:ring-1 hover:ring-accent/40 dark:bg-neutral-900">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent"><Icon className="size-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {doc.pinned && <Pin className="size-3.5 text-amber-600" aria-label="Pinned" />}
          <span className="font-medium text-slate-900 dark:text-white">{doc.title}</span>
          <StatusPills doc={doc} />
        </span>
        {doc.excerpt && <span className="mt-0.5 block truncate text-sm text-slate-600 dark:text-neutral-300">{doc.excerpt}</span>}
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-neutral-400">
          {showKind && `${KIND_INFO[doc.kind]?.label} · `}{doc.file ? `${doc.file.name} · ` : ""}Updated {dateLabel(doc.updated_at)}{doc.updated_by ? ` by ${doc.updated_by}` : ""}
        </span>
      </span>
    </Link>
  );
}

// The group's documents as folders (their kinds). Record keepers can also drag a file
// onto the page to upload it into the open folder.
export default function DocumentsView({ group }) {
  const slug = group.slug;
  const [params, setParams] = useSearchParams();
  const folder = KIND_INFO[params.get("folder")] ? params.get("folder") : null;
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    const q = query.trim();
    return api(`/groups/${slug}/documents${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(setData).catch((e) => setError(e.message));
  }, [slug, query]);
  useEffect(() => {
    const t = setTimeout(load, query ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  const canEdit = data?.can_edit;
  const upload = async (files) => {
    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        const form = new FormData();
        form.append("document[file]", file);
        form.append("document[kind]", folder || "other");
        await api(`/groups/${slug}/documents`, { method: "POST", form });
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const onDrop = (e) => {
    setDragging(false);
    if (!canEdit || !e.dataTransfer.files.length) return;
    e.preventDefault();
    upload([...e.dataTransfer.files]);
  };

  if (!data) return error ? <ErrorNote error={error} /> : <Loading />;

  const docs = data.documents;
  const searching = query.trim().length > 0;
  const inFolder = folder ? docs.filter((d) => d.kind === folder) : [];
  const counts = Object.fromEntries(KINDS.map((k) => [k.key, docs.filter((d) => d.kind === k.key).length]));
  const folders = KINDS.filter((k) => canEdit || counts[k.key] > 0);
  const pinned = docs.filter((d) => d.pinned);

  return (
    <div
      className={`space-y-5 rounded-2xl ${dragging ? "outline-dashed outline-2 outline-offset-4 outline-accent" : ""}`}
      onDragOver={(e) => { if (canEdit && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
      onDrop={onDrop}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input type="search" aria-label="Search documents" className={`${inputClass} !pl-9`} placeholder="Search documents" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {canEdit && (
          <>
            <input ref={fileRef} type="file" multiple hidden accept={FILE_ACCEPT} onChange={(e) => { upload([...e.target.files]); e.target.value = ""; }} />
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl !bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-neutral-200 hover:!bg-neutral-50 disabled:opacity-50 dark:!bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700">
              <Upload className="size-4" /> {busy ? "Uploading…" : "Upload a file"}
            </button>
            <Link to={`${documentsPath(slug, "new")}${folder ? `?kind=${folder}` : ""}`} className={primaryButton}><Plus className="size-4" /> Write a document</Link>
          </>
        )}
      </div>
      <ErrorNote error={error} />

      {searching ? (
        <Tray label={`${docs.length} ${docs.length === 1 ? "document" : "documents"}`}>
          <div className="space-y-1.5">
            {docs.length === 0 && <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">Nothing matches “{query.trim()}”.</Card>}
            {docs.map((d) => <DocRow key={d.id} slug={slug} doc={d} showKind />)}
          </div>
        </Tray>
      ) : folder ? (
        <>
          <button type="button" onClick={() => setParams({})} className="inline-flex items-center gap-1 !bg-transparent p-0 text-sm font-medium text-accent hover:underline">
            <ChevronLeft className="size-4" /> All folders
          </button>
          <Tray label={KIND_INFO[folder].label}>
            <div className="space-y-1.5">
              {inFolder.length === 0 && (
                <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">
                  {canEdit ? "Nothing here yet. Write a document, or drop a file on this page." : "Nothing here yet."}
                </Card>
              )}
              {inFolder.map((d) => <DocRow key={d.id} slug={slug} doc={d} />)}
            </div>
          </Tray>
        </>
      ) : (
        <>
          {docs.length === 0 && (
            <Card className="p-5 text-sm text-slate-600 dark:text-neutral-300">
              {canEdit
                ? "No documents yet. Start with your meeting format or your group's guidelines: write one here, or drop a PDF or Word file on this page. Everything starts for Members only."
                : "The group hasn't shared any documents yet."}
            </Card>
          )}
          {pinned.length > 0 && (
            <Tray label="Pinned">
              <div className="space-y-1.5">{pinned.map((d) => <DocRow key={d.id} slug={slug} doc={d} showKind />)}</div>
            </Tray>
          )}
          <Tray label="Folders">
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {folders.map(({ key, label, note, icon: Icon }) => (
                <button key={key} type="button" onClick={() => setParams({ folder: key })} className="flex items-start gap-3 rounded-xl !bg-white p-3 text-left shadow-panel hover:ring-1 hover:ring-accent/40 dark:!bg-neutral-900">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"><Icon className="size-5" /></span>
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-900 dark:text-white">{label}</span>
                    <span className="block text-xs text-slate-500 dark:text-neutral-400">{note}</span>
                    <span className="mt-1 block text-xs font-semibold text-accent">{counts[key]} {counts[key] === 1 ? "document" : "documents"}</span>
                  </span>
                </button>
              ))}
            </div>
          </Tray>
        </>
      )}
    </div>
  );
}
