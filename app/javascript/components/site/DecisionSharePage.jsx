import React from "react";
import { Landmark } from "lucide-react";
import Markdown from "../book/Markdown";
import { Card, Pill } from "../groups/ui";
import { CATEGORY_INFO, MOTION_STATUS_LABELS, STATUS_TONES, countLabel, longDate } from "../groups/conscience/lib";

// A group decision its record keepers shared by link (/d/:token, DecisionSharesController):
// how it came out, plus what the group chose to show in Group settings (Motion#public_json:
// wording, count, minority opinion, its name, who moved it). Never notes or the meeting.
export default function DecisionSharePage({ decision: d }) {
  const counts = countLabel(d);
  const category = CATEGORY_INFO[d.category];
  const hasBody = d.text.trim() || d.amended_text.trim() || d.minority_opinion?.trim() || d.moved_by || d.seconded_by || d.replaced;
  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 px-4 py-10 !font-sans dark:bg-neutral-950 sm:py-14 [&_*]:!font-sans [&_.ev-md_ol]:list-decimal [&_.ev-md_ol]:pl-6 [&_.ev-md_p+*]:mt-2 [&_.ev-md_ul]:list-disc [&_.ev-md_ul]:pl-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
          <Landmark className="size-4" /> A group decision{d.group ? <> · <a href={d.group.path} className="text-accent hover:underline">{d.group.title}</a></> : null}
        </p>
        <Card className="overflow-hidden">
          <div className={`p-5 ${hasBody ? "border-b border-neutral-100 dark:border-neutral-800" : ""}`}>
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
          {hasBody && <div className="space-y-4 p-5">
            {d.text.trim() && <Markdown source={d.text} className="ev-md text-base text-slate-800 dark:text-neutral-200" />}
            {d.amended_text.trim() && (
              <div className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-950">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{d.amended_label}</p>
                <Markdown source={d.amended_text} className="ev-md text-base text-slate-800 dark:text-neutral-200" />
              </div>
            )}
            {(d.moved_by || d.seconded_by) && (
              <p className="text-sm text-slate-600 dark:text-neutral-300">{d.moved_by && <>Moved by {d.moved_by}</>}{d.moved_by && d.seconded_by && ", "}{d.seconded_by && <>seconded by {d.seconded_by}</>}</p>
            )}
            {d.minority_opinion?.trim() && (
              <div className="rounded-xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide">Minority opinion</p>
                <Markdown source={d.minority_opinion} className="ev-md text-base" />
              </div>
            )}
            {d.replaced && <p className="text-sm text-slate-600 dark:text-neutral-300">The group has since replaced this decision with a later one.</p>}
          </div>}
        </Card>
        <p className="px-1 text-xs leading-relaxed text-slate-500 dark:text-neutral-400">
          Shared by the group so anyone with this link can read it. It's the group's own record, kept on RecoveryBot; it doesn't speak for AA as a whole.
        </p>
      </div>
    </div>
  );
}
