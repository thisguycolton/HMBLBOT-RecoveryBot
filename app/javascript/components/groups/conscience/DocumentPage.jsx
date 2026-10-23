import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import { ChevronLeft, Download, FileUp, Paperclip, Pin, RotateCcw, Save, Trash2 } from "lucide-react";
import { download, safeName, toDocx, toMarkdown, toRtf } from "../../../lib/documentExport";
import { toDocumentJson } from "../../../lib/documentJson";
import { IMPORT_ACCEPT } from "../../../lib/documentImport";
import MenuBar from "./MenuBar";
import Markdown, { markdownToHtml } from "../../book/Markdown";
import { importDocument } from "../../../lib/documentImport";
import { labelClass, selectClass } from "../../ui/styles";
import Toggle from "../../ui/Toggle";
import FilterPick from "../../ui/FilterPick";
import { api } from "../lib";
import { ErrorNote, Loading, Message, Pill, dangerButton, primaryButton, quietButton } from "../ui";
import DocumentToolbar from "./DocumentToolbar";
import PdfViewer from "./PdfViewer";
import ShareMenu from "./ShareMenu";
import { documentExtensions } from "./editorKit";
import { DynamicValuesBar } from "./hostSection";
import { LivePresence, liveExtensions, useLiveDocument, useShareViewing } from "./live";
import { FILE_ACCEPT, KIND_INFO, KINDS, VISIBILITIES, VISIBILITY_LABELS, STATUSES, dateLabel, decisionsPath, documentsPath, fileUrl, motionOptions, sizeLabel } from "./lib";

// The folder's letterhead at the top of the page: its logo or seal, a heading and a line under it
function Letterhead({ template: t, groupTitle }) {
  return (
    <header className={`doc-letterhead doc-letterhead--${t.align}`}>
      {t.mark_url && <img src={t.mark_url} alt="" className="doc-letterhead-mark" />}
      {(t.header_text || t.subheader_text) && (
        <div className="doc-letterhead-text">
          {t.header_text && <p className="doc-letterhead-heading">{t.header_text.replace("{{group}}", groupTitle)}</p>}
          {t.subheader_text && <p className="doc-letterhead-sub">{t.subheader_text.replace("{{group}}", groupTitle)}</p>}
        </div>
      )}
    </header>
  );
}

// What the editor starts from: the text as HTML (an older Markdown document is converted)
async function startingHtml(doc) {
  if (!doc?.body?.trim()) return "";
  return doc.body_format === "markdown" ? markdownToHtml(doc.body) : doc.body;
}

// /conscience/documents/:id (and /new): a group document as a page, like a word processor's. Record
// keepers type straight into it; everyone else reads it. Loads the document, then hands over to
// DocumentSheet, which holds the editor. With live editing on, everyone who has it open is on
// the same copy (LiveSheet).
export default function DocumentPage({ group, id = null, embedded = false }) {
  const slug = group.slug;
  const [loaded, setLoaded] = useState(null); // { doc, html }
  const [error, setError] = useState(null);
  // goes up when the live copy has to start over (someone put an old version back)
  const [reloads, setReloads] = useState(0);
  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    setLoaded(null);
    setError(null);
    if (!id) { setLoaded({ doc: null, html: "" }); return; }
    api(`/groups/${slug}/documents/${id}`)
      .then(async (doc) => setLoaded({ doc, html: await startingHtml(doc) }))
      .catch((e) => setError(e.message));
  }, [slug, id, reloads]);

  if (error) return <Message title="That document isn't here" text={error}><Link to={documentsPath(slug)} className="mt-4 inline-block text-sm text-accent hover:underline">Back to documents</Link></Message>;
  if (!loaded) return <Loading />;
  const canEdit = loaded.doc ? loaded.doc.can_edit : !!(group.can_keep_records || group.is_site_admin);
  if (!loaded.doc && !canEdit) return <Message title="You can't write documents here" text="Only this group's record keepers can write or upload documents." />;
  const props = { group, initialDoc: loaded.doc, initialHtml: loaded.html, canEdit, embedded };
  if (loaded.doc?.live) return <LiveSheet key={`${id}-${reloads}`} {...props} onReload={reload} />;
  return <DocumentSheet key={id || "new"} {...props} />;
}

// The document open live: waits for the shared copy, then shows it. If it can't connect, or a
// reader opens one nobody has edited live yet, it's the page as it always was.
function LiveSheet({ onReload, ...props }) {
  const { live, state } = useLiveDocument({ slug: props.group.slug, doc: props.initialDoc, html: props.initialHtml, canEdit: props.canEdit, onReset: onReload });
  if (state === "loading") return <Loading />;
  return <DocumentSheet {...props} live={state === "ready" ? live : null} onReload={onReload} />;
}

function DocumentSheet({ group, initialDoc, initialHtml, canEdit, embedded, live = null, onReload }) {
  const slug = group.slug;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isMember = group.is_member || group.is_site_admin;
  const [doc, setDoc] = useState(initialDoc);
  const [form, setForm] = useState(() => (initialDoc
    ? { title: initialDoc.title, kind: initialDoc.kind, visibility: initialDoc.visibility, status: initialDoc.status, pinned: initialDoc.pinned, approved_by_motion_id: initialDoc.approved_by?.id ?? "" }
    : { title: "", kind: KINDS.some((k) => k.key === params.get("kind")) ? params.get("kind") : "other", visibility: "members", status: "current", pinned: false, approved_by_motion_id: "" }));
  // live: the connection ("live" / "offline"), our edits the server hasn't taken yet, and whether
  // the text changed since the last Save version
  const [liveStatus, setLiveStatus] = useState("live");
  const [pending, setPending] = useState(0);
  const [unversioned, setUnversioned] = useState(!!live?.unversioned);
  const [upload, setUpload] = useState(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [details, setDetails] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  // The dark page: each person's own pick, kept in this browser; until they pick, it follows the site
  const [paper, setPaper] = useState(() => { try { return localStorage.getItem("doc-paper") || ""; } catch { return ""; } });
  const darkPaper = paper ? paper === "dark" : document.documentElement.classList.contains("dark");
  const flipPaper = () => {
    const next = darkPaper ? "light" : "dark";
    setPaper(next);
    try { localStorage.setItem("doc-paper", next); } catch {}
  };
  // Leaving full screen: Esc, or the browser leaving its own full screen; the page behind stays put
  useEffect(() => {
    if (!fullScreen) return undefined;
    const onKey = (e) => { if (e.key === "Escape" && !document.fullscreenElement) setFullScreen(false); };
    const onChange = () => { if (!document.fullscreenElement) setFullScreen(false); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onChange);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onChange);
      document.body.style.overflow = "";
    };
  }, [fullScreen]);
  const [history, setHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [adopters, setAdopters] = useState([]);
  const [withText, setWithText] = useState(() => !!initialHtml || !initialDoc?.file);
  const titleRef = useRef(null);
  const fileRef = useRef(null);
  const importRef = useRef(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [valuesOpen, setValuesOpen] = useState(false);
  // The folder's letterhead (Document templates): from the document, or for record keepers the
  // current one for whichever folder is picked, so changing the folder shows it at once
  const [templates, setTemplates] = useState(null);
  useEffect(() => {
    if (!isMember) return;
    api(`/groups/${slug}/document_templates`).then((d) => setTemplates(d.templates)).catch(() => {});
  }, [slug, isMember]);
  const letterhead = (() => {
    const t = templates?.find((x) => x.kind === form.kind);
    if (t) return t.blank ? null : t;
    return doc?.letterhead || null;
  })();

  const editor = useEditor({
    extensions: documentExtensions("Start typing, or import a Word or RTF file from the toolbar…", live ? liveExtensions(live) : []),
    content: live ? undefined : initialHtml,
    editable: canEdit,
    // live, the text saves itself (LiveDocument)
    onUpdate: () => { if (!live) { setDirty(true); setSaved(false); } },
    editorProps: { attributes: { class: "doc-prose", "aria-label": "Document text" } },
  });

  // Live: the title is shared too; what the others do shows up here as they do it
  useEffect(() => {
    if (!live) return undefined;
    live.onStatus = setLiveStatus;
    live.onPending = setPending;
    live.onSaved = (m) => {
      setUnversioned(!!m.unversioned);
      if (m.updated_at) setDoc((d) => ({ ...d, updated_at: m.updated_at, updated_by: m.updated_by }));
      // someone saved a version, maybe with new details (folder, visibility…)
      if (m.details) api(`/groups/${slug}/documents/${initialDoc.id}`).then((d) => { setDoc(d); setForm((f) => ({ ...f, kind: d.kind, visibility: d.visibility, status: d.status, pinned: d.pinned, approved_by_motion_id: d.approved_by?.id ?? "" })); setHistory(null); }).catch(() => {});
    };
    const onTitle = () => setForm((f) => ({ ...f, title: live.title.toString() }));
    if (live.title.length) onTitle();
    live.title.observe(onTitle);
    const onEdit = (_u, origin) => { if (origin !== "remote") setUnversioned(true); };
    live.doc.on("update", onEdit);
    return () => { live.title.unobserve(onTitle); live.doc.off("update", onEdit); live.onStatus = live.onPending = live.onSaved = null; };
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!live || !editor) return undefined;
    live.getHtml = () => (editor.isEmpty ? "" : editor.getHTML());
    return () => { live.getHtml = null; };
  }, [live, editor]);
  useShareViewing(live, editor);
  // edits that haven't gone through for a while: the connection dropped without saying so
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    setStuck(false);
    if (!pending) return undefined;
    const t = setTimeout(() => setStuck(true), 5000);
    return () => clearTimeout(t);
  }, [pending > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const offline = liveStatus === "offline" || stuck;

  const change = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (live && key === "title") { live.setTitle(value); return; }
    setDirty(true);
    setSaved(false);
  };
  const file = removeFile ? null : doc?.file;

  useEffect(() => {
    document.body.classList.add("doc-printing");
    return () => document.body.classList.remove("doc-printing");
  }, []);
  useEffect(() => {
    if (!canEdit) return;
    api(`/groups/${slug}/motions`).then((d) => setAdopters(d.motions.filter((m) => m.status === "passed"))).catch(() => {});
  }, [slug, canEdit]);
  useEffect(() => {
    const warn = (e) => { if (dirty || pending) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);

  const save = useCallback(async () => {
    if (!canEdit || saving || !editor) return;
    if (!form.title.trim() && !upload) { setError("Give the document a title."); titleRef.current?.focus(); return; }
    if (form.visibility === "public" && doc?.visibility !== "public" && !window.confirm("This will be visible to anyone who opens the group's page. Save it as Public?")) return;
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      // live, the text and title are already saved: this writes down the details and makes the
      // text as it stands the one the next edit keeps a copy of
      if (live) await live.flush();
      Object.entries(form).forEach(([k, v]) => { if (!(live && k === "title")) body.append(`document[${k}]`, v); });
      if (!live) {
        body.append("document[body]", editor.isEmpty ? "" : editor.getHTML());
        body.append("document[body_format]", "html");
      }
      if (upload) body.append("document[file]", upload);
      if (removeFile && !upload) body.append("document[remove_file]", "true");
      const result = await api(`/groups/${slug}/documents${doc ? `/${doc.id}` : ""}${live ? "?checkpoint=1" : ""}`, { method: doc ? "PATCH" : "POST", form: body });
      setUnversioned(false);
      setDirty(false);
      setSaved(true);
      setUpload(null);
      setRemoveFile(false);
      setHistory(null);
      if (doc) setDoc(result);
      else navigate(documentsPath(slug, result.id), { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }, [canEdit, saving, editor, form, upload, removeFile, doc, slug, navigate, live]);

  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const importFile = async (picked) => {
    setError(null);
    setNotice(null);
    try {
      const { title, html, notes } = await importDocument(picked);
      if (!editor.isEmpty && !window.confirm("Replace what's on the page with this file?")) return;
      editor.commands.setContent(html, true);
      if (!form.title.trim()) setForm((f) => ({ ...f, title }));
      setWithText(true);
      setDirty(true);
      setNotice([`Imported “${picked.name}”.`, ...notes, "Save when it looks right."].join(" "));
    } catch (e) {
      setError(e.message);
    }
  };

  const loadHistory = useCallback(() => api(`/groups/${slug}/documents/${doc.id}/versions`).then((d) => setHistory(d.versions)).catch((e) => setError(e.message)), [slug, doc]);
  const toggleHistory = () => {
    if (!showHistory && !history) loadHistory();
    setShowHistory((v) => !v);
  };
  const restore = async (version) => {
    if (dirty && !window.confirm("You have changes that aren't saved. Put this copy back anyway?")) return;
    if (!window.confirm("Put this copy back? The current one stays in the history.")) return;
    try {
      const result = await api(`/groups/${slug}/documents/${doc.id}/versions/${version.id}/restore`, { method: "POST" });
      // live, everyone (this tab too) starts again from the copy put back
      if (live) { onReload?.(); return; }
      editor.commands.setContent(await startingHtml(result), false);
      setDoc(result);
      setForm((f) => ({ ...f, title: result.title }));
      setDirty(false);
      setSaved(true);
      setHistory(null);
      await loadHistory();
    } catch (e) {
      setError(e.message);
    }
  };
  const remove = async () => {
    if (!window.confirm(`Delete “${doc.title}” and its history? This can't be undone.`)) return;
    try {
      await api(`/groups/${slug}/documents/${doc.id}`, { method: "DELETE" });
      setDirty(false);
      navigate(`${documentsPath(slug)}?folder=${doc.kind}`);
    } catch (e) {
      setError(e.message);
    }
  };
  const printPdf = () => {
    const before = document.title;
    document.title = form.title || doc?.title || "Document";
    const restoreTitle = () => { document.title = before; window.removeEventListener("afterprint", restoreTitle); };
    window.addEventListener("afterprint", restoreTitle);
    window.print();
  };

  // Full screen: the page fills the window (and the screen, where the browser allows), Esc leaves
  const toggleFullScreen = () => {
    const next = !fullScreen;
    setFullScreen(next);
    try {
      if (next && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
      if (!next && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch {}
  };

  const folderLink = `${documentsPath(slug)}${isMember ? `?folder=${form.kind}` : ""}`;
  const showPaper = canEdit ? withText : !!initialHtml.trim();
  const isPdf = file?.type === "application/pdf";
  const pdfOnly = isPdf && !showPaper;
  const status = saving ? "Saving…" : dirty ? "Unsaved changes"
    : live ? (offline ? (canEdit ? "Offline: your changes will sync when you're back" : "Offline") : !canEdit ? "" : pending ? "Saving…" : "All changes saved")
    : saved ? "All changes saved" : "";
  // live, Save version is worth pressing once the text changed or a detail did
  const canSave = live ? dirty || unversioned || !!upload || removeFile : dirty || !doc;
  const saveLabel = live ? "Save version" : "Save";

  const exportAs = async (kind) => {
    const html = editor?.isEmpty ? "" : editor?.getHTML() || "";
    const title = form.title || doc?.title || "Document";
    try {
      if (kind === "docx") download(await toDocx(html, title), `${safeName(title)}.docx`);
      if (kind === "rtf") download(new Blob([toRtf(html, title)], { type: "application/rtf" }), `${safeName(title)}.rtf`);
      if (kind === "md") download(new Blob([toMarkdown(html, title)], { type: "text/markdown" }), `${safeName(title)}.md`);
      if (kind === "json") download(new Blob([toDocumentJson(editor, { title, kind: form.kind, status: form.status })], { type: "application/json" }), `${safeName(title)}.recoverybot.json`);
    } catch (e) { setError(`Couldn't make that file: ${e.message}`); }
  };
  const chain = () => editor.chain().focus();
  const hasText = showPaper && editor && !editor.isEmpty;
  const menus = [
    { label: "File", items: [
      canEdit && { label: saveLabel, shortcut: "⌘S", onClick: save, disabled: saving || !canSave },
      canEdit && { label: "New document", onClick: () => navigate(`${documentsPath(slug, "new")}?kind=${form.kind}`) },
      canEdit && { label: "Import Word, RTF, Markdown or JSON…", onClick: () => importRef.current?.click() },
      canEdit && "divider",
      { label: "Download as Word (.docx)", onClick: () => exportAs("docx"), disabled: !hasText },
      { label: "Download as RTF", onClick: () => exportAs("rtf"), disabled: !hasText },
      { label: "Download as Markdown", onClick: () => exportAs("md"), disabled: !hasText },
      // Keeps the sections, forms, dynamic values and collapsibles, to import into another group or back
      { label: "Download as RecoveryBot JSON", onClick: () => exportAs("json"), disabled: !hasText },
      { label: pdfOnly ? "Download the PDF" : "Save as PDF / Print", shortcut: "⌘P", onClick: () => (pdfOnly ? window.open(fileUrl(slug, doc.id, "?download=1")) : printPdf()), disabled: !doc && !hasText },
      file && doc && !pdfOnly && { label: `Download ${file.name}`, onClick: () => window.open(fileUrl(slug, doc.id, "?download=1")) },
      "divider",
      doc && { label: "Share…", onClick: () => setShareOpen(true) },
      canEdit && { label: "Document details…", onClick: () => setDetails((v) => !v), checked: details },
      isMember && doc && { label: "Version history", onClick: toggleHistory, checked: showHistory },
      doc?.can_delete && "divider",
      doc?.can_delete && { label: "Delete document…", onClick: remove },
    ] },
    canEdit && showPaper && { label: "Edit", items: [
      { label: "Undo", shortcut: "⌘Z", onClick: () => chain().undo().run(), disabled: !editor?.can().undo() },
      { label: "Redo", shortcut: "⇧⌘Z", onClick: () => chain().redo().run(), disabled: !editor?.can().redo() },
      "divider",
      { label: "Select all", shortcut: "⌘A", onClick: () => chain().selectAll().run() },
      { label: "Clear formatting", onClick: () => chain().unsetAllMarks().clearNodes().run() },
    ] },
    { label: "View", items: [
      { label: "Dark page", onClick: flipPaper, checked: darkPaper },
      { label: "Full screen", shortcut: "Esc to leave", onClick: toggleFullScreen, checked: fullScreen },
    ] },
    canEdit && showPaper && { label: "Insert", items: [
      { label: "Table", onClick: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
      { label: "Divider line", onClick: () => chain().setHorizontalRule().run() },
      { label: "Collapsible text", onClick: () => chain().setCollapsible().run() },
      "divider",
      { label: "Add Section", onClick: () => chain().addHostSection().run() },
      { label: "Milestone Form", onClick: () => chain().addHostForm("milestones").run() },
      { label: "Dynamic Values", onClick: () => setValuesOpen((v) => !v), checked: valuesOpen },
    ] },
  ].filter(Boolean).map((m) => ({ ...m, items: m.items.filter(Boolean) }));

  return (
    <div className={`${darkPaper ? "doc-dark " : ""}${fullScreen
      ? "doc-desk doc-fullscreen fixed inset-0 z-[2200] overflow-y-auto px-2 pb-16 sm:px-4"
      : embedded ? "doc-desk min-h-[calc(100dvh-61px)] px-2 pb-16 sm:px-4"
      : "doc-desk -mx-4 -mt-1 rounded-2xl px-2 pb-10 sm:mx-0 sm:px-4"}`}>
      <div className={`doc-chrome z-20 -mx-2 mb-6 space-y-px border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 print:hidden ${fullScreen ? "sticky top-0 sm:-mx-4" : embedded ? "sticky top-[61px] sm:-mx-4" : "sm:sticky sm:top-[var(--nav-h,56px)] sm:-mx-4 sm:rounded-t-2xl"}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1.5">
          <Link to={folderLink} title={`Back to ${isMember ? KIND_INFO[form.kind].label : "Documents"}`} aria-label="Back to the folder" className="grid size-8 place-items-center rounded-lg text-accent hover:bg-neutral-200/70 dark:hover:bg-neutral-700/60"><ChevronLeft className="size-5" /></Link>
          <MenuBar menus={menus} />
          <span aria-live="polite" className="min-w-0 flex-1 truncate text-xs text-slate-500 dark:text-neutral-400">{status}</span>
          {live && <LivePresence live={live} editor={editor} offline={offline} />}
          {doc && (
            <span className="relative">
              <ShareMenu group={group} doc={doc} canEdit={canEdit} bare open={shareOpen} onOpenChange={setShareOpen}
                onChanged={(d) => { setDoc(d); setForm((f) => ({ ...f, visibility: d.visibility })); }} />
            </span>
          )}
          {canEdit && <button type="button" onClick={save} disabled={saving || !canSave} title={live ? "Your edits save as you type. Saving a version marks this point in the history." : undefined} className={primaryButton}><Save className="size-4" /> {saving ? "Saving…" : saveLabel}</button>}
          <input ref={importRef} type="file" hidden accept={IMPORT_ACCEPT} onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) importFile(f); }} />
        </div>
        {canEdit && showPaper && <DocumentToolbar editor={editor} />}
        {canEdit && showPaper && valuesOpen && <DynamicValuesBar editor={editor} slug={slug} documentId={doc?.id} onClose={() => setValuesOpen(false)} />}
      </div>

      <div className="mx-auto max-w-[816px] space-y-3 print:max-w-none">
        <div className="space-y-3 print:hidden">
          <ErrorNote error={error} />
          {notice && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</p>}
        </div>

        {details && canEdit && (
          <section aria-label="Document details" className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200 sm:p-5 dark:bg-neutral-900 dark:ring-neutral-800 print:hidden">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="doc-kind" className={labelClass}>Folder</label>
                <select id="doc-kind" className={selectClass} value={form.kind} onChange={(e) => change("kind")(e.target.value)}>{KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
              </div>
              <div>
                <label htmlFor="doc-visibility" className={labelClass}>Who can see it</label>
                <select id="doc-visibility" className={selectClass} value={form.visibility} onChange={(e) => change("visibility")(e.target.value)}>{VISIBILITIES.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}</select>
              </div>
              <div>
                <label htmlFor="doc-status" className={labelClass}>Status</label>
                <select id="doc-status" className={selectClass} value={form.status} onChange={(e) => change("status")(e.target.value)}>{STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
              </div>
            </div>
            <p className="-mt-2 text-xs text-slate-500 dark:text-neutral-400">
              {VISIBILITIES.find((v) => v.key === form.visibility).note}.{form.status !== "current" && " Drafts and archived documents are only seen by record keepers."}
            </p>
            {adopters.length > 0 && (
              <div>
                <label htmlFor="doc-adopted" className={labelClass}>Adopted by</label>
                <FilterPick id="doc-adopted" value={form.approved_by_motion_id ?? ""} onChange={change("approved_by_motion_id")} placeholder="Type to find the decision" empty="No decision matches"
                  options={motionOptions(adopters, "Not recorded")} />
                <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">The group conscience decision that adopted it, shown under the title.</p>
              </div>
            )}
            <Toggle checked={form.pinned} onChange={change("pinned")} label="Pin it" description="Pinned documents lead their folder and the Documents block on the group's page." />
            <div>
              <span className={labelClass}>Attached file</span>
              <input ref={fileRef} type="file" hidden accept={FILE_ACCEPT} onChange={(e) => { setUpload(e.target.files[0] || null); setRemoveFile(false); setDirty(true); setSaved(false); e.target.value = ""; }} />
              <div className="flex flex-wrap items-center gap-2">
                {upload || file ? (
                  <span className="rounded-xl bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-800">{upload ? upload.name : file.name} <span className="text-xs text-slate-500">({sizeLabel(upload ? upload.size : file.size)})</span></span>
                ) : <span className="text-sm text-slate-500 dark:text-neutral-400">None. A PDF shows right on the page; Word, Excel and pictures download.</span>}
                <button type="button" onClick={() => fileRef.current?.click()} className={quietButton}><Paperclip className="size-4" /> {upload || file ? "Replace" : "Attach a file"}</button>
                {(upload || file) && <button type="button" onClick={() => { setUpload(null); setRemoveFile(!!doc?.file); setDirty(true); }} className={dangerButton}>Remove</button>}
              </div>
            </div>
            {!withText && <button type="button" onClick={() => setWithText(true)} className={quietButton}><FileUp className="size-4" /> Add text to this page</button>}
            {doc?.can_delete && <div className="border-t border-neutral-100 pt-3 dark:border-neutral-800"><button type="button" onClick={remove} className={dangerButton}><Trash2 className="size-4" /> Delete this document</button></div>}
          </section>
        )}

        {showPaper && (
          <article className="doc-paper" aria-label={form.title || "Untitled document"}>
            {letterhead && <Letterhead template={letterhead} groupTitle={group.title} />}
            {canEdit ? (
              <input ref={titleRef} className="doc-title" value={form.title} maxLength={160} onChange={(e) => change("title")(e.target.value)} placeholder="Untitled document" aria-label="Title" />
            ) : <h1 className="doc-title">{form.title}</h1>}
            <p className="doc-meta print:hidden">
              {form.pinned && <Pin className="size-3.5 text-amber-600" aria-label="Pinned" />}
              {form.visibility !== "members" && <Pill tone={form.visibility === "public" ? "green" : "amber"}>{VISIBILITY_LABELS[form.visibility]}</Pill>}
              {form.status !== "current" && <Pill>{form.status === "draft" ? "Draft" : "Archived"}</Pill>}
              {doc && <span>Updated {dateLabel(doc.updated_at)}{doc.updated_by ? ` by ${doc.updated_by}` : ""}</span>}
              {doc?.approved_by && <Link to={decisionsPath(slug, doc.approved_by.id)} className="text-accent hover:underline">Adopted{doc.approved_by.decided_on ? ` ${dateLabel(doc.approved_by.decided_on)}` : ""} by group conscience</Link>}
            </p>
            <EditorContent editor={editor} />
            {letterhead?.footer_text && <footer className="doc-letterhead-footer">{letterhead.footer_text}</footer>}
          </article>
        )}

        {!showPaper && (
          <div className="space-y-1 print:hidden">
            <h1 className="doc-desk-title">{form.title || doc?.title}</h1>
            <p className="doc-meta">
              {form.visibility !== "members" && <Pill tone={form.visibility === "public" ? "green" : "amber"}>{VISIBILITY_LABELS[form.visibility]}</Pill>}
              {doc && <span>Updated {dateLabel(doc.updated_at)}{doc.updated_by ? ` by ${doc.updated_by}` : ""}</span>}
              {doc?.approved_by && <Link to={decisionsPath(slug, doc.approved_by.id)} className="text-accent hover:underline">Adopted{doc.approved_by.decided_on ? ` ${dateLabel(doc.approved_by.decided_on)}` : ""} by group conscience</Link>}
            </p>
          </div>
        )}

        {file && doc && !upload && (
          <div className={pdfOnly ? "" : "print:hidden"}>
            {isPdf && <PdfViewer src={fileUrl(slug, doc.id)} name={file.name} downloadHref={fileUrl(slug, doc.id, "?download=1")} />}
            {file.inline && file.type.startsWith("image/") && <img src={fileUrl(slug, doc.id)} alt={doc.title} className="mx-auto max-h-[80vh] rounded-xl bg-white shadow-md" />}
            {!file.inline && (
              <a href={fileUrl(slug, doc.id, "?download=1")} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200 hover:ring-accent/40 dark:bg-neutral-900 dark:ring-neutral-800">
                <span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent"><Download className="size-5" /></span>
                <span className="min-w-0"><span className="block truncate font-medium text-slate-900 dark:text-white">{file.name}</span><span className="text-xs text-slate-500 dark:text-neutral-400">{sizeLabel(file.size)} · Download</span></span>
              </a>
            )}
          </div>
        )}

        {showHistory && isMember && doc && (
          <section aria-label="History" className="space-y-1.5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800 print:hidden">
            <h2 className="!text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">History</h2>
            {!history ? <Loading /> : history.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-neutral-400">Nobody has changed this document since it was first saved.</p>
            ) : (
              <>
                <p className="text-xs text-slate-500 dark:text-neutral-400">The copies this document had before each change, newest first.</p>
                {history.map((v) => (
                  <details key={v.id} className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950">
                    <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="font-medium text-slate-900 dark:text-white">{dateLabel(v.created_at)}</span>
                      <span className="text-slate-500 dark:text-neutral-400">{v.user ? `by ${v.user}` : ""}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-neutral-300">{v.title}</span>
                    </summary>
                    <div className="mt-3 space-y-3">
                      {!v.body.trim() ? <p className="text-sm italic text-slate-500">No text.</p>
                        : v.body_format === "markdown" ? <Markdown source={v.body} className="ev-md text-sm text-slate-800 dark:text-neutral-200" />
                        : <div className="doc-prose doc-prose--small" dangerouslySetInnerHTML={{ __html: v.body }} />}
                      {v.file && <a href={fileUrl(slug, doc.id, `?version_id=${v.id}&download=1`)} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"><Download className="size-4" /> {v.file.name} ({sizeLabel(v.file.size)})</a>}
                      {canEdit && <div><button type="button" onClick={() => restore(v)} className={quietButton}><RotateCcw className="size-4" /> Put this copy back</button></div>}
                    </div>
                  </details>
                ))}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
