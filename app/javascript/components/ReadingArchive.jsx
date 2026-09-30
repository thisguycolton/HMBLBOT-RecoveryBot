import React, { useState, useMemo } from "react";
import { BookMarked, Search, Quote, HelpCircle } from "lucide-react";
import ReadingCard from "./ReadingCard";
import { getTagIcon, getAccentThemeFromIcon } from "./ReadingArchiveUtils";

const ReadingArchive = ({ readings, tags, notice }) => {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter readings based on search query
  const filteredReadings = useMemo(() => {
    if (!searchQuery.trim()) return readings;
    const query = searchQuery.toLowerCase();
    return readings.filter((reading) => {
      const titleMatch = reading.title?.toLowerCase().includes(query);
      const previewMatch = reading.preview?.toLowerCase().includes(query);
      const sourceMatch = reading.source?.toLowerCase().includes(query);
      return titleMatch || previewMatch || sourceMatch;
    });
  }, [readings, searchQuery]);

  // Sample quote for hero - recovery-themed
  const heroQuote = "One day at a time, one step at a time. Recovery is a journey, not a destination.";

  return (
    <div className="w-full min-w-0 bg-slate-950 text-slate-100">
      {/* Hero / Jumbotron - Horizontal layout */}
      <section className="relative isolate overflow-hidden w-full border-b border-slate-800/50">
        {/* Rich atmospheric gradient background */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-[#4a192c] via-[#6b2139] to-[#1a2649] opacity-90" />
        {/* Subtle texture overlay */}
        <div className="pointer-events-none absolute inset-0 z-0 opacity-5 bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.1),transparent_50%)]" />
        
        {/* Hero content - positioned above background */}
        <div className="relative z-10 w-full">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-stretch">
              
              {/* Left: Icon */}
              <div className="flex-shrink-0 flex items-center lg:w-20">
                <div className="mx-auto lg:mx-0 flex h-16 w-16 items-center justify-center rounded-xl bg-white/10 shadow-lg border border-white/20">
                  <BookMarked className="h-8 w-8 text-rose-200" strokeWidth={1.5} />
                </div>
              </div>

              {/* Center: Main content */}
              <div className="flex-1 flex flex-col justify-center py-4 lg:py-0 lg:px-8">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-rose-200/80 !font-sans">
                  Recovery Literature
                </p>

                <h1 className="mt-2 text-xl font-extrabold tracking-[0.25em] text-white drop-shadow-lg !font-sans">
                  READING ARCHIVE
                </h1>

                <p className="mt-3 text-sm text-rose-100/80 max-w-lg !font-sans">
                  An index of the meeting readings and topics from The Acid Test and friends.
                </p>

                {/* Archive stats */}
                <div className="mt-4 flex gap-6 text-xs font-semibold uppercase tracking-wide text-rose-100/70">
                  <span>{readings?.length || 0} Readings</span>
                  <span className="text-rose-300/50">•</span>
                  <span>{tags?.length || 0} Tags</span>
                </div>

                {/* Search field - wider */}
                <div className="mt-5">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-100" />
                    <input
                      type="text"
                      placeholder="Search readings by title or content..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-white/20 bg-slate-900/40 py-2.5 pl-11 pr-4 text-sm text-white placeholder:text-slate-400 shadow-xl backdrop-blur-sm transition-colors hover:border-white/30 focus:border-rose-400/50 focus:ring-2 focus:ring-rose-400/20"
                      style={{ maxWidth: '600px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Right: Quote section */}
              <div className="mt-6 lg:mt-0 lg:flex-[0_0_280px] lg:border-l border-white/10 lg:pl-8 lg:py-4">
                <div className="flex items-start gap-3">
                  <Quote className="h-5 w-5 text-rose-300/50 flex-shrink-0 mt-1" strokeWidth={1.5} />
                  <blockquote className="text-sm italic text-rose-100/70">
                    {heroQuote}
                  </blockquote>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Browse by Theme */}
      <section className="w-full border-b border-slate-800 bg-slate-900/20 py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
            Browse by Theme
          </h2>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* All button */}
            <a
              href="/readings"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-rose-500/50 bg-rose-900/30 px-4 py-2.5 text-sm font-semibold text-rose-100 transition-all hover:border-rose-400 hover:bg-rose-900/50 hover:shadow-lg"
            >
              <span className="text-base">▦</span>
              All
            </a>

            {/* Tag filter buttons - larger, with icons */}
            {tags?.map((tag) => {
              const IconComponent = getTagIcon(tag.icon_name);
              const accentTheme = getAccentThemeFromIcon(tag.icon_name);
              
              return (
                <a
                  key={tag.id}
                  href={`/readings?tag=${tag.slug}`}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all hover:shadow-lg ${accentTheme.border} ${accentTheme.bg} ${accentTheme.text}`}
                >
                  <IconComponent className="h-4 w-4" strokeWidth={2} />
                  {tag.title}
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="w-full bg-slate-950">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {notice && (
            <div className="mb-6 rounded-xl bg-slate-800/50 px-4 py-3 text-sm text-slate-300 border border-slate-700/50">
              {notice}
            </div>
          )}

          {!filteredReadings || filteredReadings.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-base text-slate-400">
                {searchQuery
                  ? "No readings match your search."
                  : "No readings found yet. Once your group adds readings, they&apos;ll show up here."}
              </p>
            </div>
          ) : (
            <>
              {/* Results toolbar */}
              <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4 ">
                <p className="text-sm text-slate-400 !font-sans">
                  Showing {filteredReadings.length} reading{filteredReadings.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Reading Grid - Responsive: 1 col mobile, 2 tablet, 3 desktop */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredReadings.map((reading) => (
                  <ReadingCard key={reading.id} reading={reading} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default ReadingArchive;
