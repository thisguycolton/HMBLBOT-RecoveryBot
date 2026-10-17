import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Users } from "lucide-react";
import Avatar from "../groups/Avatar";
import { api } from "../groups/lib";
import { Card, ErrorNote, Loading, Tray } from "../groups/ui";
import FeedItem from "../notes/FeedItem";

// People (/people): find someone by name, and what the people you follow have shared
// with their followers lately.
export default function PeopleIndex() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState(null);

  useEffect(() => {
    document.title = "People | RecoveryBot";
    api("/people").then(setData).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setMatches(null); return undefined; }
    const timer = setTimeout(() => api(`/people?q=${encodeURIComponent(term)}`).then((d) => setMatches(d.matches)).catch(() => {}), 250);
    return () => clearTimeout(timer);
  }, [q]);

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;

  return (
    <div className="mx-auto max-w-2xl space-y-6 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="flex flex-1 items-center gap-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white"><Users className="size-7 text-accent" /> People</h1>
        <Link to="/me" className="inline-flex items-center gap-2 rounded-xl !bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-panel ring-1 ring-neutral-200 hover:ring-accent/50 dark:!bg-neutral-800 dark:text-white dark:ring-neutral-700">
          <Avatar person={data.me} size={24} /> Your profile
        </Link>
      </header>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find someone by name"
          className="w-full rounded-xl border-0 bg-white py-2.5 pl-9 pr-3 text-slate-900 shadow-sm ring-1 ring-neutral-200 placeholder:text-slate-400 focus:ring-2 focus:ring-accent dark:bg-neutral-900 dark:text-white dark:ring-neutral-700" />
      </label>

      {matches ? (
        <Tray label="Matches">
          {matches.length === 0 ? <Card className="p-5 text-center text-sm text-slate-500">Nobody by that name.</Card> : (
            <Card className="divide-y divide-neutral-200/70 dark:divide-neutral-700/60">
              {matches.map((p) => (
                <Link key={p.id} to={`/${p.username}`} className="flex items-center gap-3 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
                  <Avatar person={p} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-900 dark:text-white">{p.name}</span>
                    <span className="block truncate text-xs text-slate-500">@{p.username}</span>
                  </span>
                </Link>
              ))}
            </Card>
          )}
        </Tray>
      ) : (
        <Tray label="From people you follow">
          {data.feed.length === 0 ? (
            <Card className="p-6 text-center text-sm text-slate-500 dark:text-neutral-400">
              {data.following_count === 0
                ? "Follow people from their profiles (tap someone's name in a group) and what they share with followers shows here."
                : "Nothing new from the people you follow."}
            </Card>
          ) : (
            <div className="wb wb-feed">
              {data.feed.map((item) => <FeedItem key={`${item.kind}-${item.id}`} item={item} showAuthor />)}
            </div>
          )}
        </Tray>
      )}
    </div>
  );
}
