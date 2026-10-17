import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import { blocksOn, clock, dayParts, daysBetween, formatStart, parseStart, startProblem } from "./lib";

// The poll's days side by side (the week view from metr): a row per slot, times that
// don't work hatched, the voter's picks as numbered blocks the length of the event,
// and, when results are showing, a heat map of how many points each slot drew.

const PX_PER_MIN = 0.8; // 48px an hour
const px = (minutes) => minutes * PX_PER_MIN;
const HATCH = { backgroundImage: "repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 7px)" };

function Hatched({ from, to, label, tone = "block" }) {
  if (to <= from) return null;
  return (
    <div
      className={`pointer-events-none absolute inset-x-0.5 overflow-hidden rounded-md ${tone === "block" ? "bg-neutral-300/50 text-neutral-500 dark:bg-neutral-700/60 dark:text-neutral-400" : "text-neutral-400 dark:text-neutral-600"}`}
      style={{ top: px(from) + 1, height: px(to - from) - 2 }}
    >
      <div className="absolute inset-0 opacity-40" style={HATCH} />
      {label && px(to - from) >= 18 && (
        <span className="relative block truncate px-1 pt-0.5 text-[10px] font-medium leading-tight text-neutral-600 dark:text-neutral-300">{label}</span>
      )}
    </div>
  );
}

export default function WeekGrid({ poll, now, picks = [], onToggle, heat = null, interactive = true }) {
  const [hover, setHover] = useState(null);
  const days = daysBetween(poll.starts_on, poll.ends_on);
  const viewStart = Math.floor(poll.day_start_minute / 60) * 60;
  const viewEnd = Math.min(1440, Math.ceil(poll.day_end_minute / 60) * 60);
  const slot = poll.slot_minutes;
  const rows = [];
  for (let m = viewStart; m < viewEnd; m += slot) rows.push(m);
  const hours = rows.filter((m) => m % 60 === 0);
  const height = px(viewEnd - viewStart);
  const cols = `40px repeat(${days.length}, minmax(${days.length > 7 ? 52 : 0}px, 1fr))`;
  const today = now?.date;

  const pickRank = useMemo(() => new Map(picks.map((p, i) => [p, i + 1])), [picks]);
  const full = picks.length >= poll.choices_count;

  return (
    <div className="rounded-panel bg-white p-2 shadow-panel dark:bg-surface-dark">
      <div className="max-h-[72vh] overflow-auto overscroll-contain">
        <div style={{ minWidth: days.length > 7 ? 40 + days.length * 54 : undefined }}>
          <div className="sticky top-0 z-30 grid gap-1 bg-white pb-1 dark:bg-surface-dark" style={{ gridTemplateColumns: cols }}>
            <div />
            {days.map((date) => {
              const d = dayParts(date);
              return (
                <div key={date} className={`rounded-lg py-1 text-center ${date === today ? "text-accent" : "text-slate-700 dark:text-neutral-200"}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">{d.weekday}</p>
                  <p className="text-base font-semibold leading-tight sm:text-lg">{d.day}</p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-x-1" style={{ gridTemplateColumns: cols }}>
            <div className="relative" style={{ height }}>
              {hours.map((m) => (
                <span key={m} className="absolute right-1 -translate-y-1/2 text-[10px] text-slate-400 dark:text-neutral-500" style={{ top: Math.max(px(m - viewStart), 6) }}>
                  {clock(m, { compact: true })}
                </span>
              ))}
            </div>

            {days.map((date) => {
              const past = today && date < today;
              const pastUntil = past ? viewEnd : date === today ? Math.min(viewEnd, now.minute) : viewStart;
              return (
                <div key={date} className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
                  {rows.map((m) => {
                    const start = formatStart(date, m);
                    const ok = interactive && !startProblem(poll, date, m, now);
                    const h = heat?.cells.get(start) || 0;
                    const shade = heat && h > 0 ? 12 + Math.round((h / heat.max) * 70) : 0;
                    return (
                      <div key={m} className={`p-px ${m % 60 === 0 ? "" : ""}`} style={{ height: px(slot) }}>
                        <button
                          type="button"
                          tabIndex={ok ? 0 : -1}
                          disabled={!ok || (full && !pickRank.has(start))}
                          aria-label={`${dayParts(date).long} ${clock(m)}`}
                          title={h ? `${clock(m)}: ${h} point${h === 1 ? "" : "s"}` : clock(m)}
                          onClick={() => onToggle?.(start)}
                          onMouseEnter={() => setHover(ok ? start : null)}
                          onFocus={() => setHover(ok ? start : null)}
                          className={`block h-full w-full rounded-[5px] transition-colors ${m % 60 === 0 ? "bg-neutral-100 dark:bg-neutral-800" : "bg-neutral-100/70 dark:bg-neutral-800/70"} ${ok && !(full && !pickRank.has(start)) ? "cursor-pointer hover:!bg-accent-tint dark:hover:!bg-accent/30" : "cursor-default"}`}
                          style={shade ? { backgroundColor: `color-mix(in srgb, var(--color-accent) ${shade}%, transparent)` } : undefined}
                        />
                      </div>
                    );
                  })}

                  <Hatched from={0} to={poll.day_start_minute - viewStart} tone="hours" />
                  <Hatched from={Math.min(poll.day_end_minute, viewEnd) - viewStart} to={viewEnd - viewStart} tone="hours" />
                  {blocksOn(poll, date).map((b, i) => (
                    <Hatched key={i} from={Math.max(b.start, viewStart) - viewStart} to={Math.min(b.end, viewEnd) - viewStart} label={b.label} />
                  ))}
                  {pastUntil > viewStart && <Hatched from={0} to={pastUntil - viewStart} tone="hours" />}

                  {hover && !pickRank.has(hover) && !full && parseStart(hover).date === date && (
                    <div
                      className="pointer-events-none absolute inset-x-0.5 z-10 rounded-md border-2 border-dashed border-accent/70 bg-accent/10"
                      style={{ top: px(parseStart(hover).minute - viewStart), height: px(poll.duration_minutes) }}
                    />
                  )}

                  {picks.map((start, i) => {
                    const p = parseStart(start);
                    if (!p || p.date !== date) return null;
                    return (
                      <button
                        key={start}
                        type="button"
                        onClick={() => interactive && onToggle?.(start)}
                        className="group absolute inset-x-0.5 z-20 overflow-hidden rounded-md !bg-accent px-1 py-0.5 text-left !text-white shadow-panel ring-2 ring-white dark:ring-surface-dark"
                        style={{ top: px(p.minute - viewStart), height: px(poll.duration_minutes) }}
                        title={interactive ? "Remove this pick" : undefined}
                      >
                        <span className="flex items-center gap-1">
                          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-accent">{i + 1}</span>
                          <span className="hidden truncate text-[10px] font-semibold !text-white sm:inline">{clock(p.minute, { compact: true })}</span>
                          {interactive && <X className="ml-auto hidden h-3 w-3 shrink-0 group-hover:block" />}
                        </span>
                      </button>
                    );
                  })}

                  {date === today && now.minute >= viewStart && now.minute < viewEnd && (
                    <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-red-500" style={{ top: px(now.minute - viewStart) }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Points per slot: a pick counts toward every slot its event would cover
export function buildHeat(poll, results) {
  if (!results?.length) return null;
  const cells = new Map();
  for (const row of results) {
    const p = parseStart(row.start);
    if (!p) continue;
    for (let m = p.minute; m < p.minute + poll.duration_minutes; m += poll.slot_minutes) {
      const key = formatStart(p.date, m);
      cells.set(key, (cells.get(key) || 0) + row.points);
    }
  }
  return { cells, max: Math.max(1, ...cells.values()) };
}
