import React, { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Search, Trash2 } from "lucide-react";
import Avatar from "../Avatar";
import { api } from "../lib";
import { dangerButton, ErrorNote, primaryButton, quietButton } from "../ui";
import Dialog from "./Dialog";

const fieldClass = "w-full rounded-xl border-0 bg-neutral-100 px-3 py-2 text-sm text-slate-900 ring-1 ring-neutral-200 focus:ring-2 focus:ring-accent dark:bg-neutral-800 dark:text-white dark:ring-neutral-700";

// Adding a channel, or changing one (`channel`): its name and topic, and who's in it. The
// group's admins are always in every channel; then everyone, or only the roles and people
// picked. Admins and whoever added it also archive it; admins delete it for good.
export function ChannelForm({ chat, slug, channel = null, onClose, onSaved }) {
  const [name, setName] = useState(channel?.name || "");
  const [topic, setTopic] = useState(channel?.topic || "");
  const [everyone, setEveryone] = useState(channel ? channel.access_roles.includes("members") : true);
  const [roles, setRoles] = useState(() => (channel?.access_roles || []).filter((r) => r !== "members"));
  const [people, setPeople] = useState(channel?.access_user_ids || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const general = channel?.general;

  const save = async (extra = {}) => {
    setSaving(true);
    setError(null);
    const body = { name, topic, access_roles: everyone ? ["members"] : roles, access_user_ids: everyone ? [] : people, ...extra };
    try {
      const saved = await api(channel ? `/groups/${slug}/chat_channels/${channel.id}` : `/groups/${slug}/chat_channels`, { method: channel ? "PATCH" : "POST", body });
      onSaved(saved);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  const destroy = async () => {
    if (!window.confirm(`Delete #${channel.name} and every message in it? This can't be undone.`)) return;
    setSaving(true);
    try {
      await api(`/groups/${slug}/chat_channels/${channel.id}`, { method: "DELETE" });
      onSaved(null, true);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <Dialog title={channel ? `#${channel.name}` : "Add a channel"} onClose={onClose} wide
      footer={(
        <>
          {channel && !general && (
            <button type="button" className={quietButton} disabled={saving} onClick={() => save({ archived: !channel.archived })}>
              {channel.archived ? <><ArchiveRestore className="size-4" /> Unarchive</> : <><Archive className="size-4" /> Archive</>}
            </button>
          )}
          {channel && !general && chat.can_manage && (
            <button type="button" className={dangerButton} disabled={saving} onClick={destroy}><Trash2 className="size-4" /> Delete</button>
          )}
          <span className="flex-1" />
          <button type="button" className={quietButton} onClick={onClose}>Cancel</button>
          <button type="button" className={primaryButton} disabled={saving || !name.trim() || (!everyone && !roles.length && !people.length)} onClick={() => save()}>
            {saving ? "Saving…" : channel ? "Save" : "Add channel"}
          </button>
        </>
      )}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block font-medium text-slate-900 dark:text-white">Name</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">#</span>
            <input value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, ""))}
              maxLength={40} disabled={general} autoFocus={!channel} placeholder="business-meeting" className={`${fieldClass} pl-7`} />
          </div>
          <span className="mt-1 block text-xs text-slate-500">Lowercase letters, numbers and dashes.</span>
        </label>
        <label className="block">
          <span className="mb-1 block font-medium text-slate-900 dark:text-white">What it's for <span className="font-normal text-slate-500">(optional)</span></span>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={250} placeholder="Planning the next business meeting" className={fieldClass} />
        </label>
        {general ? (
          <p className="rounded-xl bg-neutral-100 px-3 py-2 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">#general is always open to everyone in the group.</p>
        ) : (
          <fieldset>
            <legend className="mb-2 font-medium text-slate-900 dark:text-white">Who's in it</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <Choice checked={everyone} onChange={() => setEveryone(true)} title="Everyone in the group" text="Every member reads and posts." />
              <Choice checked={!everyone} onChange={() => setEveryone(false)} title="Only some people" text="Admins, plus the roles and people you pick." />
            </div>
            {!everyone && (
              <div className="mt-3 space-y-3 rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200 dark:bg-neutral-800/60 dark:ring-neutral-700">
                <RolePicker roles={chat.roles.filter((r) => r.key !== "members")} value={roles} onChange={setRoles} />
                <PeoplePicker people={chat.people} value={people} onChange={setPeople} />
              </div>
            )}
          </fieldset>
        )}
        <ErrorNote error={error} />
      </div>
    </Dialog>
  );
}

// Admins pick who else may add channels: roles (or everyone), and people
export function ChatSettings({ chat, slug, onClose, onSaved }) {
  const [roles, setRoles] = useState(chat.settings?.creator_roles || []);
  const [people, setPeople] = useState(chat.settings?.creator_user_ids || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setSaving(true);
    try {
      onSaved(await api(`/groups/${slug}/chat`, { method: "PATCH", body: { creator_roles: roles, creator_user_ids: people } }));
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };
  return (
    <Dialog title="Who can add channels" onClose={onClose} wide
      footer={(
        <>
          <span className="flex-1" />
          <button type="button" className={quietButton} onClick={onClose}>Cancel</button>
          <button type="button" className={primaryButton} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</button>
        </>
      )}>
      <div className="space-y-3">
        <p className="text-slate-600 dark:text-neutral-300">The group's admins can always add channels. Whoever adds one can change it or archive it later.</p>
        <RolePicker roles={chat.roles} value={roles} onChange={setRoles} label="Also let these roles add channels" />
        {!roles.includes("members") && <PeoplePicker people={chat.people} value={people} onChange={setPeople} label="And these people" />}
        <ErrorNote error={error} />
      </div>
    </Dialog>
  );
}

function Choice({ checked, onChange, title, text }) {
  return (
    <label className={`flex cursor-pointer gap-2 rounded-2xl p-3 ring-1 ${checked ? "bg-accent/5 ring-2 ring-accent" : "ring-neutral-200 dark:ring-neutral-700"}`}>
      <input type="radio" checked={checked} onChange={onChange} className="mt-0.5 accent-[var(--color-accent)]" />
      <span><span className="block font-semibold text-slate-900 dark:text-white">{title}</span><span className="block text-xs text-slate-500 dark:text-neutral-400">{text}</span></span>
    </label>
  );
}

function RolePicker({ roles, value, onChange, label = "Roles" }) {
  const toggle = (key) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-neutral-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {roles.map((r) => (
          <button key={r.key} type="button" aria-pressed={value.includes(r.key)} onClick={() => toggle(r.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${value.includes(r.key) ? "!bg-accent !text-white ring-accent" : "!bg-white text-slate-700 ring-neutral-200 dark:!bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700"}`}>
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PeoplePicker({ people, value, onChange, label = "People" }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return people.filter((p) => !query || p.name.toLowerCase().includes(query) || p.username.includes(query));
  }, [people, q]);
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-neutral-400">{label}{value.length ? ` · ${value.length} picked` : ""}</p>
      <div className="relative mb-1.5">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a member" className={`${fieldClass} pl-9`} />
      </div>
      <ul className="max-h-48 overflow-y-auto rounded-xl bg-white ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700">
        {shown.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800">
              <input type="checkbox" checked={value.includes(p.id)} onChange={() => toggle(p.id)} className="accent-[var(--color-accent)]" />
              <Avatar person={p} size={24} />
              <span className="min-w-0 flex-1 truncate text-slate-900 dark:text-white">{p.name}</span>
              <span className="text-xs text-slate-500">@{p.username}</span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-3 text-center text-xs text-slate-500">Nobody by that name</li>}
      </ul>
    </div>
  );
}
