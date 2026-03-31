import React, { useMemo, useState } from "react";
import { BookOpen, Plus, ChevronRight, X } from "lucide-react";

function groupByTitle(serviceReadings = []) {
  const grouped = new Map();

  serviceReadings.forEach((reading) => {
    const key = reading.title || "Untitled";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(reading);
  });

  return Array.from(grouped.entries()).map(([title, readings]) => ({
    title,
    readings,
    first: readings[0],
  }));
}

function ServiceReadingCard({ group, onOpen }) {
  const { title, readings, first } = group;
  const hasMany = readings.length > 1;

  const content = (
    <div className="group h-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 ">
      <div className="grid h-full grid-cols-[120px_1fr]">
        <div className="relative bg-cyan-100 dark:bg-cyan-950/40">
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 dark:text-slate-600">
            <BookOpen className="h-14 w-14 opacity-50" />
          </div>
        </div>

        <div className="flex flex-col justify-center p-5 text-left">
          <h3 className="mb-3 text-xl font-bold uppercase tracking-widest text-slate-900 dark:text-slate-100">
            {title}
          </h3>

          <p className="text-sm uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {hasMany ? `${readings.length} sources` : first?.source}
          </p>

          <div className="mt-4 flex items-center gap-2 text-sm font-medium text-cyan-700 dark:text-cyan-300">
            <span>{hasMany ? "View sources" : "Open reading"}</span>
            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </div>
  );

  if (hasMany) {
    return (
      <button type="button" onClick={onOpen} className="block h-full w-full text-left">
        {content}
      </button>
    );
  }

  return (
    <a href={`/service_readings/${first.id}`} className="block h-full">
      {content}
    </a>
  );
}

function SourcesModal({ group, onClose }) {
  if (!group) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="text-xl font-bold uppercase tracking-widest text-slate-900 dark:text-slate-100">
            {group.title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="space-y-2">
            {group.readings.map((reading) => (
              <a
                key={reading.id}
                href={`/service_readings/${reading.id}`}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm uppercase tracking-widest text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span>{reading.source}</span>
                <ChevronRight className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ServiceReadingsIndex({
  serviceReadings = [],
  isAdmin = false,
}) {
  const grouped = useMemo(() => groupByTitle(serviceReadings), [serviceReadings]);
  const [openGroup, setOpenGroup] = useState(null);

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 min-w-screen">
      <section className="border-b-8 border-cyan-200 bg-teal-700 text-white shadow-sm dark:border-cyan-900">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <div className="flex flex-col items-center text-center pt-0">
            <div className="mb-4 rounded-3xl bg-white/10 p-4">
              <BookOpen className="h-12 w-12 md:h-14 md:w-14" />
            </div>

            <h1 className="text-4xl font-bold tracking-widest md:text-6xl ttSans">
              SERVICE READINGS
            </h1>

            <p className="mt-4 max-w-2xl text-base text-cyan-50 md:text-xl">
              An index of commonly used meeting readings for service work.
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        {grouped.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {grouped.map((group) => (
              <ServiceReadingCard
                key={group.title}
                group={group}
                onOpen={() => setOpenGroup(group)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            No service readings yet.
          </div>
        )}

        {isAdmin && (
          <div className="mt-8">
            <a
              href="/service_readings/new"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-lg font-semibold text-white transition hover:bg-emerald-500"
            >
              <Plus className="h-5 w-5" />
              New Service Reading
            </a>
          </div>
        )}
      </main>

      <SourcesModal group={openGroup} onClose={() => setOpenGroup(null)} />
    </div>
  );
}