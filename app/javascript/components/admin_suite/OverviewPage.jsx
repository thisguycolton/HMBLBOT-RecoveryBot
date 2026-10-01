import React, { useEffect, useState } from "react";
import { api } from "../topicificator_admin/api";
import { ExternalTool, OTHER_TOOLS, StatTile, formatCount } from "./App";

export default function OverviewPage({ notify }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api("/overview").then(setData).catch((e) => notify(e.message, "error"));
  }, []);

  if (!data) return <p className="py-16 text-center text-slate-500 dark:text-neutral-400 !font-sans">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile to="/analytics" label="Visits today" value={formatCount(data.visits.today)}
          detail={`${formatCount(data.visits.last_7_days)} visits, ${formatCount(data.visits.visitors_7_days)} visitors in 7 days`} />
        <StatTile to="/users" label="Members" value={formatCount(data.users.total)}
          detail={data.users.pending ? `${formatCount(data.users.pending)} waiting for approval` : "No one waiting for approval"} />
        <StatTile to="/readings" label="Published readings" value={formatCount(data.readings.published)}
          detail={`${formatCount(data.readings.scheduled)} scheduled, ${formatCount(data.readings.drafts)} drafts`} />
        <StatTile to="/court_verifications" label="Verifications this month" value={formatCount(data.court_verifications.this_month)}
          detail={`${formatCount(data.court_verifications.total)} all time`} />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400 !font-sans">Other admin tools</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OTHER_TOOLS.map((tool) => <ExternalTool key={tool.href} tool={tool} />)}
        </div>
      </section>
    </div>
  );
}
