import { hash } from "./noise.js";
import { levelAt, waterAt, SAFE_RADIUS } from "./terrain.js";

// Towns: a communal well, houses around it, fenced gardens, and dirt paths joining every
// door and garden gate back to the well. Castles stand alone, well away from any town.
//
// Each settlement is { id, kind, cx, cy, tiles: Map("x,y" -> part), stops: [...] } where a
// part is { part, ...frame hints } and a stop is { x, y, kind: "house" | "well" | "castle", id }.

export const TOWN_REGION = 40;
export const CASTLE_REGION = 90;
export const CASTLE_TOWN_GAP = 45;
const CASTLE_SPAWN_GAP = 30;

const key = (x, y) => `${x},${y}`;

// Candidate door positions relative to the well (the house sits above its door)
const HOUSE_SLOTS = [
  [-5, -2], [5, -2], [0, -5], [-5, 5], [5, 5], [-9, 1], [9, 1], [0, 7], [-9, -5], [9, -5],
];
// Candidate top-left corners of 5x4 gardens relative to the well
const GARDEN_SLOTS = [[-12, -2], [8, 8], [-12, 6], [8, -9], [-3, 10], [-13, -9]];

function flatAndDry(seed, x0, y0, x1, y1, level) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (levelAt(seed, x, y) !== level || waterAt(seed, x, y)) return false;
    }
  }
  // no cliff face spilling down into the bottom row
  for (let x = x0; x <= x1; x++) if (levelAt(seed, x, y1 + 1) > level) return false;
  return true;
}

// ---------- towns ----------

const townCache = new Map();

export function townInRegion(seed, rx, ry) {
  const k = `${seed}:${rx},${ry}`;
  if (!townCache.has(k)) townCache.set(k, buildTown(seed, rx, ry));
  return townCache.get(k);
}

function buildTown(seed, rx, ry) {
  if (hash(seed, rx, ry, 101) > 0.45) return null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const cx = rx * TOWN_REGION + 12 + Math.floor(hash(seed, rx, ry, 102 + attempt) * 16);
    const cy = ry * TOWN_REGION + 12 + Math.floor(hash(seed, rx, ry, 110 + attempt) * 16);
    // the whole footprint (about 21 tiles from the well at its corners) stays clear of spawn
    if (Math.hypot(cx, cy) < SAFE_RADIUS + 25) continue;
    const level = levelAt(seed, cx, cy);
    if (!flatAndDry(seed, cx - 15, cy - 11, cx + 15, cy + 15, level)) continue;
    return layoutTown(seed, rx, ry, cx, cy);
  }
  return null;
}

function layoutTown(seed, rx, ry, cx, cy) {
  const id = `town:${rx},${ry}`;
  const tiles = new Map();
  const stops = [];
  const rand = (salt) => hash(seed, rx, ry, salt);
  const free = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (tiles.has(key(x, y))) return false;
    return true;
  };

  // The well, with a clear square around it
  tiles.set(key(cx, cy), { part: "well" });
  stops.push({ x: cx, y: cy, kind: "well", id: key(cx, cy) });
  const hubs = [{ x: cx, y: cy + 1 }];

  // Houses: 3 wide, 3 tall, door in the middle of the bottom row
  const houseCount = 3 + Math.floor(rand(120) * 4);
  const slots = shuffle(HOUSE_SLOTS, (i) => rand(130 + i));
  let houses = 0;
  for (const [ox, oy] of slots) {
    if (houses >= houseCount) break;
    const dx = cx + ox, dy = cy + oy;
    if (!free(dx - 2, dy - 3, dx + 2, dy + 1)) continue; // one tile of breathing room
    for (let y = dy - 2; y <= dy; y++) {
      for (let x = dx - 1; x <= dx + 1; x++) {
        const row = y - (dy - 2), col = x - (dx - 1);
        tiles.set(key(x, y), { part: "house", row, col, door: row === 2 && col === 1 });
      }
    }
    stops.push({ x: dx, y: dy, kind: "house", id: key(dx, dy) });
    hubs.push({ x: dx, y: dy + 1 });
    houses++;
  }

  // Gardens: 5x4, fenced, gate in the middle of the bottom fence
  const gardenCount = 1 + Math.floor(rand(140) * 3);
  let gardens = 0;
  for (const [ox, oy] of shuffle(GARDEN_SLOTS, (i) => rand(150 + i))) {
    if (gardens >= gardenCount) break;
    const gx = cx + ox, gy = cy + oy;
    if (!free(gx - 1, gy - 1, gx + 5, gy + 4)) continue;
    for (let y = gy; y < gy + 4; y++) {
      for (let x = gx; x < gx + 5; x++) {
        const row = y - gy, col = x - gx;
        const edge = row === 0 || row === 3 || col === 0 || col === 4;
        if (row === 3 && col === 2) tiles.set(key(x, y), { part: "gate" });
        else if (edge) tiles.set(key(x, y), { part: "fence", row, col });
        else tiles.set(key(x, y), { part: "soil", crop: Math.floor(rand(160 + row * 5 + col) * 4) });
      }
    }
    // a barrel beside the garden
    if (!tiles.has(key(gx + 5, gy + 3))) tiles.set(key(gx + 5, gy + 3), { part: "barrel" });
    hubs.push({ x: gx + 2, y: gy + 4 });
    gardens++;
  }

  // Paths: a minimum spanning tree over the hubs, each edge an L-shaped dirt path
  const blocked = (x, y) => {
    const t = tiles.get(key(x, y));
    return t && t.part !== "path" && t.part !== "gate";
  };
  const inTree = [hubs[0]];
  const rest = hubs.slice(1);
  while (rest.length) {
    let best = null;
    for (const a of inTree) {
      for (const [i, b] of rest.entries()) {
        const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        if (!best || d < best.d) best = { a, b, i, d };
      }
    }
    rest.splice(best.i, 1);
    inTree.push(best.b);
    const cells =
      lPath(best.a, best.b, blocked, rand(170 + inTree.length) < 0.5) ||
      bfsPath(best.a, best.b, blocked, { x0: cx - 15, y0: cy - 11, x1: cx + 15, y1: cy + 15 });
    cells?.forEach((c) => { if (!tiles.has(key(c.x, c.y))) tiles.set(key(c.x, c.y), { part: "path" }); });
  }
  hubs.forEach((h) => { if (!tiles.has(key(h.x, h.y))) tiles.set(key(h.x, h.y), { part: "path" }); });

  return { id, kind: "town", cx, cy, tiles, stops };
}

// Dirt path from a to b that turns once; tries both orders of the turn
function lPath(a, b, blocked, horizontalFirst) {
  for (const hFirst of [horizontalFirst, !horizontalFirst]) {
    const corner = hFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
    const cells = [...line(a, corner), ...line(corner, b)];
    if (!cells.some((c) => blocked(c.x, c.y))) return cells;
  }
  return null;
}

// Fallback when both L shapes are blocked: shortest path around the buildings
function bfsPath(a, b, blocked, box) {
  const prev = new Map([[key(a.x, a.y), null]]);
  const queue = [a];
  while (queue.length) {
    const c = queue.shift();
    if (c.x === b.x && c.y === b.y) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: c.x + dx, y: c.y + dy };
      const k = key(n.x, n.y);
      if (prev.has(k) || n.x < box.x0 || n.x > box.x1 || n.y < box.y0 || n.y > box.y1) continue;
      if (blocked(n.x, n.y) && !(n.x === b.x && n.y === b.y)) continue;
      prev.set(k, c);
      queue.push(n);
    }
  }
  if (!prev.has(key(b.x, b.y))) return null;
  const cells = [];
  for (let c = b; c; c = prev.get(key(c.x, c.y))) cells.unshift(c);
  return cells;
}

function line(a, b) {
  const cells = [];
  const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
  for (let x = a.x, y = a.y; ; x += dx, y += dy) {
    cells.push({ x, y });
    if (x === b.x && y === b.y) break;
  }
  return cells;
}

function shuffle(list, r) {
  return list.map((v, i) => [r(i), v]).sort((p, q) => p[0] - q[0]).map(([, v]) => v);
}

// ---------- castles ----------

const castleCache = new Map();

export function castleInRegion(seed, rx, ry) {
  const k = `${seed}:${rx},${ry}`;
  if (!castleCache.has(k)) castleCache.set(k, buildCastle(seed, rx, ry));
  return castleCache.get(k);
}

function buildCastle(seed, rx, ry) {
  if (hash(seed, rx, ry, 201) > 0.35) return null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const cx = rx * CASTLE_REGION + 15 + Math.floor(hash(seed, rx, ry, 202 + attempt) * 60);
    const cy = ry * CASTLE_REGION + 15 + Math.floor(hash(seed, rx, ry, 210 + attempt) * 60);
    if (Math.hypot(cx, cy) < SAFE_RADIUS + CASTLE_SPAWN_GAP) continue;
    if (nearTown(seed, cx, cy, CASTLE_TOWN_GAP)) continue;
    const level = levelAt(seed, cx, cy);
    if (!flatAndDry(seed, cx - 5, cy - 7, cx + 5, cy + 4, level)) continue;
    return layoutCastle(rx, ry, cx, cy);
  }
  return null;
}

function nearTown(seed, x, y, gap) {
  const r = Math.ceil(gap / TOWN_REGION) + 1;
  const rx0 = Math.floor(x / TOWN_REGION), ry0 = Math.floor(y / TOWN_REGION);
  for (let ry = ry0 - r; ry <= ry0 + r; ry++) {
    for (let rx = rx0 - r; rx <= rx0 + r; rx++) {
      const town = townInRegion(seed, rx, ry);
      if (town && Math.hypot(town.cx - x, town.cy - y) < gap) return true;
    }
  }
  return false;
}

// 7 wide keep with a taller tower at each corner; the gate is the bottom middle tile
function layoutCastle(rx, ry, cx, cy) {
  const tiles = new Map();
  for (let y = cy - 5; y <= cy; y++) {
    for (let x = cx - 3; x <= cx + 3; x++) {
      const col = x - (cx - 3), row = y - (cy - 5);
      const tower = col === 0 || col === 6;
      if (row === 0 && !tower) continue; // towers rise one tile above the walls
      tiles.set(key(x, y), {
        part: "castle",
        tower,
        top: row === 0 || (row === 1 && !tower),
        window: !tower && row === 3 && (col === 1 || col === 5),
        gate: row === 5 && col === 3,
      });
    }
  }
  tiles.set(key(cx, cy + 1), { part: "path" });
  tiles.set(key(cx, cy + 2), { part: "path" });
  return {
    id: `castle:${rx},${ry}`,
    kind: "castle",
    cx,
    cy,
    tiles,
    stops: [{ x: cx, y: cy, kind: "castle", id: key(cx, cy) }],
  };
}
