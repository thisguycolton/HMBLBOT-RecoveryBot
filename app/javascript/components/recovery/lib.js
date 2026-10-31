// Shared by the recovery tools (/recovery): the member's own calendar day, since a 10th step
// or a gratitude list belongs to the day it was for wherever they are.
export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function shiftDay(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}

export const dayLabel = (iso, opts = { weekday: "long", month: "long", day: "numeric", year: "numeric" }) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString([], opts);

// "Tonight", "Last night" or the date
export function nightLabel(iso) {
  const today = localDate();
  if (iso === today) return "Today";
  if (iso === shiftDay(today, -1)) return "Yesterday";
  return dayLabel(iso, { weekday: "short", month: "short", day: "numeric", year: iso.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric" });
}

// Where a Meeting Maker series counts: every meeting, a group's meetings, or one meeting
export function meetingPlace(m, at = "") {
  if (m.scope === "all") return "";
  if (m.scope === "group" || m.name === m.group_title) return `${at}${m.group_title}`;
  return `${at}${m.name} (${m.group_title})`;
}
