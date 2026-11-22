import React from "react";
import { Landmark } from "lucide-react";
import Markdown from "../book/Markdown";
import { Card, Pill } from "../groups/ui";
import { CATEGORY_INFO, MOTION_STATUS_LABELS, STATUS_TONES, countLabel, longDate } from "../groups/conscience/lib";

// A group decision its record keepers shared by link (/d/:token, DecisionSharesController):
// the wording and how it came out, read only, for anyone. Only what Motion#public_json gives:
// never who moved or seconded it, notes, the minority opinion or the meeting, and the group's
// name only when its page is open to visitors anyway.
export default function DecisionSharePage({ decision: d }) {
  const counts = countLabel(d);
  const category = CATEGORY_INFO[d.category];
  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 px-4 py-10 !font-sans dark:bg-neutral-950 sm:py-14 [&_*]:!font-sans [&_.ev-md_ol]:list-decimal [&_.ev-md_ol]:pl-6 [&_.ev-md_p+*]:mt-2 [&_.ev-md_ul]:list-disc [&_.ev-md_ul]:pl-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
          <Landmark className="size-4" /> A group decision{d.group ? <> · <a href={d.group.path} className="text-accent hover:underline">{d.group.title}</a></> : null}
        </p>
        <Card className="overflow-hidden">
          <div className="border-b border-neutral-100 p-5 dark:border-neutral-800">
            <h1 className={`!text-2xl font-semibold text-slate-900 dark:text-white ${d.replaced ? "line-through decoration-slate-400" : ""}`}>{d.title}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
              {category?.label || d.kind_label}{" · "}{d.decided_on ? longDate(d.decided_on) : "Not decided yet"}{counts ? ` · ${counts}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Pill tone={STATUS_TONES[d.status] || "slate"}>{MOTION_STATUS_LABELS[d.status] || d.status}</Pill>
              {d.standing && <Pill tone="green">Standing</Pill>}
              {d.one_time && <Pill>One-time</Pill>}
              {d.replaced && <Pill tone="amber">Replaced{d.replaced_on ? ` ${longDate(d.replaced_on)}` : ""}</Pill>}
            </div>
          </div>
          <div className="space-y-4 p-5">
            {d.text.trim() ? <Markdown source={d.text} className="ev-md text-base text-slate-800 dark:text-neutral-200" /> : <p className="text-sm text-slate-500 dark:text-neutral-400">No wording recorded.</p>}
            {d.amended_text.trim() && (
              <div className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-950">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{d.amended_label}</p>
                <Markdown source={d.amended_text} className="ev-md text-base text-slate-800 dark:text-neutral-200" />
              </div>
            )}
            {d.replaced && <p className="text-sm text-slate-600 dark:text-neutral-300">The group has since replaced this decision with a later one.</p>}
          </div>
        </Card>
        <p className="px-1 text-xs leading-relaxed text-slate-500 dark:text-neutral-400">
          Shared by the group's record keepers so anyone with this link can read it. It's the group's own record, kept on RecoveryBot; it doesn't speak for AA as a whole.
        </p>
      </div>
    </div>
  );
}
