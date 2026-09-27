import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, EyeOff, MessageSquareText, RotateCcw, Tag as TagIcon, Trash2, X } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import SegmentedControl from "../ui/SegmentedControl";
import { inputClass, labelClass } from "../ui/styles";
import { api, topicTitle } from "./api";
import { buttonClass, selectClass } from "./App";
import { CategoryTile } from "./CategoriesPage";

const BLANK = { title: "", subtitle: "", searchable_number: "", link: "", topic_category_id: "", difficulty: "", tag_ids: [], prompts: [] };

const DIFFICULTY_STYLES = {
  gentle: "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  standard: "bg-neutral-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300",
  deep: "bg-violet-50 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
};

export function DifficultyBadge({ difficulty }) {
  if (!difficulty) return null;
  return <span className={`rounded-full px-2 py-0.5 text-xs ${DIFFICULTY_STYLES[difficulty]}`}>{difficulty}</span>;
}

// One topic: its Topicificator fields, then ACID QUEST curation - difficulty, tags, and how
// each way of sharing reads for this topic (custom wording, or switched off).
export default function TopicEditor({ topicId, meta, defaults, onClose, onSaved, onDeleted, notify }) {
  const isNew = topicId === "new";
  const [topic, setTopic] = useState(isNew ? { ...BLANK, topic_set_id: defaults.topic_set_id } : null);
  const [form, setForm] = useState(topic);
  const [newTags, setNewTags] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    api(`/topics/${topicId}`).then((t) => { setTopic(t); setForm(t); setNewTags([]); }).catch((e) => notify(e.message, "error"));
  }, [topicId]);

  const dirty = useMemo(() => form && topic && (JSON.stringify(fields(form)) !== JSON.stringify(fields(topic)) || newTags.length > 0), [form, topic, newTags]);

  if (!form) return <Shell><ShellPanel className="p-6 text-sm text-slate-500 !font-sans">Loading…</ShellPanel></Shell>;

  const set = (key) => (e) => setForm({ ...form, [key]: e?.target ? e.target.value : e });

  async function save() {
    setSaving(true);
    try {
      const body = { topic: { ...fields(form), new_tags: newTags } };
      const saved = isNew ? await api("/topics", { method: "POST", body }) : await api(`/topics/${topicId}`, { method: "PATCH", body });
      setTopic(saved); setForm(saved); setNewTags([]);
      notify(isNew ? "Topic created." : "Topic saved.");
      onSaved(saved, isNew);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function destroy() {
    if (!window.confirm(`Delete “${topicTitle(topic)}”? This can't be undone.`)) return;
    try {
      await api(`/topics/${topicId}`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      notify(e.message, "error");
    }
  }

  return (
    <div className="space-y-6">
      <Shell>
        <ShellBand
          icon={MessageSquareText}
          title={isNew ? "New topic" : topicTitle(topic)}
          subtitle={isNew ? "Add a topic to the Topicificator" : `#${topic.searchable_number || "–"} · ${meta.topic_sets.find((s) => s.id === topic.topic_set_id)?.name || ""}`}
        />
        <ShellPanel position="middle" className="p-4 grid gap-4 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2">
            <input className={inputClass} value={form.title || ""} onChange={set("title")} required />
          </Field>
          <Field label="Subtitle" className="sm:col-span-2">
            <input className={inputClass} value={form.subtitle || ""} onChange={set("subtitle")} />
          </Field>
          <Field label="Number">
            <input className={inputClass} value={form.searchable_number || ""} onChange={set("searchable_number")} />
          </Field>
          <Field label="Link">
            <input className={inputClass} value={form.link || ""} onChange={set("link")} placeholder="https://…" />
          </Field>
          <Field label="Topic set">
            <select className={selectClass} value={form.topic_set_id || ""} onChange={set("topic_set_id")}>
              {meta.topic_sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <span className="flex items-center gap-2">
              <CategoryTile iconName={meta.categories.find((c) => c.id === Number(form.topic_category_id))?.icon_name || (form.topic_category_id ? null : "signpost")} />
              <select className={selectClass} value={form.topic_category_id || ""} onChange={set("topic_category_id")}>
                <option value="">Open Road (no category)</option>
                {meta.categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </span>
          </Field>
        </ShellPanel>
        <ShellPanel position="middle">
          <p className={`${labelClass} px-4 pt-3 !font-sans`}>Difficulty in ACID QUEST</p>
          <SegmentedControl
            value={form.difficulty || ""}
            onChange={set("difficulty")}
            options={[{ value: "", label: "Not set" }, ...meta.difficulties.map((d) => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }))]}
          />
          <p className="px-4 pb-3 text-xs text-slate-500 dark:text-neutral-400 !font-sans">
            Risky choices and ghosts lean towards deep topics; campfires towards gentle ones. Not set counts as standard.
          </p>
        </ShellPanel>
        <ShellPanel position="middle" className="p-4">
          <TagPicker tags={meta.tags} value={form.tag_ids || []} onChange={set("tag_ids")} newTags={newTags} onNewTags={setNewTags} />
        </ShellPanel>
        <ShellPanel position="bottom" className="p-3 flex flex-wrap items-center gap-2">
          <button type="button" className={buttonClass.secondary} onClick={onClose}>
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          {!isNew && (
            <button type="button" className={buttonClass.danger} onClick={destroy} disabled={topic.in_journeys}
              title={topic.in_journeys ? "Part of an ACID QUEST journey log" : undefined}>
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
          <span className="flex-1" />
          {dirty && <span className="text-xs text-slate-500 !font-sans">Unsaved changes</span>}
          <button type="button" className={buttonClass.primary} onClick={save} disabled={saving || !form.title?.trim() || (!isNew && !dirty)}>
            <Check className="w-4 h-4" strokeWidth={2.5} /> {isNew ? "Create topic" : "Save"}
          </button>
        </ShellPanel>
      </Shell>

      {!isNew && <WaysToShare topic={topic} modes={meta.sharing_modes} onChange={(t) => { setTopic(t); setForm({ ...form, prompts: t.prompts }); onSaved(t, false); }} notify={notify} />}
    </div>
  );
}

// The fields a save sends
function fields(t) {
  return {
    title: t.title || "", subtitle: t.subtitle || "", searchable_number: t.searchable_number || "", link: t.link || "",
    topic_set_id: t.topic_set_id ? Number(t.topic_set_id) : null,
    topic_category_id: t.topic_category_id ? Number(t.topic_category_id) : null,
    difficulty: t.difficulty || "", tag_ids: [...(t.tag_ids || [])].sort((a, b) => a - b),
  };
}

function Field({ label, className = "", children }) {
  return (
    <label className={`block ${className}`}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

// Tags come from the shared vocabulary (the same tags as Readings); typing a new one adds it
function TagPicker({ tags, value, onChange, newTags, onNewTags }) {
  const [text, setText] = useState("");
  const byId = Object.fromEntries(tags.map((t) => [t.id, t]));
  const add = () => {
    const title = text.trim();
    if (!title) return;
    const existing = tags.find((t) => t.title.toLowerCase() === title.toLowerCase());
    if (existing) { if (!value.includes(existing.id)) onChange([...value, existing.id]); }
    else if (!newTags.some((t) => t.toLowerCase() === title.toLowerCase())) onNewTags([...newTags, title]);
    setText("");
  };
  const chip = (label, onRemove, fresh) => (
    <span key={label} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${fresh ? "bg-accent text-white" : "bg-accent-tint text-accent-ink dark:bg-accent/35 dark:text-white"}`}>
      {label}{fresh && " (new)"}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="!bg-transparent opacity-70 hover:opacity-100"><X className="w-3 h-3" /></button>
    </span>
  );
  return (
    <div>
      <span className={labelClass}>Tags</span>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.length === 0 && newTags.length === 0 && <span className="text-xs text-slate-400 !font-sans">No tags yet</span>}
        {value.map((id) => byId[id] && chip(byId[id].title, () => onChange(value.filter((v) => v !== id))))}
        {newTags.map((t) => chip(t, () => onNewTags(newTags.filter((n) => n !== t)), true))}
      </div>
      <div className="relative">
        <TagIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          className={`${inputClass} pl-9`}
          list="topic-tag-options"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          onBlur={add}
          placeholder="Add a tag and press Enter"
          aria-label="Add a tag"
        />
        <datalist id="topic-tag-options">
          {tags.filter((t) => !value.includes(t.id)).map((t) => <option key={t.id} value={t.title} />)}
        </datalist>
      </div>
    </div>
  );
}

// ---------- ways to share ----------

// Each sharing mode for this topic: the generic prompt, or approved custom wording, or off.
// Only approved rows reach the game; drafts (e.g. AI suggestions later) wait here.
function WaysToShare({ topic, modes, onChange, notify }) {
  const byKey = Object.fromEntries(topic.prompts.map((p) => [p.mode_key, p]));
  const drafts = topic.prompts.filter((p) => p.status === "draft").length;
  return (
    <Shell>
      <ShellBand icon={MessageSquareText} title="Ways to share" subtitle={
        drafts ? `${drafts} draft${drafts === 1 ? "" : "s"} waiting for review` : "How ACID QUEST offers this topic. Only approved wording is used."
      } />
      {modes.map((mode, i) => (
        <ShellPanel key={mode.key} position={i === modes.length - 1 ? "bottom" : "middle"}>
          <PromptRow topic={topic} mode={mode} prompt={byKey[mode.key]} onChange={onChange} notify={notify} />
        </ShellPanel>
      ))}
    </Shell>
  );
}

function PromptRow({ topic, mode, prompt, onChange, notify }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(prompt?.text || "");
  const [busy, setBusy] = useState(false);
  useEffect(() => setText(prompt?.text || ""), [prompt?.text]);

  const state =
    !prompt ? { label: "Generic", cls: "bg-neutral-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300" } :
    prompt.status === "rejected" ? { label: "Rejected", cls: "bg-neutral-100 text-slate-500 line-through dark:bg-neutral-800" } :
    !prompt.enabled && prompt.status === "approved" ? { label: "Off", cls: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-200" } :
    prompt.status === "approved" ? { label: "Custom", cls: "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200" } :
    { label: prompt.source === "ai" ? "AI draft" : "Draft", cls: "bg-amber-50 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200" };

  async function call(method, body) {
    setBusy(true);
    try {
      onChange(await api(`/topics/${topic.id}/prompts/${mode.key}`, { method, body }));
      setOpen(false);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  const saveAs = (status) => call("PUT", { prompt: { text, status, enabled: true } });
  const switchOff = () => call("PUT", { prompt: { text: text || null, status: "approved", enabled: false } });
  const reset = () => call("DELETE");

  const shown = prompt?.enabled !== false && prompt?.text ? prompt.text : mode.prompt;

  return (
    <div className="px-4 py-3">
      <button type="button" className="w-full flex items-start gap-3 text-left !bg-transparent" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-white !font-sans">{mode.name}</span>
            {mode.gentle && <span className="text-xs text-emerald-700 dark:text-emerald-300 !font-sans">gentle</span>}
          </span>
          <span className={`block text-sm mt-0.5 !font-sans ${prompt?.enabled === false ? "text-slate-400 line-through" : "text-slate-600 dark:text-neutral-400"}`}>
            {shown}
          </span>
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${state.cls}`}>{state.label}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <textarea
            className={`${inputClass} min-h-[72px]`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={mode.prompt}
            aria-label={`Wording for ${mode.name}`}
          />
          <p className="text-xs text-slate-500 dark:text-neutral-400 !font-sans">
            Write it for the room, about this topic. Leave it empty to keep the generic prompt.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass.primary} disabled={busy || !text.trim()} onClick={() => saveAs("approved")}>
              <Check className="w-4 h-4" strokeWidth={2.5} /> Approve
            </button>
            <button type="button" className={buttonClass.secondary} disabled={busy || !text.trim()} onClick={() => saveAs("draft")}>Save draft</button>
            {prompt?.status === "draft" && (
              <button type="button" className={buttonClass.secondary} disabled={busy} onClick={() => call("PUT", { prompt: { status: "rejected" } })}>Reject</button>
            )}
            <button type="button" className={buttonClass.secondary} disabled={busy || (prompt && !prompt.enabled)} onClick={switchOff}
              title="Don't offer this way of sharing for this topic">
              <EyeOff className="w-4 h-4" /> Off for this topic
            </button>
            {prompt && (
              <button type="button" className={buttonClass.danger} disabled={busy} onClick={reset}>
                <RotateCcw className="w-4 h-4" /> Back to generic
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
