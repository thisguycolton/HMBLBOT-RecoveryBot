import React, { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  Flag,
  Gauge,
  Inbox,
  LayoutDashboard,
  Medal,
  Megaphone,
  Menu,
  Moon,
  NotebookPen,
  Sun,
  Tags,
  Users,
  X,
} from "lucide-react";
import { api } from "../topicificator_admin/api";
import NotificationBell from "../NotificationBell";
import Avatar from "../groups/Avatar";
import { RecoveryBotLogo } from "../brand/Logo";

// The admin's chrome, metr-style: the sidebar (a drawer on phones) and the top bar, around a page.
// The admin suite (App.jsx) renders its pages in it, and so do admin screens with their own app,
// like the Topicificator admin, so every admin page has the same way around.

export const BASE = "/admin_panel";

// The sidebar: sections of the suite's pages, with a count where something waits on you.
// `count` names a number from /api/admin/overview (see inboxCounts).
export const SECTIONS = [
  { title: "Menu", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }] },
  {
    title: "Review",
    items: [
      { to: "/users", label: "Members", icon: Users },
      { to: "/contact_requests", label: "Contact requests", icon: Inbox, count: "contact_requests" },
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
      { to: "/chip_templates", label: "Chip templates", icon: Medal },
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

const inboxCounts = (overview) => ({
  text_reports: overview?.text_reports?.open ?? 0,
  contact_requests: overview?.contact_requests?.open ?? 0,
  notices: overview?.notices?.live ?? 0,
});

const itemClass = (active) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
    active ? "bg-accent/15 !text-accent-ink dark:!text-sky-300" : "!text-slate-700 dark:!text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800"
  }`;

// `inSuite`: rendered by the suite's own router (basename /admin_panel), so its pages are NavLinks.
// Elsewhere they're plain links into the suite. The suite's sections show to User#suite_admin? only;
// other admins get the tools and the way back.
export default function AdminChrome({ inSuite = false, children }) {
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [counts, setCounts] = useState(inboxCounts(null));
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const name = document.body.dataset.userName || "Account";
  const suiteAdmin = document.body.dataset.suiteAdmin === "true";

  // refresh the sidebar counts on every page change (approving someone, resolving a report)
  useEffect(() => {
    setDrawer(false);
    if (suiteAdmin) api("/overview").then((data) => setCounts(inboxCounts(data))).catch(() => {});
  }, [location.pathname, suiteAdmin]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
  }, [dark]);

  const itemBody = (item, active) => {
    const Icon = item.icon;
    const n = item.count ? counts[item.count] : 0;
    return (
      <>
        <Icon className={`size-5 ${active ? "text-accent dark:text-sky-300" : "opacity-70"}`} />
        <span className="flex-1">{item.label}</span>
        {n > 0 && (
          <span className={`min-w-5 rounded-full px-1.5 text-center text-xs font-semibold !text-white ${item.countTone === "info" ? "bg-emerald-600" : "bg-accent"}`}>
            {n}
          </span>
        )}
      </>
    );
  };

  const sidebar = (
    <div className="flex h-full flex-col !font-sans">
      <a href={BASE} className="flex items-center gap-2 px-6 py-6">
        <span className="!text-slate-900 dark:!text-white"><RecoveryBotLogo markClassName="h-7 w-auto" textClassName="text-lg" /></span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold !text-white">Admin</span>
      </a>
      <nav className="flex-1 overflow-y-auto px-4 pb-6" aria-label="Admin">
        {suiteAdmin && SECTIONS.map((section) => (
          <div key={section.title} className="mb-6">
            <div className="px-3 mb-3 text-xs uppercase tracking-wider text-slate-400 dark:text-neutral-500">{section.title}</div>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.to}>
                  {inSuite ? (
                    <NavLink to={item.to} end={item.end} className={({ isActive }) => itemClass(isActive)}>
                      {({ isActive }) => itemBody(item, isActive)}
                    </NavLink>
                  ) : (
                    <a href={item.to === "/" ? BASE : `${BASE}${item.to}`} className={itemClass(false)}>{itemBody(item, false)}</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="mb-6">
          <div className="px-3 mb-3 text-xs uppercase tracking-wider text-slate-400 dark:text-neutral-500">More tools</div>
          <ul className="space-y-1">
            {OTHER_TOOLS.filter((tool) => tool.icon).map((tool) => {
              const Icon = tool.icon;
              const active = !inSuite && window.location.pathname.startsWith(tool.href);
              return (
                <li key={tool.href}>
                  <a href={tool.href} className={itemClass(active)} aria-current={active ? "page" : undefined}>
                    <Icon className={`size-5 ${active ? "text-accent dark:text-sky-300" : "opacity-70"}`} />
                    <span className="flex-1">{tool.label}</span>
                    {!active && <ArrowUpRight className="size-4 opacity-40" />}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
      <div className="border-t border-slate-200 dark:border-neutral-800 p-4">
        <a href="/" className={itemClass(false)}>
          <ArrowLeft className="size-5 opacity-70" />
          Back to RecoveryBot
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
          <a href={BASE} className="lg:hidden !text-slate-900 dark:!text-white"><RecoveryBotLogo markClassName="h-6 w-auto" textClassName="text-base" /></a>
          <div className="flex-1" />
          <button type="button" className={iconButton} onClick={() => setDark((d) => !d)} aria-label={dark ? "Light mode" : "Dark mode"} title={dark ? "Light mode" : "Dark mode"}>
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <NotificationBell />
          <a href="/users/edit" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium !text-slate-800 hover:bg-slate-100 dark:!text-neutral-200 dark:hover:bg-neutral-800">
            <Avatar person={{ name, avatar_url: document.body.dataset.avatarUrl }} size={28} />
            <span className="hidden sm:inline">{name}</span>
          </a>
        </header>

        <main className="p-4 sm:p-6 max-w-screen-2xl min-w-0">{children}</main>
      </div>
    </div>
  );
}
