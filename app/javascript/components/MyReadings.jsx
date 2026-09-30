import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BookMarked,
  CalendarDays,
  ChevronDown,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Shell, ShellPanel } from "./ui/Shell";
import SegmentedControl from "./ui/SegmentedControl";
import { inputClass, iconInputClass } from "./ui/styles";
import { createDateFromString } from "./ui/DateTimePicker/dateUtils";
import { getTagIcon } from "./ReadingArchiveUtils";

const STATUS_FILTERS = ["all", "published", "scheduled", "draft"];
const FILTER_LABELS = { all: "All", published: "Published", scheduled: "Scheduled", draft: "Drafts" };

const EMPTY_MESSAGES = {
  all: "You haven't written any readings yet.",
  published: "Nothing published yet.",
  scheduled: "Nothing scheduled. Choose “Later” when saving a reading to publish it automatically.",
  draft: "No drafts. Choose “Draft” when saving a reading to keep it private.",
};

function formatDay(date, withYear = true) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
}

function formatTime(date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function meetingLabel(reading) {
  const date = reading.meetingDate ? createDateFromString(reading.meetingDate) : null;
  if (!date) return null;
  if (reading.meetingTime) {
    const [hours, minutes] = reading.meetingTime.split(":").map(Number);
    date.setHours(hours, minutes, 0, 0);
    return `${formatDay(date)} · ${formatTime(date)}`;
  }
  return formatDay(date);
}

function initialFilter() {
  const status = new URLSearchParams(window.location.search).get("status");
  return STATUS_FILTERS.includes(status) ? status : "all";
}

function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
}

export default function MyReadings({ readings: initialReadings = [], notice = "", alert = "" }) {
  const [readings, setReadings] = useState(initialReadings);
  const [filter, setFilter] = useState(initialFilter);
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useState(alert ? { type: "error", text: alert } : notice ? { type: "info", text: notice } : null);
  const [deletingId, setDeletingId] = useState(null);

  // Keep the chosen tab in the URL so reloads and back-navigation land on it
  useEffect(() => {
    const url = new URL(window.location.href);
    if (filter === "all") url.searchParams.delete("status");
    else url.searchParams.set("status", filter);
    window.history.replaceState(null, "", url);
  }, [filter]);

  const counts = useMemo(() => {
    const result = { all: readings.length, published: 0, scheduled: 0, draft: 0 };
    readings.forEach((reading) => {
      result[reading.status] += 1;
    });
    return result;
  }, [readings]);

  const visibleReadings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return readings.filter((reading) => {
      if (filter !== "all" && reading.status !== filter) return false;
      if (!q) return true;
      return [reading.title, reading.preview, reading.source, reading.meetingName]
        .some((field) => field?.toLowerCase().includes(q));
    });
  }, [readings, filter, query]);

  const filterOptions = STATUS_FILTERS.map((value) => ({
    value,
    label: (
      <>
        {FILTER_LABELS[value]}
        <span className="ml-1 text-xs font-normal opacity-60 tabular-nums">{counts[value]}</span>
      </>
    ),
  }));

  async function handleDelete(reading) {
    if (!window.confirm(`Delete “${reading.title || "Untitled reading"}”? This can't be undone.`)) return;

    setDeletingId(reading.id);
    try {
      await axios.delete(reading.destroy_path, {
        headers: { "X-CSRF-Token": csrfToken(), Accept: "application/json" },
        withCredentials: true,
      });
      setReadings((prev) => prev.filter((r) => r.id !== reading.id));
      setFlash({ type: "info", text: "Reading deleted." });
    } catch (error) {
      const message = error?.response?.data?.errors?.[0] || "Something went wrong while deleting.";
      setFlash({ type: "error", text: message });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      {/* Page Header */}
      <header className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 pt-20 pb-10 w-full mt-6">
        <div className="max-w-6xl mx-auto">
          <nav className="flex items-center text-sm text-slate-500 dark:text-neutral-400 mb-3">
            <a href="/readings" className="hover:text-accent transition-colors">Readings</a>
            <ChevronDown className="w-4 h-4 mx-2 text-slate-400 -rotate-90" />
            <span className="text-slate-900 dark:text-white font-medium">My Readings</span>
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-accent-tint dark:bg-accent/30 shadow-panel flex items-center justify-center shrink-0">
                <BookMarked className="w-5 h-5 text-accent dark:text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white !font-sans">My Readings</h1>
                <p className="text-sm text-slate-600 dark:text-neutral-400 mt-0.5 !font-sans">
                  Everything you've published, scheduled, or saved as a draft.
                </p>
              </div>
            </div>
            <div className="flex items-stretch rounded-panel overflow-hidden shadow-panel bg-white dark:bg-surface-dark divide-x divide-neutral-200 dark:divide-neutral-700">
              <a
                href="/readings"
                className="px-5 py-3 text-sm font-medium text-slate-900 dark:text-neutral-300 hover:bg-accent/5 dark:hover:bg-white/5 transition-colors"
              >
                Archive
              </a>
              <a
                href="/readings/new"
                className="px-5 py-3 bg-accent hover:opacity-90 text-white text-sm font-semibold transition-opacity flex items-center gap-2"
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
                New Reading
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-slate-50 dark:bg-neutral-950 px-4 min-[1400px]:px-8 py-6 min-h-[60vh]">
        <div className="max-w-7xl mx-auto space-y-6">
          {flash && (
            <div
              className={`flex items-start gap-3 rounded-panel px-4 py-3 text-sm shadow-panel ${
                flash.type === "error"
                  ? "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200"
                  : "bg-accent-tint text-accent-ink dark:bg-accent/30 dark:text-white"
              }`}
            >
              <span className="flex-1 !font-sans">{flash.text}</span>
              <button type="button" onClick={() => setFlash(null)} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Filters */}
          <Shell>
            <ShellPanel position="top">
              <SegmentedControl options={filterOptions} value={filter} onChange={setFilter} />
            </ShellPanel>
            <ShellPanel position="bottom" className="p-3">
              <div className="relative">
                <Search className={iconInputClass} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your readings…"
                  className={`${inputClass} pl-9`}
                />
              </div>
            </ShellPanel>
          </Shell>

          {/* Readings */}
          {visibleReadings.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-base text-slate-500 dark:text-neutral-400 !font-sans">
                {query ? "No readings match your search." : EMPTY_MESSAGES[filter]}
              </p>
              {!query && (filter === "all" || filter === "draft") && (
                <a
                  href="/readings/new"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-panel hover:opacity-90"
                >
                  <Plus className="w-4 h-4" strokeWidth={2.5} />
                  Write a reading
                </a>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visibleReadings.map((reading) => (
                <MyReadingCard
                  key={reading.id}
                  reading={reading}
                  deleting={deletingId === reading.id}
                  onDelete={() => handleDelete(reading)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatusBadge({ reading }) {
  const publishedAt = reading.published_at ? new Date(reading.published_at) : null;
  const updatedAt = new Date(reading.updated_at);

  const variants = {
    published: {
      className: "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
      dot: "bg-emerald-500",
      label: "Published",
      detail: publishedAt && formatDay(publishedAt),
    },
    scheduled: {
      className: "bg-accent-tint text-accent-ink dark:bg-accent/35 dark:text-white",
      dot: "bg-accent dark:bg-white",
      label: "Goes live",
      detail: publishedAt && `${formatDay(publishedAt, false)} · ${formatTime(publishedAt)}`,
    },
    draft: {
      className: "bg-neutral-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300",
      dot: "bg-slate-400",
      label: "Draft",
      detail: `edited ${formatDay(updatedAt, false)}`,
    },
  };
  const variant = variants[reading.status] || variants.draft;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${variant.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${variant.dot}`} aria-hidden="true" />
      <span className="font-semibold">{variant.label}</span>
      {variant.detail && <span className="opacity-75">{variant.detail}</span>}
    </span>
  );
}

function MyReadingCard({ reading, deleting, onDelete }) {
  const tags = reading.tags || [];
  const meeting = meetingLabel(reading);

  return (
    <Shell as="article" className={`h-full transition-opacity ${deleting ? "opacity-50 pointer-events-none" : ""}`}>
      <ShellPanel position="top" className="flex-1">
        <a href={reading.path} className="flex h-full flex-col p-5 hover:bg-accent/[0.03] dark:hover:bg-white/[0.03] transition-colors">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusBadge reading={reading} />
          </div>

          <h3 className="text-lg font-bold uppercase tracking-wider text-slate-900 dark:text-white ttSans line-clamp-2">
            {reading.title || "Untitled reading"}
          </h3>

          {meeting && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-neutral-400 !font-sans">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              {reading.meetingName ? `${reading.meetingName} · ` : ""}{meeting}
            </p>
          )}

          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-neutral-300 line-clamp-3 reading-prose !text-sm">
            {reading.preview || <span className="italic opacity-60">No content yet.</span>}
          </p>

          <div className="mt-auto pt-4 space-y-3">
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.slice(0, 3).map((tag) => {
                  const Icon = getTagIcon(tag.icon_name);
                  return (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 rounded-full bg-accent-tint px-2.5 py-1 text-xs font-medium text-accent-ink dark:bg-accent/30 dark:text-white"
                    >
                      <Icon className="h-3 w-3 shrink-0" strokeWidth={2.5} />
                      {tag.title}
                    </span>
                  );
                })}
                {tags.length > 3 && (
                  <span className="px-1 py-1 text-xs font-medium text-slate-400">+{tags.length - 3}</span>
                )}
              </div>
            )}

            {reading.source && (
              <cite className="block truncate text-xs italic text-slate-500 dark:text-neutral-400">{reading.source}</cite>
            )}
          </div>
        </a>
      </ShellPanel>

      {/* Action bar */}
      <ShellPanel position="bottom">
        <div className="flex items-stretch divide-x divide-neutral-200 dark:divide-neutral-700 text-sm">
          <a
            href={reading.path}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 font-medium text-slate-900 dark:text-neutral-300 hover:bg-accent/5 dark:hover:bg-white/5 transition-colors"
          >
            <Eye className="h-4 w-4" />
            {reading.status === "published" ? "View" : "Preview"}
          </a>
          <a
            href={reading.edit_path}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 font-medium text-slate-900 dark:text-neutral-300 hover:bg-accent/5 dark:hover:bg-white/5 transition-colors"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </a>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            title="Delete reading"
            className="w-14 shrink-0 inline-flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-300 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </ShellPanel>
    </Shell>
  );
}
