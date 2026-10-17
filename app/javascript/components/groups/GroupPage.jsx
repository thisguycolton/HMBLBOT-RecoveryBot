import React, { useCallback, useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BookOpen, CalendarClock, CalendarRange, Gavel, House, LayoutTemplate, NotebookPen, Pencil, Users } from "lucide-react";
import { api } from "./lib";
import { ErrorNote, Loading, Message, Pill } from "./ui";
import GroupHero, { heroButton, heroQuietButton } from "./page/GroupHero";
import NextMeeting from "./NextMeeting";
import GroupHome from "./page/GroupHome";
import MeetingsTab from "./MeetingsTab";
import MembersTab from "./MembersTab";
import LiteratureTab from "./LiteratureTab";
import ReadingsTab from "./ReadingsTab";
import CourtTab from "./CourtTab";
import EventsTab from "./EventsTab";

const TABS = [
  { key: "home", label: "Home", icon: House },
  { key: "meetings", label: "Meetings", icon: CalendarClock },
  { key: "events", label: "Events", icon: CalendarRange },
  { key: "readings", label: "Readings", icon: NotebookPen, members: true },
  { key: "literature", label: "Literature", icon: BookOpen, members: true },
  { key: "members", label: "Members", icon: Users, members: true },
  { key: "court", label: "Court verifications", icon: Gavel, managers: true },
];

// /groups/:slug(/:tab): the group's own page (Home, made in the HMBLBOT Editor) and its
// other sections. A new group (?new=1) opens on its meetings, to bring them in.
export default function GroupPage() {
  const [searchParams] = useSearchParams();
  const { slug, tab = searchParams.get("new") === "1" ? "meetings" : "home" } = useParams();
  const navigate = useNavigate();
  // Opened from Find a meeting: back goes to those results
  const back = useLocation().state?.back;
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api(`/groups/${slug}`).then(setGroup).catch((e) => setError(e.message)), [slug]);
  useEffect(() => {
    setGroup(null);
    load();
  }, [load]);

  if (error) {
    return (
      <Message title="That group isn't here" text={error}>
        <Link to="/" className="mt-4 inline-block text-sm text-accent hover:underline">Back to groups</Link>
      </Message>
    );
  }
  if (!group) return <Loading />;

  const isMember = group.is_member || group.is_site_admin;
  const tabs = TABS.filter((t) => (!t.members || isMember) && (!t.managers || group.can_manage));
  const current = tabs.find((t) => t.key === tab) || tabs[0];

  const act = async (path, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await api(`/groups/${slug}/${path}`, { method: "POST" });
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
      <Link to={back || "/"} className="text-sm text-slate-500 hover:text-accent dark:text-neutral-400">{back ? "← Find a meeting" : "← Groups"}</Link>
      <GroupHero
        group={group}
        coverUrl={group.cover_url}
        badge={group.status === "pending" && <Pill tone="amber">Waiting for approval</Pill>}
        next={<NextMeeting meetings={group.meetings} buttonClass={heroButton} quietClass={heroQuietButton} />}
        actions={
          <>
            {group.status === "pending" && group.is_site_admin && (
              <button type="button" disabled={busy} onClick={() => act("approve")} className={heroButton}>Approve group</button>
            )}
            {!group.membership_status && (
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
            {group.can_manage && (
              <>
                <Link to={`/${slug}/page/edit`} className={heroButton}><LayoutTemplate className="h-4 w-4" /> Edit page</Link>
                <Link to={`/${slug}/edit`} className={heroQuietButton}><Pencil className="h-4 w-4" /> Details</Link>
              </>
            )}
            {group.membership_status === "active" && (
              <button type="button" disabled={busy} onClick={() => act("leave", `Leave ${group.title}?`)} className={heroQuietButton}>Leave</button>
            )}
          </>
        }
      />
      <ErrorNote error={actionError} />

      {tabs.length > 1 && (
        <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-neutral-200 px-4 dark:border-neutral-800" aria-label="Group sections">
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
      {current.key === "meetings" && <MeetingsTab group={group} setGroup={setGroup} reload={load} isNew={searchParams.get("new") === "1"} />}
      {current.key === "events" && <EventsTab group={group} />}
      {current.key === "readings" && <ReadingsTab group={group} />}
      {current.key === "literature" && <LiteratureTab group={group} reload={load} />}
      {current.key === "members" && <MembersTab group={group} reload={load} setGroup={setGroup} />}
      {current.key === "court" && <CourtTab group={group} setGroup={setGroup} />}
    </div>
  );
}
