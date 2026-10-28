import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, FileText, MonitorPlay, Search, X } from "lucide-react";
import { api } from "../../lib";
import { Card, ErrorNote, Loading, Tray, quietButton } from "../../ui";
import { inputClass } from "../../../ui/styles";
import { documentsPath } from "../../conscience/lib";

export const PURPOSE_LABELS = { business_meeting: "Business meetings", onboarding: "Host onboarding", event: "Event days", general: "Other decks" };
const ORDER = ["business_meeting", "onboarding", "event", "general"];
const updatedLabel = (iso) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

// The group's HostDecks of their own (business meetings, onboarding, event days...), by what
// they're for, each with the document it runs from. In the group dashboard (HostDecks) and at
// /groups/:slug/decks for everyone else in the group.
export function DeckList({ slug }) {
  const [decks, setDecks] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  useEffect(() => { api(`/groups/${slug}/decks`).then((d) => setDecks(d.decks)).catch((e) => setError(e.message)); }, [slug]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = (decks || []).filter((d) => !q || [d.name, d.script_document?.title].some((t) => t?.toLowerCase().includes(q)));
    return ORDER.map((p) => [p, shown.filter((d) => (ORDER.includes(d.purpose) ? d.purpose : "general") === p)]).filter(([, list]) => list.length);
  }, [decks, query]);

  if (error) return <ErrorNote error={error} />;
  if (!decks) return <Loading />;
  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <MonitorPlay className="size-6 shrink-0 text-accent" />
        <p className="min-w-0 flex-1 !text-left text-sm text-slate-600 dark:text-neutral-300">
          Hosting a meeting? Its HostDeck is under <Link to={`/${slug}/host`} className="font-medium text-accent hover:underline">Host a meeting</Link>.
          To make a new deck, open one of the group's documents and pick <span className="font-semibold">File &gt; Create New HostDeck</span>.
        </p>
        <Link to={`/${slug}/host`} className={`${quietButton} max-sm:!hidden`}>Host a meeting</Link>
      </Card>
      {decks.length > 6 && (
        <label className="relative block">
          <span className="sr-only">Find a deck</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input className={`${inputClass} !pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a deck or its document" />
        </label>
      )}
      {decks.length === 0 && (
        <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">
          The group hasn't made any decks yet. A deck can run a business meeting, host onboarding or anything else from one of the group's documents.
        </Card>
      )}
      {decks.length > 0 && groups.length === 0 && <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">No decks match that.</Card>}
      {groups.map(([purpose, list]) => (
        <Tray key={purpose} label={PURPOSE_LABELS[purpose]}>
          <div className="space-y-1.5">{list.map((d) => <DeckRow key={d.id} slug={slug} deck={d} />)}</div>
        </Tray>
      ))}
    </div>
  );
}

function DeckRow({ slug, deck }) {
  return (
    <Card className="flex items-center gap-3 p-3 hover:ring-2 hover:ring-accent/30">
      <MonitorPlay className="size-5 shrink-0 text-accent" />
      <Link to={`/${slug}/decks/${deck.id}`} className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900 dark:text-white">{deck.name}</p>
        <p className="truncate text-xs text-slate-500 dark:text-neutral-400">Changed {updatedLabel(deck.updated_at)}</p>
      </Link>
      {deck.script_document && (
        <Link to={documentsPath(slug, deck.script_document.id)} title="Open the document it runs from"
          className="hidden max-w-[40%] items-center gap-1.5 truncate rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-neutral-100 hover:text-accent dark:text-neutral-300 dark:hover:bg-neutral-800 sm:inline-flex">
          <FileText className="size-3.5 shrink-0" /> <span className="truncate">{deck.script_document.title}</span>
        </Link>
      )}
      <Link to={`/${slug}/decks/${deck.id}`} aria-label={`Open ${deck.name}`}><ChevronRight className="size-5 text-slate-400" /></Link>
    </Card>
  );
}

// /groups/:slug/decks
export default function DeckListPage() {
  const { slug } = useParams();
  return (
    <div className="mx-auto max-w-3xl space-y-6 !font-sans [&_*]:!font-sans">
      <h1 className="flex items-center gap-2 !text-2xl font-bold text-slate-900 dark:text-white"><MonitorPlay className="size-6 text-accent" /> HostDecks</h1>
      <DeckList slug={slug} />
    </div>
  );
}

// What File > Open HostDeck (and Create New HostDeck's "already running from it") offers for a
// document: its decks, and, to people who can host, the meetings whose script it is
export function decksFromDocument(slug, data) {
  if (!data) return [];
  return [
    ...data.decks.map((d) => ({ key: `d${d.id}`, to: `/${slug}/decks/${d.id}`, label: d.name, note: PURPOSE_LABELS[d.purpose]?.replace(/s$/, "") || "Deck" })),
    ...(data.can_host ? data.meetings || [] : []).map((m) => (m.id
      ? { key: `m${m.id}`, to: `/${slug}/host/${m.id}`, label: m.name, note: "Meeting script" }
      : { key: "m-all", to: `/${slug}/host`, label: m.name, note: "Meeting script" })),
  ];
}

// File > Open HostDeck when more than one runs from the document: pick which
export function OpenDeckDialog({ doc, options, onPick, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="open-deck" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 text-left shadow-2xl dark:bg-neutral-900">
        <div className="flex items-center gap-2">
          <MonitorPlay className="size-5 text-accent" />
          <h2 id="open-deck" className="flex-1 text-lg font-semibold">Open HostDeck</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-grid size-9 place-items-center rounded-xl !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:hover:!bg-neutral-800"><X className="size-5" /></button>
        </div>
        <p className="text-sm text-slate-600 dark:text-neutral-300">These run from <span className="font-semibold">{doc.title}</span>. Pick one to open.</p>
        <ul className="space-y-1.5">
          {options.map((o, i) => (
            <li key={o.key}>
              <button type="button" onClick={() => onPick(o)} autoFocus={i === 0}
                className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 !bg-transparent p-3 text-left hover:border-accent/50 hover:!bg-accent/5 dark:border-neutral-700">
                <MonitorPlay className="size-5 shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900 dark:text-white">{o.label}</span>
                  <span className="block text-xs text-slate-500 dark:text-neutral-400">{o.note}</span>
                </span>
                <ChevronRight className="size-5 text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
