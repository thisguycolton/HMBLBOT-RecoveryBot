import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { LogIn, Moon, Sun } from "lucide-react";
import { api } from "../lib";
import GroupLogo from "../GroupLogo";
import { Loading, Message, quietButton } from "../ui";
import { ChatPostings, MeetingClock, timeOf, useDarkMode, useMeetingClock } from "./CommandCenter";
import "./hosting.css";

const POLL_MS = 5000;
const iconButton = "inline-grid size-9 shrink-0 place-items-center rounded-xl !bg-transparent text-slate-600 hover:!bg-neutral-100 dark:text-neutral-300 dark:hover:!bg-neutral-800";

// /groups/:slug/chat/:code, where a hosting short link (/h/CODE) sends someone who can't host or
// isn't signed in: that date's chat postings, filled in, to copy into the Zoom chat. It follows
// what the hosts have posted and the meeting's time, but changes nothing.
export default function GuestPostings() {
  const { code } = useParams();
  const [page, setPage] = useState(null);
  const [error, setError] = useState(null);
  const [dark, toggleDark] = useDarkMode();

  const load = useCallback(() => api(`/hosting_links/${encodeURIComponent(code)}`).then((p) => { setPage(p); setError(null); })
    .catch((e) => setError(e)), [code]);
  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => { document.title = page ? `${page.meeting.name} chat postings` : "Chat postings"; }, [page]);
  const { elapsed } = useMeetingClock(page?.starts_at, page?.live?.server_now);

  if (error && !page) return <Message title="That link doesn't work" text={error.message} />;
  if (!page) return <Loading />;

  const live = page.live;
  const signIn = `/h/${page.code}?sign_in=1`;
  return (
    <div className={`hc-root min-h-dvh w-full bg-neutral-50 !font-sans text-slate-900 dark:bg-neutral-950 dark:text-white ${dark ? "doc-dark" : ""}`}>
      <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
        <GroupLogo group={page.group} className="size-9 text-xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{page.meeting.name}</p>
          <p className="truncate text-xs text-slate-500 dark:text-neutral-400">
            {page.group.title} · {new Date(`${page.on}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
            {page.starts_at && ` at ${timeOf(page.starts_at, page.meeting.time_zone)}`}
          </p>
        </div>
        {page.starts_at && <MeetingClock center={page} elapsed={elapsed} compact />}
        <button type="button" className={iconButton} onClick={toggleDark} aria-label={dark ? "Light mode" : "Dark mode"}>{dark ? <Sun className="size-5" /> : <Moon className="size-5" />}</button>
      </header>
      <main className="mx-auto max-w-xl space-y-4 px-4 py-5">
        {page.shown ? (
          <>
            <p className="text-sm text-slate-600 dark:text-neutral-300">
              The chat postings for today's meeting. Tap Copy and paste it into the Zoom chat. The one that's due stands out, and you'll see which the hosts have posted.
            </p>
            <ChatPostings center={page} live={live} elapsed={elapsed} act={null} />
          </>
        ) : (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-600 shadow-panel dark:bg-neutral-900 dark:text-neutral-300">This group keeps its chat postings to hosts. Sign in to open the Hosting Command Center.</p>
        )}
        {!page.can_host && (
          <a href={signIn} className={`${quietButton} w-full justify-center`}><LogIn className="size-4" /> Host with an account? Sign in for the Command Center</a>
        )}
        {page.can_host && <a href={`/h/${page.code}`} className={`${quietButton} w-full justify-center`}>Open the Hosting Command Center</a>}
      </main>
    </div>
  );
}
