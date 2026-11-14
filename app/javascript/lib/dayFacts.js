// Fun comparisons for a day count: "A whole year on Mars" on day 687, "As long as an emperor
// penguin dad keeps watch" on day 65. The list (dayFacts.json) is curated by hand from
// well-established figures (planet years and days, famous journeys, animal facts, round
// numbers); each fact shows on the day the count first reaches it. Site Admin > Members reads
// the same file (MemberStats) to count, without names, who passes one this week.
import FACTS from "./dayFacts.json";

export const TOPIC_ICONS = { space: "🪐", nature: "🐾", history: "🏛️", numbers: "✨" };

// { today: [facts reached today], last: the latest fact already passed, next: { ...fact, inDays } }
export function dayFacts(days) {
  if (days === null || days === undefined || days < 0) return null;
  const today = FACTS.filter((f) => f.days === days);
  const past = FACTS.filter((f) => f.days < days);
  const next = FACTS.find((f) => f.days > days);
  return { today, last: past[past.length - 1] || null, next: next ? { ...next, inDays: next.days - days } : null };
}

export default FACTS;
