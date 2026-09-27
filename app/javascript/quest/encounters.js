// What the group can meet on the road. Each encounter frames a Topicificator topic
// differently; none of them change what the group is actually there to do: share.
//
//   approach   how much say the group has over the topic
//              curious - a random topic from the stop's category
//              safe    - choose from several topics (the merchant)
//              chaos   - random topic and random way of sharing (mystery)
//              gentle  - low-pressure ways of sharing only (campfire)
//   favor      sharing modes this place leans toward (offered first when available)
export const ENCOUNTERS = {
  topic: { label: null, approach: "curious", hint: (cat) => cat?.title ?? "Open Road" },
  mystery: {
    label: "Mystery",
    approach: "chaos",
    hint: () => "? Something unknown",
    lines: ["Something unexpected waits here.", "The path shimmers. Who knows what's next?"],
  },
  merchant: {
    label: "Wandering merchant",
    approach: "safe",
    hint: () => "Merchant's cart",
    lines: ["“Fine topics, freshly gathered! One trail coin, take your pick.”"],
  },
  campfire: {
    label: "Campfire",
    approach: "gentle",
    gentleOnly: true,
    hint: () => "Campfire",
    lines: ["A warm fire. Pull up a log. No pressure here."],
  },
  ghost: {
    label: "A ghost",
    approach: "risky",
    hint: () => "A ghost waits",
    lines: [
      "A ghost drifts out of the mist. \u201cWill you take my question?\u201d",
      "A pale figure waits by the road, holding something out to you.",
    ],
  },
  cannon: { label: "Cannon", approach: null, hint: () => "Cannon · fly anywhere you can see" },
  house: { label: "Village house", approach: "curious", favor: ["connection", "story"], hint: () => "Village house" },
  well: { label: "Village well", approach: "curious", favor: ["reflection", "gratitude"], hint: () => "Village well" },
  castle: { label: "Castle", approach: "curious", favor: ["experience", "lesson"], hint: () => "Castle" },
  help: { label: null, approach: "curious", hint: () => "" },
};

// Topics without a category belong to the Open Road. It behaves like any other category:
// its own icon on the map and the card, and "Different topic" stays within it.
export const OPEN_ROAD = { id: "none", title: "Open Road", short: "Open Road", icon: "icon_open_road", color: 0x597dce };

// Weighted pick for the stop at the end of a new branch
export function rollEncounterKind(r) {
  if (r < 0.12) return "mystery";
  if (r < 0.21) return "merchant";
  if (r < 0.31) return "campfire";
  if (r < 0.36) return "ghost";
  if (r < 0.39) return "cannon";
  return "topic";
}

// Rare encounters keep at least this far (in tiles) from another of their kind
export const SPACING_BY_KIND = { merchant: 12, ghost: 16, cannon: 22 };
export const MERCHANT_PRICE = 1;
// Chance the merchant's mystery topic turns out to hold a legendary tool
export const LEGENDARY_CHANCE = 0.4;
