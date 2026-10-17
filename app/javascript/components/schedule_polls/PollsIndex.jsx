import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ChevronRight, Lock, Plus, Users } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { api, clock, dayParts, parseStart } from "./lib";
import { Message } from "./PollPage";

const ROLE_LABELS = { organizer: "Organizer", collaborator: "Collaborator", invitee: "Invited to vote" };

export default function PollsIndex() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <Message title="Couldn't load your polls" text={error} />;
  if (!data) return <p className="py-16 text-center !font-sans text-sm text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 !font-sans [&_*]:!font-sans">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Schedule polls</h1>
          <p className="text-sm text-slate-600 dark:text-neutral-400">Find a time that works: people rank their best times on a week view.</p>
        </div>
        {data.can_create && (
          <Link to="/new" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl !bg-accent px-3.5 py-2 text-sm font-semibold !text-white shadow-panel hover:opacity-90">
            <Plus className="h-4 w-4" /> New poll
          </Link>
        )}
      </div>

      <Shell>
        <ShellBand icon={CalendarClock} title="Your polls" subtitle="Ones you run, help run or were asked to vote in" />
        <ShellPanel position="bottom" className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {data.polls.length === 0 ? (
            <p className="p-4 text-sm text-slate-500 dark:text-neutral-400">No polls yet.</p>
          ) : (
            data.polls.map((poll) => {
              const closes = parseStart(poll.closes_at);
              return (
                <Link key={poll.token} to={`/${poll.token}`} className="flex items-center gap-3 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900 dark:text-white">{poll.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500 dark:text-neutral-400">
                      <span>{dayParts(poll.starts_on).long} – {dayParts(poll.ends_on).long}</span>
                      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{poll.ballots_count}</span>
                      <span>{ROLE_LABELS[poll.role]}</span>
                      {poll.closed ? (
                        <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Closed</span>
                      ) : closes && (
                        <span>Closes {dayParts(closes.date).long}, {clock(closes.minute)}</span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </Link>
              );
            })
          )}
        </ShellPanel>
      </Shell>
    </div>
  );
}
