// Courage, Connection and Hope: what the group has gathered on the road, derived from the
// journey log. Group totals only, never per person, and they only ever flavour the journey
// (the HUD, Quest Complete). Keep these rules in step with JourneyStats on the server.
//
//   courage     sharing after choosing risk: the RISKY or CHAOS approach, a ghost, a mystery
//   connection  the Connection lens, or sharing at a campfire or village house
//   hope        looking forward, gratitude, change, or returning to a topic (revisit)
export const RESOURCES = [
  { key: "courage", name: "Courage", icon: "icon_shield" },
  { key: "connection", name: "Connection", icon: "icon_follow" },
  { key: "hope", name: "Hope", icon: "icon_star" },
];

const RISK_APPROACHES = ["risky", "chaos"];
const RISK_ENCOUNTERS = ["ghost", "mystery"];
const CONNECTION_MODES = ["connection"];
const CONNECTION_ENCOUNTERS = ["campfire", "house"];
const HOPE_MODES = ["looking_forward", "gratitude", "change"];

// What one share entry adds, e.g. { courage: 1, hope: 1 }. Other entry kinds add nothing:
// passing is always fine and never costs (or counts) anything.
export function resourcesFor(entry) {
  const gained = {};
  if (entry.kind !== "share") return gained;
  if (RISK_APPROACHES.includes(entry.approach) || RISK_ENCOUNTERS.includes(entry.encounter)) gained.courage = 1;
  if (CONNECTION_MODES.includes(entry.sharing_mode_key) || CONNECTION_ENCOUNTERS.includes(entry.encounter)) gained.connection = 1;
  if (HOPE_MODES.includes(entry.sharing_mode_key) || entry.approach === "revisit") gained.hope = 1;
  return gained;
}

export function addResources(totals, entry) {
  for (const [k, n] of Object.entries(resourcesFor(entry))) totals[k] = (totals[k] || 0) + n;
  return totals;
}
