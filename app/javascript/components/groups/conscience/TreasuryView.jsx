import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "../lib";
import { Card, ErrorNote, Loading, Pill, Tray, primaryButton } from "../ui";
import { money, monthLabel, treasuryPath } from "./lib";

// The treasurer's monthly reports (/conscience/treasury): newest first, with what each month ended
// with and what was left above the prudent reserve
export default function TreasuryView({ group }) {
  const slug = group.slug;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api(`/groups/${slug}/treasurer_reports`).then(setData).catch((e) => setError(e.message)); }, [slug]);
  if (!data) return error ? <ErrorNote error={error} /> : <Loading />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-slate-600 dark:text-neutral-300">The treasurer's report for each month: what came in and went out, the prudent reserve, and how what's above it is shared.</p>
        {data.can_edit && <Link to={treasuryPath(slug, "new")} className={primaryButton}><Plus className="size-4" /> New report</Link>}
      </div>
      {data.reports.length === 0 && <Card className="p-5 text-sm text-slate-600 dark:text-neutral-300">{data.can_edit ? "No reports yet. Start with this month's, or add past months to keep the history here." : "No treasurer's reports have been posted yet."}</Card>}
      {data.reports.length > 0 && (
        <Tray label="Reports">
          <div className="space-y-1.5">
            {data.reports.map((r) => (
              <Link key={r.id} to={treasuryPath(slug, r.id)} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-white p-3 shadow-panel hover:ring-1 hover:ring-accent/40 dark:bg-neutral-900">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-900 dark:text-white">{monthLabel(r.period_on)}</span>
                  <span className="block text-xs text-slate-500 dark:text-neutral-400">In {money(r.summary.income_cents)} · Out {money(r.summary.expense_cents)}</span>
                </span>
                <span className="text-right text-sm"><span className="block font-medium text-slate-900 dark:text-white">{money(r.summary.closing_cents)}</span><span className="block text-xs text-slate-500 dark:text-neutral-400">ended with</span></span>
                {r.status === "draft" && <Pill tone="amber">Draft</Pill>}
                {r.visibility === "keepers" && <Pill tone="amber">Record keepers</Pill>}
              </Link>
            ))}
          </div>
        </Tray>
      )}
    </div>
  );
}
