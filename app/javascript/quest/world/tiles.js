import extra from "../assets/classic_rpg_extra.json";

// Frame numbers in the ClassicRPG sheet (16x16, one row) and the generated supplement sheet.
// Both sheets share one tilemap: ClassicRPG frames keep their own numbers and supplement
// frames start at EXTRA_GID.

export const EXTRA_GID = 200;
export const X = (name) => {
  if (!(name in extra)) throw new Error(`missing supplement tile ${name}`);
  return EXTRA_GID + extra[name];
};

export const F = {
  grass: [6, 40, 6, 40, 6, 40, 7, 8, 26, 27],
  bigTree: [[89, 90], [104, 105]], // 2x2
  pine: [91, 106], // 1 wide, 2 tall
  bush: 112,
  rocks: [92, 93],
  flowers: [107, 108],
  plants: [113, 114],
  waterA: 13,
  waterB: 14,
  // dirt tile keyed by which sides show a grass edge (T, R, B, L)
  dirt: {
    "": 84, T: 69, R: 85, B: 99, L: 83, TL: 68, TR: 70, RB: 100, BL: 98,
    TB: 71, RL: 72, TRB: 74, TBL: 75, TRBL: 73, TRL: 72, RBL: 72,
  },
  walk: { down: [1, 2, 3, 2], side: [20, 21, 22, 21], up: [52, 53, 54, 53] },

  // cliffs: the lip is the top edge of higher ground, the face is the rock below it
  lip: { L: 55, M: 56, R: 57 },
  face: 61,

  // buildings
  house: [
    [32, 33, 34], // gable
    [80, 81, 82], // eaves
    [17, 51, 15], // brick wall, door, window
  ],
  well: 95,
  fenceH: 87,
  fenceV: 86,
  barrel: 109,
  crops: [111, 115, 116, 113],
  castleWall: [16, 17],
  castleTower: 18,
  castleWindow: 15,
  castleGate: 35,
};

// Water frames as [frame A, frame B] pairs, so the shimmer can swap every variant at once
export const WATER_PAIRS = [[F.waterA, F.waterB]];
for (let mask = 1; mask < 16; mask++) WATER_PAIRS.push([X(`shore_${mask}_a`), X(`shore_${mask}_b`)]);

// Water tile for a shoreline mask (land on sides N=1 E=2 S=4 W=8)
export const waterFrame = (mask) => (mask === 0 ? F.waterA : X(`shore_${mask}_a`));

// Frame index inside the supplement spritesheet (for sprites, which don't use tile gids)
export const XF = (name) => {
  if (!(name in extra)) throw new Error(`missing supplement tile ${name}`);
  return extra[name];
};

// Foliage frames with a swayed twin, as [still, swayed] tile pairs
// Drifting fog, as [frame A, frame B] pairs (a full bank and its thinner edge)
export const FOG_PAIRS = [[X("fog_a"), X("fog_b")], [X("fog_edge_a"), X("fog_edge_b")]];

export const SWAY_PAIRS = [89, 90, 104, 105, 91, 106, 107, 108, 112, 113, 114].map((n) => [n, X(`sway_${n}`)]);

export const VILLAGER_WALK = { down: [1, 2, 3, 2], side: [20, 21, 22, 21], up: [52, 53, 54, 53] };
export const VILLAGER_VARIANTS = 3;
export const STALL = 79;
