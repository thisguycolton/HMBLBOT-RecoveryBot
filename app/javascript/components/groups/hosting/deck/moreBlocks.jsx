import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowRight, ExternalLink, Link2, Mic, Plus, Trash2, X } from "lucide-react";
import Markdown from "../../../book/Markdown";
import { inputClass, labelClass, selectClass } from "../../../ui/styles";
import { api } from "../../lib";
import { primaryButton, quietButton } from "../../ui";
import { documentsPath } from "../../conscience/lib";
import { label } from "../parts";
import { fillValues, mmss } from "../lib";

// HostDeck's blocks for running more than a meeting's script: a queue of who shares next, one of
// the group's documents to read from, and a list of links

const card = "rounded-xl bg-white p-3 shadow-panel ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800";
const muted = "text-sm text-slate-500 dark:text-neutral-400";
const TitleOnly = ({ settings, change, placeholder }) => (
  <div><label className={labelClass}>Title</label><input className={inputClass} maxLength={80} value={settings.title || ""} onChange={(e) => change({ title: e.target.value })} placeholder={placeholder} /></div>
);

// Who's sharing now and who's next, the same list for everyone with the deck open (the session's
// block_state). Names only; they're kept with the day like milestones.
export function ShareQueueBlock({ block, size, deck }) {
  const [name, setName] = useState("");
  const title = block.settings?.title || "Share queue";
  const state = deck.live.block_state?.[block.id] || {};
  const queue = state.queue || [];
  const op = (o, item) => deck.act("block", { label: title, data: { block_id: block.id, op: o, ...(item != null ? { item } : {}) } });
  const add = (e) => { e.preventDefault(); if (name.trim()) { op("queue_add", name.trim()); setName(""); } };
  const since = state.now?.since ? mmss(Math.max(deck.now - new Date(state.now.since).getTime(), 0) / 1000) : null;
  const nextButton = <button type="button" className={`${primaryButton} !px-3 !py-1.5`} onClick={() => op("queue_next")} disabled={!queue.length} aria-label={`Call on the next person in ${title}`}>Next <ArrowRight className="size-4" /></button>;

  if (size === "bar") {
    return (
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <Mic className="size-4 shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 truncate">
          {state.now ? <><span className={label}>Sharing</span> <strong>{state.now.name}</strong> <span className="tabular-nums text-slate-500">{since}</span></> : <span className="text-slate-500 dark:text-neutral-400">Nobody sharing</span>}
          {queue[0] && <span className="text-slate-500 dark:text-neutral-400"> · Next: {queue[0].name}{queue.length > 1 ? ` +${queue.length - 1}` : ""}</span>}
        </span>
        {nextButton}
      </div>
    );
  }
  return (
    <section>
      <h2 className={`${label} mb-2`}>{title}</h2>
      <div className={`${card} space-y-3`}>
        <div className="flex items-center gap-3">
          <Mic className={`size-5 shrink-0 ${state.now ? "text-accent" : "text-slate-400"}`} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500 dark:text-neutral-400">Sharing now</p>
            <p className={`truncate font-semibold ${size === "main" ? "text-2xl" : ""}`}>{state.now?.name || "Nobody yet"}</p>
          </div>
          {state.now && <span className="font-mono text-sm tabular-nums text-slate-500">{since}</span>}
          {state.now && <button type="button" className={`${quietButton} !px-2 !py-1`} onClick={() => op("queue_done")} aria-label={`${state.now.name} is done`} title="Done sharing"><X className="size-4" /></button>}
        </div>
        {queue.length > 0 && (
          <ol className="space-y-1">
            {queue.map((q, i) => (
              <li key={q.id} className="flex items-center gap-2 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs font-semibold text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{q.name}</span>
                <button type="button" className={`${quietButton} !px-1.5 !py-1`} onClick={() => op("queue_remove", q.id)} aria-label={`Take ${q.name} off the queue`}><X className="size-3.5" /></button>
              </li>
            ))}
          </ol>
        )}
        <form onSubmit={add} className="flex gap-1.5">
          <input aria-label="Name to add to the queue" className={`${inputClass} !py-1.5`} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a hand" />
          <button type="submit" className={`${quietButton} !px-2.5`} disabled={!name.trim()} aria-label="Add to the queue"><Plus className="size-4" /></button>
          {nextButton}
        </form>
      </div>
    </section>
  );
}

export const ShareQueueSettings = (props) => <TitleOnly {...props} placeholder="Share queue" />;

// One of the group's documents, to read from (it isn't stepped through like the script). It's
// fetched as the person looking: someone who can't read it sees that. (The server sanitizes a
// document's HTML when it's saved; an older one in Markdown goes through the Markdown renderer.)
// Its dynamic values ({{ host }}...) are filled in the way the script's are.
export function DocumentBlock({ block, size, deck }) {
  const { title, document_id: id } = block.settings || {};
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    setDoc(null); setError(null);
    if (!id) return;
    let live = true;
    api(`/groups/${deck.slug}/documents/${id}`).then((d) => live && setDoc(d)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [deck.slug, id]);
  const href = id ? `/groups${documentsPath(deck.slug, id)}` : null;
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className={`${label} min-w-0 flex-1 truncate`}>{title || doc?.title || "Document"}</h2>
        {href && <a href={href} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">Open <ExternalLink className="size-3" /></a>}
      </div>
      {!id ? <p className={muted}>Pick a document with the block's settings.</p>
        : error ? <p className={muted}>This document isn't one you can read.</p>
          : !doc ? <p className={muted}>Loading…</p>
            : doc.body ? (
              <div className={`${card} ${size === "main" ? "" : "max-h-80 overflow-y-auto"}`}>
                {doc.body_format === "markdown" ? <Markdown source={doc.body} className={`doc-prose ${size === "main" ? "" : "doc-prose--small"}`} />
                  : <div className={`doc-prose ${size === "main" ? "" : "doc-prose--small"}`} style={size === "main" ? { fontSize: deck.size } : undefined} dangerouslySetInnerHTML={{ __html: fillValues(doc.body, deck.center, deck.live, deck.center.kit?.service_roles || []) }} />}
              </div>
            ) : <p className={muted}>It's a file. <a href={href} target="_blank" rel="noopener" className="text-accent hover:underline">Open it</a>.</p>}
    </section>
  );
}

export function DocumentSettings({ settings, change }) {
  const { slug } = useParams();
  const [docs, setDocs] = useState(null);
  useEffect(() => { api(`/groups/${slug}/documents`).then((d) => setDocs(d.documents.filter((x) => x.status === "current"))).catch(() => setDocs([])); }, [slug]);
  return (
    <div className="space-y-2">
      <TitleOnly settings={settings} change={change} placeholder="The document's own" />
      <div>
        <label className={labelClass}>Document</label>
        <select className={selectClass} value={settings.document_id || ""} onChange={(e) => change({ document_id: Number(e.target.value) || undefined })} disabled={!docs}>
          <option value="">{docs ? "Pick one" : "Loading…"}</option>
          {(docs || []).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Everyone sees it only if they can read it in Group conscience &gt; Documents.</p>
      </div>
    </div>
  );
}

// Links the deck keeps at hand: a list, big buttons in the middle, a row in the bar
export function LinksBlock({ block, size }) {
  const { title, links = [] } = block.settings || {};
  if (!links.length) return size === "bar" ? null : <section><h2 className={`${label} mb-2`}>{title || "Links"}</h2><p className={muted}>No links yet.</p></section>;
  const name = (l) => l.title || l.url.replace(/^https?:\/\//, "");
  if (size === "bar") {
    return (
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
        {links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className={`${quietButton} !px-2.5 !py-1.5 shrink-0`}><Link2 className="size-4" /> {name(l)}</a>)}
      </div>
    );
  }
  const row = size === "main"
    ? "flex items-center gap-3 rounded-xl bg-white p-4 font-medium shadow-panel ring-1 ring-neutral-200 hover:ring-accent/40 dark:bg-neutral-900 dark:ring-neutral-800"
    : "flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-slate-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800";
  return (
    <section>
      <h2 className={`${label} mb-2`}>{title || "Links"}</h2>
      <div className={size === "main" ? "grid gap-2 sm:grid-cols-2" : "space-y-1"}>
        {links.map((l, i) => (
          <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className={row}>
            <Link2 className={`shrink-0 ${size === "main" ? "size-6 text-accent" : "size-5 text-slate-400"}`} /><span className="min-w-0 flex-1 truncate">{name(l)}</span><ExternalLink className="size-3.5 text-slate-400" />
          </a>
        ))}
      </div>
    </section>
  );
}

export function LinksSettings({ settings, change }) {
  const links = settings.links || [];
  const [link, setLink] = useState({ title: "", url: "" });
  const ok = /^https?:\/\/\S+$/i.test(link.url.trim());
  const add = () => { if (ok) { change({ links: [...links, { title: link.title.trim(), url: link.url.trim() }] }); setLink({ title: "", url: "" }); } };
  return (
    <div className="space-y-2">
      <TitleOnly settings={settings} change={change} placeholder="Links" />
      <ul className="space-y-1">
        {links.map((l, i) => (
          <li key={i} className="flex items-center gap-1 text-sm">
            <span className="min-w-0 flex-1 truncate">{l.title || l.url}<span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{l.url}</span></span>
            <button type="button" className={`${quietButton} !px-2`} onClick={() => change({ links: links.filter((_, j) => j !== i) })} aria-label={`Remove ${l.title || l.url}`}><Trash2 className="size-4" /></button>
          </li>
        ))}
      </ul>
      <input className={`${inputClass} !py-1.5`} maxLength={80} value={link.title} placeholder="Title" aria-label="Link title" onChange={(e) => setLink({ ...link, title: e.target.value })} />
      <div className="flex gap-1">
        <input className={`${inputClass} !py-1.5`} type="url" value={link.url} placeholder="https://" aria-label="Link" onChange={(e) => setLink({ ...link, url: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className={`${quietButton} !px-2`} onClick={add} disabled={!ok} aria-label="Add the link"><Plus className="size-4" /></button>
      </div>
    </div>
  );
}
