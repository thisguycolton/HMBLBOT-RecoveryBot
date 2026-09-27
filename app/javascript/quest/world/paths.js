import { SAFE_RADIUS } from "./terrain.js";
import { smoothstep } from "./noise.js";

// Movement over the board, kept free of Phaser so it can be tested on its own.
//
// Grid tile types (state.grid, which overrides the generated world):
//   start, path, topic, stump, bridge, stairs, ladder   walkable
//   ford (boat), boulder (pickaxe), log (axe), climb (rope)   walkable once the item is spent
//   stop     visit record for a building stop ({ visited, topic })
//   water    river from older journeys, never walkable

export const DIRS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export const OBSTACLE_ITEM = { ford: "boat", boulder: "pickaxe", log: "axe", climb: "rope" };
export const CLEARED_AS = { ford: "bridge", boulder: "path", log: "stump", climb: "ladder" };
export const ITEMS = ["boat", "pickaxe", "axe", "rope"];

const GRID_WALKABLE = new Set(["start", "path", "topic", "stump", "bridge", "stairs", "ladder", "ford", "boulder", "log", "climb"]);

export const key = (x, y) => `${x},${y}`;
export const parse = (k) => k.split(",").map(Number);

// What stands at (x, y) for movement purposes:
//   { walkable, target, obstacle, crossing, stop, topic }
// target = an unvisited topic or building stop (you can walk to it, not through it)
export function nodeAt(world, grid, x, y) {
  const g = grid[key(x, y)];
  if (g && g.type !== "stop") {
    if (!GRID_WALKABLE.has(g.type)) return { walkable: false };
    return {
      walkable: true,
      target: g.type === "topic" && !g.visited,
      topic: g.type === "topic" ? g : null,
      obstacle: OBSTACLE_ITEM[g.type] ? g.type : null,
      crossing: g.crossing ?? null,
    };
  }
  const c = world.cell(x, y);
  if (c.stop) return { walkable: true, target: !g?.visited, stop: c.stop };
  if (c.part?.part === "path") return { walkable: true };
  return { walkable: false };
}

// Anything already on the board: carved tiles, settlements, river water from older saves
function occupied(world, grid, x, y) {
  return !!grid[key(x, y)] || !!world.cell(x, y).part;
}

// ---------- routes ----------

// Cheapest route from `from` to `to` over walkable tiles. Obstacles cost a lot so routes
// avoid them when there's another way. Returns { route, needs: { boat, pickaxe, axe, rope } }.
export function findRoute(world, grid, from, to) {
  const start = key(from.x, from.y), goal = key(to.x, to.y);
  const cost = new Map([[start, 0]]);
  const prev = new Map([[start, null]]);
  const open = [{ k: start, c: 0 }];

  while (open.length) {
    open.sort((a, b) => a.c - b.c);
    const { k: ck, c } = open.shift();
    if (ck === goal) break;
    if (c > cost.get(ck)) continue;
    const [x, y] = parse(ck);
    for (const d of DIRS) {
      const nx = x + d.x, ny = y + d.y, nk = key(nx, ny);
      const node = nodeAt(world, grid, nx, ny);
      if (!node.walkable) continue;
      if (node.target && nk !== goal) continue;
      const nc = c + 1 + (node.obstacle ? 50 : 0);
      if (nc < (cost.get(nk) ?? Infinity)) {
        cost.set(nk, nc);
        prev.set(nk, ck);
        open.push({ k: nk, c: nc });
      }
    }
  }
  if (!prev.has(goal)) return null;

  const route = [];
  for (let k = goal; k && k !== start; k = prev.get(k)) {
    const [x, y] = parse(k);
    const node = nodeAt(world, grid, x, y);
    route.unshift({ x, y, obstacle: node.obstacle, crossing: node.crossing });
  }
  return { route, needs: needsFor(route) };
}

// Items a route uses up. A river crossing takes one boat however wide it is.
export function needsFor(route) {
  const needs = { boat: 0, pickaxe: 0, axe: 0, rope: 0 };
  const crossings = new Set();
  for (const step of route) {
    if (!step.obstacle) continue;
    if (step.obstacle === "ford") {
      if (crossings.has(step.crossing)) continue;
      crossings.add(step.crossing);
    }
    needs[OBSTACLE_ITEM[step.obstacle]]++;
  }
  return needs;
}

export const canAfford = (needs, inventory) => ITEMS.every((i) => (inventory[i] || 0) >= needs[i]);

// Every unvisited topic or building stop the traveler could walk to, obstacles or not
export function reachableTargets(world, grid, from) {
  const seen = new Set([key(from.x, from.y)]);
  const queue = [from];
  const targets = [];
  while (queue.length) {
    const c = queue.shift();
    for (const d of DIRS) {
      const nx = c.x + d.x, ny = c.y + d.y, nk = key(nx, ny);
      if (seen.has(nk)) continue;
      seen.add(nk);
      const node = nodeAt(world, grid, nx, ny);
      if (!node.walkable) continue;
      if (node.target) {
        targets.push({ x: nx, y: ny, ...node });
        continue;
      }
      queue.push({ x: nx, y: ny });
    }
  }
  return { targets, seen };
}

// ---------- carving new branches ----------

// Carve a branch out from `from` heading `dir`. Returns
//   { cells: [{ x, y, type, axis?, crossing? }], end: { x, y } | null, joined: bool }
// or null when the branch can't be made. `end` is where the new topic goes; a branch that
// runs into a town or castle path joins it instead and has no end.
//
// Branches wander: a random walk with momentum that turns now and then (never back on
// itself, never twice in a row). They also keep `spacing` tiles (default SPACING) clear of
// every other carved path, so the journey spreads out like loose string. Callers loosen
// spacing only when a stop would otherwise sprout nothing (see spacingForAttempt).
export const SPACING = 2;

// Spacing for the nth sprouting attempt: strict first; looser only while nothing has been made
export function spacingForAttempt(attempt, made) {
  if (attempt < 28) return SPACING;
  if (made > 0) return null; // enough; don't crowd the map just to add another branch
  return attempt < 36 ? 1 : 0;
}

// Stops need this much room (in every direction, diagonals included) from any other stop
export const STOP_SPACING = 3;

// How likely obstacles are, 0..1: nothing near spawn or early in the journey, easing in as
// the group travels further out and visits more stops
export function obstacleFactor(x, y, progress = 1) {
  const distance = smoothstep(SAFE_RADIUS + 4, SAFE_RADIUS + 45, Math.hypot(x, y));
  return distance * (0.25 + 0.75 * Math.min(1, Math.max(0, progress)));
}

// progress: 0..1, how far into the journey the group is (stops visited / 10)
export function carveBranch(world, grid, from, dir, rng, { spacing = SPACING, isTarget, progress = 1 } = {}) {
  const length = 8 + Math.floor(rng() * 6);
  // A branch never puts more than one obstacle between the group and its stop
  let obstacles = 0;
  const factor = () => obstacleFactor(cx, cy, progress);

  const cells = [];
  const has = (x, y) => cells.some((c) => c.x === x && c.y === y);
  let d = dir, cx = from.x, cy = from.y;
  let turnedLast = true; // go straight for the first step out of the stop

  // Too close to another path? The first cells leave their origin, so they're exempt.
  const crowded = (nx, ny) => {
    if (cells.length < 2 || spacing === 0) return false;
    for (let dy = -spacing; dy <= spacing; dy++) {
      for (let dx = -spacing; dx <= spacing; dx++) {
        if (grid[key(nx + dx, ny + dy)]) return true;
      }
    }
    // and never run alongside our own earlier cells (no hairpins)
    return DIRS.some((n) => {
      const ax = nx + n.x, ay = ny + n.y;
      if (ax === cx && ay === cy) return false;
      return has(ax, ay);
    });
  };

  for (let i = 1; i <= length; i++) {
    if (!turnedLast && i > 2 && rng() < 0.45) {
      d = d.x === 0 ? { x: rng() < 0.5 ? 1 : -1, y: 0 } : { x: 0, y: rng() < 0.5 ? 1 : -1 };
      turnedLast = true;
    } else {
      turnedLast = false;
    }
    const axis = d.y !== 0 ? "v" : "h";
    const nx = cx + d.x, ny = cy + d.y;
    const here = world.cell(cx, cy);
    const next = world.cell(nx, ny);

    // Ran into a town or castle path: join its network
    if (next.part?.part === "path" && !grid[key(nx, ny)]) {
      if (cells.length < 2) return null;
      return { cells, end: null, joined: true };
    }
    if (occupied(world, grid, nx, ny) || has(nx, ny)) return null;

    if (next.water) {
      // Cross the river in a straight line, if it's narrow enough
      const run = [];
      let wx = nx, wy = ny;
      while (world.cell(wx, wy).water && !occupied(world, grid, wx, wy) && run.length <= 4) {
        run.push({ x: wx, y: wy });
        wx += d.x; wy += d.y;
      }
      const landing = world.cell(wx, wy);
      if (run.length > 4 || landing.water || landing.face || occupied(world, grid, wx, wy)) return null;
      if (landing.level !== here.level) return null;
      if (run.some((c) => crowded(c.x, c.y))) return null;
      // a ford needs a boat; otherwise (early on, or if this branch already has its one
      // obstacle) the river already has a bridge
      const ford = obstacles === 0 && rng() < 0.2 + 0.8 * factor();
      const crossing = key(run[0].x, run[0].y);
      if (ford) obstacles++;
      run.forEach((c) => cells.push(ford ? { ...c, type: "ford", axis, crossing } : { ...c, type: "bridge", axis }));
      cx = run[run.length - 1].x; cy = run[run.length - 1].y;
      i += run.length - 1;
      turnedLast = true; // come straight off the bank
      continue;
    }

    // Cliffs: faces can only be crossed straight up or down; other edges one level at a time
    let crossing = null;
    if (next.face) {
      if (d.y === 0) return null;
      crossing = "cliff";
    } else if (here.face) {
      if (d.y === 0) return null; // continuing through the face we just entered
    } else if (next.level !== here.level) {
      if (Math.abs(next.level - here.level) > 1) return null;
      crossing = "cliff";
    }

    if (crowded(nx, ny)) return null;

    if (crossing) {
      const climb = obstacles === 0 && rng() < 0.45 * factor();
      if (climb) obstacles++;
      cells.push({ x: nx, y: ny, type: climb ? "climb" : "stairs", axis });
      turnedLast = true; // no turning on the stairs
    } else {
      cells.push({ x: nx, y: ny, type: "path", axis });
    }
    cx = nx; cy = ny;
  }

  // The last cell becomes a stop: plain ground, with breathing room from every other stop
  const end = cells[cells.length - 1];
  const endCell = world.cell(end.x, end.y);
  if (end.type !== "path" || endCell.face || endCell.lip) return null;
  if (stopNearby(world, grid, end.x, end.y, isTarget)) return null;

  if (obstacles === 0) sprinkleObstacles(cells, rng, { factor: obstacleFactor(end.x, end.y, progress) });
  return { cells, end, joined: false };
}

// Directions to try first when sprouting: towards the least-trodden ground, with a little
// randomness so equally open directions don't always come out in the same order
export function openDirections(grid, from, rng = Math.random) {
  const density = (d) => {
    let n = 0;
    const cx = from.x + d.x * 5, cy = from.y + d.y * 5;
    for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) if (grid[key(x, y)]) n++;
    return n + rng() * 2;
  };
  return DIRS.map((d) => [density(d), d]).sort((a, b) => a[0] - b[0]).map(([, d]) => d);
}

// Is there a stop (topic, start flag or building) within STOP_SPACING of (x, y)?
export function stopNearby(world, grid, x, y, isTarget) {
  for (let dy = -STOP_SPACING; dy <= STOP_SPACING; dy++) {
    for (let dx = -STOP_SPACING; dx <= STOP_SPACING; dx++) {
      if (!dx && !dy) continue;
      const ax = x + dx, ay = y + dy;
      const g = grid[key(ax, ay)];
      if (g?.type === "topic" || g?.type === "start" || world.cell(ax, ay).stop || isTarget?.(ax, ay)) return true;
    }
  }
  return false;
}

// Maybe put one obstacle - a boulder or a fallen tree - on a plain path cell of the branch.
// factor (0..1) scales the chance; never more than one, never on the first or last cell.
export function sprinkleObstacles(cells, rng, { factor = 1 } = {}) {
  if (rng() >= 0.4 * factor) return;
  const spots = cells.filter((c, i) => c.type === "path" && i >= 1 && i < cells.length - 1 && Math.hypot(c.x, c.y) >= SAFE_RADIUS + 2);
  if (!spots.length) return;
  spots[Math.floor(rng() * spots.length)].type = rng() < 0.6 ? "boulder" : "log";
}

// Short land-only route from `from` to the nearest point of a settlement the traveler
// isn't connected to yet, so towns and castles get woven into the journey.
export function routeToSettlement(world, grid, from, reachable, maxDist = 14, { progress = 1 } = {}) {
  const goals = new Set();
  for (const s of world.settlementsNear(from.x, from.y, maxDist)) {
    const connected = [...s.tiles.keys()].some((k) => reachable.has(k));
    if (connected) continue;
    for (const [k, t] of s.tiles) {
      const [x, y] = parse(k);
      if (t.part === "path" && Math.abs(x - from.x) + Math.abs(y - from.y) <= maxDist) goals.add(k);
    }
  }
  if (!goals.size) return null;

  const start = key(from.x, from.y);
  const prev = new Map([[start, null]]);
  const queue = [from];
  let found = null;
  while (queue.length && !found) {
    const c = queue.shift();
    const here = world.cell(c.x, c.y);
    for (const d of DIRS) {
      const nx = c.x + d.x, ny = c.y + d.y, nk = key(nx, ny);
      if (prev.has(nk) || Math.abs(nx - from.x) + Math.abs(ny - from.y) > maxDist + 4) continue;
      if (goals.has(nk)) { prev.set(nk, key(c.x, c.y)); found = nk; break; }
      const n = world.cell(nx, ny);
      if (occupied(world, grid, nx, ny) || n.water || n.face || n.level !== here.level) continue;
      prev.set(nk, key(c.x, c.y));
      queue.push({ x: nx, y: ny });
    }
  }
  if (!found) return null;

  const cells = [];
  for (let k = prev.get(found); k && k !== start; k = prev.get(k)) {
    const [x, y] = parse(k);
    cells.unshift({ x, y, type: "path" });
  }
  if (!cells.length) return null;
  sprinkleObstacles(cells, rng01(from.x * 31 + from.y), { factor: obstacleFactor(from.x, from.y, progress) });
  return cells;
}

function rng01(seed) {
  let s = seed | 0 || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x6d2b79f5;
    return ((s ^ (s >>> 13)) >>> 0) / 4294967296;
  };
}
