import React, { useEffect, useState } from "react";
import { Check, HelpCircle, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { inputClass, labelClass } from "../ui/styles";
import { api } from "../topicificator_admin/api";
import { buttonClass } from "../topicificator_admin/App";
import { TAG_ICONS } from "../ReadingArchiveUtils";

// Reading tags and their icons. The picker only offers icons the reading cards can draw
// (TAG_ICONS); anything else would show as a "?" there.
export default function TagsPage({ notify }) {
  const [tags, setTags] = useState(null);
  const [editing, setEditing] = useState(null); // tag id, or "new"

  async function load() {
    try {
      setTags(await api("/tags"));
    } catch (e) {
      notify(e.message, "error");
    }
  }
  useEffect(() => { load(); }, []);

  async function save(id, values) {
    try {
      if (id === "new") await api("/tags", { method: "POST", body: { tag: values } });
      else await api(`/tags/${id}`, { method: "PATCH", body: { tag: values } });
      setEditing(null);
      notify(id === "new" ? "Tag created." : "Tag saved.");
      await load();
    } catch (e) {
      notify(e.message, "error");
    }
  }

  async function destroy(tag) {
    const used = tag.readings_count ? ` It will be removed from ${tag.readings_count} ${tag.readings_count === 1 ? "reading" : "readings"}; the readings stay.` : "";
    if (!window.confirm(`Delete the tag “${tag.title}”?${used}`)) return;
    try {
      await api(`/tags/${tag.id}`, { method: "DELETE" });
      notify("Tag deleted.");
      await load();
    } catch (e) {
      notify(e.message, "error");
    }
  }

  if (!tags) return <p className="py-16 text-center text-slate-500 dark:text-neutral-400 !font-sans">Loading…</p>;

  return (
    <Shell className="max-w-3xl">
      <ShellBand icon={Tags} title="Tags" subtitle={`${tags.length} tags`} />
      {tags.map((tag) => (
        <ShellPanel key={tag.id} position="middle" className="p-4">
          {editing === tag.id ? (
            <TagForm tag={tag} onSave={(v) => save(tag.id, v)} onCancel={() => setEditing(null)} />
          ) : (
            <div className="flex items-center gap-3">
              <TagIcon name={tag.icon_name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white !font-sans">{tag.title}</p>
                <p className="text-sm text-slate-600 dark:text-neutral-400 !font-sans">
                  {tag.readings_count} {tag.readings_count === 1 ? "reading" : "readings"}
                  {!TAG_ICONS[tag.icon_name] && " · no icon yet"}
                </p>
              </div>
              <button type="button" className={buttonClass.secondary} onClick={() => setEditing(tag.id)} aria-label={`Edit ${tag.title}`}>
                <Pencil className="w-4 h-4" />
              </button>
              <button type="button" className={buttonClass.danger} onClick={() => destroy(tag)} aria-label={`Delete ${tag.title}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </ShellPanel>
      ))}
      <ShellPanel position="bottom" className="p-4">
        {editing === "new" ? (
          <TagForm tag={{ title: "", icon_name: null }} onSave={(v) => save("new", v)} onCancel={() => setEditing(null)} />
        ) : (
          <button type="button" className={buttonClass.primary} onClick={() => setEditing("new")}>
            <Plus className="w-4 h-4" strokeWidth={2.5} /> New tag
          </button>
        )}
      </ShellPanel>
    </Shell>
  );
}

function TagIcon({ name }) {
  const Icon = TAG_ICONS[name] || HelpCircle;
  return (
    <div className="w-10 h-10 rounded-xl bg-accent-tint dark:bg-accent/30 flex items-center justify-center shrink-0">
      <Icon className="w-5 h-5 text-accent dark:text-white" strokeWidth={2.5} />
    </div>
  );
}

function TagForm({ tag, onSave, onCancel }) {
  const [title, setTitle] = useState(tag.title || "");
  const [icon, setIcon] = useState(tag.icon_name || null);
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); onSave({ title, icon_name: icon }); }}>
      <label className="block">
        <span className={labelClass}>Name</span>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
      </label>
      <div>
        <span className={labelClass}>Icon</span>
        <div className="flex flex-wrap gap-1">
          {Object.entries(TAG_ICONS).map(([name, Icon]) => (
            <button
              key={name}
              type="button"
              title={name}
              aria-label={name}
              aria-pressed={icon === name}
              onClick={() => setIcon(name)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                icon === name ? "!bg-accent !text-white shadow-panel" : "!bg-transparent text-slate-700 dark:text-neutral-300 hover:!bg-accent/10 dark:hover:!bg-white/10"
              }`}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={buttonClass.primary} disabled={!title.trim()}><Check className="w-4 h-4" strokeWidth={2.5} /> Save</button>
        <button type="button" className={buttonClass.secondary} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
