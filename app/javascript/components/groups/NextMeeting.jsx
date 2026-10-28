import React, { useEffect, useState } from "react";
import { MapPin, Video } from "lucide-react";
import MeetingPasscode from "./MeetingPasscode";

// "Next meeting in 2h 14m" or "Live now", with a Join button, from meetings that carry
// upcoming_start/upcoming_end (Meeting#upcoming and OiaaMeeting#upcoming on the server: the
// one going on now, else the next). Times show in the viewer's own zone.

const WEEK = 7 * 24 * 3600 * 1000;

// The time now, ticking every `ms`
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

// The meeting on now, else the soonest, as { meeting, start, end, live }. A weekly meeting
// that ended since the page loaded moves on a week.
export function nextOccurrence(meetings, now = Date.now()) {
  let best = null;
  for (const meeting of meetings || []) {
    if (!meeting.upcoming_start) continue;
    let start = new Date(meeting.upcoming_start).getTime();
    let end = new Date(meeting.upcoming_end || meeting.upcoming_start).getTime();
    if (end <= now) {
      if (meeting.recurrence === "once") continue;
      const weeks = Math.ceil((now - end) / WEEK) || 1;
      start += weeks * WEEK;
      end += weeks * WEEK;
    }
    const live = start <= now && now < end;
    if (!best || (live && !best.live) || (live === best.live && start < best.start)) best = { meeting, start, end, live };
  }
  return best;
}

// "45s", "14 min", "2h 14m", "3 days"
export function countdown(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${String(m % 60).padStart(2, "0")}m`;
  const d = Math.floor(h / 24);
  return d === 1 ? `1 day ${h % 24}h` : `${d} days`;
}

// "Today, 7:00 PM", "Tomorrow, 7:00 AM" or "Sat, Oct 18, 7:00 PM", in the viewer's zone
export function whenLabel(time, now = Date.now()) {
  const at = new Date(time);
  const clock = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const day = (d) => new Date(d).toDateString();
  if (day(at) === day(now)) return `Today, ${clock}`;
  if (day(at) === day(now + 86400000)) return `Tomorrow, ${clock}`;
  return `${at.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}, ${clock}`;
}

export const viewerZoneName = () =>
  new Date().toLocaleTimeString([], { timeZoneName: "short" }).split(" ").pop();

// The pill: a pulsing "Live now", or "in 2h 14m"
export function LiveBadge({ start, end, now, className = "" }) {
  const live = start <= now && now < end;
  if (live) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm ${className}`}>
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/80" />
          <span className="relative inline-flex size-2 rounded-full bg-white" />
        </span>
        Live now
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center rounded-full bg-black/55 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur ${className}`}>
      in {countdown(start - now)}
    </span>
  );
}

// On a group's page, under its name: when the next meeting is and a way in
export default function NextMeeting({ meetings, buttonClass, quietClass }) {
  const now = useNow(1000);
  const next = nextOccurrence(meetings, now);
  if (!next) return null;
  const { meeting, start, live } = next;
  const title = meeting.name;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="next-meeting">
      <span className="inline-flex max-w-full items-center gap-2 rounded-xl bg-black/35 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur">
        {live ? (
          <>
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
            </span>
            Live now
          </>
        ) : (
          <>Next meeting in <span className="tabular-nums">{countdown(start - now)}</span></>
        )}
        <span className="hidden truncate font-normal text-white/80 sm:inline">· {live ? title : `${whenLabel(start, now)} ${viewerZoneName()}`}</span>
      </span>
      {meeting.conference_url ? (
        <a href={meeting.conference_url} data-meeting-join={meeting.id} target="_blank" rel="noreferrer" className={live ? buttonClass : quietClass}>
          <Video className="h-4 w-4" /> Join{live ? " now" : ""}
        </a>
      ) : meeting.place || meeting.location ? (
        <span className={quietClass}><MapPin className="h-4 w-4" /> {meeting.place || meeting.location}</span>
      ) : null}
      {meeting.conference_url && <MeetingPasscode notes={meeting.conference_url_notes} copy className={quietClass} />}
    </div>
  );
}
