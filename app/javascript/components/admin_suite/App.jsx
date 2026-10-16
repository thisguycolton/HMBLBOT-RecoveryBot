import React, { useEffect, useState } from "react";
import { BrowserRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  Flag,
  Gauge,
  LayoutDashboard,
  Megaphone,
  Menu,
  Moon,
  NotebookPen,
  Sun,
  Tags,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { showToast } from "../../lib/toast";
import { ShellStyle } from "../ui/Shell";
import { api } from "../topicificator_admin/api";
import NotificationBell from "../NotificationBell";
import OverviewPage from "./OverviewPage";
import AnalyticsPage from "./AnalyticsPage";
import UsersPage from "./UsersPage";
import ReadingsPage from "./ReadingsPage";
import TagsPage from "./TagsPage";
import CourtVerificationsPage from "./CourtVerificationsPage";
import TextReportsPage from "./TextReportsPage";
import NoticesPage from "./NoticesPage";

export const BASE = "/admin_panel";

// The sidebar, metr-style: sections of pages, with a count where something waits on you.
// `count` names a number from /api/admin/overview (see inboxCounts).
const SECTIONS = [
  { title: "Menu", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }] },
  {
    title: "Review",
    items: [
      { to: "/users", label: "Members", icon: Users, count: "pending" },
      { to: "/text_reports", label: "Text reports", icon: Flag, count: "text_reports" },
      { to: "/court_verifications", label: "Court verifications", icon: ClipboardCheck },
    ],
  },
  {
    title: "Content",
    items: [
      { to: "/notices", label: "Site notices", icon: Megaphone, count: "notices", countTone: "info" },
      { to: "/readings", label: "Readings", icon: NotebookPen },
      { to: "/tags", label: "Tags", icon: Tags },
    ],
  },
  { title: "Insights", items: [{ to: "/analytics", label: "Analytics", icon: Activity }] },
];

// Admin screens that live outside the suite
export const OTHER_TOOLS = [
  { href: "/admin_panel/topicificator", label: "Topicificator admin", note: "Topics, sets, categories, ACID QUEST", icon: Gauge },
  { href: "/library", label: "Library", note: "Books, chapters and imports", icon: BookOpen },
  { href: "/schedule_polls", label: "Schedule polls", note: "Find a time for a workshop", icon: CalendarClock },
  { href: "/service_readings", label: "Service readings", note: "Readings for service positions" },
  { href: "/groups", label: "Groups & meetings", note: "Groups and their meetings" },
  { href: "/hostificators", label: "Hostificators", note: "Host votes" },
  { href: "/polls", label: "Polls", note: "Polls and options" },
];

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

const inboxCounts = (overview) => ({
  pending: overview?.users?.pending ?? 0,
  text_reports: overview?.text_reports?.open ?? 0,
  notices: overview?.notices?.live ?? 0,
});

function SuiteShell() {
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [counts, setCounts] = useState(inboxCounts(null));
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const name = document.body.dataset.userName || "Account";

  // Pages report results as toasts: notify("Saved.") or notify(message, "error")
  const notify = (text, type = "info") => showToast(text, { tone: type === "error" ? "error" : "success" });

  // refresh the sidebar counts on every page change (approving someone, resolving a report)
  useEffect(() => {
    setDrawer(false);
    api("/overview").then((data) => setCounts(inboxCounts(data))).catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
  }, [dark]);

  const title = TITLES[location.pathname] || TITLES[`/${location.pathname.split("/")[1]}`] || "Admin";

  const sidebar = (
    <div className="flex h-full flex-col !font-sans">
      <a href={BASE} className="flex items-center gap-2 px-6 py-6">
        <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">HumbleBot</span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold !text-white">Admin</span>
      </a>
      <nav className="flex-1 overflow-y-auto px-4 pb-6" aria-label="Admin">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-6">
            <div className="px-3 mb-3 text-xs uppercase tracking-wider text-slate-400 dark:text-neutral-500">{section.title}</div>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const n = item.count ? counts[item.count] : 0;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-accent/15 !text-accent-ink dark:!text-sky-300"
                            : "!text-slate-700 dark:!text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon className={`size-5 ${isActive ? "text-accent dark:text-sky-300" : "opacity-70"}`} />
                          <span className="flex-1">{item.label}</span>
                          {n > 0 && (
                            <span className={`min-w-5 rounded-full px-1.5 text-center text-xs font-semibold !text-white ${item.countTone === "info" ? "bg-emerald-600" : "bg-accent"}`}>
                              {n}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className="mb-6">
          <div className="px-3 mb-3 text-xs uppercase tracking-wider text-slate-400 dark:text-neutral-500">More tools</div>
          <ul className="space-y-1">
            {OTHER_TOOLS.filter((tool) => tool.icon).map((tool) => {
              const Icon = tool.icon;
              return (
                <li key={tool.href}>
                  <a href={tool.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium !text-slate-700 dark:!text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800">
                    <Icon className="size-5 opacity-70" />
                    <span className="flex-1">{tool.label}</span>
                    <ArrowUpRight className="size-4 opacity-40" />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
      <div className="border-t border-slate-200 dark:border-neutral-800 p-4">
        <a href="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium !text-slate-700 dark:!text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800">
          <ArrowLeft className="size-5 opacity-70" />
          Back to HumbleBot
        </a>
      </div>
    </div>
  );

  const iconButton =
    "relative inline-flex size-9 items-center justify-center rounded-full border border-slate-200 !bg-transparent text-slate-700 hover:!bg-slate-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:!bg-neutral-800";

  return (
    <div className="min-h-screen w-full bg-slate-100 dark:bg-neutral-950 text-slate-900 dark:text-neutral-100 !font-sans">
      {/* Sidebar: fixed on wide screens, a drawer on phones */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        {sidebar}
      </aside>
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-[2100]">
          <button type="button" aria-label="Close menu" className="absolute inset-0 !bg-black/40" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl dark:bg-neutral-900">
            <button type="button" aria-label="Close menu" className={`${iconButton.replace("relative ", "")} absolute right-3 top-5 z-10`} onClick={() => setDrawer(false)}>
              <X className="size-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-72 min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90 sm:px-6">
          <button type="button" className={`lg:hidden ${iconButton} !rounded-lg`} aria-label="Open menu" onClick={() => setDrawer(true)}>
            <Menu className="size-4" />
          </button>
          <a href={BASE} className="lg:hidden font-semibold text-slate-900 dark:text-white">HumbleBot</a>
          <div className="flex-1" />
          <button type="button" className={iconButton} onClick={() => setDark((d) => !d)} aria-label={dark ? "Light mode" : "Dark mode"} title={dark ? "Light mode" : "Dark mode"}>
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <NotificationBell />
          <a href="/users/edit" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium !text-slate-800 hover:bg-slate-100 dark:!text-neutral-200 dark:hover:bg-neutral-800">
            <UserCircle className="size-7 text-slate-400" strokeWidth={1.5} />
            <span className="hidden sm:inline">{name}</span>
          </a>
        </header>

        <main className="p-4 sm:p-6 max-w-screen-2xl min-w-0">
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
              <Route path="/notices" element={<NoticesPage notify={notify} />} />
              <Route path="/text_reports" element={<TextReportsPage notify={notify} />} />
              <Route path="/court_verifications" element={<CourtVerificationsPage notify={notify} />} />
              <Route path="*" element={<p className="py-16 text-center text-slate-500 !font-sans">No admin page here.</p>} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
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
