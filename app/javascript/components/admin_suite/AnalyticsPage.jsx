import React, { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import SegmentedControl from "../ui/SegmentedControl";
import { api } from "../topicificator_admin/api";
import { StatTile, formatCount } from "./App";

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

// Ahoy visits and events. Every chart is one series in the accent color, so there's no
// legend to read; values are in tooltips and the ranked lists print their numbers.
export default function AnalyticsPage({ notify }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api(`/analytics?days=${days}`).then(setData).catch((e) => notify(e.message, "error"));
  }, [days]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-neutral-400 !font-sans">
          {data ? `Since ${formatDay(data.since)} (Phoenix time)` : "Loading…"}
        </p>
        <div className="shrink-0 [&_button]:whitespace-nowrap">
          <SegmentedControl options={RANGES} value={days} onChange={setDays} />
        </div>
      </div>

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Visits" value={formatCount(data.totals.visits)} />
            <StatTile label="Visitors" value={formatCount(data.totals.visitors)}
              detail={`${formatCount(data.new_vs_returning.new)} new, ${formatCount(data.new_vs_returning.returning)} returning`} />
            <StatTile label="Signed-in members" value={formatCount(data.totals.signed_in_visitors)} />
            <StatTile label="Events" value={formatCount(data.totals.events)} />
          </div>

          <Shell>
            <ShellBand icon={Activity} title="Visits per day" subtitle="Hover a day for visits and visitors" />
            <ShellPanel position="bottom" className="p-4">
              <DailyChart daily={data.daily} />
            </ShellPanel>
          </Shell>

          <div className="grid gap-6 lg:grid-cols-2">
            <RankedList title="Top pages" subtitle="controller#action, not counting API calls or admin pages" rows={data.top_pages} />
            <RankedList title="Most-viewed readings" rows={data.top_readings} />
            <RankedList title="Events" rows={data.top_events} />
            <RankedList title="Landing pages" rows={data.landing_pages} />
            <RankedList title="Referrers" rows={data.referrers} />
            <RankedList title="Devices" rows={data.devices} />
            <RankedList title="Browsers" rows={data.browsers} />
            <RankedList title="Operating systems" rows={data.operating_systems} />
            <RankedList title="Countries" rows={data.countries} />
            <RankedList title="Cities" rows={data.cities} />
          </div>
        </>
      )}
    </div>
  );
}

function formatDay(iso, opts = { month: "short", day: "numeric", year: "numeric" }) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
}

// Bars anchored to the baseline, rounded at the data end, 2px gaps. The hover target is the
// whole day column, taller than the bar.
function DailyChart({ daily }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...daily.map((d) => d.visits));
  const active = hover == null ? null : daily[hover];
  const step = Math.max(1, Math.ceil(daily.length / 8));

  return (
    <div>
      <div className="h-6 text-sm text-slate-700 dark:text-neutral-300 !font-sans" aria-live="polite">
        {active ? `${formatDay(active.date, { weekday: "short", month: "short", day: "numeric" })}: ${formatCount(active.visits)} visits, ${formatCount(active.visitors)} visitors` : ""}
      </div>
      <div className="relative h-48 border-b border-neutral-300 dark:border-neutral-600">
        <span className="absolute -top-1 left-0 text-xs text-slate-400 !font-sans">{formatCount(max)}</span>
        <div className="absolute inset-0 flex items-end gap-[2px] pl-8" onMouseLeave={() => setHover(null)}>
          {daily.map((d, i) => (
            <div key={d.date} className="flex-1 h-full flex items-end cursor-default" onMouseEnter={() => setHover(i)}
              title={`${d.date}: ${d.visits} visits, ${d.visitors} visitors`}>
              <div
                className={`w-full rounded-t-[4px] ${hover === i ? "bg-accent" : "bg-accent/70"}`}
                style={{ height: `${(d.visits / max) * 100}%`, minHeight: d.visits ? 2 : 0 }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-[2px] pl-8 mt-1">
        {daily.map((d, i) => (
          <span key={d.date} className="flex-1 text-[10px] text-slate-400 !font-sans text-center overflow-visible whitespace-nowrap">
            {i % step === 0 ? formatDay(d.date, { month: "short", day: "numeric" }) : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Visits per day</caption>
        <tbody>
          {daily.map((d) => <tr key={d.date}><th>{d.date}</th><td>{d.visits} visits</td><td>{d.visitors} visitors</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function RankedList({ title, subtitle, rows }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Shell>
      <ShellBand title={title} subtitle={subtitle} />
      <ShellPanel position="bottom" className="p-4">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-neutral-400 !font-sans">Nothing yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.label} className="text-sm !font-sans">
                <div className="flex justify-between gap-3">
                  <span className="truncate text-slate-800 dark:text-neutral-200" title={r.label}>{r.label || "(none)"}</span>
                  <span className="tabular-nums text-slate-600 dark:text-neutral-400">{formatCount(r.count)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <div className="h-full rounded-full bg-accent/70" style={{ width: `${(r.count / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </ShellPanel>
    </Shell>
  );
}
