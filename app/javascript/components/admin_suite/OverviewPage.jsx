import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { ClipboardCheck, Eye, NotebookPen, Users } from "lucide-react";
import { api } from "../topicificator_admin/api";
import { Card, ExternalTool, OTHER_TOOLS, StatTile, formatCount } from "./App";

// Admin home, metr-style: metric cards, what's waiting on you, and the other admin tools
export default function OverviewPage({ notify }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api("/overview").then(setData).catch((e) => notify(e.message, "error"));
  }, []);

  if (!data) return <p className="py-16 text-center text-slate-500 dark:text-neutral-400 !font-sans">Loading…</p>;

  const waiting = [
    { label: "Contact requests to answer", count: data.contact_requests.open, to: "/contact_requests", tone: "bg-sky-600" },
    { label: "Open text reports", count: data.text_reports.open, to: "/text_reports", tone: "bg-red-500" },
    { label: "Site notices showing", count: data.notices.live, to: "/notices", tone: "bg-emerald-600" },
  ];

  return (
    <>
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile to="/analytics" icon={Eye} label="Visits today" value={formatCount(data.visits.today)}
          detail={`${formatCount(data.visits.last_7_days)} visits, ${formatCount(data.visits.visitors_7_days)} visitors in 7 days`} />
        <StatTile to="/users" icon={Users} label="Members" value={formatCount(data.users.total)}
          detail={`${formatCount(data.users.admins)} admins`}
          badge={data.users.pending ? <Pill>{data.users.pending} unconfirmed</Pill> : null} />
        <StatTile to="/readings" icon={NotebookPen} label="Published readings" value={formatCount(data.readings.published)}
          detail={`${formatCount(data.readings.scheduled)} scheduled, ${formatCount(data.readings.drafts)} drafts`} />
        <StatTile to="/court_verifications" icon={ClipboardCheck} label="Verifications this month" value={formatCount(data.court_verifications.this_month)}
          detail={`${formatCount(data.court_verifications.total)} all time`} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-12">
        <Card title="Waiting on you" className="xl:col-span-5">
          <ul className="space-y-2">
            {waiting.map((item) => (
              <li key={item.label}>
                <NavLink to={item.to} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm !text-slate-800 hover:bg-slate-50 dark:border-neutral-800 dark:!text-neutral-200 dark:hover:bg-neutral-800">
                  <span className="flex-1">{item.label}</span>
                  <span className={`min-w-6 rounded-full px-2 text-center text-xs font-semibold leading-5 ${item.count ? `${item.tone} !text-white` : "bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400"}`}>
                    {item.count}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Other admin tools" subtitle="Older screens that live outside the suite" className="xl:col-span-7">
          <div className="grid gap-2 sm:grid-cols-2">
            {OTHER_TOOLS.map((tool) => <ExternalTool key={tool.href} tool={tool} />)}
          </div>
        </Card>
      </div>
    </>
  );
}

function Pill({ children }) {
  return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">{children}</span>;
}
