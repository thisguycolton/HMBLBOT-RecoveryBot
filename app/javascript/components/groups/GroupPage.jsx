import React, { useCallback, useEffect, useState } from "react";
import { Link, NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BookOpen, CalendarClock, ExternalLink, Gavel, NotebookPen, Pencil, Users } from "lucide-react";
import { api, zoneLabel } from "./lib";
import { ErrorNote, Loading, Message, Pill, primaryButton, quietButton } from "./ui";
import MeetingsTab from "./MeetingsTab";
import MembersTab from "./MembersTab";
import LiteratureTab from "./LiteratureTab";
import ReadingsTab from "./ReadingsTab";
import CourtTab from "./CourtTab";

const TABS = [
  { key: "meetings", label: "Meetings", icon: CalendarClock },
  { key: "readings", label: "Readings", icon: NotebookPen, members: true },
  { key: "literature", label: "Literature", icon: BookOpen, members: true },
  { key: "members", label: "Members", icon: Users, members: true },
  { key: "court", label: "Court verifications", icon: Gavel, managers: true },
];

// /groups/:slug(/:tab)
export default function GroupPage() {
  const { slug, tab = "meetings" } = useParams();
  const [searchParams] = useSearchParams();
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

  return (
    <div className="mx-auto max-w-4xl space-y-5 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <header className="space-y-3">
        <Link to="/" className="text-sm text-slate-500 hover:text-accent dark:text-neutral-400">← Groups</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {group.title}
              {group.status === "pending" && <Pill tone="amber">Waiting for approval</Pill>}
            </h1>
            {group.description && <p className="mt-1 max-w-2xl text-slate-600 dark:text-neutral-300">{group.description}</p>}
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-slate-500 dark:text-neutral-400">
              <span>{zoneLabel(group.time_zone)} time</span>
              {group.website && (
                <a href={group.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                  Website <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {group.role && group.membership_status === "active" && <span>You're {group.role === "admin" ? "a group admin" : "a member"}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {group.status === "pending" && group.is_site_admin && (
              <button type="button" disabled={busy} onClick={() => act("approve")} className={primaryButton}>Approve group</button>
            )}
            {!group.membership_status && (
              <button type="button" disabled={busy} onClick={() => act("join")} className={primaryButton}>Ask to join</button>
            )}
            {group.membership_status === "requested" && (
              <>
                <Pill tone="amber">Request sent</Pill>
                <button type="button" disabled={busy} onClick={() => act("leave")} className={quietButton}>Withdraw</button>
              </>
            )}
            {group.can_manage && (
              <Link to={`/${slug}/edit`} className={quietButton}><Pencil className="h-4 w-4" /> Edit</Link>
            )}
            {group.membership_status === "active" && (
              <button type="button" disabled={busy} onClick={() => act("leave", `Leave ${group.title}?`)} className={quietButton}>Leave</button>
            )}
          </div>
        </div>
        <ErrorNote error={actionError} />
      </header>

      {tabs.length > 1 && (
        <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-neutral-200 px-4 dark:border-neutral-800" aria-label="Group sections">
          {tabs.map(({ key, label, icon: Icon }) => (
            <NavLink
              key={key}
              to={key === "meetings" ? `/${slug}` : `/${slug}/${key}`}
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

      {current.key === "meetings" && <MeetingsTab group={group} setGroup={setGroup} reload={load} isNew={searchParams.get("new") === "1"} />}
      {current.key === "readings" && <ReadingsTab group={group} />}
      {current.key === "literature" && <LiteratureTab group={group} reload={load} />}
      {current.key === "members" && <MembersTab group={group} reload={load} setGroup={setGroup} />}
      {current.key === "court" && <CourtTab group={group} />}
    </div>
  );
}
