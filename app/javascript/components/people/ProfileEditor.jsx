import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Columns3, FileText, RotateCcw } from "lucide-react";
import { showToast } from "../../lib/toast";
import EditorFrame from "../events/editor/EditorFrame";
import BlockInspector, { Choice, Field } from "../events/editor/Inspector";
import { LayoutPanel, PanelTitle } from "../events/editor/Panels";
import { inputClass } from "../ui/styles";
import { api } from "../groups/lib";
import ProfileHero from "./ProfileHero";
import { PROFILE_BLOCK_GROUPS, PROFILE_BLOCK_INFO, newProfileBlock } from "./lib";
import { CoverField } from "../groups/page/GroupPageEditor";

const PANELS = [
  { key: "page", label: "Page", icon: FileText, note: "The cover across the top" },
  { key: "layout", label: "Layout", icon: Columns3, note: "How the page's columns are laid out" },
];

const formFrom = (p) => ({ layout: p.layout, blocks: p.blocks || [] });
const OWN = ["about", "feed", "groups", "people"];

// Your profile page in the HMBLBOT Editor (/people/me/edit), laid out like a group's page.
// Changes stay local until Save.
export default function ProfileEditor() {
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [cover, setCover] = useState(null);
  const [selected, setSelected] = useState("page");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const adopt = useCallback((data) => {
    setSaved(data);
    setDraft(formFrom(data));
    setCover({ url: data.cover_url, file: null, remove: false });
    document.title = "Your profile | HMBLBOT Editor";
  }, []);

  useEffect(() => { api("/people/me").then(adopt).catch((e) => setError(e.message)); }, [adopt]);

  const dirty = useMemo(() => {
    if (!saved || !draft) return false;
    return !saved.custom || JSON.stringify(draft) !== JSON.stringify(formFrom(saved)) || !!cover.file || cover.remove;
  }, [saved, draft, cover]);

  useEffect(() => {
    const warn = (e) => { if (dirty && saved?.custom) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saved]);

  const save = useCallback(async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      let data;
      if (cover.file || cover.remove) {
        const form = new FormData();
        form.append("page[layout]", draft.layout);
        form.append("page[blocks]", JSON.stringify(draft.blocks));
        if (cover.file) form.append("page[cover]", cover.file);
        if (cover.remove) form.append("page[remove_cover]", "1");
        data = await api("/profile_page", { method: "PATCH", form });
      } else {
        data = await api("/profile_page", { method: "PATCH", body: { page: draft } });
      }
      adopt(data);
      showToast("Saved.", { tone: "success" });
    } catch (e) {
      showToast(e.message, { tone: "error" });
    } finally {
      setSaving(false);
    }
  }, [draft, saving, cover, adopt]);

  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [save]);

  if (error) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Can't open the editor</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-neutral-400">{error}</p>
        <a href="/people/me" className="mt-4 inline-block text-sm text-accent hover:underline">Back to your profile</a>
      </div>
    );
  }
  if (!draft) return <p className="py-24 text-center text-sm text-slate-500">Loading the editor…</p>;

  const { person, viewer } = saved.context;
  const context = { ...saved.context, kind: saved.kind, note_max: saved.note_max, images_max: saved.images_max };
  const setBlocks = (fn) => setDraft((d) => ({ ...d, blocks: typeof fn === "function" ? fn(d.blocks) : fn }));

  const reset = async () => {
    if (!window.confirm("Go back to the default profile? Your own blocks and layout go away.")) return;
    setSaving(true);
    try {
      adopt(await api("/profile_page", { method: "PATCH", body: { page: { reset: true } } }));
      showToast("Your profile shows the default page again.", { tone: "success" });
    } catch (e) {
      showToast(e.message, { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const renderPanel = (key, panel) => (
    <>
      <PanelTitle icon={panel.icon} title={panel.label} note={panel.note} />
      {key === "page" && (
        <div className="space-y-5">
          {!saved.custom && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-900/60">
              Your profile shows the default page right now. Saving makes this page your own.
            </p>
          )}
          <CoverField cover={cover} setCover={setCover} />
          <Field label="Name, picture and blurb" hint="They're in your settings, along with who sees new notes and highlights.">
            <a href="/users/edit" className="text-sm font-medium text-accent hover:underline">Open your settings</a>
          </Field>
          <p className="text-xs text-slate-500 dark:text-neutral-400">Only people signed in to RecoveryBot see profiles. Each note and highlight says who sees it.</p>
          {saved.custom && (
            <div className="border-t border-slate-200 pt-4 dark:border-neutral-800">
              <button type="button" onClick={reset} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl !bg-transparent px-0 text-sm font-medium text-rose-700 hover:underline disabled:opacity-50 dark:text-rose-300">
                <RotateCcw className="size-4" /> Go back to the default page
              </button>
            </div>
          )}
        </div>
      )}
      {key === "layout" && <LayoutPanel value={draft.layout} onChange={(layout) => setDraft((d) => ({ ...d, layout }))} />}
    </>
  );

  const extraFields = (block, set) => {
    if (!OWN.includes(block.type)) return null;
    return (
      <>
        <Field label="Title"><input className={inputClass} value={block.title || ""} onChange={(e) => set("title")(e.target.value)} maxLength={120} /></Field>
        {block.type === "feed" && (
          <>
            <Field label="Show"><Choice value={block.show} onChange={set("show")} options={[["all", "Everything"], ["notes", "Notes"], ["highlights", "Highlights"]]} /></Field>
            <Field label="How many at first"><Choice value={block.limit} onChange={set("limit")} options={[[5, "5"], [10, "10"], [20, "20"]]} /></Field>
            <p className="text-xs text-slate-500 dark:text-neutral-400">You write notes from here. Everyone else sees only what you've shared with them.</p>
          </>
        )}
        {block.type === "people" && (
          <Field label="Who"><Choice value={block.which} onChange={(which) => { set("which")(which); if (["Following", "Followers"].includes(block.title)) set("title")(which === "followers" ? "Followers" : "Following"); }} options={[["following", "Who you follow"], ["followers", "Your followers"]]} /></Field>
        )}
        {block.type === "groups" && <p className="text-xs text-slate-500 dark:text-neutral-400">You see all your groups. Others only see the ones they're in too.</p>}
        {block.type === "about" && <p className="text-xs text-slate-500 dark:text-neutral-400">Your blurb, and your sobriety date if you show it (both in settings).</p>}
      </>
    );
  };

  return (
    <EditorFrame
      blocks={draft.blocks}
      setBlocks={setBlocks}
      selected={selected}
      setSelected={setSelected}
      settings={PANELS}
      settingsTitle="Your profile"
      blockGroups={PROFILE_BLOCK_GROUPS}
      blockInfo={PROFILE_BLOCK_INFO}
      makeBlock={newProfileBlock}
      home={{ href: "/people/me" }}
      back={{ href: "/people/me", label: "Back to your profile" }}
      crumb={<><a href="/people/me" className="!text-slate-500 hover:underline dark:!text-neutral-400">{person.name}</a> / Page</>}
      title={person.name}
      badge={(
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${saved.custom ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"}`}>
          {saved.custom ? "Your own page" : "Default page"}
        </span>
      )}
      dirty={dirty}
      saving={saving}
      onSave={save}
      saveLabel={saved.custom ? "Save" : "Save as my page"}
      previewTo="/me"
      hero={<ProfileHero person={person} viewer={{ ...viewer, is_me: true }} coverUrl={cover.url} />}
      canvas={{ layout: draft.layout, context }}
      renderPanel={renderPanel}
      renderInspector={(block, { onChange, onRemove }) => (
        <BlockInspector block={block} uploadPath={saved.upload_path} announces={false} blockInfo={PROFILE_BLOCK_INFO}
          extraFields={extraFields} onChange={onChange} onRemove={onRemove} />
      )}
    />
  );
}
