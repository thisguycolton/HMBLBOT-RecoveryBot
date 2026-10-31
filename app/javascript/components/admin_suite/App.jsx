import React from "react";
import { BrowserRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { showToast } from "../../lib/toast";
import { ShellStyle } from "../ui/Shell";
import AdminChrome, { BASE, OTHER_TOOLS, SECTIONS } from "./AdminChrome";
import OverviewPage from "./OverviewPage";
import AnalyticsPage from "./AnalyticsPage";
import UsersPage from "./UsersPage";
import ReadingsPage from "./ReadingsPage";
import TagsPage from "./TagsPage";
import BlockedWordsPage from "./BlockedWordsPage";
import CourtVerificationsPage from "./CourtVerificationsPage";
import TextReportsPage from "./TextReportsPage";
import ContactRequestsPage from "./ContactRequestsPage";
import UserReportsPage from "./UserReportsPage";
import NoticesPage from "./NoticesPage";
import ChipTemplatesPage from "./ChipTemplatesPage";
import ChipDesignPage from "./ChipDesignPage";
import MeetingListsPage from "./MeetingListsPage";

export { BASE, OTHER_TOOLS };

const TITLES = Object.fromEntries(SECTIONS.flatMap((s) => s.items.map((i) => [i.to, i.label])));

export default function AdminSuite() {
  return (
    <BrowserRouter basename={BASE}>
      <ShellStyle.Provider value="card">
        <SuiteShell />
      </ShellStyle.Provider>
    </BrowserRouter>
  );
}

function SuiteShell() {
  const location = useLocation();

  // Pages report results as toasts: notify("Saved.") or notify(message, "error")
  const notify = (text, type = "info") => showToast(text, { tone: type === "error" ? "error" : "success" });

  const title = TITLES[location.pathname] || TITLES[`/${location.pathname.split("/")[1]}`] || "Admin";

  return (
    <AdminChrome inSuite>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="flex-1 !text-2xl font-bold !font-sans text-slate-900 dark:text-white">{title}</h1>
        <div className="text-sm text-slate-500 dark:text-neutral-400">
          <NavLink to="/" className="hover:underline !text-slate-500 dark:!text-neutral-400">Admin</NavLink> / {title}
        </div>
      </div>
      <div className="space-y-6">
        <Routes>
          <Route path="/" element={<OverviewPage notify={notify} />} />
          <Route path="/analytics" element={<AnalyticsPage notify={notify} />} />
          <Route path="/users" element={<UsersPage notify={notify} />} />
          <Route path="/readings" element={<ReadingsPage notify={notify} />} />
          <Route path="/tags" element={<TagsPage notify={notify} />} />
          <Route path="/blocked_words" element={<BlockedWordsPage notify={notify} />} />
          <Route path="/notices" element={<NoticesPage notify={notify} />} />
          <Route path="/meeting_lists" element={<MeetingListsPage notify={notify} />} />
          <Route path="/chip_design" element={<ChipDesignPage notify={notify} />} />
          <Route path="/chip_templates" element={<ChipTemplatesPage notify={notify} />} />
          <Route path="/chip_templates/:id" element={<ChipTemplatesPage notify={notify} />} />
          <Route path="/contact_requests" element={<ContactRequestsPage notify={notify} />} />
          <Route path="/reports" element={<UserReportsPage notify={notify} />} />
          <Route path="/text_reports" element={<TextReportsPage notify={notify} />} />
          <Route path="/court_verifications" element={<CourtVerificationsPage notify={notify} />} />
          <Route path="*" element={<p className="py-16 text-center text-slate-500 !font-sans">No admin page here.</p>} />
        </Routes>
      </div>
    </AdminChrome>
  );
}

// "12" / "1,204"
export const formatCount = (n) => (n ?? 0).toLocaleString();

// A metric card (metr's dashboard): icon tile, label, big number, and a note or badge
export function StatTile({ label, value, detail, to, icon: Icon, badge }) {
  const body = (
    <>
      {Icon && (
        <span className="grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-200 mb-5">
          <Icon className="size-6" />
        </span>
      )}
      <div className="text-sm text-slate-500 dark:text-neutral-400 !font-sans">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-3xl font-bold text-slate-900 dark:text-white !font-sans tabular-nums">{value}</div>
        {badge}
      </div>
      {detail && <div className="mt-1 text-sm text-slate-500 dark:text-neutral-400 !font-sans">{detail}</div>}
    </>
  );
  const cls = "block rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-neutral-800 dark:bg-neutral-900";
  return to ? <NavLink to={to} className={`${cls} hover:border-accent/50`}>{body}</NavLink> : <div className={cls}>{body}</div>;
}

// The white rounded panel admin pages are made of
export function Card({ title, subtitle, actions, children, className = "" }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-neutral-800 dark:bg-neutral-900 ${className}`}>
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-start gap-3">
          <div className="flex-1">
            {title && <h2 className="!text-lg font-semibold text-slate-900 dark:text-white !font-sans">{title}</h2>}
            {subtitle && <div className="text-sm text-slate-500 dark:text-neutral-400 !font-sans">{subtitle}</div>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function ExternalTool({ tool }) {
  return (
    <a href={tool.href} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50 dark:border-neutral-800 dark:hover:bg-neutral-800">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-900 dark:text-white !font-sans">{tool.label}</div>
        <div className="text-sm text-slate-500 dark:text-neutral-400 !font-sans">{tool.note}</div>
      </div>
      <ArrowUpRight className="w-4 h-4 text-slate-400 shrink-0" />
    </a>
  );
}
