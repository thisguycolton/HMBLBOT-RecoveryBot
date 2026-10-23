import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, MonitorPlay, X } from "lucide-react";
import { quietButton } from "../../ui";

export const PURPOSE_LABELS = { business_meeting: "Business meeting", onboarding: "Host onboarding", event: "Event day", general: "Deck" };

// The HostDecks a document runs (GET /decks?document_id=): its decks of their own, and for the
// members who host, the meetings whose script it is (the group's default script opens the
// meeting picker)
export function hostDecksFor(slug, data) {
  if (!data) return [];
  const decks = data.decks.map((d) => ({ key: `d${d.id}`, to: `/${slug}/decks/${d.id}`, label: d.name, detail: PURPOSE_LABELS[d.purpose] || "Deck" }));
  const meetings = data.can_host ? (data.meetings || []).map((m) => (m.id
    ? { key: `m${m.id}`, to: `/${slug}/host/${m.id}`, label: m.name, detail: "Meeting script" }
    : { key: "m-all", to: `/${slug}/host`, label: "The group's meetings", detail: "Every meeting's script: pick one" })) : [];
  return [...decks, ...meetings];
}

// Document > File > Open HostDeck, when the document runs more than one: pick which
export default function OpenDeckDialog({ doc, decks, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="open-deck" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 text-left shadow-2xl dark:bg-neutral-900">
        <div className="flex items-center gap-2">
          <MonitorPlay className="size-5 text-accent" />
          <h2 id="open-deck" className="flex-1 text-lg font-semibold">Open HostDeck</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-grid size-9 place-items-center rounded-xl !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:hover:!bg-neutral-800"><X className="size-5" /></button>
        </div>
        <p className="text-sm text-slate-600 dark:text-neutral-300">These HostDecks run from <span className="font-semibold">{doc.title}</span>. Pick one to open.</p>
        <ul className="space-y-1.5">
          {decks.map((d) => (
            <li key={d.key}>
              <Link to={d.to} className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-neutral-200 hover:ring-2 hover:ring-accent/40 dark:ring-neutral-700">
                <MonitorPlay className="size-5 shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900 dark:text-white">{d.label}</span>
                  <span className="block text-xs text-slate-500 dark:text-neutral-400">{d.detail}</span>
                </span>
                <ChevronRight className="size-5 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex justify-end"><button type="button" className={quietButton} onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}
