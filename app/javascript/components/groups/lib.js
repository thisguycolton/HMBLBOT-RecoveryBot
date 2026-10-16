// Shared helpers for Groups (/groups). Weekly meeting times are minutes after midnight in
// the meeting's own time zone, as the server stores them.

const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

export async function api(path, { method = "GET", body, form } = {}) {
  const headers = { Accept: "application/json", "X-CSRF-Token": csrfToken() };
  if (!form) headers["Content-Type"] = "application/json";
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || (res.status === 401 ? "Please sign in first." : "Something went wrong."));
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const ZONES = [
  ["America/Phoenix", "Arizona"],
  ["America/Los_Angeles", "Pacific"],
  ["America/Denver", "Mountain"],
  ["America/Chicago", "Central"],
  ["America/New_York", "Eastern"],
];

export const zoneLabel = (zone) => ZONES.find(([z]) => z === zone)?.[1] || zone?.split("/").pop().replace(/_/g, " ");

export const clock = (minutes) => {
  if (minutes == null || minutes === "") return "";
  const m = ((Number(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

// <input type="time"> value <-> minutes
export const toTimeValue = (minutes) =>
  minutes == null || minutes === "" ? "" : `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
export const fromTimeValue = (value) => {
  const m = /^(\d{2}):(\d{2})/.exec(value || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// The viewer's own clock time for a meeting's next start, when their zone differs
export const localHint = (meeting) => {
  if (!meeting.next_start) return null;
  const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!viewerZone || viewerZone === meeting.time_zone) return null;
  const at = new Date(meeting.next_start);
  const mine = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const theirs = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: meeting.time_zone });
  return mine === theirs ? null : `${mine} your time`;
};

export const relativeDay = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
};

// Meeting Guide type codes worth naming (https://github.com/code4recovery/spec)
export const TYPE_LABELS = {
  O: "Open", C: "Closed", D: "Discussion", SP: "Speaker", ST: "Step study", TR: "Tradition study", B: "Big Book",
  LIT: "Literature", "12x12": "12 & 12", MED: "Meditation", "11": "11th Step", BE: "Newcomer", W: "Women", M: "Men",
  LGBTQ: "LGBTQ", Y: "Young people", SEN: "Seniors", ASL: "ASL", S: "Spanish", EN: "English", CF: "Child-friendly",
  ABSI: "As Bill Sees It", DR: "Daily Reflections", GR: "Grapevine", H: "Birthday", BI: "Bisexual", A: "Secular",
  X: "Wheelchair access", TC: "Location closed", ONL: "Online", POC: "People of color", T: "Transgender",
  NDG: "Indigenous", "AL-AN": "Al-Anon", P: "Professionals", LS: "Living Sober",
};
export const typeLabel = (code) => TYPE_LABELS[code] || code;

export const ROLE_LABELS = { admin: "Group admin", member: "Member" };

// "3 years, 2 months sober" (or "45 days sober") from a "YYYY-MM-DD" sobriety date
export function soberFor(iso) {
  if (!iso) return "";
  const start = new Date(`${iso}T00:00:00`);
  const now = new Date();
  if (Number.isNaN(start.getTime()) || start > now) return "";
  const days = Math.floor((now - start) / 86400000);
  if (days < 90) return `${days} day${days === 1 ? "" : "s"} sober`;
  let months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${months} months sober`;
  return `${years} year${years === 1 ? "" : "s"}${rest ? `, ${rest} month${rest === 1 ? "" : "s"}` : ""} sober`;
}
