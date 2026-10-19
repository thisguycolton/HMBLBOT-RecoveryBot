import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImagePlus, Trash2 } from "lucide-react";
import { inputClass, labelClass, selectClass } from "../ui/styles";
import { api, ZONES } from "./lib";
import { Card, ErrorNote, dangerButton, primaryButton, quietButton } from "./ui";

// The group's logo in its very rounded square, or its initials when it has none
export function GroupLogo({ group, url = group?.logo_url, className = "size-12 text-base" }) {
  const initials = (group?.title || "?").split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w) && !/^(the|of|and)$/i.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
  return url
    ? <img src={url} alt="" className={`shrink-0 rounded-[28%] object-cover ${className}`} />
    : <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-[28%] bg-gradient-to-br from-accent to-indigo-600 font-bold text-white ${className}`}>{initials}</span>;
}

// Group settings in the group dashboard (group admins): its name, about, website, time zone and logo
export default function GroupSettings({ group, setGroup }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: group.title || "", description: group.description || "", website: group.website || "", time_zone: group.time_zone });
  const [logo, setLogo] = useState(null); // a File waiting to be saved
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setSaved(false); };
  const preview = logo ? URL.createObjectURL(logo) : removeLogo ? null : group.logo_url;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(`group[${k}]`, v ?? ""));
    if (logo) body.append("group[logo]", logo);
    if (removeLogo && !logo) body.append("group[remove_logo]", "1");
    try {
      const updated = await api(`/groups/${group.slug}`, { method: "PATCH", form: body });
      setGroup(updated);
      setLogo(null);
      setRemoveLogo(false);
      setSaved(true);
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  const destroy = async () => {
    if (!window.confirm(`Delete ${group.title}? Its meetings, memberships and approved literature go with it. Readings stay with their authors.`)) return;
    try {
      await api(`/groups/${group.slug}`, { method: "DELETE" });
      navigate("/");
    } catch (err) { setError(err.message); }
  };

  return (
    <form onSubmit={save} className="max-w-3xl space-y-4">
      <Card className="space-y-4 p-4 sm:p-5">
        <h2 className="font-semibold text-slate-900 dark:text-white">Logo</h2>
        <div className="flex flex-wrap items-center gap-4">
          <GroupLogo group={group} url={preview} className="size-24 text-2xl" />
          <div className="space-y-2">
            <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => { setLogo(e.target.files[0] || null); setRemoveLogo(false); setSaved(false); e.target.value = ""; }} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={quietButton} onClick={() => fileRef.current.click()}><ImagePlus className="size-4" /> {preview ? "Change logo" : "Add a logo"}</button>
              {preview && <button type="button" className={quietButton} onClick={() => { setLogo(null); setRemoveLogo(true); setSaved(false); }}><Trash2 className="size-4" /> Take it off</button>}
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400">A square picture works best (PNG, JPEG, WebP or GIF, under 5 MB). It shows with rounded corners on the group page and in lists.</p>
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-4 sm:p-5">
        <h2 className="font-semibold text-slate-900 dark:text-white">About the group</h2>
        <div>
          <label htmlFor="s-title" className={labelClass}>Name</label>
          <input id="s-title" required maxLength={120} className={inputClass} value={form.title} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <div>
          <label htmlFor="s-about" className={labelClass}>About the group</label>
          <textarea id="s-about" rows={3} maxLength={1000} className={inputClass} value={form.description} onChange={(e) => set({ description: e.target.value })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="s-site" className={labelClass}>Website</label>
            <input id="s-site" type="url" className={inputClass} value={form.website} placeholder="https://" onChange={(e) => set({ website: e.target.value })} />
          </div>
          <div>
            <label htmlFor="s-zone" className={labelClass}>Time zone</label>
            <select id="s-zone" className={selectClass} value={form.time_zone} onChange={(e) => set({ time_zone: e.target.value })}>
              {ZONES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <ErrorNote error={error} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {group.is_site_admin ? <button type="button" onClick={destroy} className={dangerButton}>Delete group</button> : <span />}
        <div className="flex items-center gap-3">
          {saved && <span role="status" className="text-sm text-emerald-700 dark:text-emerald-300">Saved.</span>}
          <button type="submit" disabled={saving} className={primaryButton}>{saving ? "Saving…" : "Save settings"}</button>
        </div>
      </div>
    </form>
  );
}
