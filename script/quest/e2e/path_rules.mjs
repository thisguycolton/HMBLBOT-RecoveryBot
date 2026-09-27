// Part of the ACID QUEST test scripts - see docs/acid_quest.md. Screenshots and generated
// files go to tmp/quest-e2e/.
import { mkdirSync as __mkdir } from "node:fs";
const __out = new URL("../../../tmp/quest-e2e/", import.meta.url).pathname;
__mkdir(__out, { recursive: true });
process.chdir(__out);
const W = new URL("../../../app/javascript/quest/world", import.meta.url).pathname;
const { default: World } = await import(`${W}/world.js`);
const { carveBranch, openDirections, spacingForAttempt, key, parse } = await import(`${W}/paths.js`);
import { writePng } from "./png.mjs";

const OBST = new Set(["ford", "boulder", "log", "climb"]);
let branches = 0, maxObst = 0, len = 0, sprouts = 0, failed = 0, minStopGap = Infinity, crowded = 0, checked = 0;
const bands = { near: [0, 0], mid: [0, 0], far: [0, 0] }, phase = { early: [0, 0], late: [0, 0] };
let sample;
for (let seed = 1; seed <= 100; seed++) {
  const world = new World(seed);
  let s = seed * 7919; const rng = () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x6d2b79f5), ((s ^ (s >>> 13)) >>> 0) / 4294967296);
  const grid = { "0,0": { type: "start" } }, owner = new Map(), frontier = [], stops = [{ x: 0, y: 0 }];
  let id = 0, visited = 0;
  const sprout = (o) => {
    sprouts++; let made = 0; const want = 2 + Math.floor(rng() * 2);
    for (let a = 0; a < 40 && made < want; a++) {
      const sp = spacingForAttempt(a, made); if (sp === null) break;
      const b = carveBranch(world, grid, o, openDirections(grid, o, rng)[a % 4], rng, { spacing: sp, progress: visited / 10 });
      if (!b || !b.end) continue;
      const bid = ++id;
      b.cells.slice(0, -1).forEach((c, i) => { grid[key(c.x, c.y)] = { type: c.type }; owner.set(key(c.x, c.y), { bid, i }); });
      grid[key(b.end.x, b.end.y)] = { type: "topic" }; frontier.push(b.end); stops.push(b.end);
      const n = b.cells.filter((c) => OBST.has(c.type)).length;
      const nCross = new Set(b.cells.filter((c) => OBST.has(c.type)).map((c) => c.type === "ford" ? "ford" : key(c.x, c.y))).size;
      maxObst = Math.max(maxObst, nCross); branches++; len += b.cells.length; made++;
      const d = Math.hypot(b.end.x, b.end.y), band = d < 20 ? "near" : d < 45 ? "mid" : "far";
      bands[band][0] += nCross > 0; bands[band][1]++;
      const ph = visited < 4 ? "early" : "late"; phase[ph][0] += nCross > 0; phase[ph][1]++;
    }
    if (!made) failed++;
  };
  sprout({ x: 0, y: 0 });
  for (let step = 0; step < 20 && frontier.length; step++) { visited++; sprout(frontier.splice(Math.floor(rng() * frontier.length), 1)[0]); }
  for (let i = 0; i < stops.length; i++) for (let j = i + 1; j < stops.length; j++) minStopGap = Math.min(minStopGap, Math.max(Math.abs(stops[i].x - stops[j].x), Math.abs(stops[i].y - stops[j].y)));
  for (const [k, o] of owner) { if (o.i < 2) continue; checked++; const [x, y] = parse(k); let bad = false;
    for (let dy = -2; dy <= 2 && !bad; dy++) for (let dx = -2; dx <= 2 && !bad; dx++) { const other = owner.get(key(x + dx, y + dy)); if (other && other.bid !== o.bid && other.i >= 2) bad = true; }
    if (bad) crowded++; }
  if (seed === 42) sample = { world, grid };
}
const pct = ([a, b]) => `${(100 * a / Math.max(1, b)).toFixed(0)}% of ${b}`;
console.log(`branches ${branches}, avg length ${(len / branches).toFixed(1)}, sprouts that made nothing ${failed}/${sprouts}`);
console.log(`max obstacles on one branch: ${maxObst}`);
console.log(`branches with an obstacle by distance: near ${pct(bands.near)}, mid ${pct(bands.mid)}, far ${pct(bands.far)}`);
console.log(`by journey phase: first 4 stops ${pct(phase.early)}, later ${pct(phase.late)}`);
console.log(`closest two stops (Chebyshev): ${minStopGap}, crowded path cells ${(100 * crowded / checked).toFixed(1)}%`);
const N = 140, S = 4;
writePng("paths2_42.png", N * S, N * S, (px, py) => {
  const x = Math.floor(px / S) - N / 2, y = Math.floor(py / S) - N / 2;
  const g = sample.grid[key(x, y)], c = sample.world.cell(x, y);
  if (g) return g.type === "topic" ? [220, 60, 60] : g.type === "start" ? [255, 255, 255] : OBST.has(g.type) ? [0, 0, 0] : g.type === "bridge" ? [120, 70, 30] : g.type === "stairs" ? [150, 150, 160] : [214, 154, 78];
  if (c.part) return [60, 90, 200];
  if (c.water) return [34, 99, 107];
  return [[95, 135, 35], [130, 170, 40], [200, 215, 100]][c.level];
});
