import { hash } from "./noise.js";

// Deterministic place names, so the controller can read the fork aloud ("Whispering Pines
// or Riverbend?"). The same spot on the same world always has the same name.

const ADJECTIVES = [
  "Whispering", "Quiet", "Sunlit", "Mossy", "Windy", "Willow", "Hidden", "Golden", "Lantern",
  "Morning", "Bramble", "Juniper", "Harvest", "Cedar", "Foxglove", "Evening", "Kindle",
  "Meadowlark", "Thistle", "Silver", "Honey", "Starling", "Heron", "Clover",
];
const PLACES = {
  water: ["Brook", "Riverbend", "Ford", "Shallows", "Crossing", "Falls"],
  high: ["Heights", "Ridge", "Bluff", "Overlook", "Crest", "Rise"],
  low: ["Hollow", "Dell", "Vale", "Glen", "Basin", "Bottoms"],
  plain: ["Meadow", "Fields", "Grove", "Commons", "Pasture", "Clearing", "Pines", "Orchard"],
};
const TOWN_START = ["Mill", "Ash", "Elder", "Bright", "Stone", "Oak", "Wren", "Fair", "Hazel", "Moss", "Rose", "Birch"];
const TOWN_END = ["brook", "ford", "field", "haven", "stead", "wick", "dale", "mere", "well", "bury"];

export function settlementName(seed, s) {
  const pick = (list, salt) => list[Math.floor(hash(seed, s.cx, s.cy, salt) * list.length)];
  const name = pick(TOWN_START, 41) + pick(TOWN_END, 42);
  return s.kind === "castle" ? `${name} Keep` : name;
}

export function placeName(world, x, y) {
  const seed = world.seed ?? 0;
  const c = world.cell(x, y);
  if (c.settlement) return settlementName(seed, c.settlement);

  let kind = "plain";
  if (!world.flat) {
    const nearWater = [-3, 0, 3].some((dx) => [-3, 0, 3].some((dy) => world.cell(x + dx, y + dy).water));
    kind = nearWater ? "water" : c.level === 2 ? "high" : c.level === 0 ? "low" : "plain";
  }
  const pick = (list, salt) => list[Math.floor(hash(seed, x, y, salt) * list.length)];
  return `${pick(ADJECTIVES, 51)} ${pick(PLACES[kind], 52)}`;
}
