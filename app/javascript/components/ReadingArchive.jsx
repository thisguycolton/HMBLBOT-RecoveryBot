import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, LayoutGrid, Search, X } from "lucide-react";
import ReadingCard from "./ReadingCard";
import { getAccentThemeFromIcon, getTagIcon } from "./ReadingArchiveUtils";

// How many themes show before "Show more"
const TOP_THEMES = 14;

// A link to /readings that keeps the theme and search
const archiveUrl = ({ tag, q, page }) => {
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", page);
  const qs = params.toString();
  return qs ? `/readings?${qs}` : "/readings";
};

// Page numbers to show: the first, the last, and two either side of this one, with gaps
const pageList = (page, pages) => {
  const keep = new Set([1, pages]);
  for (let p = page - 2; p <= page + 2; p++) if (p >= 1 && p <= pages) keep.add(p);
  const out = [];
  [...keep].sort((a, b) => a - b).forEach((p, i, all) => {
    if (i > 0 && p - all[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
};

const Pagination = ({ page, pages, selectedTag, query }) => {
  if (pages <= 1) return null;
  const step =
    "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800";
  const off = "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 dark:text-neutral-600";
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-center gap-1 pt-2">
      {page > 1 ? (
        <a href={archiveUrl({ tag: selectedTag, q: query, page: page - 1 })} className={step} rel="prev">
          <ChevronLeft className="h-4 w-4" /> Previous
        </a>
      ) : (
        <span className={off}><ChevronLeft className="h-4 w-4" /> Previous</span>
      )}
      {pageList(page, pages).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-slate-400">…</span>
        ) : (
          <a
            key={p}
            href={archiveUrl({ tag: selectedTag, q: query, page: p })}
            aria-current={p === page ? "page" : undefined}
            className={`min-w-[2.25rem] rounded-lg px-2.5 py-1.5 text-center text-sm font-medium ${
              p === page ? "!bg-accent !text-white" : "text-slate-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            }`}
          >
            {p}
          </a>
        )
      )}
      {page < pages ? (
        <a href={archiveUrl({ tag: selectedTag, q: query, page: page + 1 })} className={step} rel="next">
          Next <ChevronRight className="h-4 w-4" />
        </a>
      ) : (
        <span className={off}>Next <ChevronRight className="h-4 w-4" /></span>
      )}
    </nav>
  );
};

const PER_PAGE = 24;

const ReadingArchive = ({ readings, tags, notice, selectedTag = null, page = 1, pages = 1, total, query = "" }) => {
  const [showAll, setShowAll] = useState(false);
  const count = total ?? readings?.length ?? 0;

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
            The meeting readings and topics from The Acid Test and friends
          </p>
        </div>
        <form method="get" action="/readings" role="search" className="relative w-full md:max-w-sm">
          {selectedTag && <input type="hidden" name="tag" value={selectedTag} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            name="q"
            placeholder="Search by title or source"
            aria-label="Search readings"
            defaultValue={query}
            className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          />
        </form>
      </header>

      <section>
        <h2 className="mb-2 !text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Browse by theme</h2>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-neutral-100 p-2 dark:bg-neutral-800/70">
          <a href={archiveUrl({ q: query })} className={chip(!selectedTag)}>
            <LayoutGrid className="h-4 w-4" /> All
          </a>
          {shown.map((tag) => {
            const Icon = getTagIcon(tag.icon_name, tag.slug || tag.title);
            const accent = getAccentThemeFromIcon(tag.icon_name, tag.slug || tag.title);
            const active = tag.slug === selectedTag;
            return (
              <a key={tag.id} href={archiveUrl({ tag: tag.slug, q: query })} className={chip(active)} aria-current={active ? "page" : undefined}>
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

        {query && (
          <p className="flex flex-wrap items-center gap-2 !font-sans text-sm text-slate-600 dark:text-neutral-300">
            Results for “{query}”
            <a href={archiveUrl({ tag: selectedTag })} className="inline-flex items-center gap-1 text-accent hover:underline">
              <X className="h-3.5 w-3.5" /> Clear search
            </a>
          </p>
        )}

        {!readings || readings.length === 0 ? (
          <p className="py-16 text-center !text-center !font-sans text-sm text-slate-500 dark:text-neutral-400">
            {query ? "No readings match your search." : "No readings here yet. Once your group adds readings, they'll show up here."}
          </p>
        ) : (
          <>
            <p className="!font-sans text-sm text-slate-500 dark:text-neutral-400">
              {pages > 1
                ? `Showing ${(page - 1) * PER_PAGE + 1}–${(page - 1) * PER_PAGE + readings.length} of ${count} readings`
                : `${count} reading${count !== 1 ? "s" : ""}`}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {readings.map((reading) => (
                <ReadingCard key={reading.id} reading={reading} />
              ))}
            </div>
            <Pagination page={page} pages={pages} selectedTag={selectedTag} query={query} />
          </>
        )}
      </section>
    </div>
  );
};

export default ReadingArchive;
