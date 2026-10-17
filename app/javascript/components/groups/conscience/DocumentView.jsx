import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Download, History, Pencil, Pin, RotateCcw, Trash2 } from "lucide-react";
import Markdown from "../../book/Markdown";
import { api } from "../lib";
import { Card, ErrorNote, Loading, Message, Tray, dangerButton, primaryButton, quietButton } from "../ui";
import { StatusPills } from "./DocumentsView";
import { KIND_INFO, dateLabel, decisionsPath, documentsPath, fileUrl, sizeLabel } from "./lib";

// One document: its text and/or file, who last changed it, and (for members) the copies
// it had before. Record keepers edit and restore; group admins delete.
export default function DocumentView({ group, id }) {
  const slug = group.slug;
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setDoc(null);
    setError(null);
    setHistory(null);
    setShowHistory(false);
    api(`/groups/${slug}/documents/${id}`).then(setDoc).catch((e) => setError(e.message));
  }, [slug, id]);

  const loadHistory = useCallback(() => api(`/groups/${slug}/documents/${id}/versions`).then((d) => setHistory(d.versions)).catch((e) => setError(e.message)), [slug, id]);
  const toggleHistory = () => {
    if (!showHistory && !history) loadHistory();
    setShowHistory((v) => !v);
  };

  if (error && !doc) return <Message title="That document isn't here" text={error}><Link to={documentsPath(slug)} className="mt-4 inline-block text-sm text-accent hover:underline">Back to documents</Link></Message>;
  if (!doc) return <Loading />;

  const isMember = group.is_member || group.is_site_admin;
  const folderLink = `${documentsPath(slug)}?folder=${doc.kind}`;
  const remove = async () => {
    if (!window.confirm(`Delete “${doc.title}” and its history? This can't be undone.`)) return;
    try {
      await api(`/groups/${slug}/documents/${id}`, { method: "DELETE" });
      navigate(folderLink);
    } catch (e) {
      setError(e.message);
    }
  };
  const restore = async (version) => {
    if (!window.confirm("Put this copy back? The current one stays in the history.")) return;
    try {
      setDoc(await api(`/groups/${slug}/documents/${id}/versions/${version.id}/restore`, { method: "POST" }));
      await loadHistory();
    } catch (e) {
      setError(e.message);
    }
  };

  const file = doc.file;
  const src = fileUrl(slug, id);
  return (
    <div className="space-y-4">
      <Link to={isMember ? folderLink : documentsPath(slug)} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
        <ChevronLeft className="size-4" /> {isMember ? KIND_INFO[doc.kind].label : "Documents"}
      </Link>
      <ErrorNote error={error} />

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 !text-2xl font-semibold text-slate-900 dark:text-white">
              {doc.pinned && <Pin className="size-5 text-amber-600" aria-label="Pinned" />} {doc.title}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
              <StatusPills doc={doc} />
              <span>Updated {dateLabel(doc.updated_at)}{doc.updated_by ? ` by ${doc.updated_by}` : ""}</span>
              {doc.approved_by && (
                <Link to={decisionsPath(slug, doc.approved_by.id)} className="text-accent hover:underline">
                  Adopted{doc.approved_by.decided_on ? ` ${dateLabel(doc.approved_by.decided_on)}` : ""} by group conscience
                </Link>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isMember && <button type="button" onClick={toggleHistory} aria-pressed={showHistory} className={quietButton}><History className="size-4" /> History</button>}
            {doc.can_edit && <Link to={documentsPath(slug, `${id}/edit`)} className={primaryButton}><Pencil className="size-4" /> Edit</Link>}
            {doc.can_delete && <button type="button" onClick={remove} className={dangerButton}><Trash2 className="size-4" /> Delete</button>}
          </div>
        </div>

        {doc.body.trim() && <Markdown source={doc.body} className="ev-md mt-5 text-slate-800 dark:text-neutral-200" />}

        {file && (
          <div className="mt-5 space-y-3">
            {file.inline && file.type === "application/pdf" && <iframe title={file.name} src={src} className="h-[70vh] w-full rounded-xl border border-neutral-200 dark:border-neutral-700" />}
            {file.inline && file.type.startsWith("image/") && <img src={src} alt={doc.title} className="max-h-[70vh] rounded-xl" />}
            <a href={fileUrl(slug, id, "?download=1")} className={`${quietButton} !inline-flex`}>
              <Download className="size-4" /> Download {file.name} <span className="text-xs text-slate-500">({sizeLabel(file.size)})</span>
            </a>
          </div>
        )}
        {!doc.body.trim() && !file && <p className="mt-5 text-sm italic text-slate-500 dark:text-neutral-400">This document is empty.</p>}
      </Card>

      {showHistory && (
        <Tray label="History">
          {!history ? <Loading /> : history.length === 0 ? (
            <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">Nobody has changed this document since it was first saved.</Card>
          ) : (
            <div className="space-y-1.5">
              <p className="px-1 text-xs text-slate-500 dark:text-neutral-400">The copies this document had before each change, newest first.</p>
              {history.map((v) => (
                <Card key={v.id} className="p-3">
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="font-medium text-slate-900 dark:text-white">{dateLabel(v.created_at)}</span>
                      <span className="text-slate-500 dark:text-neutral-400">{v.user ? `by ${v.user}` : ""}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-neutral-300">{v.title}</span>
                    </summary>
                    <div className="mt-3 space-y-3">
                      {v.body.trim() ? <Markdown source={v.body} className="ev-md text-sm text-slate-800 dark:text-neutral-200" /> : <p className="text-sm italic text-slate-500">No text.</p>}
                      {v.file && (
                        <a href={fileUrl(slug, id, `?version_id=${v.id}&download=1`)} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                          <Download className="size-4" /> {v.file.name} ({sizeLabel(v.file.size)})
                        </a>
                      )}
                      {doc.can_edit && <div><button type="button" onClick={() => restore(v)} className={quietButton}><RotateCcw className="size-4" /> Put this copy back</button></div>}
                    </div>
                  </details>
                </Card>
              ))}
            </div>
          )}
        </Tray>
      )}
    </div>
  );
}
