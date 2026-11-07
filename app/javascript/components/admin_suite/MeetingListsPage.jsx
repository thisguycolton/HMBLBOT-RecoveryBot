import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FileUp, Link2, ListPlus, MapPin, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import SegmentedControl from "../ui/SegmentedControl";
import { inputClass, labelClass, selectClass } from "../ui/styles";
import { api } from "../topicificator_admin/api";
import { typeLabel } from "../groups/lib";
import { buttonClass } from "../topicificator_admin/App";
import { formatCount } from "./App";
import { Badge, shortDate } from "./UsersPage";
import Skeleton from "../ui/Skeleton";

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
// source stay listed unless you tick them to take them off. Lists with a feed link refresh
// weekly on their own (MeetingListRefresh): new and changed meetings only.
export default function MeetingListsPage({ notify }) {
  const [lists, setLists] = useState(null);
  const [editing, setEditing] = useState(null); // list id or "new"
  const [importing, setImporting] = useState(null); // list id
  const [adding, setAdding] = useState(false); // the add-many panel
  const [refreshing, setRefreshing] = useState(null); // list id

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

  async function refresh(list) {
    setRefreshing(list.id);
    try {
      const saved = await api(`/meeting_directories/${list.id}/refresh`, { method: "POST" });
      notify(saved.refresh_status === "error" ? `Couldn't refresh ${list.name}.` : `Refreshed ${list.name}.`, saved.refresh_status === "error" ? "error" : undefined);
      await load();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setRefreshing(null);
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

  if (!lists) return <Skeleton variant="list" className="max-w-3xl" />;

  return (
    <Shell className="max-w-5xl">
      <ShellBand
        icon={MapPin}
        title="Meeting lists"
        subtitle="In-person meetings from local intergroups, shown in Find a meeting next to AA Intergroup's online ones"
      />
      <ShellPanel position="middle" className="p-4">
        {adding ? (
          <BulkAdd notify={notify} onDone={load} onCancel={() => setAdding(false)} />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 min-w-[14rem] text-sm text-slate-600 dark:text-neutral-400 !font-sans">
              Lists with a feed link refresh every week on their own: new and changed meetings are added, and anything that
              needs a look (possible duplicates, meetings gone from the feed) waits for you here.
            </p>
            <button type="button" className={buttonClass.secondary} onClick={() => setAdding(true)}>
              <ListPlus className="size-4" /> Add many at once
            </button>
          </div>
        )}
      </ShellPanel>
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
                  <RefreshLine list={list} onReview={() => setImporting(list.id)} />
                </div>
                {list.feed_url && (
                  <button type="button" className={buttonClass.secondary} onClick={() => refresh(list)} disabled={refreshing === list.id || list.refreshing} aria-label={`Refresh ${list.name} now`} title="Refresh now">
                    <RefreshCw className={`size-4 ${refreshing === list.id || list.refreshing ? "animate-spin" : ""}`} />
                  </button>
                )}
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
          <ListForm list={{ name: "", key: "", feed_url: "", website: "", time_zone: "America/Phoenix", auto_refresh: true }} onSave={(v) => save("new", v)} onCancel={() => setEditing(null)} />
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
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-300 !font-sans sm:col-span-2">
        <input type="checkbox" checked={values.auto_refresh !== false} onChange={(e) => setValues({ ...values, auto_refresh: e.target.checked })} />
        Refresh from the feed link every week (new and changed meetings only)
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
  const [blocked, setBlocked] = useState(null); // the feed link a site's bot protection turned away

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
      if (e.data?.blocked && mode === "url") {
        setBlocked(url);
        setMode("file");
      }
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
            <input type="file" accept=".json,.csv,.txt,.html,application/json,text/csv,text/plain,text/html" className="hidden" onChange={readFile} />
          </label>
        )}
        <button type="button" className={buttonClass.secondary} onClick={runPreview} disabled={busy || (mode === "url" ? !url : !file)}>
          {busy && !preview ? "Reading…" : "Preview"}
        </button>
      </div>
      {blocked && mode === "file" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 !font-sans">
          <AlertTriangle className="inline size-4 mr-1" />
          That site's bot protection won't let us read the feed link. Open{" "}
          <a href={blocked} target="_blank" rel="noopener noreferrer" className="underline">the feed in your browser</a>, save the page
          as a .json file (File, Save Page As), then choose that file here. The weekly refresh can't read it either, so import a fresh
          file now and then.
        </div>
      )}
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

function plural(n, one, many = `${one}s`) {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

// How the list's weekly refresh went, and when it runs next
function RefreshLine({ list, onReview }) {
  const muted = "text-sm text-slate-500 dark:text-neutral-400 !font-sans";
  if (!list.feed_url) return <p className={muted}>No feed link, so it only updates when you import.</p>;
  if (!list.auto_refresh) return <p className={muted}>Weekly refresh is off.</p>;
  if (list.refreshing) return <p className={muted}>Refreshing now…</p>;
  if (!list.refreshed_at) return <p className={muted}>First refresh is on its way (within the hour).</p>;

  const r = list.refresh_result || {};
  const when = `Refreshed ${shortDate(list.refreshed_at)}`;
  const next = list.next_refresh_at ? `, next ${shortDate(list.next_refresh_at)}` : "";
  if (list.refresh_status === "error") {
    return (
      <p className="text-sm text-red-700 dark:text-red-300 !font-sans">
        <AlertTriangle className="inline size-3.5 mr-1" />
        Last refresh failed {shortDate(list.refreshed_at)}: {list.refresh_error}. It tries again daily.
      </p>
    );
  }
  const added = [r.new ? `${formatCount(r.new)} new` : null, r.changed ? `${formatCount(r.changed)} changed` : null].filter(Boolean).join(", ") || "no changes";
  const review = [
    r.duplicates ? `${plural(r.duplicates, "possible duplicate")}` : null,
    r.missing ? `${plural(r.missing, "meeting")} gone from the feed` : null,
  ].filter(Boolean).join(" and ");
  return (
    <p className={muted}>
      {list.refresh_status === "review" ? <AlertTriangle className="inline size-3.5 mr-1 text-amber-600" /> : <CheckCircle2 className="inline size-3.5 mr-1 text-emerald-600" />}
      {when}: {added}{next}.
      {list.refresh_status === "review" && review && (
        <>
          {" "}<span className="text-amber-700 dark:text-amber-300">{review} to look over.</span>{" "}
          <button type="button" className="!bg-transparent text-accent hover:underline" onClick={onReview}>Review</button>
        </>
      )}
      {list.refresh_status === "reviewed" && " Reviewed since."}
    </p>
  );
}

// Paste many intergroups' feed links at once, one per line
function BulkAdd({ notify, onDone, onCancel }) {
  const [text, setText] = useState("");
  const [zone, setZone] = useState("America/Phoenix");
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState([]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await api("/meeting_directories/bulk", { method: "POST", body: { text, time_zone: zone } });
      setSkipped(result.skipped);
      const n = result.added.length;
      notify(n ? `Added ${plural(n, "list")}. Their meetings import in the background.` : "No lists added.", n ? undefined : "error");
      if (n) setText(result.skipped.map((s) => s.line).join("\n"));
      onDone();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <label className="block">
        <span className={labelClass}>One intergroup per line: name, then its feed link (the name is optional)</span>
        <textarea
          className={`${inputClass} font-mono text-xs min-h-[10rem]`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Phoenix Area Intergroup, https://example.org/wp-admin/admin-ajax.php?action=meetings\nEast Valley Intergroup, https://example.com/meetings.json, America/Phoenix\nhttps://example.net/wp-admin/admin-ajax.php?action=meetings"}
          required
        />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className={labelClass}>Time zone, for lines that don't say</span>
          <select className={selectClass} value={zone} onChange={(e) => setZone(e.target.value)}>
            {ZONES.map((z) => <option key={z} value={z}>{z.replace("_", " ")}</option>)}
          </select>
        </label>
        <button type="submit" className={buttonClass.primary} disabled={busy || !text.trim()}>{busy ? "Adding…" : "Add lists"}</button>
        <button type="button" className={buttonClass.secondary} onClick={onCancel}>Close</button>
      </div>
      <p className="text-xs text-slate-500 dark:text-neutral-400 !font-sans">
        Commas, tabs or semicolons can separate the columns, so rows copied from a spreadsheet work. Links already added are skipped.
        Each new list imports its new meetings within a few minutes and then refreshes weekly; possible duplicates are left for you to review.
      </p>
      {skipped.length > 0 && (
        <ul className="text-sm text-amber-700 dark:text-amber-300 !font-sans space-y-1">
          {skipped.map((s, i) => <li key={i}><AlertTriangle className="inline size-3.5 mr-1" />{s.reason}: <span className="font-mono text-xs">{s.line}</span></li>)}
        </ul>
      )}
      <details className="text-sm text-slate-600 dark:text-neutral-400 !font-sans">
        <summary className="cursor-pointer font-medium text-slate-800 dark:text-neutral-200">Where to find an intergroup's feed link</summary>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>Most intergroup websites run the 12 Step Meeting List plugin for WordPress. Its feed is the site's address followed by <span className="font-mono text-xs">/wp-admin/admin-ajax.php?action=meetings</span>. Open that in a browser: a page full of meeting data means it works.</li>
          <li>These are Meeting Guide feeds, the same ones the Meeting Guide app reads. If an area's meetings show up in that app, its intergroup has a feed.</li>
          <li>A page that links to a .json file works too; we follow the link.</li>
          <li>If a site turns its feed off or needs a key, ask the intergroup's webmaster for the Meeting Guide feed link, or download their meeting list as a CSV and use Import on that list instead.</li>
        </ul>
      </details>
    </form>
  );
}
