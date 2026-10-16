import React, { useEffect, useState } from "react";
import { CalendarDays, Plus, Users } from "lucide-react";
import { inputClass } from "../ui/styles";
import { api } from "./lib";
import { Card, ErrorNote, Loading, Pill, Tray, primaryButton } from "./ui";

// A group's events. Group admins start one with a title, then build it in the HMBLBOT
// Editor (/events/:token/edit).
export default function EventsTab({ group }) {
  const [data, setData] = useState(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/groups/${group.slug}/events`).then(setData).catch((e) => setError(e.message));
  }, [group.slug]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const event = await api(`/groups/${group.slug}/events`, { method: "POST", body: { event: { title } } });
      window.location.href = `/events/${event.token}/edit`;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (!data) return error ? <ErrorNote error={error} /> : <Loading />;

  return (
    <div className="space-y-5">
      <ErrorNote error={error} />
      {data.can_create && (
        <Tray label="Start an event">
          <Card className="p-3">
            <form onSubmit={create} className="flex flex-wrap gap-2">
              <input className={`${inputClass} min-w-0 flex-1`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" maxLength={120} required />
              <button type="submit" disabled={busy || !title.trim()} className={primaryButton}><Plus className="h-4 w-4" /> New event</button>
            </form>
            <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">You'll lay out the page, agenda and photos in the HMBLBOT Editor next.</p>
          </Card>
        </Tray>
      )}

      <Tray label={`Events (${data.events.length})`}>
        {data.events.length === 0 ? (
          <Card className="p-6 text-center text-sm text-slate-500 dark:text-neutral-400">No events yet.</Card>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {data.events.map((event) => (
              <a key={event.token} href={`/events/${event.token}`} className="group block overflow-hidden rounded-xl bg-white shadow-panel hover:ring-2 hover:ring-accent/40 dark:bg-neutral-900">
                <div className={`h-28 ${event.cover_url ? "" : "bg-gradient-to-br from-accent via-sky-600 to-indigo-700"}`}>
                  {event.cover_url && <img src={event.cover_url} alt="" className="size-full object-cover" />}
                </div>
                <div className="space-y-1 p-3">
                  <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                    <span className="truncate">{event.title}</span>
                    {event.status !== "published" && <Pill tone="amber">Draft</Pill>}
                  </p>
                  {event.short_description && <p className="line-clamp-2 text-sm text-slate-600 dark:text-neutral-300">{event.short_description}</p>}
                  <p className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500 dark:text-neutral-400">
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {event.when_label || "Date to be decided"}</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {event.going_count} going</span>
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </Tray>
    </div>
  );
}
