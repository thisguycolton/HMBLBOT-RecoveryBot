import React, { useMemo, useState } from "react";
import { BookOpen, ChevronRight, Plus, Search } from "lucide-react";

// Readings that share a title (How It Works from the Big Book and from a pamphlet, say)
// show as one card that lists each source.
function groupByTitle(serviceReadings = []) {
  const grouped = new Map();

  serviceReadings.forEach((reading) => {
    const key = reading.title || "Untitled";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(reading);
  });

  return Array.from(grouped.entries()).map(([title, readings]) => ({ title, readings }));
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900";

function IconTile() {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-tint text-accent dark:bg-accent/15 dark:text-accent-light">
      <BookOpen className="size-5" strokeWidth={2.25} />
    </span>
  );
}

// One source: the whole card is the link
function SingleCard({ title, reading }) {
  return (
    <a
      href={`/service_readings/${reading.id}`}
      className={`group flex min-w-0 items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 !text-slate-900 shadow-sm transition hover:border-accent/40 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:!text-white dark:hover:border-accent-light/40 ${focusRing}`}
    >
      <IconTile />
      <div className="min-w-0 flex-1">
        <div className="text-base font-semibold leading-snug break-words">{title}</div>
        {reading.source && (
          <div className="mt-0.5 text-sm text-slate-500 break-words dark:text-neutral-400">{reading.source}</div>
        )}
      </div>
      <ChevronRight className="size-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-accent dark:text-neutral-500 dark:group-hover:text-accent-light" />
    </a>
  );
}

// Several sources: the card lists them, each its own link
function MultiCard({ title, readings }) {
  return (
    <div className="min-w-0 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-4">
        <IconTile />
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold leading-snug text-slate-900 break-words dark:text-white">{title}</div>
          <div className="mt-0.5 text-sm text-slate-500 dark:text-neutral-400">{readings.length} sources</div>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {readings.map((reading) => (
          <li key={reading.id}>
            <a
              href={`/service_readings/${reading.id}`}
              className={`group flex min-w-0 items-center gap-3 rounded-xl bg-neutral-50 px-3.5 py-2.5 text-sm !text-slate-700 transition hover:bg-accent-tint hover:!text-accent-ink dark:bg-neutral-800/70 dark:!text-neutral-200 dark:hover:bg-accent/15 dark:hover:!text-white ${focusRing}`}
            >
              <span className="min-w-0 flex-1 break-words">{reading.source || "Untitled source"}</span>
              <ChevronRight className="size-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-accent dark:text-neutral-500 dark:group-hover:text-accent-light" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ServiceReadingsIndex({ serviceReadings = [], isAdmin = false }) {
  const [query, setQuery] = useState("");
  const grouped = useMemo(() => groupByTitle(serviceReadings), [serviceReadings]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return grouped;
    return grouped
      .map((group) => {
        if (group.title.toLowerCase().includes(q)) return group;
        const readings = group.readings.filter((r) => (r.source || "").toLowerCase().includes(q));
        return readings.length ? { ...group, readings } : null;
      })
      .filter(Boolean);
  }, [grouped, query]);

  return (
    <div className="w-full min-w-0 px-4 py-8 sm:px-6 md:py-12 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6 !font-sans [&_*]:!font-sans">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Service Readings</h1>
            <div className="mt-1 text-sm text-slate-600 dark:text-neutral-400">
              The readings meetings use most, ready to read aloud or paste in the chat.
            </div>
          </div>

          {isAdmin && (
            <a
              href="/service_readings/new"
              className={`inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold !text-white shadow-sm transition hover:bg-accent/90 ${focusRing}`}
            >
              <Plus className="size-4" />
              New reading
            </a>
          )}
        </div>

        {grouped.length > 5 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-accent dark:text-accent-light" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search readings and sources"
              aria-label="Search readings and sources"
              className="h-12 w-full rounded-full border border-neutral-200 bg-white pl-12 pr-5 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500"
            />
          </div>
        )}

        {visible.length > 0 ? (
          <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((group) =>
              group.readings.length > 1 ? (
                <MultiCard key={group.title} title={group.title} readings={group.readings} />
              ) : (
                <SingleCard key={group.title} title={group.title} reading={group.readings[0]} />
              )
            )}
          </div>
        ) : (
          <div className="rounded-3xl bg-neutral-100 px-6 py-10 text-center text-sm text-slate-600 dark:bg-neutral-800/60 dark:text-neutral-400">
            {grouped.length ? "No readings match." : "No service readings yet."}
          </div>
        )}
      </div>
    </div>
  );
}
