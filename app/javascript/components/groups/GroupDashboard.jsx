import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate, NavLink, useNavigate, useParams } from "react-router-dom";
import {
  BellRing, BookOpen, BookOpenCheck, CalendarClock, CalendarDays, ClipboardCheck, FileText, Gavel, Landmark,
  LayoutTemplate, Medal, Repeat, Scale, Settings, Stamp, UserCheck, UserPlus, Users,
} from "lucide-react";
import Layout from "../Layout";
import { api } from "./lib";
import { Card, ErrorNote, Loading, Tray } from "./ui";
import { selectClass } from "../ui/styles";
import ConscienceTab, { ConscienceBody } from "./conscience/ConscienceTab";
import { Row, Stat } from "./conscience/OverviewView";
import { dateLabel, decisionsPath, documentsPath, meetingsPath, treasuryPath } from "./conscience/lib";
import MeetingsTab from "./MeetingsTab";
import LiteratureTab from "./LiteratureTab";
import CourtTab from "./CourtTab";
import GroupSettings, { GroupLogo } from "./GroupSettings";
import ChipDesigner from "./ChipDesigner";

// Who gets the Dashboard: anyone in the group with a role beyond plain member
export const hasGroupRole = (group) =>
  !!(group && (group.can_manage || group.can_keep_records || group.can_schedule_hosts || group.can_keep_treasury));

// A group's working pages on the stage without the group page's header: its name back to the
// group page, the page's title, then the page. `fill` gives one open document the whole stage.
export function GroupFrame({ group, title, fill = false, error = null, children }) {
  useEffect(() => { document.title = `${title} · ${group.title} | RecoveryBot`; }, [title, group.title]);
  return (
    <Layout isAuthenticated>
      <div className="min-w-0 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
        {fill ? <div className="min-w-0">{children}</div> : (
          <div className="mx-auto min-w-0 max-w-screen-xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
            <Link to={`/${group.slug}`} className="group-chrome mb-3 inline-flex items-center gap-2 text-sm !text-slate-500 hover:!text-accent dark:!text-neutral-400">
              <GroupLogo group={group} className="size-6 text-[0.55rem]" /> {group.title}
            </Link>
            <h1 className="group-chrome mb-6 !text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
            <ErrorNote error={error} />
            {children}
          </div>
        )}
      </div>
    </Layout>
  );
}

// Loads the group for a page outside the group page (`children(group, setGroup, reload)`);
// `fallback` when it can't be loaded
function GroupRoute({ fallback = null, children }) {
  const { slug } = useParams();
  const [group, setGroup] = useState(null);
  const [failed, setFailed] = useState(false);
  const reload = useCallback(() => api(`/groups/${slug}`).then(setGroup).catch(() => setFailed(true)), [slug]);
  useEffect(() => { setGroup(null); reload(); }, [reload]);
  if (failed) return fallback || <Navigate to={`/${slug}`} replace />;
  if (!group) return <Layout isAuthenticated><div className="p-6"><Loading /></div></Layout>;
  return children(group, setGroup, reload);
}

// Where the pages of the old group dashboard (/conscience/<page>) live now
const MOVED = {
  hosts: "meetings", schedule: "settings/meetings", settings: "settings", chips: "settings/chips",
  literature: "settings/literature", court: "settings/court", members: "members", events: "events",
};

// /:slug/conscience/*: Group conscience. Everyone sees the same sections, and a record keeper or
// treasurer edits right there; they get it on the stage (so an open document fills it), members
// on the group page (`fallback`).
export function ConscienceRoute({ fallback }) {
  const { slug, "*": rest = "" } = useParams();
  const [view, id] = rest.split("/").filter(Boolean);
  if (MOVED[view]) return <Navigate to={`/${slug}/${MOVED[view]}`} replace />;
  return (
    <GroupRoute fallback={fallback}>
      {(group) => (hasGroupRole(group) ? (
        <GroupFrame group={group} title="Group conscience" fill={view === "documents" && !!id}>
          {view === "documents" && id ? <ConscienceBody group={group} view="documents" id={id} embedded /> : <ConscienceTab group={group} embedded />}
        </GroupFrame>
      ) : fallback)}
    </GroupRoute>
  );
}

// Group settings (/:slug/settings/*), for group admins: everything about how the group is set up,
// in one place
const SETTINGS = [
  { key: "", label: "Group", icon: Settings },
  { key: "meetings", label: "Meeting settings", icon: CalendarClock },
  { key: "chips", label: "Chips", icon: Medal },
  { key: "literature", label: "Approved literature", icon: BookOpen },
  { key: "court", label: "Court verifications", icon: ClipboardCheck },
];

export function SettingsRoute() {
  const { slug, "*": rest = "" } = useParams();
  const navigate = useNavigate();
  const key = rest.split("/")[0] || "";
  return (
    <GroupRoute>
      {(group, setGroup, reload) => {
        if (!group.can_manage) return <Navigate to={`/${slug}`} replace />;
        const current = SETTINGS.find((s) => s.key === key) || SETTINGS[0];
        const path = (s) => `/${slug}/settings${s.key ? `/${s.key}` : ""}`;
        return (
          <GroupFrame group={group} title="Settings">
            <div className="space-y-5">
              <nav aria-label="Settings" className="group-chrome hidden flex-wrap gap-1 sm:flex">
                {SETTINGS.map((s) => (
                  <NavLink key={s.key} to={path(s)} end
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ${current.key === s.key ? "!bg-accent !text-white" : "bg-white text-slate-700 ring-1 ring-neutral-200 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700"}`}>
                    <s.icon className="size-4" /> {s.label}
                  </NavLink>
                ))}
                <Link to={`/${slug}/page/edit`} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-neutral-200 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700">
                  <LayoutTemplate className="size-4" /> Edit the group page
                </Link>
              </nav>
              <select aria-label="Settings" className={`${selectClass} group-chrome sm:hidden`} value={current.key}
                onChange={(e) => (e.target.value === "page" ? navigate(`/${slug}/page/edit`) : navigate(path({ key: e.target.value })))}>
                {SETTINGS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                <option value="page">Edit the group page</option>
              </select>
              {current.key === "" && <GroupSettings group={group} setGroup={setGroup} />}
              {current.key === "meetings" && <MeetingsTab group={group} setGroup={setGroup} reload={reload} isNew={new URLSearchParams(window.location.search).get("new") === "1"} />}
              {current.key === "chips" && <ChipDesigner group={group} />}
              {current.key === "literature" && <LiteratureTab group={group} reload={reload} />}
              {current.key === "court" && <CourtTab group={group} setGroup={setGroup} />}
            </div>
          </GroupFrame>
        );
      }}
    </GroupRoute>
  );
}

// A role's part of the Dashboard: what's waiting on it, then its pages
function RolePart({ title, items, empty, links }) {
  return (
    <Tray label={title}>
      <div className="space-y-1.5">
        {items.length === 0 && <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">{empty}</Card>}
        {items}
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 pt-1">
          {links.map(([to, label]) => <Link key={to} to={to} className="text-sm font-medium text-accent hover:underline">{label}</Link>)}
        </div>
      </div>
    </Tray>
  );
}

// The Dashboard (/:slug/dashboard), for anyone with a role in the group: the numbers, then what
// needs them, a part for each role they hold. The pages themselves are the group's own
// (Meetings, Group conscience, Members, Settings), where their role lets them edit.
export default function GroupDashboard() {
  const { slug } = useParams();
  return (
    <GroupRoute>
      {(group) => (hasGroupRole(group) ? <DashboardBody group={group} /> : <Navigate to={`/${slug}`} replace />)}
    </GroupRoute>
  );
}

function DashboardBody({ group }) {
  const slug = group.slug;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api(`/groups/${slug}/conscience`).then(setData).catch((e) => setError(e.message)); }, [slug]);

  const st = data?.stats;
  const waiting = data?.waiting;
  const requests = group.requests || [];
  return (
    <GroupFrame group={group} title="Dashboard" error={error}>
      {!data ? <Loading /> : (
        <div className="space-y-6">
          {st && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <Stat to={`/${slug}/members`} icon={Users} label="Members" value={st.members} detail={st.requests ? `${st.requests} asking to join` : "No one waiting to join"} />
              <Stat to={decisionsPath(slug)} icon={Gavel} label="Standing decisions" value={st.standing_decisions} detail={st.decisions_to_check ? `${st.decisions_to_check} imported, waiting to be checked` : "Everything checked"} />
              <Stat to={meetingsPath(slug)} icon={CalendarDays} label="Business meetings held" value={st.business_meetings} detail={data.next_meeting ? `Next: ${dateLabel(data.next_meeting.held_on)}` : "None scheduled"} />
              <Stat to={treasuryPath(slug)} icon={Landmark} label="Last treasurer's report" value={st.last_report_on ? new Date(`${st.last_report_on}T00:00:00`).toLocaleDateString([], { month: "short", year: "numeric" }) : "None"} detail={waiting?.draft_reports?.length ? `${waiting.draft_reports.length} in draft` : "Posted reports"} />
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            {group.can_manage && (
              <RolePart title="Group admin" empty="Nobody is waiting to join."
                items={requests.map((r) => <Row key={r.membership_id} to={`/${slug}/members`} icon={UserPlus} title={`${r.name} asked to join`} note="Let them in, or not, on Members" />)}
                links={[[`/${slug}/members`, "Members"], [`/${slug}/settings`, "Settings"], [`/${slug}/settings/meetings`, "Meeting settings"], [`/${slug}/page/edit`, "Edit the group page"]]} />
            )}
            {group.can_keep_records && waiting && (
              <RolePart title="Record keeper" empty="Nothing is waiting on the records."
                items={[
                  ...waiting.suggested_items.map((i) => <Row key={`i${i.id}`} to={meetingsPath(slug, i.meeting_id)} icon={CalendarClock} title={`Suggested for ${dateLabel(i.held_on)}: ${i.title}`} note="Put it on the agenda or decline it" />),
                  ...waiting.draft_minutes.map((m) => <Row key={`m${m.id}`} to={meetingsPath(slug, m.id)} icon={CalendarClock} title={`Minutes for ${dateLabel(m.held_on)} aren't posted`} note="Still a draft" />),
                  ...waiting.draft_documents.map((d) => <Row key={`d${d.id}`} to={documentsPath(slug, d.id)} icon={FileText} title={d.title} note="A draft document" />),
                  ...(st?.decisions_to_check ? [<Row key="check" to={decisionsPath(slug)} icon={Scale} title={`${st.decisions_to_check} imported decisions to check`} note="Look them over in Decisions" />] : []),
                ]}
                links={[[meetingsPath(slug), "Business meetings"], [decisionsPath(slug), "Decisions"], [documentsPath(slug), "Documents"], [`/${slug}/conscience/templates`, "Document templates"], [`/${slug}/conscience/officials`, "Elected officials"]]} />
            )}
            {group.can_schedule_hosts && (
              <RolePart title="Host coordinator" empty="Every host place is filled and nobody needs a sub."
                items={[
                  ...(data.covers || []).map((c) => <Row key={`c${c.id}`} to={`/${slug}/meetings`} icon={Repeat} title={c.text} note={dateLabel(c.on)} />),
                  ...(data.sub_requests || []).map((r) => <Row key={`s${r.id}`} to={`/${slug}/meetings`} icon={BellRing} title={`${r.meeting_name}, ${dateLabel(r.on)}: needs a ${r.role === "co_host" ? "co-host" : "host"}`} note={r.requested_by ? `Asked by ${r.requested_by}` : "Nobody has taken it yet"} />),
                  ...(data.hosts_open && data.hosts_open.open_hosts + data.hosts_open.open_co_hosts > 0
                    ? [<Row key="open" to={`/${slug}/meetings`} icon={UserCheck} title={`${data.hosts_open.open_hosts + data.hosts_open.open_co_hosts} host places are open`} note={`${data.hosts_open.open_hosts} ${data.hosts_open.open_hosts === 1 ? "host" : "hosts"} and ${data.hosts_open.open_co_hosts} ${data.hosts_open.open_co_hosts === 1 ? "co-host" : "co-hosts"} needed across the week`} />] : []),
                ]}
                links={[[`/${slug}/meetings`, "Meetings and hosts"], [`/${slug}/decks`, "HostDecks"]]} />
            )}
            {group.can_keep_treasury && waiting && (
              <RolePart title="Treasurer" empty="No reports in draft."
                items={waiting.draft_reports.map((r) => <Row key={`r${r.id}`} to={treasuryPath(slug, r.id)} icon={Landmark} title={`Treasurer's report for ${dateLabel(r.period_on)}`} note="Not posted yet" />)}
                links={[[treasuryPath(slug), "Treasury"], [`${treasuryPath(slug)}/new`, "Start a report"]]} />
            )}
          </div>
          {!group.can_manage && !group.can_keep_records && !group.can_schedule_hosts && !group.can_keep_treasury && (
            <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400"><BookOpenCheck className="mr-1 inline size-4" /> Nothing here needs you.</Card>
          )}
          {data.next_meeting && (
            <Tray label="Next business meeting">
              <Row to={meetingsPath(slug, data.next_meeting.id)} icon={Stamp} title={data.next_meeting.starts_at ? data.next_meeting.when_label : dateLabel(data.next_meeting.held_on)} note="Open it to see the agenda" />
            </Tray>
          )}
        </div>
      )}
    </GroupFrame>
  );
}
