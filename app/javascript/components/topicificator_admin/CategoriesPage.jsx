import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Folder, FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { inputClass, labelClass } from "../ui/styles";
import LucideIcon from "../ui/LucideIcon";
import IconPicker from "../ui/IconPicker";
import { api } from "./api";
import { buttonClass } from "./App";

// Topic categories. Deleting one moves its topics to the Open Road (no category).
export default function CategoriesPage({ meta, reloadMeta, notify }) {
  const [editing, setEditing] = useState(null); // category id, or "new"

  async function save(id, values) {
    try {
      if (id === "new") await api("/topic_categories", { method: "POST", body: { topic_category: values } });
      else await api(`/topic_categories/${id}`, { method: "PATCH", body: { topic_category: values } });
      setEditing(null);
      await reloadMeta();
      notify(id === "new" ? "Category created." : "Category saved.");
    } catch (e) {
      notify(e.message, "error");
    }
  }

  async function destroy(cat) {
    const note = cat.topics ? ` Its ${cat.topics} topics will move to the Open Road.` : "";
    if (!window.confirm(`Delete the category “${cat.title}”?${note}`)) return;
    try {
      await api(`/topic_categories/${cat.id}`, { method: "DELETE" });
      await reloadMeta();
      notify("Category deleted.");
    } catch (e) {
      notify(e.message, "error");
    }
  }

  return (
    <Shell className="max-w-3xl">
      <ShellBand icon={FolderTree} title="Categories" subtitle={`${meta.categories.length} categories · ${meta.uncategorized} topics on the Open Road`} />
      {meta.categories.map((cat) => (
        <ShellPanel key={cat.id} position="middle" className="p-4">
          {editing === cat.id ? (
            <CategoryForm category={cat} onSave={(v) => save(cat.id, v)} onCancel={() => setEditing(null)} />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <CategoryTile iconName={cat.icon_name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white !font-sans">{cat.title}</p>
                {cat.cat && <p className="text-xs text-slate-500 dark:text-neutral-400 tabular-nums !font-sans">{cat.cat}</p>}
              </div>
              <Link to={`/?category_id=${cat.id}`} className="text-sm text-accent hover:underline !font-sans">{cat.topics} topics</Link>
              <button type="button" className={buttonClass.secondary} onClick={() => setEditing(cat.id)} aria-label={`Edit ${cat.title}`}>
                <Pencil className="w-4 h-4" />
              </button>
              <button type="button" className={buttonClass.danger} onClick={() => destroy(cat)} aria-label={`Delete ${cat.title}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </ShellPanel>
      ))}
      <ShellPanel position="bottom" className="p-4">
        {editing === "new" ? (
          <CategoryForm category={{ title: "", cat: "", icon_name: null }} onSave={(v) => save("new", v)} onCancel={() => setEditing(null)} />
        ) : (
          <button type="button" className={buttonClass.primary} onClick={() => setEditing("new")}>
            <Plus className="w-4 h-4" strokeWidth={2.5} /> New category
          </button>
        )}
      </ShellPanel>
    </Shell>
  );
}

export function CategoryTile({ iconName, size = "md" }) {
  const box = size === "sm" ? "w-6 h-6 rounded-lg" : "w-9 h-9 rounded-xl";
  return (
    <span className={`${box} bg-accent-tint dark:bg-accent/30 flex items-center justify-center shrink-0`} title={iconName || "No icon"}>
      <LucideIcon name={iconName} fallback={Folder} size={size === "sm" ? 14 : 18} className="text-accent dark:text-white" />
    </span>
  );
}

function CategoryForm({ category, onSave, onCancel }) {
  const [title, setTitle] = useState(category.title || "");
  const [code, setCode] = useState(category.cat || "");
  const [iconName, setIconName] = useState(category.icon_name || null);
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); onSave({ title, cat: code, icon_name: iconName }); }}>
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_10rem] items-end">
        <CategoryTile iconName={iconName} />
        <label className="block">
          <span className={labelClass}>Title</span>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
        </label>
        <label className="block">
          <span className={labelClass}>Code</span>
          <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} placeholder="CAT_001" />
        </label>
      </div>
      <div>
        <span className={labelClass}>Icon</span>
        <IconPicker value={iconName} onChange={setIconName} label={`Icon for ${title || "this category"}`} />
      </div>
      <div className="flex gap-2">
        <button type="submit" className={buttonClass.primary} disabled={!title.trim()}><Check className="w-4 h-4" strokeWidth={2.5} /> Save</button>
        <button type="button" className={buttonClass.secondary} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
