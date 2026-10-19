import React, { useCallback, useEffect, useState } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowUpRight, BookOpen, BookOpenCheck, CalendarClock, CalendarDays, CalendarRange, ClipboardCheck, FileText, Gavel, LayoutDashboard, LayoutTemplate,
  Landmark, Menu, Moon, Settings, Sun, UserCheck, UserCircle, Users, X,
} from "lucide-react";
import NotificationBell from "../NotificationBell";
import { RecoveryBotLogo } from "../brand/Logo";
import { api } from "./lib";
import { ErrorNote, Loading } from "./ui";
import { ConscienceBody } from "./conscience/ConscienceTab";
import HostsTab from "./HostsTab";
import MembersTab from "./MembersTab";
import MeetingsTab from "./MeetingsTab";
import EventsTab from "./EventsTab";
import LiteratureTab from "./LiteratureTab";
import CourtTab from "./CourtTab";
import GroupSettings, { GroupLogo } from "./GroupSettings";

// Who gets the dashboard: anyone in the group with a role beyond plain member
export const hasGroupRole = (group) =>
  !!(group && (group.can_manage || group.can_keep_records || group.can_schedule_hosts || group.can_keep_treasury));

// The sidebar, like the site admin's (components/admin_suite/App.jsx). `show` says who sees an item.
const SECTIONS = [
  { title: "Menu", items: [{ key: "overview", path: "", label: "Dashboard", icon: LayoutDashboard }] },
  {
    title: "Business",
    items: [
      { key: "meetings", path: "/meetings", label: "Business meetings", icon: CalendarDays },
      { key: "decisions", path: "/decisions", label: "Decisions", icon: Gavel },
      { key: "documents", path: "/documents", label: "Documents", icon: FileText },
    ],
  },
  {
    title: "Service",
    items: [
      { key: "officials", path: "/officials", label: "Elected officials", icon: BookOpenCheck },
      { key: "treasury", path: "/treasury", label: "Treasury", icon: Landmark },
      { key: "hosts", path: "/hosts", label: "Hosts", icon: UserCheck, show: (g) => g.can_schedule_hosts },
    ],
  },
  {
    title: "Group",
    items: [
      { key: "members", path: "/members", label: "Members", icon: Users, show: (g) => g.can_manage, count: (g) => g.requests?.length || 0 },
      { key: "schedule", path: "/schedule", label: "Meeting schedule", icon: CalendarClock, show: (g) => g.can_manage },
      { key: "events", path: "/events", label: "Events", icon: CalendarRange, show: (g) => g.can_manage },
      { key: "literature", path: "/literature", label: "Approved literature", icon: BookOpen, show: (g) => g.can_manage },
      { key: "court", path: "/court", label: "Court verifications", icon: ClipboardCheck, show: (g) => g.can_manage },
      { key: "settings", path: "/settings", label: "Group settings", icon: Settings, show: (g) => g.can_manage },
    ],
  },
];
const ALL = SECTIONS.flatMap((s) => s.items);

// /groups/:slug/conscience/* for group admins, record keepers, host coordinators and treasurers:
// the group's business in one dashboard with its own chrome, instead of a tab on the group page.
// Plain members still get the Group conscience tab (GroupPage), which only reads.
export default function GroupDashboard({ group: initial }) {
  const { slug, "*": rest = "" } = useParams();
  const [group, setGroup] = useState(initial);
  const [error, setError] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const reload = useCallback(() => api(`/groups/${slug}`).then(setGroup).catch((e) => setError(e.message)), [slug]);

  const [rawView, id] = rest.split("/").filter(Boolean);
  const view = rawView === "service" ? "officials" : rawView || "overview";
  const items = ALL.filter((i) => !i.show || i.show(group));
  const current = items.find((i) => i.key === view) || items[0];
  const base = `/${slug}/conscience`;

  useEffect(() => { setDrawer(false); window.scrollTo(0, 0); }, [rest]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
  }, [dark]);
  useEffect(() => { document.title = `${current.label} · ${group.title} | RecoveryBot`; }, [current, group.title]);

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link to={base} className="flex items-center gap-3 px-6 pb-5 pt-6">
        <GroupLogo group={group} className="size-10 text-sm" />
        <span className="min-w-0">
          <span className="block truncate font-semibold !text-slate-900 dark:!text-white">{group.title}</span>
          <span className="block text-xs !text-slate-500 dark:!text-neutral-400">Group dashboard</span>
        </span>
      </Link>
      <nav className="flex-1 overflow-y-auto px-4 pb-6" aria-label="Group dashboard">
        {SECTIONS.map((section) => {
          const shown = section.items.filter((i) => items.includes(i));
          if (!shown.length) return null;
          return (
            <div key={section.title} className="mb-6">
              <div className="mb-3 px-3 text-xs uppercase tracking-wider text-slate-400 dark:text-neutral-500">{section.title}</div>
              <ul className="space-y-1">
                {shown.map((item) => {
                  const Icon = item.icon;
                  const active = item.key === current.key;
                  const n = item.count ? item.count(group) : 0;
                  return (
                    <li key={item.key}>
                      <NavLink to={`${base}${item.path}`} end
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-accent/15 !text-accent-ink dark:!text-sky-300" : "!text-slate-700 hover:bg-slate-100 dark:!text-neutral-300 dark:hover:bg-neutral-800"}`}>
                        <Icon className={`size-5 ${active ? "text-accent dark:text-sky-300" : "opacity-70"}`} />
                        <span className="flex-1">{item.label}</span>
                        {n > 0 && <span className="min-w-5 rounded-full bg-amber-500 px-1.5 text-center text-xs font-semibold !text-white">{n}</span>}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {group.can_manage && (
          <div className="mb-6">
            <div className="mb-3 px-3 text-xs uppercase tracking-wider text-slate-400 dark:text-neutral-500">More</div>
            <Link to={`/${slug}/page/edit`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium !text-slate-700 hover:bg-slate-100 dark:!text-neutral-300 dark:hover:bg-neutral-800">
              <LayoutTemplate className="size-5 opacity-70" /> <span className="flex-1">Edit the group page</span> <ArrowUpRight className="size-4 opacity-40" />
            </Link>
          </div>
        )}
      </nav>
      <div className="border-t border-slate-200 p-4 dark:border-neutral-800">
        <Link to={`/${slug}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium !text-slate-700 hover:bg-slate-100 dark:!text-neutral-300 dark:hover:bg-neutral-800">
          <ArrowLeft className="size-5 opacity-70" /> Back to the group page
        </Link>
      </div>
    </div>
  );

  const iconButton = "relative inline-flex size-9 items-center justify-center rounded-full border border-slate-200 !bg-transparent text-slate-700 hover:!bg-slate-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:!bg-neutral-800";

  let body;
  if (current.key === "hosts") body = <HostsTab group={group} />;
  else if (current.key === "members") body = <MembersTab group={group} reload={reload} setGroup={setGroup} />;
  else if (current.key === "schedule") body = <MeetingsTab group={group} setGroup={setGroup} reload={reload} />;
  else if (current.key === "events") body = <EventsTab group={group} />;
  else if (current.key === "literature") body = <LiteratureTab group={group} reload={reload} />;
  else if (current.key === "court") body = <CourtTab group={group} setGroup={setGroup} />;
  else if (current.key === "settings") body = <GroupSettings group={group} setGroup={setGroup} />;
  else body = <ConscienceBody group={group} view={current.key} id={id} />;

  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-900 !font-sans dark:bg-neutral-950 dark:text-neutral-100 [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <aside className="group-chrome fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 lg:block print:!hidden">
        {sidebar}
      </aside>
      {drawer && (
        <div className="group-chrome fixed inset-0 z-[2100] lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 !bg-black/40" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl dark:bg-neutral-900">
            <button type="button" aria-label="Close menu" className={`${iconButton.replace("relative ", "")} absolute right-3 top-5 z-10`} onClick={() => setDrawer(false)}><X className="size-4" /></button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0 lg:pl-72 print:!pl-0">
        <header className="group-chrome sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90 sm:px-6 print:!hidden">
          <button type="button" className={`lg:hidden ${iconButton} !rounded-lg`} aria-label="Open menu" onClick={() => setDrawer(true)}><Menu className="size-4" /></button>
          <span className="flex min-w-0 items-center gap-2 lg:hidden"><GroupLogo group={group} className="size-7 text-[0.6rem]" /><span className="truncate font-semibold text-slate-900 dark:text-white">{group.title}</span></span>
          <div className="flex-1" />
          <button type="button" className={iconButton} onClick={() => setDark((d) => !d)} aria-label={dark ? "Light mode" : "Dark mode"}>{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</button>
          <NotificationBell />
          <a href="/people/me" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 text-sm font-medium !text-slate-800 hover:bg-slate-100 dark:!text-neutral-200 dark:hover:bg-neutral-800 sm:pr-3">
            <UserCircle className="size-7 text-slate-400" strokeWidth={1.5} />
            <span className="hidden sm:inline">{document.body.dataset.userName || "You"}</span>
          </a>
        </header>

        <main className="min-w-0 max-w-screen-xl p-4 sm:p-6">
          <div className="group-chrome mb-6 flex flex-wrap items-center gap-3">
            <h1 className="flex-1 !text-2xl font-bold text-slate-900 dark:text-white">{current.label}</h1>
            <div className="text-sm text-slate-500 dark:text-neutral-400">
              <Link to={`/${slug}`} className="!text-slate-500 hover:underline dark:!text-neutral-400">{group.title}</Link>
              {" / "}
              {current.key === "overview" ? "Dashboard" : <><Link to={base} className="!text-slate-500 hover:underline dark:!text-neutral-400">Dashboard</Link> / {current.label}</>}
            </div>
          </div>
          <ErrorNote error={error} />
          {body}
        </main>
      </div>
    </div>
  );
}

// /:slug/conscience/*: the dashboard for people with a role, the plain tab for everyone else
export function ConscienceRoute({ fallback }) {
  const { slug } = useParams();
  const [group, setGroup] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { api(`/groups/${slug}`).then(setGroup).catch(() => setFailed(true)); }, [slug]);
  if (failed) return fallback;
  if (!group) return <div className="p-6"><Loading /></div>;
  return hasGroupRole(group) ? <GroupDashboard group={group} /> : fallback;
}
