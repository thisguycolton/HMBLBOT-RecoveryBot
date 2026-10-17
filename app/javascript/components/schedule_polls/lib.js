// Shared helpers for schedule polls. Every time is wall-clock time in the poll's
// zone, written "2026-10-16T19:00"; days are ISO dates handled in UTC so the
// browser's own zone never shifts them.

export const DAY_MINUTES = 24 * 60;

const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api/schedule_polls${path}`, {
    method,
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": csrfToken() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || (res.status === 401 ? "Please sign in first." : "Something went wrong."));
    error.status = res.status;
    throw error;
  }
  return data;
}

const utc = (iso) => new Date(`${iso}T12:00:00Z`);
export const addDays = (iso, n) => {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const daysBetween = (from, to) => {
  const out = [];
  for (let d = from; d <= to && out.length < 31; d = addDays(d, 1)) out.push(d);
  return out;
};
export const dayParts = (iso) => {
  const d = utc(iso);
  const f = (opts) => d.toLocaleDateString([], { timeZone: "UTC", ...opts });
  return { weekday: f({ weekday: "short" }), day: d.getUTCDate(), month: f({ month: "short" }), long: f({ weekday: "short", month: "short", day: "numeric" }) };
};

export const clock = (minutes, { compact = false } = {}) => {
  const m = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const hour = Math.floor(m / 60);
  const mins = m % 60;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const period = hour < 12 ? "AM" : "PM";
  if (compact) return `${h12}${mins ? `:${String(mins).padStart(2, "0")}` : ""}${period === "AM" ? "a" : "p"}`;
  if (minutes === DAY_MINUTES) return "Midnight";
  return `${h12}:${String(mins).padStart(2, "0")} ${period}`;
};

export const formatStart = (date, minute) => `${date}T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
export const parseStart = (value) => {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value || "");
  return m ? { date: m[1], minute: Number(m[2]) * 60 + Number(m[3]) } : null;
};

// "Thu Oct 16 · 7:00–8:00 PM"
export const describeStart = (value, duration) => {
  const p = parseStart(value);
  if (!p) return value;
  return `${dayParts(p.date).long} · ${clock(p.minute)} – ${clock(p.minute + duration)}`;
};

export const blocksOn = (poll, date) => (poll.blocks || []).filter((b) => b.kind === "daily" || b.date === date);

// The poll's clock, kept in step with the server's "now" in the poll's zone
export const makeNow = (nowLocal) => {
  const base = parseStart(nowLocal);
  const loadedAt = Date.now();
  return () => {
    if (!base) return { date: "0000-00-00", minute: 0 };
    const minute = base.minute + Math.floor((Date.now() - loadedAt) / 60000);
    return { date: addDays(base.date, Math.floor(minute / DAY_MINUTES)), minute: minute % DAY_MINUTES };
  };
};

// Why a start can't be picked (mirrors SchedulePoll#start_problem), or null
export function startProblem(poll, date, minute, now) {
  const finish = minute + poll.duration_minutes;
  if (date < poll.starts_on || date > poll.ends_on) return "not a poll day";
  if (minute < poll.day_start_minute || finish > Math.min(poll.day_end_minute, DAY_MINUTES)) return "outside the hours";
  if (now && (date < now.date || (date === now.date && minute <= now.minute))) return "already passed";
  if (blocksOn(poll, date).some((b) => minute < b.end && finish > b.start)) return "doesn't work";
  return null;
}

export const VISIBILITY_LABELS = {
  always: "Anyone can see results anytime",
  after_vote: "Voters see results after they vote",
  after_close: "Results show when voting closes",
};
