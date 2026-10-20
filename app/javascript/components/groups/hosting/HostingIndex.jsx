import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, MonitorPlay } from "lucide-react";
import { DAYS, api, clock } from "../lib";
import { Card, ErrorNote, Loading, Pill, Tray } from "../ui";

const short = (days) => (days.length === 7 ? "Every day" : days.map((d) => DAYS[d].slice(0, 3)).join(", "));
const when = (iso) => (iso ? new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null);

// /groups/:slug/host: the group's meetings, to open one's Hosting Command Center. The ones you
// host or co-host come first.
export default function HostingIndex() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api(`/groups/${slug}/hosting`).then(setData).catch((e) => setError(e.message)); }, [slug]);
  if (error) return <div className="mx-auto max-w-3xl space-y-4"><Link to={`/${slug}/hosts`} className="text-sm text-slate-500 hover:text-accent">← Hosts</Link><ErrorNote error={error} /></div>;
  if (!data) return <Loading />;
  const meetings = [...data.meetings].sort((a, b) => Number(b.mine) - Number(a.mine));
  return (
    <div className="mx-auto max-w-3xl space-y-5 !font-sans">
      <Link to={`/${slug}/hosts`} className="text-sm text-slate-500 hover:text-accent dark:text-neutral-400">← Hosts</Link>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white"><MonitorPlay className="size-6 text-accent" /> Hosting Command Center</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-neutral-300">The script, the chat postings and the readings for a meeting, with the other host beside you. Pick the meeting you're hosting.</p>
      </div>
      <Tray label="Meetings">
        {meetings.length === 0 ? <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">The group has no meetings yet.</Card> : (
          <div className="space-y-1.5">
            {meetings.map((m) => (
              <Link key={m.id} to={`/${slug}/host/${m.id}`} className="block">
                <Card className="flex items-center gap-3 p-3 hover:ring-2 hover:ring-accent/30">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900 dark:text-white">{m.name} {m.mine && <Pill tone="green">You're hosting</Pill>}</p>
                    <p className="text-xs text-slate-500 dark:text-neutral-400">
                      {m.days.length ? `${short(m.days)} at ${clock(m.start_minute)}` : m.schedule_label}
                      {m.next_start && ` · next ${when(m.next_start)}`}
                      {(m.host || m.co_host) && ` · ${[m.host, m.co_host].filter(Boolean).join(" and ")}`}
                    </p>
                  </div>
                  <ChevronRight className="size-5 text-slate-400" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </Tray>
    </div>
  );
}
