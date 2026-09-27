import { fbm, value, warp, smoothstep } from "./noise.js";

// Nothing that blocks movement generates within this many tiles of spawn (0, 0)
export const SAFE_RADIUS = 8;

const dist = (x, y) => Math.hypot(x, y);

// How much terrain is allowed at (x, y): 0 inside the safe zone, easing to 1 beyond it
export function wildness(x, y, margin = 10) {
  return smoothstep(SAFE_RADIUS + 1, SAFE_RADIUS + margin, dist(x, y));
}

// Spawn sits on the middle level, so the land can rise above it and fall away below it
export const SPAWN_LEVEL = 1;

// Height level 0 (basin), 1 or 2 (plateau/mountain). Very low-frequency, lightly warped
// noise with only two octaves gives big, smooth-edged landforms: wide plateaus and mountains,
// broad basins, few stray fragments (so few cliffs to climb). Hilly regions exaggerate the
// relief and plains flatten it out. Inside the safe zone everything eases to the spawn level.
export function levelAt(seed, x, y) {
  const w = wildness(x, y, 16);
  if (w === 0) return SPAWN_LEVEL;
  const [wx, wy] = warp(seed, x, y, 11, 1 / 110, 70);
  const h = fbm(seed, wx / 120, wy / 120, 3, 2) - 0.5;
  const hills = smoothstep(0.3, 0.6, fbm(seed, x / 240, y / 240, 5, 1));
  const v = h * (0.5 + 1.8 * hills) * w;
  return v < -0.075 ? 0 : v > 0.075 ? 2 : 1;
}

// Rivers trace the midline contour of warped noise, which gives long bending strands.
// Distance to that contour is measured in tiles (value / gradient), so a second noise can
// set the width directly: 1 to 4 tiles, tapering to nothing where rivers begin and end.
export function waterAt(seed, x, y) {
  if (dist(x, y) < SAFE_RADIUS + 3) return false;
  // only some regions have rivers at all
  const region = smoothstep(0.38, 0.5, fbm(seed, x / 140, y / 140, 31, 2));
  if (region === 0) return false;

  const field = (px, py) => {
    const [wx, wy] = warp(seed, px, py, 21, 1 / 55, 34);
    return fbm(seed, wx / 80, wy / 80, 23, 2) - 0.5;
  };
  const n = field(x, y);
  const gx = field(x + 0.5, y) - field(x - 0.5, y);
  const gy = field(x, y + 0.5) - field(x, y - 0.5);
  const tilesFromCenter = Math.abs(n) / Math.max(Math.hypot(gx, gy), 1e-4);

  const width = (1 + smoothstep(0.25, 0.75, value(seed, x / 40, y / 40, 29)) * 3.2) * region * wildness(x, y, 14);
  return tilesFromCenter < width / 2;
}

// Fog banks: big soft patches, none near spawn. Stops inside stay hidden until reached, so
// the fork can only say "???". Rarer early on the map, so the first steps are always clear.
export const FOG_CLEAR_RADIUS = SAFE_RADIUS + 10;
export function fogAt(seed, x, y) {
  const near = smoothstep(FOG_CLEAR_RADIUS, FOG_CLEAR_RADIUS + 12, dist(x, y));
  if (near === 0) return false;
  const [wx, wy] = warp(seed, x, y, 71, 1 / 40, 18);
  return fbm(seed, wx / 32, wy / 32, 73, 2) * (0.85 + 0.15 * near) > 0.66;
}
