// Part of the ACID QUEST test scripts - see docs/acid_quest.md. Screenshots and generated
// files go to tmp/quest-e2e/.
import { mkdirSync as __mkdir } from "node:fs";
const __out = new URL("../../../tmp/quest-e2e/", import.meta.url).pathname;
__mkdir(__out, { recursive: true });
process.chdir(__out);
const W = new URL("../../../app/javascript/quest/world", import.meta.url).pathname;
const { default: World, SAFE_RADIUS } = await import(`${W}/world.js`);
const { CASTLE_TOWN_GAP } = await import(`${W}/settlements.js`);
const { carveBranch, DIRS, key, parse } = await import(`${W}/paths.js`);
import { writePng } from "./png.mjs";

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const R = 120;
let towns = 0, castles = 0, widths = new Map(), carveOk = 0, carveTry = 0;

for (let seed = 1; seed <= 100; seed++) {
  const world = new World(seed);
  // safe zone: nothing blocking
  for (let y = -SAFE_RADIUS; y <= SAFE_RADIUS; y++) for (let x = -SAFE_RADIUS; x <= SAFE_RADIUS; x++) {
    if (Math.hypot(x, y) > SAFE_RADIUS) continue;
    const c = world.cell(x, y);
    check(!c.water && !c.face && !c.part && c.level === 1, `seed ${seed}: blocking feature in safe zone at ${x},${y}`);
  }
  // settlements in range
  const seen = new Map();
  for (const s of world.settlementsNear(0, 0, R)) seen.set(s.id, s);
  const all = [...seen.values()];
  const ts = all.filter((s) => s.kind === "town"), cs = all.filter((s) => s.kind === "castle");
  towns += ts.length; castles += cs.length;
  for (const c of cs) for (const t of ts) check(Math.hypot(c.cx - t.cx, c.cy - t.cy) >= CASTLE_TOWN_GAP, `seed ${seed}: castle ${c.id} too close to ${t.id}`);
  // towns: every stop reachable from the well over town paths
  for (const t of ts) {
    const walk = (k) => { const p = t.tiles.get(k); return p && (p.part === "path"); };
    const start = key(t.cx, t.cy + 1);
    const seenK = new Set([start]); const q = [start];
    while (q.length) { const [x, y] = parse(q.shift()); for (const d of DIRS) { const nk = key(x + d.x, y + d.y); if (!seenK.has(nk) && walk(nk)) { seenK.add(nk); q.push(nk); } } }
    for (const st of t.stops) {
      const front = key(st.x, st.y + 1);
      check(seenK.has(front), `seed ${seed}: ${t.id} ${st.kind} at ${st.id} not connected to well`);
    }
    // gardens: hub below gate
    for (const [k, p] of t.tiles) if (p.part === "gate") { const [x, y] = parse(k); check(seenK.has(key(x, y + 1)), `seed ${seed}: ${t.id} garden gate ${k} not connected`); }
    // footprint on dry flat land
    for (const k of t.tiles.keys()) { const [x, y] = parse(k); const c = world.cell(x, y); check(!c.water && !c.face, `seed ${seed}: ${t.id} part on water/cliff at ${k}`); }
  }
  // river widths: horizontal runs of water
  for (let y = -R; y <= R; y += 3) { let run = 0; for (let x = -R; x <= R; x++) { if (world.cell(x, y).water) run++; else { if (run) widths.set(run, (widths.get(run) || 0) + 1); run = 0; } } }
  // determinism
  const w2 = new World(seed);
  for (let i = 0; i < 200; i++) { const x = ((i * 37) % 200) - 100, y = ((i * 91) % 200) - 100; const a = world.cell(x, y), b = w2.cell(x, y); check(a.level === b.level && a.water === b.water && (a.part?.part) === (b.part?.part), `seed ${seed}: not deterministic at ${x},${y}`); }
  // carve smoke test from spawn
  let s = seed; const rng = () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x6d2b79f5), ((s ^ (s >>> 13)) >>> 0) / 4294967296);
  const grid = { "0,0": { type: "start" } };
  for (let i = 0; i < 20; i++) { carveTry++; const r = carveBranch(world, grid, { x: 0, y: 0 }, DIRS[i % 4], rng, { spacing: 0 }); if (r) { carveOk++; break; } }
}

console.log("towns", towns, "castles", castles, "(per 100 seeds, radius", R, ")");
console.log("river run widths (horizontal samples):", [...widths.entries()].sort((a, b) => a[0] - b[0]).slice(0, 8).map(([w, n]) => `${w}:${n}`).join(" "));
console.log("carve from spawn succeeded for", carveOk, "of 100 seeds");
console.log(fails.length ? `FAILURES (${fails.length}):\n` + fails.slice(0, 15).join("\n") : "all invariants hold");

// overview for a few seeds
for (const seed of [1, 42, 777]) {
  const world = new World(seed), N = 240, S = 2;
  writePng(`world_${seed}.png`, N * S, N * S, (px, py) => {
    const x = Math.floor(px / S) - N / 2, y = Math.floor(py / S) - N / 2, c = world.cell(x, y);
    if (x === 0 && y === 0) return [255, 0, 0];
    if (c.part) return ({ house: [60, 90, 200], well: [255, 255, 255], path: [214, 154, 78], fence: [243, 208, 64], soil: [148, 88, 72], gate: [214, 154, 78], barrel: [148, 88, 72], castle: [185, 181, 195] })[c.part.part] || [255, 0, 255];
    if (c.water) return [34, 99, 107];
    if (c.face) return [92, 56, 65];
    return [[95, 135, 35], [130, 170, 40], [200, 215, 100]][c.level];
  });
}
