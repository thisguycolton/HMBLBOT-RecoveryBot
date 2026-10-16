import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Lock, MessagesSquare, Pencil, Trash2, X } from "lucide-react";
import { showToast } from "../../lib/toast";
import Avatar from "./Avatar";
import NoteComposer from "./NoteComposer";
import { api } from "./lib";
import { Card, ErrorNote, Loading, Tray } from "./ui";
import { timeAgo } from "./page/lib";

// Your timeline (/groups/timeline): notes only you see until you share them to groups
// you're in; there, members see them in the group page's Timeline block.
export default function TimelinePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = () => api("/timeline_notes").then(setData).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    document.title = "Your timeline | RecoveryBot";
  }, []);

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;

  const replace = (note) => setData((d) => ({ ...d, notes: d.notes.map((n) => (n.id === note.id ? note : n)) }));
  const remove = (id) => setData((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }));

  return (
    <div className="mx-auto max-w-2xl space-y-5 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <header className="space-y-2">
        <Link to="/" className="text-sm text-slate-500 hover:text-accent dark:text-neutral-400">← Groups</Link>
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white"><MessagesSquare className="size-7 text-accent" /> Your timeline</h1>
        <p className="text-slate-600 dark:text-neutral-300">Notes stay yours until you share them. Members of the groups you pick see them on the group's page.</p>
      </header>

      <Tray label="New note">
        <Card className="p-3">
          <NoteComposer groups={data.groups} max={data.max} placeholder="What's on your mind today?" onPosted={(note) => setData((d) => ({ ...d, notes: [note, ...d.notes] }))} />
        </Card>
      </Tray>

      <Tray label={`Notes (${data.notes.length})`}>
        {data.notes.length === 0 ? (
          <Card className="p-6 text-center text-sm text-slate-500 dark:text-neutral-400">Nothing here yet.</Card>
        ) : (
          <ol className="space-y-1.5">
            {data.notes.map((note) => <NoteRow key={note.id} note={note} groups={data.groups} max={data.max} onChange={replace} onRemove={remove} />)}
          </ol>
        )}
      </Tray>
    </div>
  );
}

function NoteRow({ note, groups, max, onChange, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  const shared = note.groups.map((g) => g.slug);

  const patch = async (fields) => {
    try {
      onChange(await api(`/timeline_notes/${note.id}`, { method: "PATCH", body: { note: fields } }));
      return true;
    } catch (e) {
      showToast(e.message, { tone: "error" });
      return false;
    }
  };
  const toggle = (slug) => patch({ group_slugs: shared.includes(slug) ? shared.filter((s) => s !== slug) : [...shared, slug] });
  const destroy = async () => {
    if (!window.confirm("Delete this note? It comes off every group it's shared to.")) return;
    try {
      await api(`/timeline_notes/${note.id}`, { method: "DELETE" });
      onRemove(note.id);
    } catch (e) { showToast(e.message, { tone: "error" }); }
  };
  const icon = "grid size-7 place-items-center rounded-lg !bg-transparent text-slate-400 hover:!bg-neutral-100 hover:text-slate-700 dark:hover:!bg-neutral-800 dark:hover:text-white";

  return (
    <li>
      <Card className="flex gap-3 p-3">
        <Avatar person={note.author} size={36} />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <span>{timeAgo(note.created_at)}{note.edited ? " · edited" : ""}</span>
            <span className="ml-auto flex gap-0.5">
              {!editing && <button type="button" className={icon} onClick={() => setEditing(true)} title="Edit" aria-label="Edit"><Pencil className="size-3.5" /></button>}
              <button type="button" className={`${icon} hover:!text-rose-600`} onClick={destroy} title="Delete" aria-label="Delete"><Trash2 className="size-3.5" /></button>
            </span>
          </p>
          {editing ? (
            <div className="space-y-2">
              <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={max} rows={3}
                className="w-full resize-y rounded-xl border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-neutral-200 focus:ring-2 focus:ring-accent dark:bg-neutral-900 dark:text-white dark:ring-neutral-700" />
              <div className="flex justify-end gap-2">
                <button type="button" className="inline-flex items-center gap-1 rounded-lg !bg-transparent px-2 py-1 text-sm text-slate-600 dark:text-neutral-300" onClick={() => { setBody(note.body); setEditing(false); }}><X className="size-4" /> Cancel</button>
                <button type="button" disabled={!body.trim()} className="inline-flex items-center gap-1 rounded-lg !bg-accent px-2.5 py-1 text-sm font-semibold !text-white disabled:opacity-50" onClick={async () => { if (await patch({ body })) setEditing(false); }}><Check className="size-4" /> Save</button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-line text-slate-800 [overflow-wrap:anywhere] dark:text-neutral-100">{note.body}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {groups.length === 0 ? (
              <span className="inline-flex items-center gap-1 text-slate-400"><Lock className="size-3" /> Only you. Join a group to share notes with it.</span>
            ) : (
              <>
                <span className="text-slate-500 dark:text-neutral-400">{shared.length ? "Shared to" : <span className="inline-flex items-center gap-1"><Lock className="size-3" /> Only you · share to</span>}</span>
                {groups.map((g) => (
                  <button key={g.slug} type="button" onClick={() => toggle(g.slug)} aria-pressed={shared.includes(g.slug)}
                    className={`rounded-full px-2.5 py-1 font-medium ring-1 ${shared.includes(g.slug) ? "!bg-accent/10 text-accent ring-accent dark:!bg-accent/25 dark:text-sky-200" : "!bg-transparent text-slate-500 ring-neutral-300 hover:!bg-neutral-100 dark:text-neutral-400 dark:ring-neutral-700 dark:hover:!bg-neutral-800"}`}>
                    {g.title}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </Card>
    </li>
  );
}
