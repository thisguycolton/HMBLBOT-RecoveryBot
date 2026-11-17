import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, EyeOff, FileUp, Plus, RotateCcw, Save, ScrollText, Trash2 } from "lucide-react";
import { api } from "../topicificator_admin/api";
import { buttonClass } from "../topicificator_admin/App";
import { inputClass, labelClass } from "../ui/styles";
import Toggle from "../ui/Toggle";
import { SkeletonList, SkeletonText } from "../ui/Skeleton";
import MenuBar from "../groups/conscience/MenuBar";
import DocumentToolbar from "../groups/conscience/DocumentToolbar";
import { documentExtensions } from "../groups/conscience/editorKit";
import { DynamicValuesBar } from "../groups/conscience/hostSection";
import { offeredValues } from "../groups/hosting/lib";
import { IMPORT_ACCEPT, importDocument } from "../../lib/documentImport";
import { Card } from "./App";

// The service roles every kit starts with (HostingKit::DEFAULT_SERVICE_ROLES), so the template's
// writers can put in {{ service_hiw }} and the rest
const ROLES = [
  { key: "host", label: "Host" }, { key: "co_host", label: "Co-host" }, { key: "hiw", label: "How It Works" },
  { key: "traditions", label: "The 12 Traditions" }, { key: "timer", label: "Timer" }, { key: "closing", label: "Closing reading" },
];
const when = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");

// Site Admin > HostDeck scripts: the meeting scripts host coordinators can start from in Set up
// HostDeck (HostScriptTemplate). The list, and a script's editor (/host_scripts/:id), the same
// document editor groups write their formats in, with sections, the milestones form and dynamic values.
export default function HostScriptsPage({ notify }) {
  const { id } = useParams();
  return id ? <ScriptEditor key={id} id={id} notify={notify} /> : <ScriptList notify={notify} />;
}

function ScriptList({ notify }) {
  const [templates, setTemplates] = useState(null);
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const load = () => api("/host_script_templates").then((d) => setTemplates(d.templates)).catch((e) => notify(e.message, "error"));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async (body) => {
    try { navigate(`/host_scripts/${(await api("/host_script_templates", { method: "POST", body })).template.id}`); } catch (e) { notify(e.message, "error"); }
  };
  const move = async (i, by) => {
    const a = templates[i];
    const b = templates[i + by];
    if (!b) return;
    try {
      await api(`/host_script_templates/${a.id}`, { method: "PATCH", body: { template: { position: b.position } } });
      await api(`/host_script_templates/${b.id}`, { method: "PATCH", body: { template: { position: a.position === b.position ? a.position + by : a.position } } });
      load();
    } catch (e) { notify(e.message, "error"); }
  };

  return (
    <>
      <Card title="New script" subtitle="Start a blank script, or copy one below and change it. A new script stays hidden from groups until you turn on Offer to groups.">
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); create({ template: { name: name.trim() || "Untitled script", body: "" } }); }}>
          <label className="min-w-[12rem] flex-1">
            <span className={labelClass}>Name</span>
            <input className={inputClass} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Speaker meeting format" />
          </label>
          <button type="submit" className={buttonClass.primary}><Plus className="size-4" /> New script</button>
        </form>
      </Card>

      <Card title="HostDeck scripts" subtitle="What host coordinators can start from in Set up HostDeck > Script > Start from a template. The group gets its own copy in its documents, so changing a script here only reaches groups that copy it from now on.">
        {!templates ? <SkeletonList rows={3} /> : templates.length === 0 ? <p className="text-sm text-slate-500 !font-sans">No scripts yet.</p> : (
          <ul className="divide-y divide-slate-200 dark:divide-neutral-800">
            {templates.map((t, i) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1">
                <Link to={`/host_scripts/${t.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-neutral-800/60">
                  <ScrollText className="size-4 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-900 !font-sans dark:text-white">{t.name}</span>
                    <span className="block truncate text-xs text-slate-500 !font-sans dark:text-neutral-400">{t.description || `${t.sections.length} sections`}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 !font-sans dark:text-neutral-400">
                    {t.built_in && <span className="rounded-full bg-accent/10 px-2 py-0.5 font-semibold text-accent dark:bg-accent/25 dark:text-white">Built in</span>}
                    {t.hidden && <span className="inline-flex items-center gap-1 rounded-full bg-neutral-200 px-2 py-0.5 font-semibold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200"><EyeOff className="size-3" /> Hidden</span>}
                    <span>{t.sections.length} sections</span>
                    <span>· {when(t.updated_at)}</span>
                  </span>
                </Link>
                <span className="flex items-center gap-1">
                  <button type="button" className={`${buttonClass.bare} grid size-8 place-items-center rounded-lg text-slate-500 hover:!bg-slate-100 disabled:opacity-30 dark:hover:!bg-neutral-800`} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${t.name} up`}><ArrowUp className="size-4" /></button>
                  <button type="button" className={`${buttonClass.bare} grid size-8 place-items-center rounded-lg text-slate-500 hover:!bg-slate-100 disabled:opacity-30 dark:hover:!bg-neutral-800`} disabled={i === templates.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${t.name} down`}><ArrowDown className="size-4" /></button>
                  <button type="button" className={`${buttonClass.bare} grid size-8 place-items-center rounded-lg text-slate-500 hover:!bg-slate-100 dark:hover:!bg-neutral-800`} onClick={() => create({ copy_of: t.id })} title="Make a copy" aria-label={`Copy ${t.name}`}><Copy className="size-4" /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function ScriptEditor({ id, notify }) {
  const navigate = useNavigate();
  const [template, setTemplate] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", hidden: false });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [valuesOpen, setValuesOpen] = useState(true);
  const importRef = useRef(null);
  const offered = useMemo(() => offeredValues(null, ROLES), []);

  const editor = useEditor({
    extensions: documentExtensions("Write the script. Insert > Add Section starts each step the hosts go through."),
    content: "",
    onUpdate: () => setDirty(true),
    editorProps: { attributes: { class: "doc-prose", "aria-label": "Script text" } },
  });

  const take = (t, setBody = true) => {
    setTemplate(t);
    setForm({ name: t.name, description: t.description || "", hidden: t.hidden });
    if (setBody && editor) editor.commands.setContent(t.body || "", false);
    setDirty(false);
  };
  useEffect(() => {
    if (!editor) return;
    api(`/host_script_templates/${id}`).then((d) => take(d.template)).catch((e) => notify(e.message, "error"));
  }, [id, editor]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = (key) => (value) => { setForm((f) => ({ ...f, [key]: value })); setDirty(true); };
  const save = async () => {
    setSaving(true);
    try {
      const body = editor.isEmpty ? "" : editor.getHTML();
      take((await api(`/host_script_templates/${id}`, { method: "PATCH", body: { template: { ...form, body } } })).template, false);
      notify("Saved.");
    } catch (e) { notify(e.message, "error"); } finally { setSaving(false); }
  };
  const reset = async () => {
    if (!window.confirm("Put the built-in script back as it came? Your changes to its text are lost.")) return;
    try { take((await api(`/host_script_templates/${id}/reset`, { method: "POST" })).template); notify("Put back as it came."); } catch (e) { notify(e.message, "error"); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete “${template.name}”? Groups that already copied it keep their copies.`)) return;
    try { await api(`/host_script_templates/${id}`, { method: "DELETE" }); navigate("/host_scripts"); } catch (e) { notify(e.message, "error"); }
  };
  const copy = async () => {
    try { navigate(`/host_scripts/${(await api("/host_script_templates", { method: "POST", body: { copy_of: id } })).template.id}`); } catch (e) { notify(e.message, "error"); }
  };
  const importFile = async (file) => {
    try {
      const result = await importDocument(file);
      if (!editor.isEmpty && !window.confirm("Replace the script's text with this file?")) return;
      editor.commands.setContent(result.html || "", true);
      if (!form.name || form.name === "Untitled script") change("name")(result.title);
    } catch (e) { notify(e.message, "error"); }
  };

  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); if (dirty && !saving) save(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const chain = () => editor.chain().focus();
  const menus = editor ? [
    { label: "File", items: [
      { label: "Save", shortcut: "⌘S", onClick: save, disabled: saving || !dirty },
      { label: "Import Word, RTF, Markdown or JSON…", onClick: () => importRef.current?.click() },
      { label: "Make a copy", onClick: copy },
      template?.built_in && { label: "Put back the built-in script…", onClick: reset },
      !template?.built_in && "divider",
      !template?.built_in && { label: "Delete script…", onClick: remove },
    ].filter(Boolean) },
    { label: "Edit", items: [
      { label: "Undo", shortcut: "⌘Z", onClick: () => chain().undo().run(), disabled: !editor.can().undo() },
      { label: "Redo", shortcut: "⇧⌘Z", onClick: () => chain().redo().run(), disabled: !editor.can().redo() },
    ] },
    { label: "Insert", items: [
      { label: "Table", onClick: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
      { label: "Divider line", onClick: () => chain().setHorizontalRule().run() },
      { label: "Collapsible text", onClick: () => chain().setCollapsible().run() },
      "divider",
      { label: "Add Section", onClick: () => chain().addHostSection().run() },
      { label: "Milestone Form", onClick: () => chain().addHostForm("milestones").run() },
      { label: "Dynamic Values", onClick: () => setValuesOpen((v) => !v), checked: valuesOpen },
    ] },
  ] : [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/host_scripts" className="inline-flex items-center gap-1.5 text-sm font-medium !text-accent hover:underline"><ArrowLeft className="size-4" /> All scripts</Link>
        <span className="flex-1" />
        {template?.built_in && <button type="button" className={buttonClass.secondary} onClick={reset}><RotateCcw className="size-4" /> Put back as it came</button>}
        {template && !template.built_in && <button type="button" className={buttonClass.danger} onClick={remove}><Trash2 className="size-4" /> Delete</button>}
        <button type="button" className={buttonClass.primary} disabled={!template || saving || !dirty} onClick={save}><Save className="size-4" /> {saving ? "Saving…" : dirty ? "Save" : "Saved"}</button>
      </div>

      <Card title="About this script">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Name</span>
            <input className={inputClass} maxLength={120} value={form.name} onChange={(e) => change("name")(e.target.value)} />
          </label>
          <label>
            <span className={labelClass}>What it's for</span>
            <input className={inputClass} maxLength={300} value={form.description} onChange={(e) => change("description")(e.target.value)} placeholder="Shown to host coordinators when they pick one" />
          </label>
        </div>
        <div className="mt-4">
          <Toggle checked={!form.hidden} onChange={(on) => change("hidden")(!on)} label="Offer to groups"
            description="Host coordinators see it under Set up HostDeck > Script > Start from a template. Groups that already copied it keep their copy either way." />
        </div>
        {template?.sections?.length > 0 && (
          <ol className="mt-4 flex flex-wrap gap-1.5 text-xs !font-sans" aria-label="Sections, as last saved">
            {template.sections.map((s, i) => <li key={i} className="rounded-full bg-neutral-200 px-2 py-0.5 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300">{i + 1}. {s}</li>)}
          </ol>
        )}
      </Card>

      <div className="doc-desk overflow-hidden rounded-2xl pb-8">
        <div className="doc-chrome sticky top-0 z-20 mb-6 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <MenuBar menus={menus} />
            <span className="flex-1" />
            <button type="button" className={`${buttonClass.bare} inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:!bg-neutral-200/70 dark:text-neutral-300 dark:hover:!bg-neutral-700/60`} onClick={() => importRef.current?.click()}>
              <FileUp className="size-4" /> Import
            </button>
            <input ref={importRef} type="file" hidden accept={IMPORT_ACCEPT} onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) importFile(f); }} />
          </div>
          {editor && <DocumentToolbar editor={editor} />}
          {editor && valuesOpen && <DynamicValuesBar editor={editor} offered={offered} onClose={() => setValuesOpen(false)} />}
        </div>
        <article className="doc-paper mx-auto max-w-[816px]" aria-label={form.name || "Script"}>
          {!template && <SkeletonText lines={8} />}
          <EditorContent editor={editor} />
        </article>
      </div>
    </>
  );
}
