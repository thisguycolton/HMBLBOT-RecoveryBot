import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, ChevronDown, ExternalLink, Link2, MessageSquare, Plus, Save, Trash2, X } from "lucide-react";
import { api } from "../lib";
import IconPicker from "../../ui/IconPicker";
import LucideIcon from "../../ui/LucideIcon";
import SegmentedControl from "../../ui/SegmentedControl";
import { inputClass, labelClass, selectClass } from "../../ui/styles";
import MarkdownTextarea from "../../notes/MarkdownTextarea";
import { ErrorNote, dangerButton, primaryButton, quietButton } from "../ui";
import { documentsPath } from "../conscience/lib";
import PostingPreview from "./PostingPreview";
import { AUTO_ANCHOR, DYNAMIC_VALUES, PLACEHOLDERS, SERVICE_VALUES, cueLabel, fillPosting, roleKey, roleToken, scriptParagraphs, scriptSections, valueToken } from "./lib";

const move = (list, i, by) => {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};
const smallButton = `${quietButton} !px-2 !py-1 !text-xs`;

// The gear in the Command Center, for host coordinators: which document is the script, the chat
// postings and the readings, for this meeting (all its days) or as the group's default for every
// meeting without its own. `only`: just one part ("script", "postings", "roles" or "readings"),
// opened from its block on HostDeck; the rest of the kit is saved as it was.
const PARTS = { script: "The script", postings: "Chat postings", roles: "Service roles", readings: "Meeting readings" };

export default function KitEditor({ center, onClose, onSaved, only = null }) {
  const shows = (part) => !only || only === part;
  const { kit, editor, meeting, group } = center;
  const [scope, setScope] = useState(kit.own || !editor.has_default ? "meeting" : "default");
  const [scriptId, setScriptId] = useState(editor.script_document_id ? String(editor.script_document_id) : "");
  const [anchor, setAnchor] = useState(kit.activity_anchor || "");
  const [publicPostings, setPublicPostings] = useState(center.link?.public_postings !== false);
  const [postings, setPostings] = useState(() => kit.postings.map((p) => ({ ...p, key: `p${p.id}` })));
  const [readings, setReadings] = useState(kit.readings);
  // Only sent when changed, so a kit keeps following the usual roles until someone edits them
  const [roles, setRoles] = useState(() => kit.service_roles.map((r) => ({ ...r, id: r.key })));
  const [rolesEdited, setRolesEdited] = useState(false);
  // Which dynamic values the document editor offers (Insert > Dynamic Values); null: all of them
  const [allowed, setAllowed] = useState(kit.allowed_values ?? null);
  const changeRoles = (list) => { setRoles(list); setRolesEdited(true); };
  const [openKey, setOpenKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setPosting = (key, change) => setPostings((list) => list.map((p) => (p.key === key ? { ...p, ...change } : p)));
  const addPosting = () => {
    const key = `n${Date.now()}`;
    const last = postings[postings.length - 1];
    setPostings([...postings, { key, title: "", icon: "message-circle", minute: last ? last.minute + 5 : 0, body: "" }]);
    setOpenKey(key);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await api(`/groups/${group.slug}/hosting/${meeting.id}/kit?on=${center.on}`, {
        method: "PUT",
        body: { kit: { scope, script_document_id: scriptId || null, activity_anchor: anchor || null, public_postings: publicPostings, readings, allowed_values: allowed, postings: postings.map(({ id, title, icon, minute, body }) => ({ id, title, icon, minute, body })),
          ...(rolesEdited ? { service_roles: roles.map(({ key, label }) => ({ key, label })) } : {}) } },
      });
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const reset = async () => {
    if (!window.confirm(`Take ${meeting.name}'s own script, postings and readings away? It goes back to the group's default.`)) return;
    try {
      onSaved(await api(`/groups/${group.slug}/hosting/${meeting.id}/kit?on=${center.on}`, { method: "DELETE" }));
      onClose();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true" aria-labelledby="kit-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-full w-full max-w-2xl flex-col bg-neutral-50 shadow-2xl dark:bg-neutral-950">
        <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="min-w-0 flex-1">
            <h2 id="kit-title" className="font-semibold">{only ? PARTS[only] : "Set up HostDeck"}</h2>
            <p className="truncate text-xs text-slate-500 dark:text-neutral-400">What the hosts of {meeting.name} get. Host coordinators and group admins change it.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-grid size-9 place-items-center rounded-xl !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:hover:!bg-neutral-800"><X className="size-5" /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
          <ErrorNote error={error} />
          <div>
            <p className={labelClass}>Applies to</p>
            <div className="overflow-hidden rounded-xl bg-white ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700">
              <SegmentedControl
                value={scope}
                onChange={setScope}
                options={[{ value: "meeting", label: `Just ${meeting.name}` }, { value: "default", label: "Every meeting (the default)" }]}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
              {scope === "meeting"
                ? `${meeting.name} gets its own, on every day it runs.${!kit.own && kit.exists ? " Saving copies what's here from the default." : ""}`
                : "Every meeting without its own uses this."}
              {kit.own && scope === "default" && " This meeting has its own, so it keeps using that."}
            </p>
          </div>

          {shows("script") && <ScriptPicker documents={editor.documents} value={scriptId} onChange={setScriptId} current={kit.script} anchor={anchor} setAnchor={setAnchor} slug={group.slug} />}

          {shows("script") && <ValuesPicker allowed={allowed} setAllowed={setAllowed} />}

          {shows("postings") && <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className={labelClass}>Chat postings</h3>
              <button type="button" className={smallButton} onClick={addPosting}><Plus className="size-3.5" /> Add a posting</button>
            </div>
            <p className="mb-2 text-xs text-slate-500 dark:text-neutral-400">
              Pasted into the Zoom chat, with the formatting you give it. These fill themselves in: {PLACEHOLDERS.map(([k, what], i) => <span key={k}>{i > 0 && ", "}<code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">{`{{${k}}}`}</code> ({what})</span>)}, and the service roles below, like <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">{roleToken("hiw")}</code>.
            </p>
            <label className="mb-2 flex items-start gap-2 rounded-xl bg-white p-3 text-sm shadow-panel dark:bg-neutral-900">
              <input type="checkbox" className="mt-0.5" checked={publicPostings} onChange={(e) => setPublicPostings(e.target.checked)} />
              <span>Anyone with the hosts' share link can see and copy these, without an account<span className="block text-xs text-slate-500 dark:text-neutral-400">For a co-host who doesn't sign in. The script, readings and milestones stay with the hosts.</span></span>
            </label>
            {postings.length === 0 && <p className="rounded-xl bg-white p-3 text-sm text-slate-500 shadow-panel dark:bg-neutral-900 dark:text-neutral-400">No postings yet.</p>}
            <ul className="space-y-2">
              {postings.map((p, i) => (
                <PostingRow key={p.key} posting={p} open={openKey === p.key} center={center}
                  toggle={() => setOpenKey(openKey === p.key ? null : p.key)} change={(c) => setPosting(p.key, c)}
                  up={i > 0 ? () => setPostings(move(postings, i, -1)) : null} down={i < postings.length - 1 ? () => setPostings(move(postings, i, 1)) : null}
                  remove={() => setPostings(postings.filter((x) => x.key !== p.key))} />
              ))}
            </ul>
          </section>}

          {shows("roles") && <RolesEditor roles={roles} setRoles={changeRoles} custom={kit.custom_service_roles || rolesEdited} />}

          {shows("readings") && <ReadingsEditor books={editor.books} readings={readings} setReadings={setReadings} />}
        </div>

        <footer className="flex items-center gap-2 border-t border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          {kit.own && <button type="button" className={dangerButton} onClick={reset}><Trash2 className="size-4" /> Use the default instead</button>}
          <span className="flex-1" />
          <button type="button" className={quietButton} onClick={onClose}>Cancel</button>
          <button type="button" className={primaryButton} onClick={save} disabled={saving}><Save className="size-4" /> {saving ? "Saving…" : "Save"}</button>
        </footer>
      </div>
    </div>
  );
}

// Which document is the script, the sections it makes, and where the day's reading / activity goes
function ScriptPicker({ documents, value, onChange, current, anchor, setAnchor, slug }) {
  const [sections, setSections] = useState([]);
  const [paragraphs, setParagraphs] = useState([]);
  const shown = current && String(current.id) === value;
  useEffect(() => {
    let gone = false;
    if (shown) {
      scriptSections(current, anchor || null).then((s) => !gone && setSections(s));
      scriptParagraphs(current).then((p) => !gone && setParagraphs(p));
    } else { setSections([]); setParagraphs([]); }
    return () => { gone = true; };
  }, [current, shown, anchor]);
  const auto = paragraphs.find((t) => AUTO_ANCHOR.test(t));
  // a section marked as the reading / activity spot in the document takes the place of picking one here
  const marked = shown && /data-kind="activity"/.test(current.body || "");
  const count = (n) => (n == null ? "" : ` · ${n} ${n === 1 ? "section" : "sections"}`);
  return (
    <section>
      <label htmlFor="kit-script" className={labelClass}>Script</label>
      <select id="kit-script" className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">No script</option>
        {documents.map((d) => <option key={d.id} value={d.id}>{d.title}{d.kind === "format" ? "" : ` (${d.kind})`}{count(d.sections)}</option>)}
      </select>
      <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
        One of the group's current documents that hosts can read (Hosts, Members or Public, in Group conscience &gt; Documents). Its sections (Insert &gt; Add Section in the document) make the meeting's steps, each with a title, and can be kept to certain activities or days, or remind the hosts at a time. Without sections, its headings or bold time cues like "(Top of the hour)" are used.
        {value && <> <a href={`/groups${documentsPath(slug, value)}`} target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 font-medium text-accent hover:underline">Edit the document <ExternalLink className="size-3" /></a></>}
      </p>
      {shown && paragraphs.length > 0 && !marked && (
        <div className="mt-3">
          <label htmlFor="kit-anchor" className={labelClass}>Reading / activity goes after</label>
          <select id="kit-anchor" className={selectClass} value={anchor} onChange={(e) => setAnchor(e.target.value)}>
            <option value="">{auto ? `Found by itself: “${auto.slice(0, 70)}…”` : "Found by itself (nothing found: no spot)"}</option>
            <option value="none">No reading / activity spot</option>
            {paragraphs.map((t, i) => <option key={i} value={t.slice(0, 160)}>{t.length > 90 ? `${t.slice(0, 90)}…` : t}</option>)}
          </select>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">The hosts pick what fills it each day: a reading, today's daily reading, the Topicificator, a speaker…</p>
        </div>
      )}
      {sections.length > 0 && (
        <ol className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {sections.map((s, i) => (
            <li key={i} title={[s.when && "Only for some activities", s.days && "Only some days", s.cue && `Reminder ${cueLabel(s.cue)}`].filter(Boolean).join(" · ") || undefined}
              className={`rounded-full px-2 py-0.5 ${s.activity ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" : s.when || s.days ? "border border-dashed border-slate-400 text-slate-600 dark:text-neutral-300" : "bg-neutral-200 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300"}`}>
              {i + 1}. {s.title}{s.cue ? " ⏰" : ""}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// Which dynamic values a host coordinator lets the format's writers put in (the document editor's
// Insert > Dynamic Values): all of them until some are turned off
function ValuesPicker({ allowed, setAllowed }) {
  const keys = [...DYNAMIC_VALUES.map((v) => v.key), SERVICE_VALUES];
  const isOn = (key) => !allowed || allowed.includes(key);
  const toggle = (key) => {
    const current = allowed || keys;
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    setAllowed(keys.every((k) => next.includes(k)) ? null : next);
  };
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className={labelClass}>Dynamic values</h3>
        {allowed && <button type="button" className={smallButton} onClick={() => setAllowed(null)}>Allow all</button>}
      </div>
      <p className="mb-2 text-xs text-slate-500 dark:text-neutral-400">
        What the script's writers can put in from the document editor's Insert &gt; Dynamic Values. Each fills itself in during the meeting, like {valueToken("milestones")} with who's celebrating.
      </p>
      <div className="grid gap-1.5 rounded-xl bg-white p-3 shadow-panel sm:grid-cols-2 dark:bg-neutral-900">
        {[...DYNAMIC_VALUES, { key: SERVICE_VALUES, label: "Service roles", what: "who's doing each service, like How It Works" }].map((v) => (
          <label key={v.key} className="flex items-start gap-2 text-sm" title={v.key === SERVICE_VALUES ? roleToken("hiw") : valueToken(v.key)}>
            <input type="checkbox" className="mt-0.5" checked={isOn(v.key)} onChange={() => toggle(v.key)} />
            <span>{v.label}<span className="block text-xs text-slate-500 dark:text-neutral-400">{v.what}</span></span>
          </label>
        ))}
      </div>
    </section>
  );
}

function PostingRow({ posting: p, open, toggle, change, up, down, remove, center }) {
  const id = `posting-${p.key}`;
  const [pickIcon, setPickIcon] = useState(false);
  return (
    <li className="rounded-xl bg-white shadow-panel dark:bg-neutral-900">
      <div className="flex items-center gap-2 p-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"><LucideIcon name={p.icon} fallback={MessageSquare} size={16} /></span>
        <button type="button" onClick={toggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 !bg-transparent p-0 text-left">
          <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-neutral-400">{String(p.minute).padStart(2, "0")}:00</span>
          <span className={`min-w-0 flex-1 truncate text-sm font-medium ${p.title ? "" : "italic text-slate-400"}`}>{p.title || "Untitled"}</span>
          <ChevronDown className={`size-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <button type="button" className={smallButton} onClick={up} disabled={!up} aria-label="Move up"><ArrowUp className="size-3.5" /></button>
        <button type="button" className={smallButton} onClick={down} disabled={!down} aria-label="Move down"><ArrowDown className="size-3.5" /></button>
        <button type="button" className={`${dangerButton} !px-2 !py-1`} onClick={remove} aria-label={`Remove ${p.title || "this posting"}`}><Trash2 className="size-3.5" /></button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-neutral-100 p-3 dark:border-neutral-800">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <div><label htmlFor={`${id}-title`} className={labelClass}>Short title</label><input id={`${id}-title`} className={inputClass} maxLength={60} value={p.title} onChange={(e) => change({ title: e.target.value })} placeholder="Welcome" /></div>
            <div><label htmlFor={`${id}-minute`} className={labelClass}>Minute in</label><input id={`${id}-minute`} type="number" min={0} max={600} className={inputClass} value={p.minute} onChange={(e) => change({ minute: Math.max(0, Number(e.target.value) || 0) })} /></div>
          </div>
          <div>
            <label htmlFor={`${id}-body`} className={labelClass}>What gets pasted</label>
            <MarkdownTextarea id={`${id}-body`} minRows={6} maxLength={4000} colors className={`${inputClass} font-mono`} value={p.body} onChange={(body) => change({ body })}
              placeholder={"Welcome to {{meeting}}! 👋\nPlease keep your microphone **muted** unless you're sharing."} />
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Select text for bold, italic, underline, strikethrough, a link, or a text or highlight color. It copies with that formatting.</p>
            {p.body.trim() && (
              <div className="mt-2 rounded-lg bg-neutral-100 p-2.5 text-sm text-slate-800 dark:bg-neutral-800 dark:text-neutral-100">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">As it pastes</p>
                <PostingPreview markdown={fillPosting(p.body, center, center.live)} />
              </div>
            )}
          </div>
          <div>
            <button type="button" className={smallButton} onClick={() => setPickIcon(!pickIcon)} aria-expanded={pickIcon}><LucideIcon name={p.icon} fallback={MessageSquare} size={14} /> {pickIcon ? "Done picking" : "Change icon"}</button>
            {pickIcon && <div className="mt-2"><IconPicker value={p.icon} onChange={(icon) => change({ icon })} label={`Icon for ${p.title || "this posting"}`} /></div>}
          </div>
        </div>
      )}
    </li>
  );
}

// Chapters from the group's literature, or any link, kept at hand to share on screen
function ReadingsEditor({ books, readings, setReadings }) {
  const [bookSlug, setBookSlug] = useState(books[0]?.slug || "");
  const [chapters, setChapters] = useState(null);
  const [chapterSlug, setChapterSlug] = useState("");
  const [link, setLink] = useState({ title: "", url: "" });

  useEffect(() => {
    setChapters(null);
    setChapterSlug("");
    if (!bookSlug) return;
    fetch(`/api/books/${encodeURIComponent(bookSlug)}/chapters`, { headers: { Accept: "application/json" }, credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setChapters(Array.isArray(list) ? list : []))
      .catch(() => setChapters([]));
  }, [bookSlug]);

  const addChapter = () => {
    const c = chapters?.find((x) => x.slug === chapterSlug);
    const book = books.find((b) => b.slug === bookSlug);
    if (!c) return;
    setReadings([...readings, { book_slug: bookSlug, chapter_slug: c.slug, title: c.title || c.label || c.slug, book_title: book?.title }]);
    setChapterSlug("");
  };
  const addLink = (e) => {
    e.preventDefault();
    if (!/^https?:\/\//i.test(link.url.trim())) return;
    setReadings([...readings, { title: link.title.trim() || link.url.trim(), url: link.url.trim() }]);
    setLink({ title: "", url: "" });
  };

  return (
    <section>
      <h3 className={`${labelClass} mb-2`}>Readings</h3>
      {readings.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {readings.map((r, i) => (
            <li key={`${r.url || r.chapter_slug}-${i}`} className="flex items-center gap-2 rounded-xl bg-white p-2.5 shadow-panel dark:bg-neutral-900">
              {r.url ? <Link2 className="size-4 shrink-0 text-slate-400" /> : <BookOpen className="size-4 shrink-0 text-slate-400" />}
              <span className="min-w-0 flex-1 truncate text-sm">{r.title}{r.book_title && <span className="text-slate-500 dark:text-neutral-400"> · {r.book_title}</span>}</span>
              <button type="button" className={smallButton} onClick={() => setReadings(move(readings, i, -1))} disabled={i === 0} aria-label="Move up"><ArrowUp className="size-3.5" /></button>
              <button type="button" className={smallButton} onClick={() => setReadings(move(readings, i, 1))} disabled={i === readings.length - 1} aria-label="Move down"><ArrowDown className="size-3.5" /></button>
              <button type="button" className={`${dangerButton} !px-2 !py-1`} onClick={() => setReadings(readings.filter((_, j) => j !== i))} aria-label={`Remove ${r.title}`}><Trash2 className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      {books.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-end">
          <div><label htmlFor="kit-book" className={labelClass}>Book</label><select id="kit-book" className={selectClass} value={bookSlug} onChange={(e) => setBookSlug(e.target.value)}>{books.map((b) => <option key={b.slug} value={b.slug}>{b.title}</option>)}</select></div>
          <div><label htmlFor="kit-chapter" className={labelClass}>Chapter</label>
            <select id="kit-chapter" className={selectClass} value={chapterSlug} onChange={(e) => setChapterSlug(e.target.value)} disabled={!chapters}>
              <option value="">{chapters ? "Pick a chapter" : "Loading…"}</option>
              {(chapters || []).map((c) => <option key={c.slug} value={c.slug}>{c.title || c.label || c.slug}</option>)}
            </select>
          </div>
          <button type="button" className={quietButton} onClick={addChapter} disabled={!chapterSlug}><Plus className="size-4" /> Add</button>
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-neutral-400">Chapters come from the group's approved literature (the Literature tab). Links work without it.</p>
      )}
      <form onSubmit={addLink} className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-end">
        <div><label htmlFor="kit-link-title" className={labelClass}>Link title</label><input id="kit-link-title" className={inputClass} maxLength={120} value={link.title} onChange={(e) => setLink({ ...link, title: e.target.value })} placeholder="Daily Reflections" /></div>
        <div><label htmlFor="kit-link-url" className={labelClass}>Link</label><input id="kit-link-url" type="url" className={inputClass} value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} placeholder="https://" /></div>
        <button type="submit" className={quietButton} disabled={!/^https?:\/\//i.test(link.url.trim())}><Plus className="size-4" /> Add</button>
      </form>
    </section>
  );
}

// The service the hosts line people up for at the start ("Before we begin"). The script and the
// chat postings name each one as {{ service_KEY }}, and the name the hosts type goes there.
function RolesEditor({ roles, setRoles, custom }) {
  const [label, setLabel] = useState("");
  const add = (e) => {
    e.preventDefault();
    const key = roleKey(label);
    if (!key || roles.some((r) => r.key === key)) return;
    setRoles([...roles, { key, label: label.trim(), id: `n${Date.now()}` }]);
    setLabel("");
  };
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className={labelClass}>Service roles</h3>
        {custom && <button type="button" className={smallButton} onClick={() => setRoles([])}>Use the usual ones</button>}
      </div>
      <p className="mb-2 text-xs text-slate-500 dark:text-neutral-400">
        The hosts fill these in under "Before we begin". Put the code in the script (or a posting) where the name goes, like "{roleToken("hiw")} has volunteered to read How It Works". Host and co-host start with the schedule's.
      </p>
      {roles.length === 0 && <p className="rounded-xl bg-white p-3 text-sm text-slate-500 shadow-panel dark:bg-neutral-900 dark:text-neutral-400">The usual ones (host, co-host, How It Works, Traditions, timer, closing reading), once you save.</p>}
      <ul className="space-y-1.5">
        {roles.map((r, i) => (
          <li key={r.id} className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-panel dark:bg-neutral-900">
            <input aria-label="Role" className={`${inputClass} !py-1.5`} maxLength={60} value={r.label}
              onChange={(e) => setRoles(roles.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <code className="hidden w-44 shrink-0 truncate rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-slate-600 sm:block dark:bg-neutral-800 dark:text-neutral-300">{roleToken(r.key)}</code>
            <button type="button" className={smallButton} onClick={() => setRoles(move(roles, i, -1))} disabled={i === 0} aria-label={`Move ${r.label} up`}><ArrowUp className="size-3.5" /></button>
            <button type="button" className={smallButton} onClick={() => setRoles(move(roles, i, 1))} disabled={i === roles.length - 1} aria-label={`Move ${r.label} down`}><ArrowDown className="size-3.5" /></button>
            <button type="button" className={smallButton} onClick={() => setRoles(roles.filter((_, j) => j !== i))} aria-label={`Take ${r.label} off`}><Trash2 className="size-3.5" /></button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-2 flex gap-2">
        <input aria-label="New role" className={`${inputClass} !py-1.5`} maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add a role, like Secretary" />
        <button type="submit" className={smallButton} disabled={!roleKey(label)}><Plus className="size-3.5" /> Add</button>
      </form>
    </section>
  );
}
