import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Clipboard, ClipboardCheck, Link2, RefreshCw, X } from "lucide-react";
import { api } from "../../lib";
import { copyText } from "../lib";
import { ErrorNote, dangerButton, primaryButton, quietButton } from "../../ui";
import FilterPick from "../../../ui/FilterPick";
import { inputClass, labelClass, selectClass } from "../../../ui/styles";
import { IntroTitle } from "../KitEditor";
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

// The gear on a deck of its own: its name, what it's for (which template it starts from), the
// document it runs from and what its first section is called; or deleting it
function DeckSettings({ deck, onClose }) {
  const navigate = useNavigate();
  const { center } = deck;
  const [form, setForm] = useState({ name: center.deck.name, purpose: center.deck.purpose, script_document_id: center.deck.script_document_id, intro_title: center.deck.intro_title || "", guest_access: center.deck.guest_access || "off", guest_script: center.deck.guest_script !== false });
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
          {form.script_document_id && <IntroTitle id="deck-intro" value={form.intro_title} onChange={(v) => setForm({ ...form, intro_title: v })} />}
        </div>
        <Sharing deck={deck} form={form} setForm={setForm} setError={setError} />
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

// The deck's share link (/h/CODE) and what people without an account may do with it. Members of the
// group always get the deck itself; the rest follow it read-only when "view" is on.
function Sharing({ deck, form, setForm, setError }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}${deck.center.deck.share_path}`;
  const copy = () => copyText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  const renew = async () => {
    if (!window.confirm("Make a new link? The old one stops working for everyone who has it.")) return;
    try { const c = await api(`${deck.base}/reshare`, { method: "POST" }); deck.setCenter(c); } catch (err) { setError(err.message); }
  };
  return (
    <fieldset className="space-y-2 rounded-xl bg-neutral-50 p-3 ring-1 ring-neutral-200 dark:bg-neutral-800/50 dark:ring-neutral-700">
      <legend className={`${labelClass} flex items-center gap-1.5 px-1`}><Link2 className="size-3.5" /> Share this deck</legend>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-sm font-semibold" title={url}>{url.replace(/^https?:\/\//, "")}</code>
        <button type="button" className={`${quietButton} !px-3`} onClick={copy}>{copied ? <><ClipboardCheck className="size-4" /> Copied</> : <><Clipboard className="size-4" /> Copy</>}</button>
        <button type="button" className={`${quietButton} !px-2.5`} onClick={renew} aria-label="Make a new link" title="Make a new link (the old one stops working)"><RefreshCw className="size-4" /></button>
      </div>
      <label htmlFor="deck-guests" className={labelClass}>Anyone with the link who isn't in the group</label>
      <select id="deck-guests" className={selectClass} value={form.guest_access} onChange={(e) => setForm({ ...form, guest_access: e.target.value })}>
        <option value="off">Can't open it (they're asked to sign in)</option>
        <option value="view">Can follow along, no account needed (read-only)</option>
      </select>
      {form.guest_access === "view" && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" checked={form.guest_script} onChange={(e) => setForm({ ...form, guest_script: e.target.checked })} />
          <span>Show them the script too<span className="block text-xs text-slate-500 dark:text-neutral-400">Off: they see the deck's other blocks (checklists, timers, notes) but not the document it runs from.</span></span>
        </label>
      )}
      <p className="text-xs text-slate-500 dark:text-neutral-400">
        {form.guest_access === "view"
          ? "They see what the deck shows as the hosts move through it, and can't change anything. Members of the group get the full deck from the same link."
          : "Members of the group get the full deck from this link."}
      </p>
    </fieldset>
  );
}
