import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate, NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BookOpen, CalendarClock, CalendarRange, House, LayoutDashboard, LayoutTemplate, NotebookPen, Settings, Scale, Users } from "lucide-react";
import { hasGroupRole } from "./GroupDashboard";
import { api } from "./lib";
import { ErrorNote, Loading, Message, Pill } from "./ui";
import GroupHero, { heroButton, heroQuietButton } from "./page/GroupHero";
import NextMeeting from "./NextMeeting";
import GroupHome from "./page/GroupHome";
import MeetingsPage from "./MeetingsPage";
import MembersTab from "./MembersTab";
import LiteratureTab from "./LiteratureTab";
import ReadingsTab from "./ReadingsTab";
import EventsTab from "./EventsTab";
import ConscienceTab from "./conscience/ConscienceTab";
import ShareButton from "../share/ShareButton";
import { refreshNav } from "../shell/useShell";

const TABS = [
  { key: "home", label: "Home", icon: House },
  { key: "meetings", label: "Meetings", icon: CalendarClock },
  { key: "events", label: "Events", icon: CalendarRange },
  { key: "readings", label: "Readings", icon: NotebookPen, members: true },
  { key: "literature", label: "Literature", icon: BookOpen, members: true },
  { key: "conscience", label: "Group conscience", icon: Scale, members: true },
  { key: "members", label: "Members", icon: Users, members: true },
];

// Old addresses of pages that moved: Hosts joined Meetings, court verifications went to Settings
const MOVED = { hosts: "meetings", court: "settings/court" };

// /groups/:slug(/:tab): the group's own page (Home, made in the HMBLBOT Editor) and its
// other sections, the same for everyone in the group, a role deciding what they can change.
// A new group (?new=1) opens on Meeting settings, to bring its meetings in. Group conscience
// (/:slug/conscience/*) is members' tab, but a Public document opens for anyone; people with a
// role get it on the stage (GroupDashboard.jsx ConscienceRoute). Settings and the Dashboard
// are pages of their own there too.
export default function GroupPage({ tab: fixedTab }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { slug, meetingId, tab: routeTab = meetingId ? "meetings" : "home" } = useParams();
  const tab = fixedTab || routeTab;
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api(`/groups/${slug}`).then(setGroup).catch((e) => setError(e.message)), [slug]);
  useEffect(() => {
    setGroup(null);
    load();
  }, [load]);

  // Back from making an account to ask to join (GroupsController#ask): send the request
  useEffect(() => {
    if (!group || searchParams.get("ask") !== "1") return;
    setSearchParams({}, { replace: true });
    if (group.signed_in && !group.membership_status && group.status === "active") {
      api(`/groups/${slug}/join`, { method: "POST" }).then(setGroup).catch((e) => setActionError(e.message));
    }
  }, [group, searchParams, setSearchParams, slug]);

  if (error) {
    return (
      <Message title="That group isn't here" text={error}>
        <Link to="/" className="mt-4 inline-block text-sm text-accent hover:underline">Back to groups</Link>
      </Message>
    );
  }
  if (!group) return <Loading />;

  const isMember = group.is_member || group.is_site_admin;
  const dashboard = hasGroupRole(group);
  if (MOVED[tab]) return <Navigate to={`/${slug}/${MOVED[tab]}`} replace />;
  if (searchParams.get("new") === "1" && group.can_manage) return <Navigate to={`/${slug}/settings/meetings?new=1`} replace />;
  const tabs = TABS.filter((t) => !t.members || isMember);
  const current = tabs.find((t) => t.key === tab) || (tab === "conscience" && { key: "conscience" }) || tabs[0];

  const act = async (path, confirmText) => {
    // Signed out: make an account first, then back here, where the request goes out (?ask=1)
    if (path === "join" && !group.signed_in) {
      window.location.href = `/groups/${slug}/ask`;
      return;
    }
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await api(`/groups/${slug}/${path}`, { method: "POST" });
      refreshNav(); // joined or left: the sidebar's groups change
      if (path === "leave") navigate("/");
      else if (result) setGroup(result);
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const pathFor = (key) => (key === "home" ? `/${slug}` : `/${slug}/${key}`);

  return (
    <div className="mx-auto max-w-6xl space-y-5 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <GroupHero
        bleed
        group={group}
        coverUrl={group.cover_url}
        badge={group.status === "pending" && <Pill tone="amber">Waiting for approval</Pill>}
        next={<NextMeeting meetings={group.meetings} buttonClass={heroButton} quietClass={heroQuietButton} />}
        actions={
          <>
            {group.status === "pending" && group.is_site_admin && (
              <button type="button" disabled={busy} onClick={() => act("approve")} className={heroButton}>Approve group</button>
            )}
            {!group.membership_status && group.status === "active" && (
              <button type="button" disabled={busy} onClick={() => act("join")} className={heroButton}>Ask to join</button>
            )}
            {group.membership_status === "requested" && (
              <>
                <span className={heroQuietButton}>Request sent</span>
                <button type="button" disabled={busy} onClick={() => act("leave")} className={heroQuietButton}>Withdraw</button>
              </>
            )}
            {group.membership_status === "active" && (
              <span className={heroQuietButton}>You're {group.role === "admin" ? "a group admin" : "a member"}</span>
            )}
            {dashboard && <Link to={`/${slug}/dashboard`} className={heroButton}><LayoutDashboard className="h-4 w-4" /> Dashboard</Link>}
            {group.can_manage && (
              <>
                <Link to={`/${slug}/page/edit`} className={heroButton}><LayoutTemplate className="h-4 w-4" /> Edit page</Link>
                <Link to={`/${slug}/settings`} className={heroQuietButton}><Settings className="h-4 w-4" /> Settings</Link>
              </>
            )}
            {group.membership_status === "active" && (
              <button type="button" disabled={busy} onClick={() => act("leave", `Leave ${group.title}?`)} className={heroQuietButton}>Leave</button>
            )}
            {group.status === "active" && (
              <ShareButton url={`/groups/${slug}`} title={group.title} text={`${group.title} on RecoveryBot`}
                image={`/share_cards/group/${slug}.png`} panelTitle="Share this group" className={heroQuietButton} />
            )}
          </>
        }
      />
      <ErrorNote error={actionError} />

      {tabs.length > 1 && (
        <nav className="group-chrome no-scrollbar -mx-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-neutral-200 px-4 dark:border-neutral-800" aria-label="Group sections">
          {tabs.map(({ key, label, icon: Icon }) => (
            <NavLink
              key={key}
              to={pathFor(key)}
              end
              className={() =>
                `-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium ${
                  current.key === key
                    ? "border-accent text-accent"
                    : "border-transparent text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
                }`
              }
            >
              <Icon className="h-4 w-4" /> {label}
              {key === "members" && group.requests?.length > 0 && (
                <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">{group.requests.length}</span>
              )}
            </NavLink>
          ))}
        </nav>
      )}

      {current.key === "home" && <GroupHome slug={slug} onJoin={() => act("join")} />}
      {current.key === "meetings" && <MeetingsPage group={group} setGroup={setGroup} reload={load} focusId={Number(meetingId) || null} />}
      {current.key === "events" && <EventsTab group={group} />}
      {current.key === "readings" && <ReadingsTab group={group} />}
      {current.key === "literature" && <LiteratureTab group={group} reload={load} />}
      {current.key === "conscience" && <ConscienceTab group={group} />}
      {current.key === "members" && <MembersTab group={group} reload={load} setGroup={setGroup} />}
    </div>
  );
}
