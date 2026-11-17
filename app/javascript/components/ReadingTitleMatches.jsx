import React, { useEffect, useState } from "react";
import { CalendarDays, Copy, ExternalLink, Search, Undo2, X } from "lucide-react";

// While someone types a new reading's title: every reading they may see with those words in
// its title (any group), with when its meeting was held, and "Adopt" to start from one

// "2025-11-11" + "19:00" -> "Tue, Nov 11, 2025 · 7:00 PM" (the meeting's own date, read as local)
export function heldLabel(date, time) {
  if (!date) return "No meeting date";
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  let label = day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  if (time) {
    const [h, min] = time.split(":").map(Number);
    day.setHours(h, min || 0);
    label += ` · ${day.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }
  return label;
}

function useTitleMatches(query, enabled, exceptId) {
  const [state, setState] = useState({ query: "", matches: [], total: 0, loading: false });

  useEffect(() => {
    const q = query.trim();
    if (!enabled || q.length < 2) {
      setState({ query: "", matches: [], total: 0, loading: false });
      return undefined;
    }

    setState((s) => ({ ...s, loading: true }));
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q });
        if (exceptId) params.set("except", exceptId);
        const response = await fetch(`/readings/title_matches?${params}`, {
          headers: { Accept: "application/json" },
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setState({ query: q, matches: data.matches || [], total: data.total || 0, loading: false });
      } catch (error) {
        if (error.name !== "AbortError") setState({ query: q, matches: [], total: 0, loading: false });
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, enabled, exceptId]);

  return state;
}

const STATUS_LABELS = { draft: "Your draft", scheduled: "Scheduled" };

function MatchRow({ match, onAdopt, adopting }) {
  const status = STATUS_LABELS[match.status];
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-slate-900 dark:text-white break-words">{match.title}</span>
          {status && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              {status}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600 dark:text-neutral-400">
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={13} aria-hidden="true" />
            Held {heldLabel(match.meeting_date, match.meeting_time)}
          </span>
          {match.meeting_name && <span className="break-words">{match.meeting_name}</span>}
        </div>
        {match.topic_count > 0 && (
          <div className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400 line-clamp-2">
            <span className="font-medium">{match.topic_count === 1 ? "1 topic" : `${match.topic_count} topics`}:</span>{" "}
            {match.topics.join(" · ")}
            {match.topic_count > match.topics.length ? " …" : ""}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a
          href={match.path}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <ExternalLink size={13} aria-hidden="true" /> View
        </a>
        <button
          type="button"
          onClick={() => onAdopt(match)}
          disabled={adopting}
          className="inline-flex items-center gap-1 rounded-full !bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
        >
          <Copy size={13} aria-hidden="true" /> {adopting ? "Adopting…" : "Adopt"}
        </button>
      </div>
    </li>
  );
}

export default function ReadingTitleMatches({ title, enabled, exceptId, adopted, onAdopt, onUndo }) {
  const [hiddenFor, setHiddenFor] = useState(null);
  const [adoptingId, setAdoptingId] = useState(null);
  const [error, setError] = useState(null);
  const { query, matches, total } = useTitleMatches(title, enabled && !adopted, exceptId);

  if (adopted) {
    return (
      <div className="mt-4 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-100 dark:ring-sky-500/30 !font-sans">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold">
              Adopted from{" "}
              <a href={adopted.path} target="_blank" rel="noopener" className="underline underline-offset-2">
                {adopted.title}
              </a>
            </div>
            <div className="mt-0.5 text-xs opacity-80">
              {[adopted.meeting_name, `held ${heldLabel(adopted.meeting_date, adopted.meeting_time)}`].filter(Boolean).join(", ")}.
              {" "}Its words and topics are filled in. Add your own topics under Example Topics.
            </div>
          </div>
          <button
            type="button"
            onClick={onUndo}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-sky-100 dark:hover:bg-sky-500/20"
          >
            <Undo2 size={13} aria-hidden="true" /> Undo
          </button>
        </div>
      </div>
    );
  }

  // Nothing yet (still typing), nothing found, or hidden for this title
  if (!enabled || !query || hiddenFor === query || !matches.length) return null;

  async function adopt(match) {
    setAdoptingId(match.id);
    setError(null);
    try {
      await onAdopt(match);
    } catch (e) {
      console.error("Failed to adopt reading", e);
      setError("Couldn't load that reading. Try again.");
    } finally {
      setAdoptingId(null);
    }
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl bg-white text-sm shadow-panel ring-1 ring-black/5 dark:bg-neutral-950 dark:ring-white/10 !font-sans">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 dark:border-neutral-800">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
          <Search size={13} aria-hidden="true" />
          {total === 1 ? "1 reading has this title" : `${total} readings have this title`}
        </span>
        <button
          type="button"
          onClick={() => setHiddenFor(query)}
          aria-label="Hide matching readings"
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-neutral-800"
        >
          <X size={16} />
        </button>
      </div>
      <p className="px-4 pt-2.5 text-xs text-slate-500 dark:text-neutral-400">
        Adopt one to start from its words and topics, then add your own topics.
      </p>
      {error && <p className="px-4 pt-2 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
      <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-neutral-800">
        {matches.map((match) => (
          <MatchRow key={match.id} match={match} onAdopt={adopt} adopting={adoptingId === match.id} />
        ))}
      </ul>
      {total > matches.length && (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-neutral-800 dark:text-neutral-400">
          Showing the {matches.length} most recent. Type more of the title to narrow it down.
        </p>
      )}
    </div>
  );
}
