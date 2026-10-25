import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import Avatar from "../groups/Avatar";
import { api } from "../groups/lib";
import { Card, ErrorNote, Loading } from "../groups/ui";
import FeedItem from "../notes/FeedItem";
import NoteEditor from "../notes/NoteEditor";
import InstallNudge from "../site/InstallNudge";
import PageAside from "../shell/PageAside";
import TodayPanel from "../shell/TodayPanel";

// The home page after signing in (/people): your notes and highlights and those of the
// people you follow, and as the page's side panel (Today) what's coming up in your groups:
// next meetings, sobriety birthdays and events.
export default function PeopleIndex() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState(null);

  useEffect(() => {
    document.title = "Home | RecoveryBot";
    api("/people").then(setData).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setMatches(null); return undefined; }
    const timer = setTimeout(() => api(`/people?q=${encodeURIComponent(term)}`).then((d) => setMatches(d.matches)).catch(() => {}), 250);
    return () => clearTimeout(timer);
  }, [q]);

  // The phone bar's "Write a note" (/people#write) lands in the composer
  useEffect(() => {
    if (!data || window.location.hash !== "#write") return;
    const field = document.querySelector("#write [contenteditable=true], #write textarea");
    field?.focus();
    field?.scrollIntoView({ block: "center" });
  }, [data]);

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;

  const replace = (item) => setData((d) => ({ ...d, feed: d.feed.map((i) => (i.kind === item.kind && i.id === item.id ? { ...i, ...item } : i)) }));
  const remove = (kind) => (id) => setData((d) => ({ ...d, feed: d.feed.filter((i) => !(i.kind === kind && i.id === id)) }));

  return (
    <div className="mx-auto max-w-3xl !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <PageAside title="Today"><TodayPanel today={data.coming_up} /></PageAside>
      <div className="min-w-0 space-y-5">
        <InstallNudge />
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="flex-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Notes</h1>
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
          matches.length === 0 ? <Card className="p-5 text-center text-sm text-slate-500">Nobody by that name.</Card> : (
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
          )
        ) : (
          <div className="wb space-y-4">
            <Card className="p-4" id="write">
              <NoteEditor groups={data.groups} defaultVisibility={data.default_note_visibility} max={data.note_max} imagesMax={data.images_max}
                placeholder="What's on your mind today? Select words to format them, and add photos if you like."
                onSaved={(note) => setData((d) => ({ ...d, feed: [note, ...d.feed] }))} />
            </Card>
            {data.feed.length === 0 ? (
              <Card className="p-6 text-center text-sm text-slate-500 dark:text-neutral-400">
                {data.following_count === 0
                  ? "Your notes show here, with what the people you follow share. Follow people from their profiles (tap someone in a group)."
                  : "Nothing new yet."}
              </Card>
            ) : (
              <div className="wb-feed">
                {data.feed.map((item) => (
                  <FeedItem key={`${item.kind}-${item.id}`} item={item} showAuthor groups={data.groups} max={data.note_max} imagesMax={data.images_max}
                    onChange={replace} onRemove={remove(item.kind)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
