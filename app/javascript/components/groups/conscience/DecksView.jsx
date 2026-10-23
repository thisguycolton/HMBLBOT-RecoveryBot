import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, FileText, MonitorPlay } from "lucide-react";
import { api } from "../lib";
import { Card, ErrorNote, Loading, Tray } from "../ui";
import { PURPOSE_LABELS } from "../hosting/deck/OpenDeckDialog";
import { documentsPath } from "./lib";

// HostDecks (/conscience/hostdecks): every deck the group runs from its documents (business
// meetings, onboarding, events...), for any member to open, and the way to the meetings' HostDeck
// for the members who host
export default function DecksView({ group }) {
  const slug = group.slug;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api(`/groups/${slug}/decks`).then(setData).catch((e) => setError(e.message)); }, [slug]);

  if (!data) return error ? <ErrorNote error={error} /> : <Loading />;
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600 dark:text-neutral-300">
        A HostDeck steps through one of the group's documents a section at a time. Anyone in the group can open these.
        {data.can_create && <> To make one, open a document and pick <span className="font-semibold">File &gt; Create New HostDeck</span>.</>}
      </p>
      {data.can_host && (
        <Link to={`/${slug}/host`} className="block">
          <Card className="flex items-center gap-3 p-3 hover:ring-2 hover:ring-accent/30">
            <MonitorPlay className="size-5 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900 dark:text-white">Meetings</p>
              <p className="text-xs text-slate-500 dark:text-neutral-400">The HostDeck for each of the group's meetings, for the members who host</p>
            </div>
            <ChevronRight className="size-5 text-slate-400" />
          </Card>
        </Link>
      )}
      <Tray label="The group's HostDecks">
        {data.decks.length === 0 ? (
          <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">No HostDecks yet.</Card>
        ) : (
          <div className="space-y-1.5">
            {data.decks.map((d) => (
              <Card key={d.id} className="flex items-center gap-3 p-3 hover:ring-2 hover:ring-accent/30">
                <MonitorPlay className="size-5 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <Link to={`/${slug}/decks/${d.id}`} className="block truncate font-medium text-slate-900 hover:text-accent dark:text-white">{d.name}</Link>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-neutral-400">
                    <span>{PURPOSE_LABELS[d.purpose] || "Deck"}</span>
                    {d.document_title && (
                      <Link to={documentsPath(slug, d.script_document_id)} className="inline-flex items-center gap-1 hover:text-accent"><FileText className="size-3.5" /> {d.document_title}</Link>
                    )}
                  </p>
                </div>
                <Link to={`/${slug}/decks/${d.id}`} aria-label={`Open ${d.name}`}><ChevronRight className="size-5 text-slate-400" /></Link>
              </Card>
            ))}
          </div>
        )}
      </Tray>
    </div>
  );
}
