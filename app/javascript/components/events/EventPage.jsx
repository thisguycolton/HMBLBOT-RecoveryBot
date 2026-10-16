import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Megaphone, Pencil } from "lucide-react";
import Markdown from "../book/Markdown";
import { api } from "./lib";
import { EventHero } from "./EventLayout";
import EventBlocks from "./EventLayout";
import RsvpCard from "./RsvpCard";

// /events/:token — the published event (or a draft, for the people editing it)
export default function EventPage() {
  const { token } = useParams();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(null);
  const [allUpdates, setAllUpdates] = useState(false);

  useEffect(() => {
    api(`/events/${token}`).then((e) => {
      setEvent(e);
      document.title = `${e.title} | RecoveryBot`;
    }).catch((e) => setError(e.message));
  }, [token]);

  if (error) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">That event isn't here</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-neutral-400">{error}</p>
      </div>
    );
  }
  if (!event) return <p className="py-24 text-center text-sm text-slate-500">Loading…</p>;

  const updates = allUpdates ? event.updates : event.updates.slice(0, 1);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:py-8">
      {(event.status !== "published" || event.can_edit) && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-900/60">
          <span className="flex-1">{event.status === "published" ? "You can edit this event." : "This is a draft. Only the people editing it can see it."}</span>
          <Link to={`/${token}/edit`} className="inline-flex items-center gap-1.5 rounded-xl !bg-accent px-3 py-1.5 font-semibold !text-white"><Pencil className="size-4" /> Open in the editor</Link>
        </div>
      )}

      <EventHero event={event} aside={<RsvpCard event={event} setEvent={setEvent} />} />

      {event.updates.length > 0 && (
        <section className="rounded-2xl bg-accent/5 p-4 ring-1 ring-accent/20 dark:bg-accent/10">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-accent dark:text-sky-300">
            <Megaphone className="size-4" /> Updates
          </h2>
          <ul className="space-y-3">
            {updates.map((u) => (
              <li key={u.id}>
                <p className="font-semibold text-slate-900 dark:text-white">{u.title}</p>
                <p className="text-xs text-slate-500 dark:text-neutral-400">{new Date(u.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                {u.body && <Markdown source={u.body} className="ev-md mt-1 text-sm" />}
              </li>
            ))}
          </ul>
          {event.updates.length > 1 && (
            <button type="button" onClick={() => setAllUpdates(!allUpdates)} className="mt-2 !bg-transparent !p-0 text-sm font-medium text-accent hover:underline">
              {allUpdates ? "Show the latest only" : `Show all ${event.updates.length} updates`}
            </button>
          )}
        </section>
      )}

      <EventBlocks event={event} />
    </div>
  );
}
