import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { inputClass, labelClass } from "../ui/styles";
import { api } from "./api";
import { buttonClass } from "./App";

// Topic sets: the Topicificator's collections (Original, Newcomers...). A set used by an
// ACID QUEST journey can't be deleted; the server says so.
export default function SetsPage({ meta, reloadMeta, notify }) {
  const [editing, setEditing] = useState(null); // set id, or "new"

  async function save(id, values) {
    try {
      if (id === "new") await api("/topic_sets", { method: "POST", body: { topic_set: values } });
      else await api(`/topic_sets/${id}`, { method: "PATCH", body: { topic_set: values } });
      setEditing(null);
      await reloadMeta();
      notify(id === "new" ? "Topic set created." : "Topic set saved.");
    } catch (e) {
      notify(e.message, "error");
    }
  }

  async function destroy(set) {
    const warning = set.topics ? ` Its ${set.topics} topics will be deleted too.` : "";
    if (!window.confirm(`Delete the set “${set.name}”?${warning} This can't be undone.`)) return;
    try {
      await api(`/topic_sets/${set.id}`, { method: "DELETE" });
      await reloadMeta();
      notify("Topic set deleted.");
    } catch (e) {
      notify(e.message, "error");
    }
  }

  return (
    <Shell className="max-w-3xl">
      <ShellBand icon={Layers} title="Topic sets" subtitle={`${meta.topic_sets.length} sets`} />
      {meta.topic_sets.map((set) => (
        <ShellPanel key={set.id} position="middle" className="p-4">
          {editing === set.id ? (
            <SetForm set={set} onSave={(v) => save(set.id, v)} onCancel={() => setEditing(null)} />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white !font-sans">{set.name}</p>
                {set.description && <p className="text-sm text-slate-600 dark:text-neutral-400 !font-sans">{set.description}</p>}
              </div>
              <Link to={`/?topic_set_id=${set.id}`} className="text-sm text-accent hover:underline !font-sans">{set.topics} topics</Link>
              <button type="button" className={buttonClass.secondary} onClick={() => setEditing(set.id)} aria-label={`Edit ${set.name}`}>
                <Pencil className="w-4 h-4" />
              </button>
              <button type="button" className={buttonClass.danger} onClick={() => destroy(set)} aria-label={`Delete ${set.name}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </ShellPanel>
      ))}
      <ShellPanel position="bottom" className="p-4">
        {editing === "new" ? (
          <SetForm set={{ name: "", description: "" }} onSave={(v) => save("new", v)} onCancel={() => setEditing(null)} />
        ) : (
          <button type="button" className={buttonClass.primary} onClick={() => setEditing("new")}>
            <Plus className="w-4 h-4" strokeWidth={2.5} /> New topic set
          </button>
        )}
      </ShellPanel>
    </Shell>
  );
}

function SetForm({ set, onSave, onCancel }) {
  const [name, setName] = useState(set.name || "");
  const [description, setDescription] = useState(set.description || "");
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); onSave({ name, description }); }}>
      <label className="block">
        <span className={labelClass}>Name</span>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
      </label>
      <label className="block">
        <span className={labelClass}>Description</span>
        <textarea className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </label>
      <div className="flex gap-2">
        <button type="submit" className={buttonClass.primary} disabled={!name.trim()}><Check className="w-4 h-4" strokeWidth={2.5} /> Save</button>
        <button type="button" className={buttonClass.secondary} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
