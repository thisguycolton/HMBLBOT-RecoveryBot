import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BellRing, MapPin, MonitorPlay, Settings, Video } from "lucide-react";
import { api } from "./lib";
import { Card, Pill, Tray, quietButton } from "./ui";
import { LiveBadge, useNow, whenLabel, viewerZoneName } from "./NextMeeting";
import MeetingPasscode from "./MeetingPasscode";
import HostsTab from "./HostsTab";
import WeekView from "./WeekView";
import MeetingsTab from "./MeetingsTab";

const WEEK = 7 * 24 * 3600 * 1000;
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
// "2026-10-28" for a time, on the meeting's own calendar (the server's dates are)
const isoIn = (time, zone) => {
  try { return new Date(time).toLocaleDateString("en-CA", { timeZone: zone }); } catch { return new Date(time).toISOString().slice(0, 10); }
};

// Each meeting's next time (or the one on now), a weekly one that ended since the page loaded
// moved on a week
function occurrences(meetings, now) {
  return (meetings || []).filter((m) => m.upcoming_start).map((meeting) => {
    let start = new Date(meeting.upcoming_start).getTime();
    let end = new Date(meeting.upcoming_end || meeting.upcoming_start).getTime();
    if (end <= now && meeting.recurrence !== "once") {
      const weeks = Math.ceil((now - end) / WEEK) || 1;
      start += weeks * WEEK;
      end += weeks * WEEK;
    }
    return { meeting, start, end };
  }).filter((o) => o.end > now).sort((a, b) => a.start - b.start);
}

// Who hosts and co-hosts that time: the public names when the group shows them, else (for
// members) the host schedule's, its next date's covers included
function hostsFor({ meeting, start }, slots) {
  if (meeting.hosts) {
    const by = Object.fromEntries(meeting.hosts.map((h) => [h.role, h.name]));
    return { host: by.host, co_host: by.co_host, known: true };
  }
  const slot = slots?.find((s) => s.id === meeting.id);
  if (!slot) return { known: false };
  const next = slot.next_on === isoIn(start, meeting.time_zone);
  return {
    host: (next ? slot.next_host : slot.host)?.name,
    co_host: (next ? slot.next_co_host : slot.co_host)?.name,
    known: true,
  };
}

const Heading = ({ children }) => (
  <h2 className="group-chrome border-t border-neutral-200 pt-5 !text-xl font-semibold tracking-tight text-slate-900 dark:border-neutral-800 dark:text-white">{children}</h2>
);

function TodayCard({ occurrence, hosts, needsSub, now, canHost, slug }) {
  const { meeting, start, end } = occurrence;
  return (
    <Card className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
      <div className="min-w-[min(100%,14rem)] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">{whenLabel(start, now).replace(/^Today, /, "")}</p>
          <LiveBadge start={start} end={end} now={now}/>
          {needsSub && <Pill tone="amber"><BellRing className="size-3" /> Needs a sub</Pill>}
        </div>
        <p className="text-sm text-slate-600 dark:text-neutral-300">{meeting.name} · {viewerZoneName()}</p>
        {hosts.known && (
          <p className="mt-1.5 text-sm text-slate-700 dark:text-neutral-200">
            <span className="text-slate-500 dark:text-neutral-400">Host</span> {hosts.host || <Pill tone="amber">Open</Pill>}
            <span className="ml-3 text-slate-500 dark:text-neutral-400">Co-host</span> {hosts.co_host || <Pill tone="amber">Open</Pill>}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canHost && <Link to={`/${slug}/host/${meeting.id}`} className={quietButton}><MonitorPlay className="size-4" /> HostDeck</Link>}
        {meeting.conference_url ? (
          <>
            <MeetingPasscode notes={meeting.conference_url_notes} copy className="text-sm text-slate-500 dark:text-neutral-400" />
            <a href={meeting.conference_url} data-meeting-join={meeting.id} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl !bg-accent px-3.5 py-2 text-sm font-semibold !text-white hover:opacity-90">
              <Video className="size-4" /> Join
            </a>
          </>
        ) : (meeting.location || meeting.formatted_address) ? (
          <span className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-neutral-300"><MapPin className="size-4" /> {meeting.location || meeting.formatted_address}</span>
        ) : null}
      </div>
    </Card>
  );
}

// A group's Meetings page (/groups/:slug/meetings), for everyone: today's meetings first with who
// hosts them and a way in, then (for members) the schedule week by week, by date (WeekView: your
// dates, "I can't make it", coordinators filling gaps), the regular hosts of each weekly meeting
// (HostsTab), then every meeting's details. Adding and changing the meetings themselves
// is Meeting settings (/groups/:slug/settings/meetings), for group admins.
export default function MeetingsPage({ group, setGroup, reload, focusId }) {
  const slug = group.slug;
  const isMember = group.is_member || group.is_site_admin;
  const now = useNow(30000);
  const [schedule, setSchedule] = useState(null);
  const [version, setVersion] = useState(0); // the week view changed someone's place: show it everywhere
  useEffect(() => {
    if (isMember) api(`/groups/${slug}/meeting_hosts`).then(setSchedule).catch(() => {});
  }, [slug, isMember, version]);

  const all = occurrences(group.meetings, now);
  const today = all.filter((o) => sameDay(o.start, now) || o.start <= now);
  const shown = today.length ? today : all.filter((o) => all[0] && sameDay(o.start, all[0].start));
  const label = today.length ? "Today" : shown.length ? `Next up · ${new Date(shown[0].start).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}` : "Today";
  const subs = schedule?.sub_requests || [];

  return (
    <div className="space-y-6">
      {group.can_manage && (
        <div className="flex flex-wrap justify-end gap-2">
          <Link to={`/${slug}/settings/meetings`} className={quietButton}><Settings className="size-4" /> Meeting settings</Link>
        </div>
      )}
      <Tray label={label}>
        <div className="space-y-1.5">
          {shown.length === 0 && <Card className="p-5 text-sm text-slate-600 dark:text-neutral-300">No meetings coming up.</Card>}
          {shown.map((o) => (
            <TodayCard key={o.meeting.id} occurrence={o} now={now} slug={slug} canHost={schedule?.can_host}
              hosts={hostsFor(o, schedule?.slots)}
              needsSub={subs.some((r) => r.meeting_id === o.meeting.id && r.on === isoIn(o.start, o.meeting.time_zone))} />
          ))}
        </div>
      </Tray>

      {isMember && (
        <>
          <section className="space-y-3">
            <Heading>Week by week</Heading>
            <WeekView group={group} onChanged={() => setVersion((v) => v + 1)} />
          </section>
          <section className="space-y-3">
            <Heading>Regular hosts</Heading>
            <HostsTab key={version} group={group} />
          </section>
        </>
      )}

      <section className="space-y-3">
        <Heading>Every meeting</Heading>
        <MeetingsTab group={group} setGroup={setGroup} reload={reload} focusId={focusId} readOnly />
      </section>
    </div>
  );
}
