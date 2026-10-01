import React, { useEffect, useState } from "react";
import { BookOpen, CalendarClock, EyeOff, Pencil, Search, Send, Trash2 } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import SegmentedControl from "../ui/SegmentedControl";
import { inputClass } from "../ui/styles";
import { api } from "../topicificator_admin/api";
import { buttonClass } from "../topicificator_admin/App";
import { formatCount } from "./App";
import { Badge, shortDate, td, th } from "./UsersPage";

const STATUSES = [
  { value: "", label: "All" },
  { value: "published", label: "Published" },
  { value: "scheduled", label: "Scheduled" },
  { value: "draft", label: "Drafts" },
];

// Every reading, whoever wrote it. Editing opens the normal reading editor.
export default function ReadingsPage({ notify }) {
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [scheduling, setScheduling] = useState(null); // reading id
  const [data, setData] = useState(null);

  async function load() {
    try {
      setData(await api(`/readings?${new URLSearchParams({ q: search, status })}`));
    } catch (e) {
      notify(e.message, "error");
    }
  }
  useEffect(() => { load(); }, [status, search]);

  async function update(reading, body, message) {
    try {
      await api(`/readings/${reading.id}`, { method: "PATCH", body });
      notify(message);
      setScheduling(null);
      await load();
    } catch (e) {
      notify(e.message, "error");
    }
  }

  async function destroy(reading) {
    if (!window.confirm(`Delete “${reading.title}”? This can't be undone.`)) return;
    try {
      await api(`/readings/${reading.id}`, { method: "DELETE" });
      notify("Reading deleted.");
      await load();
    } catch (e) {
      notify(e.message, "error");
    }
  }

  return (
    <Shell>
      <ShellBand icon={BookOpen} title="Readings" subtitle={data ? `${formatCount(data.total)} ${data.total === 1 ? "reading" : "readings"}${data.total > data.limit ? `, showing the ${data.limit} most recently changed` : ""}` : "Loading…"} />
      <ShellPanel position="middle" className="p-4 flex flex-wrap items-center gap-3">
        <SegmentedControl options={STATUSES} value={status} onChange={setStatus} />
        <form className="flex gap-2 flex-1 min-w-[16rem]" onSubmit={(e) => { e.preventDefault(); setSearch(query.trim()); }}>
          <input className={inputClass} placeholder="Search titles" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="submit" className={buttonClass.secondary} aria-label="Search"><Search className="w-4 h-4" /></button>
        </form>
      </ShellPanel>
      <ShellPanel position="bottom" className="overflow-x-auto">
        {!data ? null : data.readings.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 !font-sans">No readings match.</p>
        ) : (
          <table className="w-full text-sm !font-sans [&_*]:!font-sans">
            <thead className="border-b border-neutral-200 dark:border-neutral-700">
              <tr>{["Reading", "Author", "Status", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {data.readings.map((r) => (
                <tr key={r.id}>
                  <td className={td}>
                    <a href={r.path} className="font-medium text-slate-900 dark:text-white hover:text-accent">{r.title || "Untitled"}</a>
                    {r.tags.length > 0 && <p className="text-slate-500">{r.tags.map((t) => t.title).join(", ")}</p>}
                  </td>
                  <td className={td}>{r.author || "—"}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    {r.status === "published" && <Badge>Published {r.published_at && shortDate(r.published_at)}</Badge>}
                    {r.status === "scheduled" && <Badge tone="warn">Goes live {new Date(r.published_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</Badge>}
                    {r.status === "draft" && <Badge tone="warn">Draft</Badge>}
                  </td>
                  <td className={`${td} text-right`}>
                    {scheduling === r.id ? (
                      <ScheduleForm onCancel={() => setScheduling(null)}
                        onSave={(at) => update(r, { published_at: at }, `“${r.title}” is scheduled.`)} />
                    ) : (
                      <div className="flex flex-wrap justify-end gap-1">
                        {r.status === "published" ? (
                          <button type="button" className={buttonClass.secondary} onClick={() => update(r, { publish: "unpublish" }, `“${r.title}” is back to a draft.`)}>
                            <EyeOff className="w-4 h-4" /> Unpublish
                          </button>
                        ) : (
                          <button type="button" className={buttonClass.secondary} onClick={() => update(r, { publish: "now" }, `“${r.title}” is published.`)}>
                            <Send className="w-4 h-4" /> Publish now
                          </button>
                        )}
                        <button type="button" className={buttonClass.secondary} onClick={() => setScheduling(r.id)} aria-label={`Schedule ${r.title}`}>
                          <CalendarClock className="w-4 h-4" />
                        </button>
                        <a href={r.edit_path} className={buttonClass.secondary} aria-label={`Edit ${r.title}`}><Pencil className="w-4 h-4" /></a>
                        <button type="button" className={buttonClass.danger} onClick={() => destroy(r)} aria-label={`Delete ${r.title}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ShellPanel>
    </Shell>
  );
}

function ScheduleForm({ onSave, onCancel }) {
  const [at, setAt] = useState("");
  return (
    <form className="flex flex-wrap justify-end gap-2" onSubmit={(e) => { e.preventDefault(); onSave(new Date(at).toISOString()); }}>
      <input type="datetime-local" required className={`${inputClass} !w-56`} value={at} onChange={(e) => setAt(e.target.value)} />
      <button type="submit" className={buttonClass.primary} disabled={!at}>Schedule</button>
      <button type="button" className={buttonClass.secondary} onClick={onCancel}>Cancel</button>
    </form>
  );
}
