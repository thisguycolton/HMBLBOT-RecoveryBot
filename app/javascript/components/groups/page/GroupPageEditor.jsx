import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Columns3, FileText, RotateCcw } from "lucide-react";
import { showToast } from "../../../lib/toast";
import EditorFrame from "../../events/editor/EditorFrame";
import BlockInspector, { Choice, Field } from "../../events/editor/Inspector";
import { LayoutPanel, PanelTitle } from "../../events/editor/Panels";
import { inputClass, selectClass } from "../../ui/styles";
import Toggle from "../../ui/Toggle";
import { CATEGORIES, KINDS } from "../conscience/lib";
import { api } from "../lib";
import GroupHero from "./GroupHero";
import { GROUP_BLOCK_GROUPS, GROUP_BLOCK_INFO, newGroupBlock } from "./lib";

const PANELS = [
  { key: "page", label: "Page", icon: FileText, note: "The cover across the top" },
  { key: "layout", label: "Layout", icon: Columns3, note: "How the page's columns are laid out" },
];

const formFrom = (p) => ({ layout: p.layout, blocks: p.blocks || [] });
const LIMITS = { events: [[1, "1"], [3, "3"], [6, "6"], [12, "12"]], timeline: [[5, "5"], [10, "10"], [20, "20"]], readings: [[3, "3"], [5, "5"], [10, "10"]] };
// The group's own blocks; the rest are the event page's, with their own fields
const GROUP_OWN = ["meetings", "events", "timeline", "literature", "readings", "documents", "decisions", "business_meeting", "members", "join"];
const GROUP_HINT = "{{group}} is the group's name.";

// The HMBLBOT Editor for a group's page (/groups/:slug/page/edit, its admins) or, with
// `template`, the default page AA Intergroup groups and new groups show
// (/groups/default-page/edit, site admins). Changes stay local until Save.
export default function GroupPageEditor({ template = false }) {
  const { slug } = useParams();
  const endpoint = template ? "/group_page_template" : `/groups/${slug}/page`;
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
    document.title = `${template ? "The default group page" : data.context.group.title} | HMBLBOT Editor`;
  }, [template]);

  useEffect(() => {
    api(endpoint).then((data) => {
      if (!data.can_edit) throw new Error(template ? "Only site admins can change the default page." : "Only the group's admins can edit its page.");
      adopt(data);
    }).catch((e) => setError(e.message));
  }, [endpoint, template, adopt]);

  // A group still on the default page has nothing of its own to lose; saving makes it its own
  const dirty = useMemo(() => {
    if (!saved || !draft) return false;
    return !saved.custom || JSON.stringify(draft) !== JSON.stringify(formFrom(saved)) || !!cover.file || cover.remove;
  }, [saved, draft, cover]);

  useEffect(() => {
    const warn = (e) => { if (dirty && saved?.custom) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saved]);

  const send = useCallback(async (page) => {
    setSaving(true);
    try {
      let data;
      if (cover.file || cover.remove) {
        const form = new FormData();
        form.append("page[layout]", page.layout);
        form.append("page[blocks]", JSON.stringify(page.blocks));
        if (cover.file) form.append("page[cover]", cover.file);
        if (cover.remove) form.append("page[remove_cover]", "1");
        data = await api(endpoint, { method: "PATCH", form });
      } else {
        data = await api(endpoint, { method: "PATCH", body: { page } });
      }
      adopt(data);
      return data;
    } finally {
      setSaving(false);
    }
  }, [cover, endpoint, adopt]);

  const save = useCallback(async () => {
    if (!draft || saving) return;
    try {
      await send(draft);
      showToast(template ? "Saved. Every group on the default page shows it now." : "Saved.", { tone: "success" });
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  }, [draft, saving, send, template]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [save]);

  if (error) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Can't open the editor</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-neutral-400">{error}</p>
        <a href="/groups" className="mt-4 inline-block text-sm text-accent hover:underline">Back to groups</a>
      </div>
    );
  }
  if (!draft) return <p className="py-24 text-center text-sm text-slate-500">Loading the editor…</p>;

  const group = saved.context.group;
  const context = { ...saved.context, kind: saved.kind, note_max: saved.note_max };
  const setBlocks = (fn) => setDraft((d) => ({ ...d, blocks: typeof fn === "function" ? fn(d.blocks) : fn }));
  const groupHref = template ? "/groups" : `/groups/${slug}`;

  const reset = async () => {
    if (!window.confirm("Go back to the default page? This group's own blocks and layout go away.")) return;
    setSaving(true);
    try {
      adopt(await api(endpoint, { method: "PATCH", body: { page: { reset: true } } }));
      showToast("This group shows the default page again.", { tone: "success" });
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
          {template ? (
            <p className="rounded-xl bg-accent/5 p-3 text-sm text-slate-700 ring-1 ring-accent/15 dark:bg-accent/10 dark:text-neutral-200">
              Every AA Intergroup group that isn't on RecoveryBot yet shows this page, with its own name and meetings, and so does
              every group here until its admins make their own. It's shown here with a made-up group. In headings and text,
              {" "}<code>{"{{group}}"}</code> becomes the group's name.
            </p>
          ) : !saved.custom && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-900/60">
              {group.title} shows the default page right now. Saving makes this page the group's own.
            </p>
          )}
          <CoverField cover={cover} setCover={setCover} />
          {!template && (
            <Field label="Name and description" hint="They're the group's details, shown across the cover.">
              <a href={`/groups/${slug}/edit`} className="text-sm font-medium text-accent hover:underline">Edit the group's details</a>
            </Field>
          )}
          {!template && saved.custom && (
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
    if (!GROUP_OWN.includes(block.type)) return null;
    return (
      <>
        <Field label="Title" hint={GROUP_HINT}><input className={inputClass} value={block.title || ""} onChange={(e) => set("title")(e.target.value)} maxLength={120} /></Field>
        {LIMITS[block.type] && <Field label="How many"><Choice value={block.limit} onChange={set("limit")} options={LIMITS[block.type]} /></Field>}
        {block.type === "documents" && (
          <>
            <Field label="Folder"><select className={selectClass} value={block.kind || "all"} onChange={(e) => set("kind")(e.target.value)}>
              <option value="all">All folders</option>
              {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select></Field>
            <Field label="How many"><Choice value={block.limit} onChange={set("limit")} options={[[3, "3"], [5, "5"], [10, "10"], [20, "20"]]} /></Field>
            <Toggle checked={!!block.pinned_only} onChange={set("pinned_only")} label="Pinned documents only" />
            <p className="text-xs text-slate-500 dark:text-neutral-400">Shows the documents each person may see: visitors only see ones marked Public, members also see Members ones. The block hides itself for anyone with nothing to see.</p>
          </>
        )}
        {block.type === "decisions" && (
          <>
            <Field label="Kind of decision"><select className={selectClass} value={block.category || "all"} onChange={(e) => set("category")(e.target.value)}>
              <option value="all">All kinds</option>
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select></Field>
            <Field label="How many"><Choice value={block.limit} onChange={set("limit")} options={[[3, "3"], [5, "5"], [10, "10"], [20, "20"]]} /></Field>
            <p className="text-xs text-slate-500 dark:text-neutral-400">Lists the decisions that still stand, newest first. Visitors only see ones marked Public, members also see Members ones. The block hides itself for anyone with nothing to see.</p>
          </>
        )}
        {block.type === "join" && (
          <Field label="Text" hint={`Markdown. ${GROUP_HINT} The button under it fits whoever's looking: ask to join, waiting, or already in.`}>
            <textarea className={`${inputClass} min-h-28 font-mono !text-xs`} value={block.markdown || ""} onChange={(e) => set("markdown")(e.target.value)} maxLength={2000} />
          </Field>
        )}
        {block.type === "timeline" && <p className="text-xs text-slate-500 dark:text-neutral-400">Members post notes to their own timeline and pick which groups see them, or post right here. Only members see the notes; group admins can take one down.</p>}
        {block.type === "members" && <p className="text-xs text-slate-500 dark:text-neutral-400">Members see who's in the group. Everyone else sees how many.</p>}
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
      settingsTitle={template ? "Default page" : "Page"}
      blockGroups={GROUP_BLOCK_GROUPS}
      blockInfo={GROUP_BLOCK_INFO}
      makeBlock={newGroupBlock}
      home={{ href: groupHref }}
      back={{ href: groupHref, label: template ? "Back to groups" : `Back to ${group.title}` }}
      crumb={template ? "Groups / Default page" : <><a href={groupHref} className="!text-slate-500 hover:underline dark:!text-neutral-400">{group.title}</a> / Page</>}
      title={template ? "The default group page" : group.title}
      badge={!template && (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${saved.custom ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"}`}>
          {saved.custom ? "Its own page" : "Default page"}
        </span>
      )}
      dirty={dirty}
      saving={saving}
      onSave={save}
      saveLabel={!template && !saved.custom ? "Save as our page" : "Save"}
      previewTo={template ? "/default-page" : `/${slug}`}
      hero={<GroupHero group={group} coverUrl={cover.url} note={template ? "Each group's name and details go here" : null} />}
      canvas={{ layout: draft.layout, context }}
      renderPanel={renderPanel}
      renderInspector={(block, { onChange, onRemove }) => (
        <BlockInspector
          block={block}
          uploadPath={saved.upload_path}
          announces={false}
          blockInfo={GROUP_BLOCK_INFO}
          extraFields={extraFields}
          textHint={GROUP_HINT}
          onChange={onChange}
          onRemove={onRemove}
        />
      )}
    />
  );
}

export function CoverField({ cover, setCover }) {
  const input = React.useRef(null);
  return (
    <Field label="Cover photo" hint="Across the top of the page. Without one it's the site's blue.">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => input.current?.click()} className="relative grid h-16 w-28 shrink-0 place-items-center overflow-hidden rounded-xl !bg-gradient-to-br from-accent via-sky-600 to-indigo-700 !p-0 text-white/80 ring-1 ring-neutral-200 dark:ring-neutral-700" aria-label="Upload a cover photo">
          {cover.url && <img src={cover.url} alt="" className="absolute inset-0 size-full object-cover" />}
        </button>
        <div className="flex flex-col items-start gap-1">
          <button type="button" onClick={() => input.current?.click()} className="!bg-transparent !p-0 text-sm font-medium text-accent hover:underline">{cover.url ? "Change" : "Upload"}</button>
          {cover.url && <button type="button" onClick={() => setCover({ file: null, url: null, remove: true })} className="!bg-transparent !p-0 text-sm text-slate-500 hover:text-rose-600">Remove</button>}
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) setCover({ file, url: URL.createObjectURL(file), remove: false });
      }} />
    </Field>
  );
}
