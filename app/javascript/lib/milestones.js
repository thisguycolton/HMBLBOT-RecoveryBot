// Day counts and AA milestones from a "YYYY-MM-DD" sobriety date, counted on the member's own
// calendar (their time zone), so a milestone turns over at their midnight. The chips most groups
// give: 24 hours, 30, 60 and 90 days, 6 and 9 months, a year, 18 months, then every year.
const DAY = 86400000;

function parse(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? [Number(m[1]), Number(m[2]) - 1, Number(m[3])] : null;
}

const stamp = ([y, m, d]) => Date.UTC(y, m, d);
const today = (now = new Date()) => [now.getFullYear(), now.getMonth(), now.getDate()];

// The date `months` calendar months on; a 31st lands on a shorter month's last day
function addMonths([y, m, d], months) {
  const total = m + months;
  const year = y + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [year, month, Math.min(d, last)];
}

// Days since the sobriety date (0 on the day itself), or null without one or for a future date
export function dayCount(iso, now) {
  const start = parse(iso);
  if (!start) return null;
  const days = Math.round((stamp(today(now)) - stamp(start)) / DAY);
  return days < 0 ? null : days;
}

// Every milestone through `years` years, in order: { label, at (ms, UTC midnight) }
function milestoneList(start, years) {
  const list = [
    { label: "24 hours", at: stamp(start) + DAY },
    ...[30, 60, 90].map((n) => ({ label: `${n} days`, at: stamp(start) + n * DAY })),
    ...[6, 9, 18].map((n) => ({ label: `${n} months`, at: stamp(addMonths(start, n)) })),
  ];
  for (let y = 1; y <= years; y += 1) list.push({ label: `${y} year${y === 1 ? "" : "s"}`, at: stamp(addMonths(start, y * 12)) });
  return list.sort((a, b) => a.at - b.at);
}

// Where they are: { days, today: milestone reached today or null, next: { ...milestone, inDays } }
export function milestoneStatus(iso, now) {
  const start = parse(iso);
  const days = dayCount(iso, now);
  if (days === null) return null;
  const t = stamp(today(now));
  const list = milestoneList(start, Math.floor(days / 365) + 2);
  const reached = list.find((m) => m.at === t) || null;
  const next = list.find((m) => m.at > t);
  return { days, today: reached, next: next && { ...next, inDays: Math.round((next.at - t) / DAY) } };
}
