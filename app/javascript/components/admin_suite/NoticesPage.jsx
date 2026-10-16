import React, { useEffect, useState } from "react";
import { Check, Eye, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import SegmentedControl from "../ui/SegmentedControl";
import { inputClass, labelClass } from "../ui/styles";
import { api } from "../topicificator_admin/api";
import { buttonClass } from "../topicificator_admin/App";
import { NoticeCard, NoticeModal } from "../SiteNotices";

const TONES = [
  { value: "info", label: "Info" },
  { value: "success", label: "Good news" },
  { value: "warning", label: "Heads up" },
];

const AUDIENCES = [
  { value: "everyone", label: "Everyone" },
  { value: "members", label: "Members" },
  { value: "guests", label: "Signed out" },
];

const AUDIENCE_LABEL = { everyone: "everyone", members: "signed-in members", guests: "people who aren't signed in" };

const BLANK = {
  title: "", summary: "", body: "", tone: "info", link_url: "", link_label: "",
  audience: "everyone", active: true, starts_at: null, ends_at: null,
};

// ISO <-> the local "YYYY-MM-DDTHH:mm" a datetime-local input takes
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);

const when = (iso) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function status(notice) {
  if (!notice.active) return { label: "Off", cls: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200" };
  if (notice.live) return { label: "Showing", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200" };
  if (notice.starts_at && new Date(notice.starts_at) > new Date()) return { label: `Starts ${when(notice.starts_at)}`, cls: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200" };
  return { label: "Ended", cls: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200" };
}

// Site-wide notices: a toast on every page (components/SiteNotices.jsx) that readers can
// close for a day, with an optional write-up that opens in a modal.
export default function NoticesPage({ notify }) {
  const [notices, setNotices] = useState(null);
  const [editing, setEditing] = useState(null); // notice id, or "new"
  const [previewing, setPreviewing] = useState(null); // a notice whose write-up modal is open

  async function load() {
    try {
      setNotices(await api("/site_notices"));
    } catch (e) {
      notify(e.message, "error");
    }
  }
  useEffect(() => { load(); }, []);

  async function save(id, values, message) {
    try {
      if (id === "new") await api("/site_notices", { method: "POST", body: { site_notice: values } });
      else await api(`/site_notices/${id}`, { method: "PATCH", body: { site_notice: values } });
      setEditing(null);
      notify(message || (id === "new" ? "Notice posted." : "Notice saved. Anyone who closed it will see it again."));
      await load();
    } catch (e) {
      notify(e.message, "error");
    }
  }

  async function toggle(notice) {
    await save(notice.id, { active: !notice.active }, notice.active ? "Notice turned off." : "Notice turned on.");
  }

  async function destroy(notice) {
    if (!window.confirm(`Delete the notice “${notice.title}”? Its write-up goes too.`)) return;
    try {
      await api(`/site_notices/${notice.id}`, { method: "DELETE" });
      notify("Notice deleted.");
      await load();
    } catch (e) {
      notify(e.message, "error");
    }
  }

  if (!notices) return <p className="py-16 text-center text-slate-500 dark:text-neutral-400 !font-sans">Loading…</p>;

  const live = notices.filter((n) => n.live).length;
  return (
    <>
    {previewing && <NoticeModal notice={previewing} onClose={() => setPreviewing(null)} />}
    <Shell className="max-w-3xl">
      <ShellBand
        icon={Megaphone}
        title="Site notices"
        subtitle={`${live} showing now · a toast on every page; closing one hides it for a day`}
      />
      {notices.length === 0 && editing !== "new" && (
        <ShellPanel position="middle" className="p-6 text-center text-sm text-slate-600 dark:text-neutral-400 !font-sans">
          No notices yet. Post one to tell everyone about a new feature, a schedule change or an outage.
        </ShellPanel>
      )}
      {notices.map((notice) => {
        const s = status(notice);
        return (
          <ShellPanel key={notice.id} position="middle" className="p-4">
            {editing === notice.id ? (
              <NoticeForm notice={notice} onSave={(v) => save(notice.id, v)} onCancel={() => setEditing(null)} />
            ) : (
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0 !font-sans">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{notice.title}</div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                  </div>
                  {notice.summary && <div className="text-sm text-slate-600 dark:text-neutral-400">{notice.summary}</div>}
                  <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                    For {AUDIENCE_LABEL[notice.audience]}
                    {notice.ends_at && ` · until ${when(notice.ends_at)}`}
                    {notice.body ? " · has a write-up" : notice.link_url ? " · links out" : ""}
                    {notice.author && ` · by ${notice.author}`}
                  </div>
                </div>
                {notice.body && (
                  <button type="button" onClick={() => setPreviewing(notice)} className={buttonClass.secondary} aria-label="View the write-up" title="View the write-up">
                    <Eye className="w-4 h-4" />
                  </button>
                )}
                <button type="button" className={buttonClass.secondary} onClick={() => toggle(notice)}>
                  {notice.active ? "Turn off" : "Turn on"}
                </button>
                <button type="button" className={buttonClass.secondary} onClick={() => setEditing(notice.id)} aria-label={`Edit ${notice.title}`}>
                  <Pencil className="w-4 h-4" />
                </button>
                <button type="button" className={buttonClass.danger} onClick={() => destroy(notice)} aria-label={`Delete ${notice.title}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </ShellPanel>
        );
      })}
      <ShellPanel position="bottom" className="p-4">
        {editing === "new" ? (
          <NoticeForm notice={BLANK} onSave={(v) => save("new", v)} onCancel={() => setEditing(null)} />
        ) : (
          <button type="button" className={buttonClass.primary} onClick={() => setEditing("new")}>
            <Plus className="w-4 h-4" strokeWidth={2.5} /> New notice
          </button>
        )}
      </ShellPanel>
    </Shell>
    </>
  );
}

function NoticeForm({ notice, onSave, onCancel }) {
  const [v, setV] = useState({
    ...BLANK,
    ...notice,
    summary: notice.summary || "",
    body: notice.body || "",
    link_url: notice.link_url || "",
    link_label: notice.link_label || "",
  });
  const set = (key) => (e) => setV((prev) => ({ ...prev, [key]: e?.target ? e.target.value : e }));

  const submit = (e) => {
    e.preventDefault();
    onSave({
      title: v.title, summary: v.summary, body: v.body, tone: v.tone, link_url: v.link_url, link_label: v.link_label,
      audience: v.audience, active: v.active, starts_at: v.starts_at, ends_at: v.ends_at,
    });
  };

  // what the toast will look like
  const [showModal, setShowModal] = useState(false);
  const preview = {
    id: "preview", title: v.title || "Your headline", summary: v.summary, tone: v.tone,
    body: v.body.trim() || null, link_url: v.link_url || null, link_label: v.link_label || null,
    published_at: v.starts_at || new Date().toISOString(),
  };

  return (
    <form className="grid gap-4 !font-sans" onSubmit={submit}>
      <label className="block">
        <span className={labelClass}>Headline</span>
        <input className={inputClass} value={v.title} onChange={set("title")} maxLength={120} autoFocus required placeholder="New: highlights and notes in the library" />
      </label>
      <label className="block">
        <span className={labelClass}>One line under it (optional)</span>
        <input className={inputClass} value={v.summary} onChange={set("summary")} maxLength={240} placeholder="Sign in to save passages and share them with your group." />
      </label>
      <div>
        <span className={labelClass}>Tone</span>
        <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700">
          <SegmentedControl options={TONES} value={v.tone} onChange={set("tone")} />
        </div>
      </div>
      <label className="block">
        <span className={labelClass}>Write-up (optional, Markdown)</span>
        <textarea
          className={`${inputClass} min-h-40 font-mono`}
          value={v.body}
          onChange={set("body")}
          placeholder={"The longer story. The toast's \"Read more\" opens it in a pop-up.\n\n**Bold**, *italic*, [links](https://…), - lists and # headings work."}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Link {v.body.trim() ? "(button at the end of the write-up)" : "(the toast opens it)"}</span>
          <input className={inputClass} value={v.link_url} onChange={set("link_url")} placeholder="/library or https://…" />
        </label>
        <label className="block">
          <span className={labelClass}>Link text</span>
          <input className={inputClass} value={v.link_label} onChange={set("link_label")} placeholder="Open" />
        </label>
      </div>
      <div>
        <span className={labelClass}>Who sees it</span>
        <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700">
          <SegmentedControl options={AUDIENCES} value={v.audience} onChange={set("audience")} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Starts (blank = now)</span>
          <input type="datetime-local" className={inputClass} value={toLocalInput(v.starts_at)} onChange={(e) => setV((p) => ({ ...p, starts_at: fromLocalInput(e.target.value) }))} />
        </label>
        <label className="block">
          <span className={labelClass}>Ends (blank = until turned off)</span>
          <input type="datetime-local" className={inputClass} value={toLocalInput(v.ends_at)} onChange={(e) => setV((p) => ({ ...p, ends_at: fromLocalInput(e.target.value) }))} />
        </label>
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-slate-800 dark:text-neutral-200">
        <input type="checkbox" checked={v.active} onChange={(e) => setV((p) => ({ ...p, active: e.target.checked }))} />
        On (uncheck to save it as a draft)
      </label>
      <div>
        <span className={labelClass}>Preview</span>
        <div className="max-w-sm hb-notice-preview">
          <NoticeCard notice={preview} onDismiss={() => {}} onOpen={() => setShowModal(true)} />
          {showModal && <NoticeModal notice={preview} onClose={() => setShowModal(false)} />}
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={buttonClass.primary} disabled={!v.title.trim()}>
          <Check className="w-4 h-4" strokeWidth={2.5} /> {notice.id ? "Save" : "Post notice"}
        </button>
        <button type="button" className={buttonClass.secondary} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
