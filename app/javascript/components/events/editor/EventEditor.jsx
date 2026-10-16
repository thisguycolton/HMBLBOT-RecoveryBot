import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Columns3, FileText, Inbox, Users } from "lucide-react";
import { showToast } from "../../../lib/toast";
import { api, BLOCK_GROUPS, BLOCK_INFO, newBlock, pendingUpdates } from "../lib";
import { EventHero } from "../EventLayout";
import RsvpCard from "../RsvpCard";
import EditorFrame from "./EditorFrame";
import BlockInspector from "./Inspector";
import { DangerZone, DetailsPanel, LayoutPanel, PanelTitle, PeoplePanel, RsvpsPanel } from "./Panels";

// The event's own settings, in the sidebar's "Event" section
const PANELS = [
  { key: "details", label: "Details", icon: FileText, note: "Title, when and where, cover and flyer" },
  { key: "layout", label: "Layout", icon: Columns3, note: "How the page's columns are laid out" },
  { key: "people", label: "Collaborators", icon: Users, note: "Who can edit this event" },
  { key: "rsvps", label: "RSVPs & updates", icon: Inbox, note: "Who's coming, and what went out" },
];

const formFrom = (e) => ({
  title: e.title || "", short_description: e.short_description || "", layout: e.layout, status: e.status,
  time_zone: e.time_zone, starts_at: e.starts_at || "", ends_at: e.ends_at || "", location: e.location || "",
  blocks: e.blocks || [],
});
const imagesFrom = (e) => ({ cover: { url: e.cover_url, file: null, remove: false }, flyer: { url: e.flyer_url, file: null, remove: false } });

// The HMBLBOT Editor at /events/:token/edit (its frame is ./EditorFrame): the event's
// settings and the block palette, the page as the canvas, and a panel for whatever is
// selected. Changes stay local until Save.
export default function EventEditor() {
  const { token } = useParams();
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [images, setImages] = useState(null);
  const [selected, setSelected] = useState("details");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const adopt = useCallback((data) => {
    setSaved(data);
    setDraft(formFrom(data));
    setImages(imagesFrom(data));
    document.title = `Edit ${data.title} | HMBLBOT Editor`;
  }, []);

  useEffect(() => {
    api(`/events/${token}`).then((data) => {
      if (!data.can_edit) throw new Error("Only the people running this event can edit it.");
      adopt(data);
    }).catch((e) => setError(e.message));
  }, [token, adopt]);

  const dirty = useMemo(() => {
    if (!saved || !draft) return false;
    return JSON.stringify(draft) !== JSON.stringify(formFrom(saved)) || images.cover.file || images.cover.remove || images.flyer.file || images.flyer.remove;
  }, [saved, draft, images]);

  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const pending = useMemo(() => (saved && draft && draft.status === "published" ? pendingUpdates(saved.blocks, draft.blocks) : []), [saved, draft]);

  const save = useCallback(async () => {
    if (!draft || saving) return;
    if (!draft.title.trim()) {
      setSelected("details");
      showToast("Give the event a title first.", { tone: "error" });
      return;
    }
    if (pending.length && saved.followers_count > 0) {
      const n = saved.followers_count;
      if (!window.confirm(`Saving sends ${pending.length === 1 ? "an update" : `${pending.length} updates`} to ${n} ${n === 1 ? "person" : "people"} following this event. Save and send?`)) return;
    }
    setSaving(true);
    try {
      const withFiles = images.cover.file || images.flyer.file || images.cover.remove || images.flyer.remove;
      let data;
      if (withFiles) {
        const form = new FormData();
        for (const [key, value] of Object.entries(draft)) form.append(`event[${key}]`, key === "blocks" ? JSON.stringify(value) : value ?? "");
        for (const name of ["cover", "flyer"]) {
          if (images[name].file) form.append(`event[${name}]`, images[name].file);
          if (images[name].remove) form.append(`event[remove_${name}]`, "1");
        }
        data = await api(`/events/${token}`, { method: "PATCH", form });
      } else {
        data = await api(`/events/${token}`, { method: "PATCH", body: { event: draft } });
      }
      adopt(data);
      const sent = data.sent_updates?.length || 0;
      showToast(sent ? `Saved, and sent ${sent === 1 ? "an update" : `${sent} updates`}.` : "Saved.", { tone: "success" });
    } catch (e) {
      showToast(e.message, { tone: "error" });
    } finally {
      setSaving(false);
    }
  }, [draft, saving, pending, saved, images, token, adopt]);

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

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setBlocks = (fn) => setDraft((d) => ({ ...d, blocks: typeof fn === "function" ? fn(d.blocks) : fn }));
  const preview = { ...saved, ...draft, cover_url: images.cover.url, flyer_url: images.flyer.url, when_label: whenLabel(draft) };
  const settings = PANELS.map((p) => ({ ...p, count: p.key === "rsvps" ? saved.counts.going : null }));

  const renderPanel = (key, panel) => (
    <>
      <PanelTitle icon={panel.icon} title={panel.label} note={panel.note} />
      {key === "details" && (
        <>
          <DetailsPanel draft={draft} set={set} images={images} setImages={setImages} max={saved.short_description_max} />
          {saved.can_manage && (
            <div className="mt-6 border-t border-slate-200 pt-4 dark:border-neutral-800">
              <DangerZone onDelete={async () => {
                if (!window.confirm(`Delete “${saved.title}”? Its RSVPs and updates go too.`)) return;
                try {
                  await api(`/events/${token}`, { method: "DELETE" });
                  window.location.href = `/groups/${saved.group.slug}/events`;
                } catch (e) { showToast(e.message, { tone: "error" }); }
              }} />
            </div>
          )}
        </>
      )}
      {key === "layout" && <LayoutPanel value={draft.layout} onChange={(layout) => set({ layout })} />}
      {key === "people" && <PeoplePanel event={saved} setEvent={(data) => { setSaved(data); }} />}
      {key === "rsvps" && <RsvpsPanel event={saved} />}
    </>
  );

  return (
    <EditorFrame
      blocks={draft.blocks}
      setBlocks={setBlocks}
      selected={selected}
      setSelected={setSelected}
      settings={settings}
      settingsTitle="Event"
      blockGroups={BLOCK_GROUPS}
      blockInfo={BLOCK_INFO}
      makeBlock={newBlock}
      home={{ href: `/groups/${saved.group.slug}` }}
      back={{ href: `/groups/${saved.group.slug}/events`, label: `Back to ${saved.group.title}` }}
      crumb={<><a href={`/groups/${saved.group.slug}/events`} className="!text-slate-500 hover:underline dark:!text-neutral-400">{saved.group.title}</a> / Events</>}
      title={draft.title || "Untitled event"}
      badge={
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${draft.status === "published" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"}`}>
          {draft.status === "published" ? "Published" : "Draft"}
        </span>
      }
      dirty={dirty}
      saving={saving}
      onSave={save}
      saveLabel={pending.length && saved.followers_count ? "Save & send" : "Save"}
      previewTo={`/${token}`}
      hero={<EventHero event={preview} groupLink={false} aside={<RsvpCard event={preview} setEvent={() => {}} preview />} />}
      canvas={{ layout: draft.layout, polls: saved.polls }}
      renderPanel={renderPanel}
      renderInspector={(block, { onChange, onRemove }) => (
        <BlockInspector
          block={block}
          uploadPath={`/events/${token}/images`}
          pollsFor={token}
          followers={saved.followers_count}
          changed={pending.includes(block.id)}
          onChange={onChange}
          onRemove={onRemove}
        />
      )}
    />
  );
}

// The details line while editing, before the server has worded it
function whenLabel(draft) {
  if (!draft.starts_at) return null;
  const start = new Date(draft.starts_at);
  const opts = { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" };
  let label = start.toLocaleString([], opts);
  if (draft.ends_at) {
    const end = new Date(draft.ends_at);
    label += ` – ${end.toDateString() === start.toDateString() ? end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : end.toLocaleString([], opts)}`;
  }
  return label;
}
