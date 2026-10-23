import React, { useEffect, useState } from "react";
import { Check, Globe, LayoutTemplate, Save, Trash2, Undo2, X } from "lucide-react";
import { inputClass, labelClass, selectClass } from "../../../ui/styles";
import { api } from "../../lib";
import { ErrorNote, Loading, Pill, dangerButton, primaryButton, quietButton } from "../../ui";
import { label } from "../parts";
import { BLOCKS } from "./blocks";
import { LAYOUT_SIDES, REGIONS, TEMPLATES, baseTemplate, draftOf, toArrangement } from "./templates";

// HostDeck's templates, from the layout editor: the built-in ones, the group's own, and the
// site-wide gallery (DeckTemplate). Using one puts its blocks on the deck being edited, and
// nothing is saved until Save layout. The layout being edited can be saved as the group's own
// template, and shared to the gallery, where a site admin publishes it.

const PURPOSE_NAMES = { meeting: "Meetings", business_meeting: "Business meetings", onboarding: "Onboarding", event: "Events", general: "Anything" };
const GALLERY_PILLS = { pending: ["amber", "Waiting for the gallery"], published: ["green", "In the gallery"], declined: ["slate", "Not taken for the gallery"] };
const BUILT_IN_PURPOSE = { host_a_meeting: "meeting", business_meeting: "business_meeting", onboarding: "onboarding", event: "event", general: "general" };

// A template's blocks on the deck being edited: the ones this deck can have, in its regions
export function fromTemplate(center, t) {
  const isDeck = !!center.deck;
  const keep = (list) => (list || []).filter((b) => BLOCKS[b.type] && !(isDeck && BLOCKS[b.type].meetingOnly));
  return draftOf({ ...baseTemplate(center), ...Object.fromEntries(REGIONS.map((r) => [r, keep(t[r])])), layout: LAYOUT_SIDES[t.layout] ? t.layout : "both" });
}

// The template's layout, small: the strip, the columns and the bar, with their blocks' names
function LayoutMap({ arrangement: a }) {
  const sides = LAYOUT_SIDES[a.layout] || LAYOUT_SIDES.both;
  const names = (list) => (list || []).filter((b) => BLOCKS[b.type]).map((b) => b.settings?.title || BLOCKS[b.type].label);
  const box = "min-w-0 rounded bg-neutral-100 p-1 text-[10px] leading-tight text-slate-600 dark:bg-neutral-800 dark:text-neutral-300";
  const column = (list) => <div className={`${box} space-y-0.5`}>{names(list).map((n, i) => <p key={i} className="truncate">{n}</p>)}</div>;
  return (
    <div className="space-y-1" aria-hidden="true">
      {names(a.strip).length > 0 && <div className={`${box} truncate`}>{names(a.strip).join(" · ")}</div>}
      <div className={`grid gap-1 ${sides.length === 2 ? "grid-cols-[1fr_1.6fr_1fr]" : sides.length ? "grid-cols-[1fr_1.6fr]" : ""}`}>
        {sides.includes("left") && column(a.left)}
        {column(a.main)}
        {sides.includes("right") && column(a.right)}
      </div>
      {names(a.bar).length > 0 && <div className={`${box} truncate`}>{names(a.bar).join(" · ")}</div>}
    </div>
  );
}

function TemplateCard({ name, description, purpose, arrangement, footer, actions }) {
  return (
    <li className="flex flex-col gap-2 rounded-xl bg-white p-3 shadow-panel ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="text-xs text-slate-500 dark:text-neutral-400">{PURPOSE_NAMES[purpose] || "Anything"}{footer ? ` · ${footer}` : ""}</p>
        </div>
      </div>
      {description && <p className="text-sm text-slate-600 dark:text-neutral-300">{description}</p>}
      <LayoutMap arrangement={arrangement} />
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">{actions}</div>
    </li>
  );
}

export default function TemplateGallery({ center, draft, setDraft, onClose }) {
  const slug = center.group.slug;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", purpose: center.deck?.purpose || "meeting", share: false });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const load = () => api(`/groups/${slug}/deck_templates`).then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const use = (t) => { setDraft(fromTemplate(center, t)); onClose(); };
  const run = async (fn) => { setError(null); try { await fn(); await load(); } catch (e) { setError(e.message); } };
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    await run(async () => {
      const t = await api(`/groups/${slug}/deck_templates`, { method: "POST", body: { deck_template: { ...form, arrangement: toArrangement(draft) } } });
      setSaved(t.name);
      setForm((f) => ({ ...f, name: "", description: "", share: false }));
    });
    setSaving(false);
  };
  const patch = (t, body) => run(() => api(`/groups/${slug}/deck_templates/${t.id}`, { method: "PATCH", body }));
  const remove = (t) => window.confirm(`Delete the template ${t.name}? Decks already using it keep their layout.`) && run(() => api(`/groups/${slug}/deck_templates/${t.id}`, { method: "DELETE" }));
  const useButton = (t) => <button type="button" className={`${primaryButton} !px-3 !py-1.5`} onClick={() => use(t.arrangement || t)} aria-label={`Use ${t.name}`}>Use</button>;
  const small = `${quietButton} !px-2.5 !py-1.5 !text-xs`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true" aria-labelledby="templates-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-full w-full max-w-3xl flex-col bg-neutral-50 shadow-2xl dark:bg-neutral-950">
        <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <LayoutTemplate className="size-5 text-accent" />
          <div className="min-w-0 flex-1">
            <h2 id="templates-title" className="font-semibold">Templates</h2>
            <p className="truncate text-xs text-slate-500 dark:text-neutral-400">Using one puts its blocks on the deck you're editing. Nothing is saved until you press Save layout.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-grid size-9 place-items-center rounded-xl !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:hover:!bg-neutral-800"><X className="size-5" /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
          <ErrorNote error={error} />
          {!data ? <Loading /> : (
            <>
              {data.can_save && (
                <form onSubmit={save} className="space-y-2 rounded-xl bg-white p-3 shadow-panel ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
                  <h3 className={label}>Save this layout as a template</h3>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
                    <div><label htmlFor="tpl-name" className={labelClass}>Name</label><input id="tpl-name" required maxLength={80} className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Speaker meeting" /></div>
                    <div><label htmlFor="tpl-purpose" className={labelClass}>For</label>
                      <select id="tpl-purpose" className={selectClass} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
                        {Object.entries(PURPOSE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                  <div><label htmlFor="tpl-about" className={labelClass}>What it's good for (optional)</label><input id="tpl-about" maxLength={300} className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-0.5" checked={form.share} onChange={(e) => setForm({ ...form, share: e.target.checked })} />
                    <span>Share it in the HostDeck gallery, for other groups to start from<span className="block text-xs text-slate-500 dark:text-neutral-400">A site admin looks at it first. Everything in its blocks goes with it, like notes, checklists and links, but not your documents or the meeting's chat postings.</span></span>
                  </label>
                  <div className="flex items-center justify-end gap-3">
                    {saved && <span role="status" className="text-sm text-emerald-700 dark:text-emerald-300">Saved {saved}.</span>}
                    <button type="submit" className={`${primaryButton} !py-1.5`} disabled={saving || !form.name.trim()}><Save className="size-4" /> {saving ? "Saving…" : "Save template"}</button>
                  </div>
                </form>
              )}

              {data.pending?.length > 0 && (
                <section>
                  <h3 className={`${label} mb-2`}>Waiting for the gallery ({data.pending.length})</h3>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {data.pending.map((t) => (
                      <TemplateCard key={t.id} {...t} footer={`from ${t.group.title}${t.by ? `, ${t.by}` : ""}`} actions={<>
                        <button type="button" className={`${primaryButton} !px-3 !py-1.5`} onClick={() => patch(t, { review: "publish" })}><Check className="size-4" /> Publish</button>
                        <button type="button" className={small} onClick={() => patch(t, { review: "decline" })}>Decline</button>
                        <button type="button" className={small} onClick={() => use(t.arrangement)}>Try it here</button>
                      </>} />
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h3 className={`${label} mb-2`}>Built in</h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {TEMPLATES.map((t) => <TemplateCard key={t.key} name={t.name} purpose={BUILT_IN_PURPOSE[t.key]} arrangement={t} actions={useButton(t)} />)}
                </ul>
              </section>

              <section>
                <h3 className={`${label} mb-2`}>{center.group.title}'s templates</h3>
                {data.mine.length === 0 ? <p className="text-sm text-slate-500 dark:text-neutral-400">None yet. {data.can_save ? "Save the layout you're editing above." : ""}</p> : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {data.mine.map((t) => (
                      <TemplateCard key={t.id} {...t} footer={t.by} actions={<>
                        {useButton(t)}
                        {GALLERY_PILLS[t.gallery] && <Pill tone={GALLERY_PILLS[t.gallery][0]}>{GALLERY_PILLS[t.gallery][1]}</Pill>}
                        {data.can_save && (t.gallery === "none" || t.gallery === "declined"
                          ? <button type="button" className={small} onClick={() => patch(t, { deck_template: { share: true } })}><Globe className="size-3.5" /> Share to the gallery</button>
                          : <button type="button" className={small} onClick={() => patch(t, { deck_template: { share: false } })}><Undo2 className="size-3.5" /> Take it out</button>)}
                        {data.can_save && <button type="button" className={`${dangerButton} !px-2 !py-1.5`} onClick={() => remove(t)} aria-label={`Delete ${t.name}`}><Trash2 className="size-3.5" /></button>}
                      </>} />
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className={`${label} mb-2 flex items-center gap-1.5`}><Globe className="size-3.5" /> The gallery</h3>
                {data.gallery.length === 0 ? <p className="text-sm text-slate-500 dark:text-neutral-400">Nothing from other groups yet. Share one of yours to start it off.</p> : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {data.gallery.map((t) => (
                      <TemplateCard key={t.id} {...t} footer={`from ${t.group.title}`} actions={<>
                        {useButton(t)}
                        {data.is_site_admin && <button type="button" className={`${dangerButton} !px-2 !py-1.5`} onClick={() => remove(t)} aria-label={`Delete ${t.name}`}><Trash2 className="size-3.5" /></button>}
                      </>} />
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
