import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ChevronRight, LayoutTemplate, MessagesSquare, Plus, Search, Users } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { api } from "./lib";
import { Loading, Message, Pill, primaryButton, quietButton } from "./ui";
import { GroupLogo } from "./GroupSettings";

// /groups: the groups you're in (and waiting on), then every other group for site admins
export default function GroupsIndex() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/groups").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <Message title="Couldn't load your groups" text={error} />;
  if (!data) return <Loading />;

  const mine = data.groups.filter((g) => g.membership_status);
  const others = data.groups.filter((g) => !g.membership_status);

  return (
    <div className="mx-auto max-w-3xl space-y-4 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Groups</h1>
          <p className="text-sm text-slate-600 dark:text-neutral-400">Your home groups: meetings, readings, literature and the people in them.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/people/me" className={quietButton}><MessagesSquare className="h-4 w-4" /> Your profile</a>
          <Link to="/find" className={quietButton}><Search className="h-4 w-4" /> Find a group</Link>
          {data.can_create && (
            <>
              <Link to="/default-page" className={quietButton}><LayoutTemplate className="h-4 w-4" /> Default page</Link>
              <Link to="/new" className={primaryButton}><Plus className="h-4 w-4" /> New group</Link>
            </>
          )}
        </div>
      </div>

      <Shell>
        <ShellBand icon={Users} title="Your groups" subtitle="Groups you belong to or asked to join" />
        <ShellPanel position={others.length ? "middle" : "bottom"} className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {mine.length === 0 ? (
            <div className="p-5 text-sm text-slate-600 dark:text-neutral-400">
              You're not in a group yet.{" "}
              <Link to="/find" className="font-semibold text-accent hover:underline">Find your group</Link> by the meeting you go to.
            </div>
          ) : (
            mine.map((group) => <GroupRow key={group.slug} group={group} />)
          )}
        </ShellPanel>
        {others.length > 0 && (
          <>
            <ShellBand icon={Users} title="Every other group" subtitle="Site admins see them all" position="middle" />
            <ShellPanel position="bottom" className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {others.map((group) => <GroupRow key={group.slug} group={group} />)}
            </ShellPanel>
          </>
        )}
      </Shell>
    </div>
  );
}

function GroupRow({ group }) {
  return (
    <Link to={`/${group.slug}`} className="flex items-center gap-3 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
      <GroupLogo group={group} className="size-11 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900 dark:text-white">
          <span className="truncate">{group.title}</span>
          {group.role === "admin" && group.membership_status === "active" && <Pill tone="accent">Admin</Pill>}
          {group.membership_status === "requested" && <Pill tone="amber">Request sent</Pill>}
          {group.status === "pending" && <Pill tone="amber">Waiting for approval</Pill>}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500 dark:text-neutral-400">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {group.next_meeting ? `Next: ${group.next_meeting.schedule_label}` : "No meetings yet"}
          </span>
          <span>{group.meetings_count} meeting{group.meetings_count === 1 ? "" : "s"}</span>
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
    </Link>
  );
}
