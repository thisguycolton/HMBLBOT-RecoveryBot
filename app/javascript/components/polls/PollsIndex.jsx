import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Lock, Plus, Users, Vote } from "lucide-react";
import { Skeleton } from "skullet/react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { Message } from "./PollPage";
import { AUDIENCE_LABELS, api, primaryClass, when } from "./lib";

export default function PollsIndex() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <Message title="Couldn't load your polls" text={error} />;
  // While it loads, Skullet draws the page itself, from made-up polls, as a skeleton
  return (
    <Skeleton data={data} sample={SAMPLE} label="Loading your polls">
      {(loaded) => <Polls data={loaded} />}
    </Skeleton>
  );
}

// Stands in for the list while it loads: the skeleton's shape, never shown as text
const SAMPLE = {
  can_create: false,
  polls: [
    { token: "a", question: "Should we move the business meeting to the second Sunday?", group: "Lantern Street Group", ballots_count: 12, audience: "members", closed: false, closes_at: null },
    { token: "b", question: "Which reading for the anniversary night?", group: null, ballots_count: 5, audience: "anyone", closed: true, closes_at: null },
    { token: "c", question: "Coffee or tea at the Tuesday meeting?", group: "Early Risers", ballots_count: 8, audience: "members", closed: false, closes_at: null },
  ],
};

function Polls({ data }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 !font-sans [&_*]:!font-sans">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Polls</h1>
          <p className="text-sm text-slate-600 dark:text-neutral-400">Ask a question, share a short link, and watch the answers come in.</p>
        </div>
        {data.can_create && <Link to="/polls/new" className={`${primaryClass} shrink-0`}><Plus className="size-4" /> New poll</Link>}
      </div>

      <Shell>
        <ShellBand icon={Vote} title="Your polls" subtitle="Ones you made, or run for your group" />
        <ShellPanel position="bottom" className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {data.polls.length === 0 ? (
            <p className="p-4 text-sm text-slate-500 dark:text-neutral-400">
              No polls yet. Make one with New poll.
            </p>
          ) : (
            data.polls.map((poll) => (
              <Link key={poll.token} to={`/p/${poll.token}`} className="flex items-center gap-3 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 dark:text-white">{poll.question}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500 dark:text-neutral-400">
                    {poll.group && <span>{poll.group}</span>}
                    <span className="inline-flex items-center gap-1"><Users className="size-3" />{poll.ballots_count}</span>
                    <span>{AUDIENCE_LABELS[poll.audience]}</span>
                    {poll.closed ? <span className="inline-flex items-center gap-1"><Lock className="size-3" /> Closed</span>
                      : poll.closes_at && <span>Closes {when(poll.closes_at)}</span>}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-slate-400" />
              </Link>
            ))
          )}
        </ShellPanel>
      </Shell>
    </div>
  );
}
