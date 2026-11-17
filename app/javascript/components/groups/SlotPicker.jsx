import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DAYS, api, clock } from "./lib";
import { Card, Pill, Tray } from "./ui";

// A meeting that runs on several days is one weekly meeting per day: these group them by time and
// name, so "9:00 AM, every day" is one row
export function slotTimes(slots) {
  const times = [];
  slots.forEach((slot) => {
    const key = `${slot.start_minute}|${slot.end_minute}|${slot.name}`;
    let t = times.find((x) => x.key === key);
    if (!t) times.push(t = { key, name: slot.name, start_minute: slot.start_minute, slots: [] });
    t.slots.push(slot);
  });
  return times.sort((x, y) => x.start_minute - y.start_minute || x.name.localeCompare(y.name));
}

const dayList = (slots) => (slots.length === 7 ? "every day" : slots.map((x) => DAYS[x.day_of_week].slice(0, 3)).join(", "));

// What a host coordinator office covers, in words: "Whole group", "9:00 AM Sunrise, every day"
export function coverageLabel(ids, slots) {
  if (!ids || ids.length === 0) return "Whole group";
  return slotTimes(slots.filter((s) => ids.includes(s.id))).map((t) => `${clock(t.start_minute)} ${t.name}, ${dayList(t.slots)}`).join("; ") || "No time slots";
}

// Picking the time slots (and days) a host coordinator office covers (Manage > Offices). An empty
// pick is the whole group.
export default function SlotPicker({ slots, value, onChange, idPrefix = "slots" }) {
  const whole = value === null;
  const ids = value || [];
  const pick = (picked, on) => {
    const rest = ids.filter((x) => !picked.includes(x));
    onChange(on ? [...rest, ...picked] : rest);
  };
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="What it covers" className="flex flex-wrap gap-3 text-sm text-slate-800 dark:text-neutral-100">
        <label className="flex items-center gap-2"><input type="radio" name={`${idPrefix}-scope`} checked={whole} onChange={() => onChange(null)} /> The whole group</label>
        <label className="flex items-center gap-2"><input type="radio" name={`${idPrefix}-scope`} checked={!whole} onChange={() => onChange([])} disabled={slots.length === 0} /> Only some time slots</label>
      </div>
      {!whole && (
        <>
          {ids.length === 0 && <p className="text-xs text-amber-800 dark:text-amber-200">Pick at least one, or it covers the whole group.</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {slotTimes(slots).map((t) => {
              const tIds = t.slots.map((x) => x.id);
              const count = tIds.filter((id) => ids.includes(id)).length;
              const all = count === tIds.length;
              return (
                <div key={t.key} className={`rounded-xl px-3 py-2 ring-1 ${count ? "bg-sky-100 ring-sky-200 dark:bg-sky-900/40 dark:ring-sky-800" : "ring-neutral-200 dark:ring-neutral-700"}`}>
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-900 dark:text-white">
                    <input type="checkbox" className="size-4" checked={all} ref={(el) => { if (el) el.indeterminate = count > 0 && !all; }} onChange={() => pick(tIds, !all)} />
                    <span className="min-w-0 truncate"><span className="font-medium">{clock(t.start_minute)} · {t.name}</span> <span className="text-slate-500 dark:text-neutral-400">{dayList(t.slots)}</span></span>
                  </label>
                  {tIds.length > 1 && (
                    <div className="mt-1.5 flex flex-wrap gap-1 pl-6">
                      {t.slots.map((x) => {
                        const on = ids.includes(x.id);
                        return (
                          <button key={x.id} type="button" aria-pressed={on} title={`${DAYS[x.day_of_week]} ${clock(x.start_minute)}`} onClick={() => pick([x.id], !on)}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${on ? "!bg-accent !text-white ring-transparent" : "!bg-white text-slate-600 ring-neutral-200 dark:!bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-700"}`}>
                            {DAYS[x.day_of_week].slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Who coordinates each time slot (Manage > Meetings setup and the Meetings page, for admins),
// read-only: it comes from the host coordinator offices (and anyone given the role by hand before
// offices did that). Changed in Manage > Offices.
export function SlotCoverage({ slug, coordinators, slots }) {
  const whole = coordinators.filter((c) => c.host_meeting_ids.length === 0);
  const who = (c) => `${c.name || "Nobody yet"}${c.office ? ` (${c.office})` : " (given by hand)"}`;
  return (
    <Tray label="Who coordinates each time slot">
      <div className="space-y-1.5">
        {whole.length > 0 && (
          <Card className="flex flex-wrap items-center gap-3 p-3">
            <span className="w-24 shrink-0 font-semibold text-slate-900 dark:text-white">Every slot</span>
            <span className="min-w-0 flex-1 text-sm text-slate-700 dark:text-neutral-200">{whole.map(who).join(", ")}</span>
          </Card>
        )}
        {slotTimes(slots).map((t) => {
          const ids = t.slots.map((s) => s.id);
          const mine = coordinators.filter((c) => c.host_meeting_ids.some((id) => ids.includes(id)));
          return (
            <Card key={t.key} className="flex flex-wrap items-center gap-3 p-3">
              <span className="w-24 shrink-0 font-semibold text-slate-900 dark:text-white">{clock(t.start_minute)}</span>
              <span className="min-w-0 flex-1 basis-48">
                <span className="block text-sm text-slate-900 dark:text-white">{t.name} <span className="text-slate-500 dark:text-neutral-400">{dayList(t.slots)}</span></span>
                <span className="block text-sm text-slate-700 dark:text-neutral-200">
                  {mine.length > 0 ? mine.map(who).join(", ") : whole.length > 0 ? <span className="text-slate-500 dark:text-neutral-400">Only the whole group's coordinators</span> : <Pill tone="amber">Nobody</Pill>}
                </span>
              </span>
            </Card>
          );
        })}
        <p className="px-1 text-xs text-slate-500 dark:text-neutral-400">This comes from the host coordinator offices. Change who holds them, and which slots they cover, in <Link to={`/${slug}/manage/offices`} className="font-medium text-accent hover:underline">Manage › Offices</Link>. Group admins coordinate every meeting.</p>
      </div>
    </Tray>
  );
}

// Manage > Meetings setup: the same, loaded from the host schedule
export function SlotCoverageSection({ slug }) {
  const [data, setData] = useState(null);
  useEffect(() => { api(`/groups/${slug}/meeting_hosts`).then(setData).catch(() => {}); }, [slug]);
  if (!data?.coordinators || data.slots.length === 0) return null;
  return <SlotCoverage slug={slug} coordinators={data.coordinators} slots={data.slots} />;
}
