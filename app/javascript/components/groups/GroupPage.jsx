import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate, NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Lock } from "lucide-react";
import { api } from "./lib";
import { Card, ErrorNote, Loading, Message, Pill, primaryButton } from "./ui";
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
import { groupMenu, groupPerms } from "../shell/navItems";

// Old addresses of pages that moved: Hosts joined Meetings, court verifications went to Manage,
// Readings and Literature became Reading, the Dashboard's settings became Manage
const MOVED = { hosts: "meetings", court: "manage/court", readings: "reading", literature: "reading", settings: "manage" };
// The group page's own sections (the rest of the group menu are pages of their own)
const OWN = ["home", "meetings", "events", "reading", "conscience", "members", "chat"];

// The roles someone holds, for the badge on the hero: "Record keeper · Can host"
const roleBadge = (group) => (group.role === "admin" ? "Group admin" : (group.my_roles || []).join(" · ") || "Member");

// /groups/:slug(/:tab): the group's own page (Home, made in the HMBLBOT Editor) and its
// other sections, the same for everyone in the group, a role deciding what they can change.
// The tabs are the group menu (navItems.js groupMenu), the same list as its sidebar folder: the
// members' sections show locked to anyone else, and Host tools, the Dashboard and Manage come
// after a divider for people with a role. A new group (?new=1) opens on Meetings setup, to bring
// its meetings in. Group conscience (/:slug/conscience/*) is members' tab, but a Public document
// opens for anyone; people with a role get it on the stage (GroupDashboard.jsx ConscienceRoute).
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
  if (!group) return <Loading variant="group" />;

  const isMember = group.is_member || group.is_site_admin;
  if (MOVED[tab]) return <Navigate to={`/${slug}/${MOVED[tab]}`} replace />;
  if (searchParams.get("new") === "1" && group.can_manage) return <Navigate to={`/${slug}/manage/meetings?new=1`} replace />;
  const tabs = groupMenu(slug, groupPerms(group));
  // Chat is a page of its own for members; anyone else lands here and sees it locked
  if (tab === "chat" && isMember) return <Navigate to={`/${slug}/messages`} replace />;
  const current = tabs.find((t) => t.key === tab && OWN.includes(t.key)) || tabs[0];
  // A Public document or decision someone linked to opens for anyone (ConscienceTab)
  const conscienceLink = current.key === "conscience" && !!(fixedTab && window.location.pathname.split("/conscience/")[1]);
  const locked = current.locked && !conscienceLink;

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
                <span className="inline-flex items-center px-1 py-2 text-sm font-semibold text-white">Waiting for a group admin</span>
                <button type="button" disabled={busy} onClick={() => act("leave")} className={heroQuietButton}>Withdraw</button>
              </>
            )}
            {group.membership_status === "active" && (
              <span className="inline-flex items-center rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-900">{roleBadge(group)}</span>
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
      {group.membership_status === "requested" && (
        <Card className="p-4 text-sm text-slate-700 dark:text-neutral-200">
          Your request is waiting for a group admin. You'll get a notification when they let you in. Until then you can still join any of the group's open meetings.
        </Card>
      )}

      {tabs.length > 1 && (
        <nav className="group-chrome no-scrollbar -mx-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] border-neutral-200 pl-4 pr-10 dark:border-neutral-800" aria-label="Group sections">
          {tabs.map(({ key, label, icon: Icon, href, locked: shut, service }, i) => (
            <React.Fragment key={key}>
              {/* Host tools, the Dashboard and Manage, for people with a role, after a divider */}
              {service && !tabs[i - 1].service && <span aria-hidden="true" className="mx-1 my-2.5 w-px shrink-0 bg-neutral-300 dark:bg-neutral-700" />}
              <NavLink
                to={shut || OWN.includes(key) ? pathFor(key) : href.replace(/^\/groups/, "")}
                end
                className={() =>
                  `-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium ${
                    current.key === key
                      ? "border-accent text-accent"
                      : `border-transparent hover:text-slate-900 dark:hover:text-white ${shut ? "text-slate-400 dark:text-neutral-500" : "text-slate-600 dark:text-neutral-400"}`
                  }`
                }
              >
                {shut ? <Lock className="h-3.5 w-3.5" aria-label="Members only" /> : <Icon className="h-4 w-4" />} {label}
                {key === "members" && group.requests?.length > 0 && (
                  <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">{group.requests.length}</span>
                )}
              </NavLink>
            </React.Fragment>
          ))}
        </nav>
      )}

      {locked ? <MembersOnly group={group} label={current.label} busy={busy} onJoin={() => act("join")} /> : (
        <>
          {current.key === "home" && <GroupHome slug={slug} onJoin={() => act("join")} />}
          {current.key === "meetings" && <MeetingsPage group={group} setGroup={setGroup} reload={load} focusId={Number(meetingId) || null} />}
          {current.key === "events" && <EventsTab group={group} />}
          {current.key === "reading" && <ReadingSection group={group} reload={load} />}
          {current.key === "conscience" && <ConscienceTab group={group} />}
          {current.key === "members" && <MembersTab group={group} reload={load} setGroup={setGroup} />}
        </>
      )}
    </div>
  );
}

// Reading: the books the group approved (Literature), then readings members tagged to it
function ReadingSection({ group, reload }) {
  return (
    <div className="space-y-8">
      <LiteratureTab group={group} reload={reload} />
      <ReadingsTab group={group} />
    </div>
  );
}

// A members' section, to someone who isn't in the group (yet)
function MembersOnly({ group, label, busy, onJoin }) {
  const waiting = group.membership_status === "requested";
  return (
    <Card className="mx-auto flex max-w-lg gap-4 p-6">
      <Lock className="size-7 shrink-0 text-slate-400" />
      <div className="min-w-0">
      <p className="text-lg font-semibold text-slate-900 dark:text-white">{label} is for members</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-neutral-300">
        {waiting ? "You'll see it as soon as a group admin lets you in."
          : "Members get the group chat, the host schedule, business meetings and decisions, the group's approved reading and the member list."}
      </p>
      {!waiting && group.status === "active" && (
        <button type="button" disabled={busy} onClick={onJoin} className={`${primaryButton} mt-4`}>Ask to join</button>
      )}
      </div>
    </Card>
  );
}
