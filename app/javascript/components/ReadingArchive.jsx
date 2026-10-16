import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, LayoutGrid, Search } from "lucide-react";
import ReadingCard from "./ReadingCard";
import { getAccentThemeFromIcon, getTagIcon } from "./ReadingArchiveUtils";

// How many themes show before "Show more"
const TOP_THEMES = 14;

const ReadingArchive = ({ readings, tags, notice, selectedTag = null }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filteredReadings = useMemo(() => {
    if (!searchQuery.trim()) return readings;
    const query = searchQuery.toLowerCase();
    return readings.filter((reading) =>
      [reading.title, reading.preview, reading.source].some((text) => text?.toLowerCase().includes(query))
    );
  }, [readings, searchQuery]);

  // The most used themes first; the rest (alphabetical) behind "Show more". The picked theme
  // always shows.
  const { shown, hiddenCount } = useMemo(() => {
    const list = tags || [];
    if (showAll) return { shown: list, hiddenCount: 0 };
    const top = [...list].sort((a, b) => (b.count || 0) - (a.count || 0) || a.title.localeCompare(b.title)).slice(0, TOP_THEMES);
    const ids = new Set(top.map((t) => t.id));
    const picked = list.find((t) => t.slug === selectedTag);
    if (picked) ids.add(picked.id);
    return { shown: list.filter((t) => ids.has(t.id)), hiddenCount: list.length - ids.size };
  }, [tags, showAll, selectedTag]);

  const chip = (active) =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "!bg-accent !text-white shadow-panel"
        : "bg-white text-slate-700 ring-1 ring-neutral-200 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700 dark:hover:bg-neutral-800"
    }`;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 !font-sans sm:px-6 lg:px-8 [&_p]:!text-left [&_p]:!hyphens-none [&_header_*]:!font-sans">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Recovery literature</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Reading archive</h1>
          <p className="text-sm text-slate-600 dark:text-neutral-400">
            The meeting readings and topics from The Acid Test and friends · {readings?.length || 0} readings
          </p>
        </div>
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search readings"
            aria-label="Search readings"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          />
        </div>
      </header>

      <section>
        <h2 className="mb-2 !text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Browse by theme</h2>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-neutral-100 p-2 dark:bg-neutral-800/70">
          <a href="/readings" className={chip(!selectedTag)}>
            <LayoutGrid className="h-4 w-4" /> All
          </a>
          {shown.map((tag) => {
            const Icon = getTagIcon(tag.icon_name, tag.slug || tag.title);
            const accent = getAccentThemeFromIcon(tag.icon_name, tag.slug || tag.title);
            const active = tag.slug === selectedTag;
            return (
              <a key={tag.id} href={`/readings?tag=${tag.slug}`} className={chip(active)} aria-current={active ? "page" : undefined}>
                <Icon className={`h-4 w-4 ${active ? "" : accent.text}`} strokeWidth={2} />
                {tag.title}
                {tag.count > 0 && <span className={`text-xs ${active ? "text-white/80" : "text-slate-400 dark:text-neutral-500"}`}>{tag.count}</span>}
              </a>
            );
          })}
          {(hiddenCount > 0 || showAll) && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="inline-flex items-center gap-1 rounded-full !bg-transparent px-3 py-1.5 text-sm font-medium text-accent hover:underline"
            >
              {showAll ? <>Show fewer <ChevronUp className="h-4 w-4" /></> : <>Show more ({hiddenCount}) <ChevronDown className="h-4 w-4" /></>}
            </button>
          )}
        </div>
      </section>

      <section className="space-y-4">
        {notice && (
          <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700 shadow-panel dark:bg-neutral-900 dark:text-neutral-200">{notice}</p>
        )}

        {!filteredReadings || filteredReadings.length === 0 ? (
          <p className="py-16 text-center !text-center !font-sans text-sm text-slate-500 dark:text-neutral-400">
            {searchQuery ? "No readings match your search." : "No readings here yet. Once your group adds readings, they'll show up here."}
          </p>
        ) : (
          <>
            <p className="!font-sans text-sm text-slate-500 dark:text-neutral-400">
              Showing {filteredReadings.length} reading{filteredReadings.length !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredReadings.map((reading) => (
                <ReadingCard key={reading.id} reading={reading} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default ReadingArchive;
