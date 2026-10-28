import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  BookOpen, BookOpenCheck, CalendarClock, CalendarDays, CalendarRange, ClipboardCheck, FileText, Gavel, LayoutDashboard,
  Landmark, Medal, MonitorPlay, Settings, Stamp, UserCheck, Users,
} from "lucide-react";
import Layout from "../Layout";
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
import DocumentTemplates from "./conscience/DocumentTemplates";
import ChipDesigner from "./ChipDesigner";

// Who gets the dashboard: anyone in the group with a role beyond plain member
export const hasGroupRole = (group) =>
  !!(group && (group.can_manage || group.can_keep_records || group.can_schedule_hosts || group.can_keep_treasury));

// The dashboard's pages. The shell's sidebar lists them under the group, a section per role
// (shell/navItems.js ROLE_SECTIONS); `show` says who may open one here.
const SECTIONS = [
  { title: "Menu", items: [{ key: "overview", path: "", label: "Dashboard", icon: LayoutDashboard }] },
  {
    title: "Business",
    items: [
      { key: "meetings", path: "/meetings", label: "Business meetings", icon: CalendarDays },
      { key: "decisions", path: "/decisions", label: "Decisions", icon: Gavel },
      { key: "documents", path: "/documents", label: "Documents", icon: FileText },
      { key: "templates", path: "/templates", label: "Document templates", icon: Stamp, show: (g) => g.can_keep_records },
    ],
  },
  {
    title: "Service",
    items: [
      { key: "officials", path: "/officials", label: "Elected officials", icon: BookOpenCheck },
      { key: "treasury", path: "/treasury", label: "Treasury", icon: Landmark },
      { key: "hosts", path: "/hosts", label: "Hosts", icon: UserCheck, show: (g) => g.can_schedule_hosts },
      { key: "decks", path: "/decks", label: "HostDecks", icon: MonitorPlay },
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
      { key: "chips", path: "/chips", label: "Chips", icon: Medal, show: (g) => g.can_manage },
    ],
  },
];
const ALL = SECTIONS.flatMap((s) => s.items);

// /groups/:slug/conscience/* for group admins, record keepers, host coordinators and treasurers:
// the group's business on the stage, its pages in the sidebar under the group, instead of a tab
// on the group page. Plain members still get the Group conscience tab (GroupPage), which only reads.
export default function GroupDashboard({ group: initial }) {
  const { slug, "*": rest = "" } = useParams();
  const [group, setGroup] = useState(initial);
  const [error, setError] = useState(null);
  const reload = useCallback(() => api(`/groups/${slug}`).then(setGroup).catch((e) => setError(e.message)), [slug]);

  const [rawView, id] = rest.split("/").filter(Boolean);
  const view = rawView === "service" ? "officials" : rawView || "overview";
  const items = ALL.filter((i) => !i.show || i.show(group));
  const current = items.find((i) => i.key === view) || items[0];

  useEffect(() => { window.scrollTo(0, 0); }, [rest]);
  useEffect(() => { document.title = `${current.label} · ${group.title} | RecoveryBot`; }, [current, group.title]);

  let body;
  if (current.key === "hosts") body = <HostsTab group={group} />;
  else if (current.key === "members") body = <MembersTab group={group} reload={reload} setGroup={setGroup} />;
  else if (current.key === "schedule") body = <MeetingsTab group={group} setGroup={setGroup} reload={reload} />;
  else if (current.key === "events") body = <EventsTab group={group} />;
  else if (current.key === "literature") body = <LiteratureTab group={group} reload={reload} />;
  else if (current.key === "court") body = <CourtTab group={group} setGroup={setGroup} />;
  else if (current.key === "settings") body = <GroupSettings group={group} setGroup={setGroup} />;
  else if (current.key === "templates") body = <DocumentTemplates group={group} />;
  else if (current.key === "chips") body = <ChipDesigner group={group} />;
  else body = <ConscienceBody group={group} view={current.key} id={id} embedded />;

  return (
    <Layout isAuthenticated>
      <div className="min-w-0 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
        {/* One open document fills the whole stage, its menus and toolbar along the top */}
        {current.key === "documents" && id ? (
          <div className="min-w-0">{body}</div>
        ) : (
          <div className="mx-auto min-w-0 max-w-screen-xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
            <Link to={`/${slug}`} className="group-chrome mb-3 inline-flex items-center gap-2 text-sm !text-slate-500 hover:!text-accent dark:!text-neutral-400">
              <GroupLogo group={group} className="size-6 text-[0.55rem]" /> {group.title}
            </Link>
            <h1 className="group-chrome mb-6 !text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{current.label}</h1>
            <ErrorNote error={error} />
            {body}
          </div>
        )}
      </div>
    </Layout>
  );
}

// /:slug/conscience/*: the dashboard for people with a role, the plain tab for everyone else
export function ConscienceRoute({ fallback }) {
  const { slug } = useParams();
  const [group, setGroup] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { api(`/groups/${slug}`).then(setGroup).catch(() => setFailed(true)); }, [slug]);
  if (failed) return fallback;
  if (!group) return <Layout isAuthenticated><div className="p-6"><Loading /></div></Layout>;
  return hasGroupRole(group) ? <GroupDashboard group={group} /> : fallback;
}
