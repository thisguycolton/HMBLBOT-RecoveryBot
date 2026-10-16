import React, { useEffect, useRef, useState } from "react";
import { Camera, Check, Megaphone, Trash2, UserPlus, X } from "lucide-react";
import { inputClass, selectClass } from "../../ui/styles";
import { DateTimeField } from "../../ui/DateFields";
import Toggle from "../../ui/Toggle";
import Avatar from "../../groups/Avatar";
import { ZONES } from "../../groups/lib";
import { api, LAYOUTS, STATUS_LABEL } from "../lib";
import { Field } from "./Inspector";

export function PanelTitle({ icon: Icon, title, note }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-200"><Icon className="size-5" /></span>
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
        {note && <p className="text-xs text-slate-500 dark:text-neutral-400">{note}</p>}
      </div>
    </div>
  );
}

// Title, short description, when and where, cover and flyer, and whether it's published
export function DetailsPanel({ draft, set, images, setImages, max }) {
  return (
    <div className="space-y-4">
      <Field label="Title (required)">
        <input className={inputClass} value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} required />
      </Field>
      <Field label="Short description" hint={`${(draft.short_description || "").length}/${max} · The longer description goes in the page's blocks.`}>
        <textarea className={`${inputClass} resize-none`} rows={3} maxLength={max} value={draft.short_description || ""} onChange={(e) => set({ short_description: e.target.value })} placeholder="A line or two people see first" />
      </Field>
      <Field label="Starts"><DateTimeField value={draft.starts_at || ""} onChange={(v) => set({ starts_at: v })} clearable /></Field>
      <Field label="Ends"><DateTimeField value={draft.ends_at || ""} onChange={(v) => set({ ends_at: v })} min={draft.starts_at} clearable /></Field>
      <Field label="Time zone">
        <select className={selectClass} value={draft.time_zone} onChange={(e) => set({ time_zone: e.target.value })}>
          {ZONES.map(([zone, label]) => <option key={zone} value={zone}>{label}</option>)}
        </select>
      </Field>
      <Field label="Where" hint="An address, a room, or a meeting link">
        <input className={inputClass} value={draft.location || ""} onChange={(e) => set({ location: e.target.value })} maxLength={300} />
      </Field>
      <ImageField label="Cover photo" hint="Across the top of the page" url={images.cover.url} onPick={(file, url) => setImages({ ...images, cover: { file, url, remove: false } })} onRemove={() => setImages({ ...images, cover: { file: null, url: null, remove: true } })} wide />
      <ImageField label="Flyer" hint="People tap it to see it full size" url={images.flyer.url} onPick={(file, url) => setImages({ ...images, flyer: { file, url, remove: false } })} onRemove={() => setImages({ ...images, flyer: { file: null, url: null, remove: true } })} />
      <div className="rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800/70">
        <Toggle
          checked={draft.status === "published"}
          onChange={(on) => set({ status: on ? "published" : "draft" })}
          label="Published"
          description={draft.status === "published" ? "Anyone with the link can see it and RSVP." : "A draft: only the people editing can see it."}
        />
      </div>
    </div>
  );
}

function ImageField({ label, hint, url, onPick, onRemove, wide = false }) {
  const input = useRef(null);
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => input.current?.click()} className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl !bg-neutral-100 !p-0 text-slate-400 ring-1 ring-neutral-200 hover:text-accent dark:!bg-neutral-800 dark:ring-neutral-700 ${wide ? "h-16 w-28" : "h-20 w-16"}`} aria-label={`Upload a ${label.toLowerCase()}`}>
          {url ? <img src={url} alt="" className="absolute inset-0 size-full object-cover" /> : <Camera className="size-5" />}
        </button>
        <div className="flex flex-col items-start gap-1">
          <button type="button" onClick={() => input.current?.click()} className="!bg-transparent !p-0 text-sm font-medium text-accent hover:underline">{url ? "Change" : "Upload"}</button>
          {url && <button type="button" onClick={onRemove} className="!bg-transparent !p-0 text-sm text-slate-500 hover:text-rose-600">Remove</button>}
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) onPick(file, URL.createObjectURL(file));
      }} />
    </Field>
  );
}

// The three layouts, drawn as little column diagrams
export function LayoutPanel({ value, onChange }) {
  return (
    <div className="space-y-2">
      {LAYOUTS.map((l) => (
        <button key={l.key} type="button" onClick={() => onChange(l.key)} aria-pressed={value === l.key}
          className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 transition-colors ${value === l.key ? "!bg-accent/10 ring-accent" : "!bg-white ring-neutral-200 hover:!bg-neutral-50 dark:!bg-neutral-900 dark:ring-neutral-700 dark:hover:!bg-neutral-800"}`}>
          <span className="flex h-12 w-20 shrink-0 gap-1 rounded-lg bg-neutral-100 p-1.5 dark:bg-neutral-800">
            {l.cols.map((c, i) => {
              const filler = l.key === "centered" && i !== 1;
              const big = c === Math.max(...l.cols);
              return <span key={i} style={{ flex: c }} className={`rounded ${filler ? "bg-transparent ring-1 ring-dashed ring-neutral-300 dark:ring-neutral-600" : big ? "bg-accent/70" : "bg-accent/35"}`} />;
            })}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900 dark:text-white">{l.label}</span>
            <span className="block text-xs text-slate-500 dark:text-neutral-400">{l.ratio}</span>
          </span>
          {value === l.key && <Check className="size-4 text-accent" />}
        </button>
      ))}
      <p className="pt-1 text-xs text-slate-500 dark:text-neutral-400">
        Blocks keep their column when you switch. In the centered layout, side blocks sit under the main ones.
      </p>
    </div>
  );
}

const Person = ({ person, note, action }) => (
  <li className="flex items-center gap-3 rounded-xl bg-white p-2 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700">
    <Avatar person={person} size={32} />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{person.name}</span>
      <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{note || person.email}</span>
    </span>
    {action}
  </li>
);

// Who can edit: every group admin, plus collaborators group admins add from the group
export function PeoplePanel({ event, setEvent }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!event.can_manage) return;
    const timer = setTimeout(() => {
      api(`/events/${event.token}/people?q=${encodeURIComponent(q)}`).then(setResults).catch(() => setResults([]));
    }, 150);
    return () => clearTimeout(timer);
  }, [q, event.token, event.can_manage, event.collaborators?.length]);

  const call = async (path, method, body) => {
    setError(null);
    try {
      setEvent(await api(`/events/${event.token}/${path}`, { method, body }));
      setQ("");
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <Field label="Group admins" hint="They can edit every event in the group.">
        <ul className="space-y-1.5">{event.admins.map((p) => <Person key={p.id} person={p} />)}</ul>
      </Field>
      <Field label="Collaborators" hint={event.can_manage ? "Members of the group who can edit this event." : "Only group admins add collaborators."}>
        <ul className="space-y-1.5">
          {event.collaborators.length === 0 && <li className="text-sm text-slate-500 dark:text-neutral-400">No collaborators yet.</li>}
          {event.collaborators.map((p) => (
            <Person key={p.id} person={p} action={event.can_manage && (
              <button type="button" onClick={() => call(`collaborators/${p.id}`, "DELETE")} className="grid size-7 place-items-center rounded-lg !bg-transparent text-slate-400 hover:text-rose-600" aria-label={`Remove ${p.name}`}>
                <X className="size-4" />
              </button>
            )} />
          ))}
        </ul>
      </Field>
      {event.can_manage && (
        <Field label="Add a collaborator">
          <div className="relative">
            <UserPlus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input className={`${inputClass} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email of a group member" />
          </div>
          {results.length > 0 && (
            <ul className="mt-1.5 space-y-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800/70" role="listbox">
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => call("collaborators", "POST", { user_id: p.id })} className="flex w-full items-center gap-3 rounded-lg !bg-transparent p-2 text-left hover:!bg-white dark:hover:!bg-neutral-900">
                    <Avatar person={p} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{p.name}</span>
                      <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{p.email}</span>
                    </span>
                    <span className="text-xs font-semibold text-accent">Add</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q && results.length === 0 && <p className="mt-1.5 text-xs text-slate-500">Nobody else in {event.group.title} matches.</p>}
          {error && <p className="mt-1.5 text-sm text-rose-600">{error}</p>}
        </Field>
      )}
    </div>
  );
}

// Who's coming, and the updates that went out
export function RsvpsPanel({ event }) {
  const groups = ["going", "maybe", "following", "not_going"].map((s) => [s, event.rsvps.filter((r) => r.status === s)]).filter(([, l]) => l.length);
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600 dark:text-neutral-300">
        {event.followers_count} {event.followers_count === 1 ? "person gets" : "people get"} updates. Voting in this event's polls with an account follows it.
      </p>
      {groups.length === 0 && <p className="text-sm text-slate-500">No RSVPs yet.</p>}
      {groups.map(([status, list]) => (
        <Field key={status} label={`${STATUS_LABEL[status]} (${list.length})`}>
          <ul className="space-y-1.5">
            {list.map((r) => <Person key={r.id} person={r} note={`${r.email || ""}${r.guest ? " · no account" : ""}`} />)}
          </ul>
        </Field>
      ))}
      <Field label={`Updates sent (${event.updates.length})`}>
        <ul className="space-y-1.5">
          {event.updates.length === 0 && <li className="text-sm text-slate-500 dark:text-neutral-400">None yet. Turn on “Send as an update” on a Notes block.</li>}
          {event.updates.map((u) => (
            <li key={u.id} className="flex items-start gap-2 rounded-xl bg-white p-2.5 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700">
              <Megaphone className="mt-0.5 size-4 shrink-0 text-accent" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-900 dark:text-white">{u.title}</span>
                <span className="block text-xs text-slate-500">{new Date(u.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              </span>
            </li>
          ))}
        </ul>
      </Field>
    </div>
  );
}

export function DangerZone({ onDelete }) {
  return (
    <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-xl !bg-transparent px-3 py-2 text-sm font-medium text-rose-700 hover:!bg-rose-50 dark:text-rose-300 dark:hover:!bg-rose-950/40">
      <Trash2 className="size-4" /> Delete this event
    </button>
  );
}
