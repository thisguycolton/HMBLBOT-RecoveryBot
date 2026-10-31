import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, FileUp, Link2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import SegmentedControl from "../ui/SegmentedControl";
import { inputClass, labelClass, selectClass } from "../ui/styles";
import { api } from "../topicificator_admin/api";
import { typeLabel } from "../groups/lib";
import { buttonClass } from "../topicificator_admin/App";
import { formatCount } from "./App";
import { Badge, shortDate } from "./UsersPage";

const ZONES = ["America/Phoenix", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "Pacific/Honolulu", "America/Anchorage"];

const STATUS_LABELS = {
  new: "New",
  changed: "Changed",
  same: "No change",
  hidden: "Was taken off",
  skipped: "Can't use",
  missing: "Gone from source",
};

// Local meeting lists (MeetingListImport): an intergroup's in-person meetings, from its
// Meeting Guide feed link or a JSON or CSV file, shown in Find a meeting next to AA
// Intergroup's. Import previews first; nothing is deleted, and listings gone from the
// source stay listed unless you tick them to take them off.
export default function MeetingListsPage({ notify }) {
  const [lists, setLists] = useState(null);
  const [editing, setEditing] = useState(null); // list id or "new"
  const [importing, setImporting] = useState(null); // list id

  async function load() {
    try {
      setLists(await api("/meeting_directories"));
    } catch (e) {
      notify(e.message, "error");
    }
  }
  useEffect(() => { load(); }, []);

  async function save(id, values) {
    try {
      const saved = id === "new"
        ? await api("/meeting_directories", { method: "POST", body: { meeting_directory: values } })
        : await api(`/meeting_directories/${id}`, { method: "PATCH", body: { meeting_directory: values } });
      setEditing(null);
      notify(id === "new" ? "List added. Import its meetings next." : "Saved.");
      await load();
      if (id === "new") setImporting(saved.id);
    } catch (e) {
      notify(e.message, "error");
    }
  }

  async function destroy(list) {
    if (!window.confirm(`Remove the list “${list.name}”?`)) return;
    try {
      await api(`/meeting_directories/${list.id}`, { method: "DELETE" });
      notify("List removed.");
      await load();
    } catch (e) {
      notify(e.message, "error");
    }
  }

  if (!lists) return <p className="py-16 text-center text-slate-500 dark:text-neutral-400 !font-sans">Loading…</p>;

  return (
    <Shell className="max-w-5xl">
      <ShellBand
        icon={MapPin}
        title="Meeting lists"
        subtitle="In-person meetings from local intergroups, shown in Find a meeting next to AA Intergroup's online ones"
      />
      {lists.length === 0 && editing !== "new" && (
        <ShellPanel position="middle" className="p-5">
          <p className="text-sm text-slate-600 dark:text-neutral-400 !font-sans">
            No lists yet. Add one for an area intergroup, then import its meetings from its Meeting Guide feed link (most intergroup
            websites have one) or from a JSON or CSV file.
          </p>
        </ShellPanel>
      )}
      {lists.map((list) => (
        <ShellPanel key={list.id} position="middle" className="p-4">
          {editing === list.id ? (
            <ListForm list={list} onSave={(v) => save(list.id, v)} onCancel={() => setEditing(null)} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white !font-sans">
                    {list.name}
                    {list.website && (
                      <a href={list.website} target="_blank" rel="noreferrer" className="ml-2 inline-flex text-slate-400 hover:text-accent" aria-label="Website">
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-neutral-400 !font-sans">
                    {formatCount(list.listed)} listed
                    {list.hidden > 0 && ` · ${formatCount(list.hidden)} taken off`}
                    {list.linked > 0 && ` · used by ${list.linked} ${list.linked === 1 ? "group" : "groups"}`}
                    {" · "}
                    {list.imported_at ? `imported ${shortDate(list.imported_at)}${list.imported_by ? ` by ${list.imported_by}` : ""}` : "not imported yet"}
                  </p>
                </div>
                <button type="button" className={buttonClass.primary} onClick={() => setImporting(importing === list.id ? null : list.id)}>
                  <FileUp className="size-4" /> {importing === list.id ? "Close import" : "Import"}
                </button>
                <button type="button" className={buttonClass.secondary} onClick={() => setEditing(list.id)} aria-label={`Edit ${list.name}`}>
                  <Pencil className="size-4" />
                </button>
                {list.listed + list.hidden === 0 && (
                  <button type="button" className={buttonClass.danger} onClick={() => destroy(list)} aria-label={`Remove ${list.name}`}>
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              {importing === list.id && <ImportPanel list={list} notify={notify} onDone={load} />}
            </>
          )}
        </ShellPanel>
      ))}
      <ShellPanel position="bottom" className="p-4">
        {editing === "new" ? (
          <ListForm list={{ name: "", key: "", feed_url: "", website: "", time_zone: "America/Phoenix" }} onSave={(v) => save("new", v)} onCancel={() => setEditing(null)} />
        ) : (
          <button type="button" className={buttonClass.secondary} onClick={() => setEditing("new")}>
            <Plus className="size-4" /> Add a meeting list
          </button>
        )}
      </ShellPanel>
    </Shell>
  );
}

function ListForm({ list, onSave, onCancel }) {
  const [values, setValues] = useState(list);
  const set = (k) => (e) => setValues({ ...values, [k]: e.target.value });
  const isNew = !list.id;
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => { e.preventDefault(); onSave(values); }}
    >
      <label className="block">
        <span className={labelClass}>Name people see</span>
        <input className={inputClass} value={values.name} onChange={set("name")} placeholder="Phoenix Area Intergroup" required />
      </label>
      <label className="block">
        <span className={labelClass}>Short key {isNew ? "(goes in its meetings' links)" : "(can't change)"}</span>
        <input className={inputClass} value={values.key} onChange={set("key")} placeholder="phx" disabled={!isNew} />
      </label>
      <label className="block sm:col-span-2">
        <span className={labelClass}>Meeting Guide feed link (optional)</span>
        <input className={inputClass} value={values.feed_url || ""} onChange={set("feed_url")} placeholder="https://example.org/wp-admin/admin-ajax.php?action=meetings" />
      </label>
      <label className="block">
        <span className={labelClass}>Website (optional)</span>
        <input className={inputClass} value={values.website || ""} onChange={set("website")} placeholder="https://example.org" />
      </label>
      <label className="block">
        <span className={labelClass}>Time zone, for meetings that don't say</span>
        <select className={selectClass} value={values.time_zone} onChange={set("time_zone")}>
          {[...new Set([values.time_zone, ...ZONES])].map((z) => <option key={z} value={z}>{z.replace("_", " ")}</option>)}
        </select>
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className={buttonClass.primary}>{isNew ? "Add list" : "Save"}</button>
        <button type="button" className={buttonClass.secondary} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// Pick the source, preview, tick what to import, import
function ImportPanel({ list, notify, onDone }) {
  const [mode, setMode] = useState(list.feed_url ? "url" : "file");
  const [url, setUrl] = useState(list.feed_url || "");
  const [file, setFile] = useState(null); // { name, text }
  const [preview, setPreview] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [hide, setHide] = useState(new Set());
  const [tab, setTab] = useState("new");
  const [busy, setBusy] = useState(false);

  const source = mode === "url" ? { url } : { text: file?.text };

  async function readFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile({ name: f.name, text: await f.text() });
    setPreview(null);
  }

  async function runPreview() {
    setBusy(true);
    try {
      const data = await api(`/meeting_directories/${list.id}/preview`, { method: "POST", body: source });
      setPreview(data);
      setPicked(new Set(data.rows.filter((r) => r.selected).map((r) => r.key)));
      setHide(new Set());
      setTab(["new", "changed", "missing", "skipped", "same"].find((s) => data.counts[s]) || "new");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    setBusy(true);
    try {
      const result = await api(`/meeting_directories/${list.id}/import`, { method: "POST", body: { ...source, keys: [...picked], hide: [...hide] } });
      notify(`Imported ${result.saved} ${result.saved === 1 ? "meeting" : "meetings"}${result.hidden ? `, took ${result.hidden} off` : ""}.`);
      setPreview(null);
      onDone();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  const rows = useMemo(() => {
    if (!preview) return [];
    if (tab === "missing") return preview.missing.map((m) => ({ ...m, status: "missing" }));
    if (tab === "duplicates") return preview.rows.filter((r) => r.duplicates?.length);
    return preview.rows.filter((r) => r.status === tab);
  }, [preview, tab]);

  const toggle = (set, setter, key) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setter(next);
  };
  const dupCount = preview ? preview.rows.filter((r) => r.duplicates?.length).length : 0;
  const tabs = preview
    ? [
        ...["new", "changed", "same", "hidden", "skipped", "missing"].filter((s) => preview.counts[s]).map((s) => ({ value: s, label: `${STATUS_LABELS[s]} ${preview.counts[s]}` })),
        ...(dupCount ? [{ value: "duplicates", label: `Maybe already listed ${dupCount}` }] : []),
      ]
    : [];
  const selectable = (row) => !["skipped", "same", "missing"].includes(row.status);

  return (
    <div className="mt-4 space-y-4 border-t border-slate-200 pt-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-full sm:w-80 rounded-xl border border-slate-200 overflow-hidden dark:border-neutral-700">
          <SegmentedControl options={[{ value: "url", label: "Feed link" }, { value: "file", label: "JSON or CSV file" }]} value={mode} onChange={(m) => { setMode(m); setPreview(null); }} />
        </div>
        {mode === "url" ? (
          <input className={`${inputClass} flex-1 min-w-[16rem]`} value={url} onChange={(e) => { setUrl(e.target.value); setPreview(null); }} placeholder="https://…" />
        ) : (
          <label className={`${buttonClass.secondary} cursor-pointer`}>
            <FileUp className="size-4" /> {file ? file.name : "Choose a file"}
            <input type="file" accept=".json,.csv,application/json,text/csv" className="hidden" onChange={readFile} />
          </label>
        )}
        <button type="button" className={buttonClass.secondary} onClick={runPreview} disabled={busy || (mode === "url" ? !url : !file)}>
          {busy && !preview ? "Reading…" : "Preview"}
        </button>
      </div>
      <p className="text-xs text-slate-500 dark:text-neutral-400 !font-sans">
        A CSV needs Name, Day and Time columns; it can also have End Time, Location, Address, City, State, Postal Code, Types,
        Notes, Location Notes, Group, Region and Conference URL (the columns 12 Step Meeting List exports). Nothing is saved until you import.
      </p>

      {preview && (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 overflow-hidden dark:border-neutral-700">
            <SegmentedControl options={tabs} value={tab} onChange={setTab} />
          </div>
          <TabNote tab={tab} />
          {rows.length > 0 && selectable(rows[0]) && (
            <div className="flex gap-2 text-sm">
              <button type="button" className="!bg-transparent text-accent hover:underline" onClick={() => setPicked(new Set([...picked, ...rows.filter(selectable).map((r) => r.key)]))}>Tick all</button>
              <button type="button" className="!bg-transparent text-accent hover:underline" onClick={() => { const n = new Set(picked); rows.forEach((r) => n.delete(r.key)); setPicked(n); }}>Untick all</button>
            </div>
          )}
          <ul className="[&_*]:!font-sans max-h-[32rem] overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-neutral-800 dark:border-neutral-800">
            {rows.length === 0 && <li className="p-4 text-sm text-slate-500 !font-sans">Nothing here.</li>}
            {rows.map((row, i) => (
              <PreviewRow
                key={`${row.key}-${i}`}
                row={row}
                checked={row.status === "missing" ? hide.has(row.key) : picked.has(row.key)}
                onToggle={row.status === "missing" ? () => toggle(hide, setHide, row.key) : selectable(row) ? () => toggle(picked, setPicked, row.key) : null}
              />
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={buttonClass.primary} onClick={runImport} disabled={busy || (picked.size === 0 && hide.size === 0)}>
              {busy ? "Importing…" : `Import ${picked.size} ${picked.size === 1 ? "meeting" : "meetings"}${hide.size ? ` and take ${hide.size} off` : ""}`}
            </button>
            <span className="text-sm text-slate-500 dark:text-neutral-400 !font-sans">New and changed meetings are ticked; possible duplicates aren't.</span>
          </div>
        </>
      )}
    </div>
  );
}

function TabNote({ tab }) {
  const notes = {
    new: "Not on this list yet. Ones that look like a meeting already in Find a meeting are left unticked.",
    changed: "Already imported; the source has new details for them.",
    same: "Already imported, and nothing changed.",
    hidden: "You took these off before; tick one to list it again.",
    skipped: "These rows can't be imported as they are.",
    missing: "Imported before but not in this source anymore. They stay listed unless you tick them to take them off. Groups linked to one keep their meeting either way.",
    duplicates: "These look like meetings already in Find a meeting: an AA Intergroup listing, another list's, or a group's own. Tick one only if it's really a different meeting.",
  };
  return <p className="text-sm text-slate-600 dark:text-neutral-400 !font-sans">{notes[tab]}</p>;
}

function PreviewRow({ row, checked, onToggle }) {
  const l = row.listing;
  return (
    <li className="flex gap-3 p-3">
      <input type="checkbox" className="mt-1" checked={checked} disabled={!onToggle} onChange={onToggle || undefined} aria-label={l.name || "Meeting"} />
      <div className="flex-1 min-w-0 text-sm !font-sans">
        <p className="font-semibold text-slate-900 dark:text-white">
          {l.name || "No name"}
          {l.group_name && l.group_name !== l.name && <span className="font-normal text-slate-500"> · {l.group_name}</span>}
        </p>
        <p className="text-slate-600 dark:text-neutral-400">
          {l.schedule}
          {l.attendance && ` · ${l.attendance.replace("_", " ")}`}
          {l.types?.length > 0 && ` · ${l.types.map(typeLabel).join(", ")}`}
        </p>
        {(l.location || l.address) && <p className="text-slate-600 dark:text-neutral-400"><MapPin className="inline size-3.5 mr-1" />{[l.location, l.address].filter(Boolean).join(", ")}</p>}
        {l.conference_url && <p className="text-slate-500 truncate"><Link2 className="inline size-3.5 mr-1" />{l.conference_url}</p>}
        {row.reason && <p className="mt-1 text-amber-700 dark:text-amber-300"><AlertTriangle className="inline size-3.5 mr-1" />{row.reason}</p>}
        {row.changes?.length > 0 && <p className="mt-1">{row.changes.map((c) => <Badge key={c}>{c.replaceAll("_", " ")}</Badge>)}</p>}
        {row.linked > 0 && <p className="mt-1 text-slate-500">Used by {row.linked} {row.linked === 1 ? "group" : "groups"}</p>}
        {row.duplicates?.map((d) => (
          <p key={d.href + d.name} className="mt-1 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="inline size-3.5 mr-1" />
            Maybe <a href={d.href} target="_blank" rel="noreferrer" className="underline">{d.name}</a> ({d.source}, {d.schedule}): {d.reason}
          </p>
        ))}
      </div>
    </li>
  );
}
