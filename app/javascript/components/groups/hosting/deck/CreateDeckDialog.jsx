import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MonitorPlay, X } from "lucide-react";
import { api } from "../../lib";
import { ErrorNote, Loading, primaryButton, quietButton } from "../../ui";
import { inputClass, labelClass, selectClass } from "../../../ui/styles";
import { PURPOSES } from "./templates";

// Document > File > Create New HostDeck: run this document as a deck of its own (a business
// meeting, host onboarding, anything), or make it a meeting's script. It lists the decks and
// meetings that already use it, to open them.
export default function CreateDeckDialog({ group, doc, onClose }) {
  const navigate = useNavigate();
  const slug = group.slug;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ purpose: doc.kind === "format" ? "meeting" : "business_meeting", name: doc.title, meeting_id: "", scope: "meeting" });
  const [saving, setSaving] = useState(false);
  useEffect(() => { api(`/groups/${slug}/decks?document_id=${doc.id}`).then(setData).catch((e) => setError(e.message)); }, [slug, doc.id]);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (form.purpose === "meeting") {
        await api(`/groups/${slug}/hosting/${form.meeting_id}/script`, { method: "PUT", body: { scope: form.scope, document_id: doc.id } });
        navigate(`/${slug}/host/${form.meeting_id}`);
      } else {
        const deck = await api(`/groups/${slug}/decks`, { method: "POST", body: { deck: { name: form.name, purpose: form.purpose, script_document_id: doc.id } } });
        navigate(`/${slug}/decks/${deck.id}?edit=1`);
      }
    } catch (err) { setError(err.message); setSaving(false); }
  };

  const using = data ? [...data.decks.map((d) => ({ key: `d${d.id}`, to: `/${slug}/decks/${d.id}`, label: d.name })),
    ...(data.meetings || []).filter((m) => m.id).map((m) => ({ key: `m${m.id}`, to: `/${slug}/host/${m.id}`, label: `${m.name} (meeting script)` }))] : [];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="new-deck" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={create} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 text-left shadow-2xl dark:bg-neutral-900">
        <div className="flex items-center gap-2">
          <MonitorPlay className="size-5 text-accent" />
          <h2 id="new-deck" className="flex-1 text-lg font-semibold">Create New HostDeck</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-grid size-9 place-items-center rounded-xl !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:hover:!bg-neutral-800"><X className="size-5" /></button>
        </div>
        <p className="text-sm text-slate-600 dark:text-neutral-300">HostDeck steps through <span className="font-semibold">{doc.title}</span> a section at a time (Insert &gt; Add Section, or its headings), with the blocks around it that you pick.</p>
        {!data && !error && <Loading />}
        {using.length > 0 && (
          <div className="rounded-xl bg-neutral-50 p-3 text-sm dark:bg-neutral-800/60">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Already running from it</p>
            <ul className="space-y-1">{using.map((u) => <li key={u.key}><Link to={u.to} className="text-accent hover:underline">{u.label}</Link></li>)}</ul>
          </div>
        )}
        {data && !data.can_create && <p className="text-sm text-amber-800 dark:text-amber-200">Only the members your group picked in Group settings &gt; HostDeck can make decks.</p>}
        {data?.can_create && (
          <>
            <div>
              <label htmlFor="deck-for" className={labelClass}>What it's for</label>
              <select id="deck-for" className={selectClass} value={form.purpose} onChange={(e) => set({ purpose: e.target.value })}>
                {PURPOSES.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
                <option value="meeting">A meeting's script (Host a meeting)</option>
              </select>
            </div>
            {form.purpose === "meeting" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="deck-meeting" className={labelClass}>Meeting</label>
                  <select id="deck-meeting" required className={selectClass} value={form.meeting_id} onChange={(e) => set({ meeting_id: e.target.value })}>
                    <option value="">Pick one</option>
                    {data.meeting_choices.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="deck-scope" className={labelClass}>Use it for</label>
                  <select id="deck-scope" className={selectClass} value={form.scope} onChange={(e) => set({ scope: e.target.value })}>
                    <option value="meeting">Just that meeting</option>
                    <option value="default">All the group's meetings</option>
                  </select>
                </div>
              </div>
            ) : (
              <div><label htmlFor="deck-name" className={labelClass}>Name</label><input id="deck-name" required maxLength={120} className={inputClass} value={form.name} onChange={(e) => set({ name: e.target.value })} /></div>
            )}
            {form.purpose !== "meeting" && doc.visibility === "keepers" && <p className="text-xs text-amber-800 dark:text-amber-200">Only record keepers can read this document, so other members will see the deck without it. Share it with members in Document details.</p>}
          </>
        )}
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={quietButton} onClick={onClose}>Cancel</button>
          {data?.can_create && <button type="submit" className={primaryButton} disabled={saving}>{saving ? "Creating…" : form.purpose === "meeting" ? "Use it and open HostDeck" : "Create and open"}</button>}
        </div>
      </form>
    </div>
  );
}
