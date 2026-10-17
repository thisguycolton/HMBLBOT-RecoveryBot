// Part of the ACID QUEST test scripts - see docs/acid_quest.md. Screenshots and generated
// files go to tmp/quest-e2e/.
import { mkdirSync as __mkdir } from "node:fs";
const __out = new URL("../../../tmp/quest-e2e/", import.meta.url).pathname;
__mkdir(__out, { recursive: true });
process.chdir(__out);
const W = new URL("../../../app/javascript/quest/world", import.meta.url).pathname;
const { default: World } = await import(`${W}/world.js`);
const { key, parse, DIRS } = await import(`${W}/paths.js`);
import fs from "node:fs";

// land-only BFS from spawn to any path cell of the settlement
function landPath(world, s) {
  const goals = new Set([...s.tiles].filter(([, p]) => p.part === "path").map(([k]) => k));
  const prev = new Map([["0,0", null]]); const q = [[0, 0]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const d of DIRS) {
      const nx = x + d.x, ny = y + d.y, nk = key(nx, ny);
      if (prev.has(nk) || Math.abs(nx) > 90 || Math.abs(ny) > 90) continue;
      if (goals.has(nk)) { const cells = []; for (let k = key(x, y); k && k !== "0,0"; k = prev.get(k)) cells.unshift(parse(k)); return { cells, join: [nx, ny] }; }
      const c = world.cell(nx, ny), h = world.cell(x, y);
      if (c.part || c.water || c.face || c.level !== h.level) continue;
      prev.set(nk, key(x, y)); q.push([nx, ny]);
    }
  }
  return null;
}

const out = {};
for (let seed = 1; seed < 400 && !(out.town && out.castle); seed++) {
  const world = new World(seed);
  for (const s of world.settlementsNear(0, 0, 50)) {
    if (out[s.kind] || Math.hypot(s.cx, s.cy) > 55) continue;
    const p = landPath(world, s);
    if (!p || p.cells.length > 120) continue;
    out[s.kind] = { seed, cx: s.cx, cy: s.cy, stops: s.stops.map(({ x, y, kind }) => ({ x, y, kind })), path: p.cells, join: p.join };
  }
}
fs.writeFileSync("seeds.json", JSON.stringify(out));
for (const [k, v] of Object.entries(out)) console.log(k, "seed", v.seed, "center", v.cx, v.cy, "path len", v.path.length, "stops", v.stops.map((s) => `${s.kind}@${s.x},${s.y}`).join(" "));
