import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, FileText, Paperclip, Save, Trash2 } from "lucide-react";
import Markdown from "../../book/Markdown";
import { inputClass, labelClass, selectClass } from "../../ui/styles";
import Toggle from "../../ui/Toggle";
import { api } from "../lib";
import { Card, ErrorNote, Loading, Message, primaryButton, quietButton } from "../ui";
import { FILE_ACCEPT, KINDS, NAMES_REMINDER, STATUSES, VISIBILITIES, documentsPath, sizeLabel } from "./lib";

const BODY_MAX = 100_000;

// Writing or changing a document (record keepers): Markdown with a preview, and/or a file.
// ⌘/Ctrl+S saves; each save keeps the copy it replaces in the document's history.
export default function DocumentEditor({ group, id = null }) {
  const slug = group.slug;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [loaded, setLoaded] = useState(id ? null : {});
  const [form, setForm] = useState({ title: "", kind: KINDS.some((k) => k.key === params.get("kind")) ? params.get("kind") : "other", body: "", visibility: "members", status: "current", pinned: false });
  const [file, setFile] = useState(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [view, setView] = useState("write");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    api(`/groups/${slug}/documents/${id}`).then((d) => {
      if (!d.can_edit) throw new Error("Only this group's record keepers can change documents.");
      setLoaded(d);
      setForm({ title: d.title, kind: d.kind, body: d.body, visibility: d.visibility, status: d.status, pinned: d.pinned });
    }).catch((e) => setError(e.message));
  }, [slug, id]);

  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (key) => (value) => { setForm((f) => ({ ...f, [key]: value })); setDirty(true); };
  const hasFile = !!file || (!!loaded?.file && !removeFile);
  const empty = !form.title.trim() && !file;

  const save = useCallback(async () => {
    if (saving || empty) return;
    if (form.visibility === "public" && loaded?.visibility !== "public" && !window.confirm("This will be visible to anyone who opens the group's page. Save it as Public?")) return;
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(`document[${k}]`, v));
      if (file) body.append("document[file]", file);
      if (removeFile && !file) body.append("document[remove_file]", "true");
      const saved = await api(`/groups/${slug}/documents${id ? `/${id}` : ""}`, { method: id ? "PATCH" : "POST", form: body });
      setDirty(false);
      navigate(documentsPath(slug, saved.id), { replace: true });
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }, [saving, empty, form, file, removeFile, slug, id, loaded, navigate]);

  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  if (error && !loaded) return <Message title="You can't change that" text={error}><Link to={documentsPath(slug)} className="mt-4 inline-block text-sm text-accent hover:underline">Back to documents</Link></Message>;
  if (!loaded) return <Loading />;
  if (!group.can_keep_records && !group.is_site_admin) return <Message title="You can't change documents" text="Only this group's record keepers can write or upload documents." />;

  return (
    <div className="space-y-4">
      <Link to={id ? documentsPath(slug, id) : documentsPath(slug)} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
        <ChevronLeft className="size-4" /> {id ? "Back to the document" : "Documents"}
      </Link>
      <ErrorNote error={error} />

      <Card className="space-y-4 p-4 sm:p-5">
        <div>
          <label htmlFor="doc-title" className={labelClass}>Title</label>
          <input id="doc-title" className={`${inputClass} !text-base font-medium`} maxLength={160} value={form.title} onChange={(e) => set("title")(e.target.value)}
            placeholder={file ? file.name.replace(/\.[^.]+$/, "") : "e.g. Our meeting format"} autoFocus={!id} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="doc-kind" className={labelClass}>Folder</label>
            <select id="doc-kind" className={selectClass} value={form.kind} onChange={(e) => set("kind")(e.target.value)}>
              {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="doc-visibility" className={labelClass}>Who can see it</label>
            <select id="doc-visibility" className={selectClass} value={form.visibility} onChange={(e) => set("visibility")(e.target.value)}>
              {VISIBILITIES.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="doc-status" className={labelClass}>Status</label>
            <select id="doc-status" className={selectClass} value={form.status} onChange={(e) => set("status")(e.target.value)}>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <p className="-mt-2 text-xs text-slate-500 dark:text-neutral-400">
          {VISIBILITIES.find((v) => v.key === form.visibility).note}.{form.status === "draft" && " Drafts are only seen by record keepers."}{form.status === "archived" && " Archived documents are only seen by record keepers."}
        </p>
        <Toggle checked={form.pinned} onChange={set("pinned")} label="Pin it" description="Pinned documents lead their folder and the Documents block on the group's page." />

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="doc-body" className={`${labelClass} !mb-0`}>Text</label>
            <div role="tablist" className="flex rounded-lg bg-neutral-100 p-0.5 text-xs font-semibold dark:bg-neutral-800 lg:hidden">
              {["write", "preview"].map((v) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
                  className={`rounded-md px-2.5 py-1 capitalize ${view === v ? "!bg-white text-slate-900 shadow-sm dark:!bg-neutral-950 dark:text-white" : "!bg-transparent text-slate-500"}`}>{v}</button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <textarea id="doc-body" className={`${inputClass} min-h-[28rem] font-mono !text-[13px] leading-relaxed ${view === "preview" ? "hidden lg:block" : ""}`}
              maxLength={BODY_MAX} value={form.body} onChange={(e) => set("body")(e.target.value)}
              placeholder={"Markdown works: # headings, **bold**, - lists, > quotes, and tables:\n\n| Item | Amount |\n|---|---|\n| Rent | $60 |"} />
            <div className={`min-h-[28rem] rounded-xl bg-neutral-50 p-4 ring-1 ring-neutral-200 dark:bg-neutral-950 dark:ring-neutral-800 ${view === "write" ? "hidden lg:block" : ""}`}>
              {form.body.trim() ? <Markdown source={form.body} className="ev-md text-slate-800 dark:text-neutral-200" /> : <p className="text-sm italic text-slate-400">Your document shows here as you write.</p>}
            </div>
          </div>
          <p className="mt-1 flex justify-between gap-3 text-xs text-slate-500 dark:text-neutral-400">
            <span>{NAMES_REMINDER}</span>
            <span>{form.body.length.toLocaleString()} / {BODY_MAX.toLocaleString()}</span>
          </p>
        </div>

        <div>
          <span className={labelClass}>File</span>
          <input ref={fileRef} type="file" hidden accept={FILE_ACCEPT} onChange={(e) => { setFile(e.target.files[0] || null); setRemoveFile(false); setDirty(true); e.target.value = ""; }} />
          <div className="flex flex-wrap items-center gap-2">
            {hasFile ? (
              <span className="inline-flex items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-800">
                <FileText className="size-4 text-slate-500" /> {file ? file.name : loaded.file.name}
                <span className="text-xs text-slate-500">({sizeLabel(file ? file.size : loaded.file.size)})</span>
              </span>
            ) : <span className="text-sm text-slate-500 dark:text-neutral-400">No file. A PDF, Word, Excel or picture file, up to 20 MB.</span>}
            <button type="button" onClick={() => fileRef.current?.click()} className={quietButton}><Paperclip className="size-4" /> {hasFile ? "Replace file" : "Attach a file"}</button>
            {hasFile && (
              <button type="button" onClick={() => { setFile(null); setRemoveFile(!!loaded?.file); setDirty(true); }} className={`${quietButton} !text-rose-700`}><Trash2 className="size-4" /> Remove</button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
          <Link to={id ? documentsPath(slug, id) : documentsPath(slug)} className={quietButton}>Cancel</Link>
          <button type="button" onClick={save} disabled={saving || empty} className={primaryButton}><Save className="size-4" /> {saving ? "Saving…" : "Save"}</button>
        </div>
      </Card>
    </div>
  );
}
