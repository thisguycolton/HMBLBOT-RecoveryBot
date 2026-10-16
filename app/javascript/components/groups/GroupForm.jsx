import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Users } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { inputClass, labelClass } from "../ui/styles";
import { api, ZONES } from "./lib";
import { ErrorNote, Loading, Message, dangerButton, primaryButton, quietButton } from "./ui";

const BLANK = { title: "", description: "", website: "", time_zone: "America/Phoenix" };

// /groups/new (site admins) and /groups/:slug/edit (group admins)
export default function GroupForm() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(slug ? null : BLANK);
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api(`/groups/${slug}`)
      .then((g) => {
        setGroup(g);
        setForm({ title: g.title || "", description: g.description || "", website: g.website || "", time_zone: g.time_zone });
      })
      .catch((e) => setLoadError(e.message));
  }, [slug]);

  if (loadError) return <Message title="Can't edit this group" text={loadError} />;
  if (!form) return <Loading />;
  if (group && !group.can_manage) return <Message title="Only this group's admins can edit it" />;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await api(slug ? `/groups/${slug}` : "/groups", { method: slug ? "PATCH" : "POST", body: { group: form } });
      // a new group opens on its meetings, which offers its Meeting Guide listings
      navigate(`/${saved.slug}${slug ? "" : "?new=1"}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const destroy = async () => {
    if (!window.confirm(`Delete ${group.title}? Its meetings, memberships and approved literature go with it. Readings stay with their authors.`)) return;
    try {
      await api(`/groups/${slug}`, { method: "DELETE" });
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={save} className="mx-auto max-w-xl space-y-4 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <Shell>
        <ShellBand icon={Users} title={slug ? `Edit ${group.title}` : "New group"} subtitle={slug ? null : "You'll be its first admin"} />
        <ShellPanel position="middle" className="space-y-4 p-4">
          <div>
            <label htmlFor="title" className={labelClass}>Name</label>
            <input id="title" required maxLength={120} className={inputClass} value={form.title} onChange={(e) => set({ title: e.target.value })}
              placeholder="As the group calls itself" />
          </div>
          <div>
            <label htmlFor="description" className={labelClass}>About the group</label>
            <textarea id="description" rows={3} maxLength={1000} className={inputClass} value={form.description}
              onChange={(e) => set({ description: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="website" className={labelClass}>Website</label>
              <input id="website" type="url" className={inputClass} value={form.website} placeholder="https://"
                onChange={(e) => set({ website: e.target.value })} />
            </div>
            <div>
              <label htmlFor="zone" className={labelClass}>Time zone</label>
              <select id="zone" className={inputClass} value={form.time_zone} onChange={(e) => set({ time_zone: e.target.value })}>
                {ZONES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
          <ErrorNote error={error} />
        </ShellPanel>
        <ShellPanel position="bottom" className="flex flex-wrap items-center justify-between gap-2 p-4">
          {slug && group.is_site_admin ? (
            <button type="button" onClick={destroy} className={dangerButton}>Delete group</button>
          ) : <span />}
          <div className="flex gap-2">
            <Link to={slug ? `/${slug}` : "/"} className={quietButton}>Cancel</Link>
            <button type="submit" disabled={saving} className={primaryButton}>{saving ? "Saving…" : slug ? "Save" : "Create group"}</button>
          </div>
        </ShellPanel>
      </Shell>
    </form>
  );
}
