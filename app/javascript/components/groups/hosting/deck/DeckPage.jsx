import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { api } from "../../lib";
import { ErrorNote, dangerButton, primaryButton, quietButton } from "../../ui";
import FilterPick from "../../../ui/FilterPick";
import { inputClass, labelClass, selectClass } from "../../../ui/styles";
import DeckView from "./DeckView";
import { EditorToolbar } from "./LayoutEditor";
import useHostingDeck from "./useHostingDeck";
import { PURPOSES, deckTemplate, draftOf, toArrangement } from "./templates";

// /groups/:slug/decks/:deckId: a HostDeck of its own (a business meeting's, host onboarding...),
// run from one of the group's documents. The same deck as a meeting's, with its own layout.
export default function DeckPage() {
  const { slug, deckId } = useParams();
  const deck = useHostingDeck(`/groups/${slug}/decks/${deckId}`);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const template = deckTemplate(deck.center);
  const done = (c) => { deck.setCenter(c); deck.applyLive(c.live); setDraft(null); };
  // ?edit=1 (just made from a document): straight into laying it out
  const [params, setParams] = useSearchParams();
  const ready = !!deck.center?.can_arrange;
  useEffect(() => {
    if (ready && params.get("edit") === "1") { setDraft(draftOf(deckTemplate(deck.center))); setParams({}, { replace: true }); }
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true);
    setError(null);
    try { done(await api(`${deck.base}/arrangement`, { method: "PUT", body: { arrangement: toArrangement(draft) } })); } catch (e) { setError(e.message); }
    setSaving(false);
  };
  const editor = draft && {
    draft, setDraft,
    toolbar: <EditorToolbar center={deck.center} draft={draft} setDraft={setDraft} saving={saving} error={error} onSave={save} onCancel={() => setDraft(null)} />,
  };
  return (
    <DeckView deck={deck} template={template} editor={editor} canArrange={!!deck.center?.can_arrange} onEdit={() => { setError(null); setDraft(draftOf(template)); }}
      renderSetup={() => <DeckSettings deck={deck} onClose={() => deck.setSetup(false)} />} />
  );
}

// The gear on a deck of its own: its name, what it's for (which template it starts from) and
// the document it runs from; or deleting it
function DeckSettings({ deck, onClose }) {
  const navigate = useNavigate();
  const { center } = deck;
  const [form, setForm] = useState({ name: center.deck.name, purpose: center.deck.purpose, script_document_id: center.deck.script_document_id });
  const [error, setError] = useState(null);
  const documents = center.editor?.documents || [];
  const save = async (e) => {
    e.preventDefault();
    try {
      const c = await api(deck.base, { method: "PATCH", body: { deck: form } });
      deck.setCenter(c);
      deck.applyLive(c.live);
      onClose();
    } catch (err) { setError(err.message); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${center.deck.name}? What was ticked off and timed in it goes too. The document stays.`)) return;
    try { await api(deck.base, { method: "DELETE" }); navigate(`/${deck.slug}/host`); } catch (err) { setError(err.message); }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="deck-settings" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={save} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-2xl dark:bg-neutral-900">
        <div className="flex items-center gap-2">
          <h2 id="deck-settings" className="flex-1 text-lg font-semibold">Deck settings</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-grid size-9 place-items-center rounded-xl !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:hover:!bg-neutral-800"><X className="size-5" /></button>
        </div>
        <div><label htmlFor="deck-name" className={labelClass}>Name</label><input id="deck-name" required maxLength={120} className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div>
          <label htmlFor="deck-purpose" className={labelClass}>What it's for</label>
          <select id="deck-purpose" className={selectClass} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
            {PURPOSES.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Until the layout is saved, the deck is laid out as this one's template.</p>
        </div>
        <div>
          <label className={labelClass}>Document it runs from</label>
          <FilterPick options={documents.map((d) => ({ value: String(d.id), label: d.title }))} value={form.script_document_id ? String(form.script_document_id) : ""}
            onChange={(v) => setForm({ ...form, script_document_id: v ? Number(v) : null })} placeholder="Type to find a document" />
        </div>
        <ErrorNote error={error} />
        <div className="flex items-center gap-2">
          <button type="button" className={dangerButton} onClick={remove}>Delete deck</button>
          <span className="flex-1" />
          <button type="button" className={quietButton} onClick={onClose}>Cancel</button>
          <button type="submit" className={primaryButton}>Save</button>
        </div>
      </form>
    </div>
  );
}
