import React, { useEffect, useState } from "react";
import { BrowserRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { ArrowUpRight, Gauge } from "lucide-react";
import { Flash } from "../topicificator_admin/App";
import OverviewPage from "./OverviewPage";
import AnalyticsPage from "./AnalyticsPage";
import UsersPage from "./UsersPage";
import ReadingsPage from "./ReadingsPage";
import TagsPage from "./TagsPage";
import CourtVerificationsPage from "./CourtVerificationsPage";

export const BASE = "/admin_panel";

const TABS = [
  { to: "/", label: "Overview", end: true },
  { to: "/analytics", label: "Analytics" },
  { to: "/users", label: "Users" },
  { to: "/readings", label: "Readings" },
  { to: "/tags", label: "Tags" },
  { to: "/court_verifications", label: "Court verifications" },
];

// Older admin screens that live outside the suite
export const OTHER_TOOLS = [
  { href: "/admin_panel/topicificator", label: "Topicificator admin", note: "Topics, sets, categories, ACID QUEST" },
  { href: "/ahoy_captain", label: "AhoyCaptain", note: "Ahoy's own analytics dashboard" },
  { href: "/books", label: "Books", note: "Literature library" },
  { href: "/service_readings", label: "Service readings", note: "Readings for service positions" },
  { href: "/groups", label: "Groups & meetings", note: "Groups and their meetings" },
  { href: "/hostificators", label: "Hostificators", note: "Host votes" },
  { href: "/polls", label: "Polls", note: "Polls and options" },
];

export default function AdminSuite() {
  return (
    <BrowserRouter basename={BASE}>
      <SuiteShell />
    </BrowserRouter>
  );
}

function SuiteShell() {
  const [flash, setFlash] = useState(null);
  const location = useLocation();
  useEffect(() => setFlash(null), [location.pathname]);
  const notify = (text, type = "info") => setFlash({ type, text });

  return (
    <>
      <header className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 pt-20 pb-8 w-full mt-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-accent-tint dark:bg-accent/30 shadow-panel flex items-center justify-center shrink-0">
              <Gauge className="w-5 h-5 text-accent dark:text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="!text-xl !leading-tight font-semibold text-slate-900 dark:text-white !font-sans">Admin</h1>
              <p className="text-sm text-slate-600 dark:text-neutral-400 mt-0.5 !font-sans">Visits, members, readings, tags and court verifications.</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-stretch rounded-panel overflow-hidden shadow-panel bg-white dark:bg-surface-dark divide-x divide-neutral-200 dark:divide-neutral-700">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `px-4 py-3 text-sm transition-colors ${
                    isActive
                      ? "bg-accent-tint !text-accent-ink font-semibold dark:bg-accent/35 dark:!text-white"
                      : "font-medium !text-slate-900 dark:!text-neutral-300 hover:bg-accent/5 dark:hover:bg-white/5"
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <div className="bg-slate-50 dark:bg-neutral-950 px-4 min-[1400px]:px-8 py-6 min-h-[70vh]">
        <div className="max-w-7xl mx-auto space-y-6">
          {flash && <Flash flash={flash} onClose={() => setFlash(null)} />}
          <Routes>
            <Route path="/" element={<OverviewPage notify={notify} />} />
            <Route path="/analytics" element={<AnalyticsPage notify={notify} />} />
            <Route path="/users" element={<UsersPage notify={notify} />} />
            <Route path="/readings" element={<ReadingsPage notify={notify} />} />
            <Route path="/tags" element={<TagsPage notify={notify} />} />
            <Route path="/court_verifications" element={<CourtVerificationsPage notify={notify} />} />
            <Route path="*" element={<p className="py-16 text-center text-slate-500 !font-sans">No admin page here.</p>} />
          </Routes>
        </div>
      </div>
    </>
  );
}

// "12" / "1,204"
export const formatCount = (n) => (n ?? 0).toLocaleString();

export function StatTile({ label, value, detail, to }) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400 !font-sans">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900 dark:text-white !font-sans tabular-nums">{value}</p>
      {detail && <p className="mt-1 text-sm text-slate-600 dark:text-neutral-400 !font-sans">{detail}</p>}
    </>
  );
  const cls = "block rounded-panel bg-white dark:bg-surface-dark shadow-panel p-4";
  return to ? <NavLink to={to} className={`${cls} hover:ring-2 hover:ring-accent/40`}>{body}</NavLink> : <div className={cls}>{body}</div>;
}

export function ExternalTool({ tool }) {
  return (
    <a href={tool.href} className="flex items-start gap-3 rounded-panel bg-white dark:bg-surface-dark shadow-panel p-4 hover:ring-2 hover:ring-accent/40">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white !font-sans">{tool.label}</p>
        <p className="text-sm text-slate-600 dark:text-neutral-400 !font-sans">{tool.note}</p>
      </div>
      <ArrowUpRight className="w-4 h-4 text-slate-400 shrink-0" />
    </a>
  );
}
