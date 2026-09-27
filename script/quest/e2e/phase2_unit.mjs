// Part of the ACID QUEST test scripts - see docs/acid_quest.md. Pure checks (no browser) for
// the Phase 2 rules: fog banks, locked gates and Courage / Connection / Hope.
const Q = new URL("../../../app/javascript/quest", import.meta.url).pathname;
const { default: World } = await import(`${Q}/world/world.js`);
const { fogAt, FOG_CLEAR_RADIUS } = await import(`${Q}/world/terrain.js`);
const { placeGate, findRoute, reachableTargets, nodeAt, key } = await import(`${Q}/world/paths.js`);
const { resourcesFor, addResources } = await import(`${Q}/resources.js`);
const ok = (c, m) => console.log(c ? "  ✓" : "  ✗ FAIL:", m);

console.log("fog");
let nearSpawn = 0, fog = 0, total = 0, mismatch = 0;
for (let seed = 1; seed <= 100; seed++) {
  const world = new World(seed);
  for (let y = -90; y <= 90; y += 3) for (let x = -90; x <= 90; x += 3) {
    const f = fogAt(seed, x, y);
    if (Math.hypot(x, y) < FOG_CLEAR_RADIUS && f) nearSpawn++;
    if (world.cell(x, y).fog !== f) mismatch++;
    total++; fog += f;
  }
}
ok(nearSpawn === 0, `no fog within ${FOG_CLEAR_RADIUS} tiles of spawn (${nearSpawn})`);
ok(mismatch === 0, "world.cell(x, y).fog matches fogAt");
ok(fog / total > 0.05 && fog / total < 0.25, `fog covers a modest share of the map: ${(100 * fog / total).toFixed(1)}%`);
ok(new World(null).cell(40, 40).fog === false, "older flat-meadow journeys have no fog");

console.log("gates");
const line = (n) => Array.from({ length: n }, (_, i) => ({ x: i + 1, y: 0, type: "path", axis: "h" }));
let placedBad = 0;
for (let i = 0; i < 500; i++) {
  const cells = line(10);
  const r = (() => { let s = i * 97 + 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  if (placeGate(cells, r)) {
    const at = cells.findIndex((c) => c.type === "gate");
    if (at < 2 || at >= cells.length - 1 || cells.filter((c) => c.type === "gate").length !== 1) placedBad++;
  }
}
ok(placedBad === 0, "a gate is never on the first two cells or the stop, and only one per branch");
const withBoulder = line(10); withBoulder[4].type = "boulder";
ok(!placeGate(withBoulder, Math.random), "no gate on a branch that already has an obstacle");

// a start with two roads: a gated one and an open one
const flat = new World(null);
const grid = { "0,0": { type: "start", visited: true } };
for (let x = 1; x <= 4; x++) grid[key(x, 0)] = { type: x === 2 ? "gate" : "path", axis: "h" };
grid["5,0"] = { type: "topic", visited: false };
for (let y = 1; y <= 4; y++) grid[key(0, y)] = { type: "path", axis: "v" };
grid["0,5"] = { type: "topic", visited: false };
const toGated = findRoute(flat, grid, { x: 0, y: 0 }, { x: 5, y: 0 });
ok(toGated?.gates.length === 1 && toGated.gates[0].x === 2, "route reports the locked gate on the way");
ok(Object.values(toGated.needs).every((n) => n === 0), "a gate needs no tools");
ok(reachableTargets(flat, grid, { x: 0, y: 0 }).targets.length === 2, "stops behind a gate still count as reachable");
grid["2,0"].type = "gate_open";
ok(findRoute(flat, grid, { x: 0, y: 0 }, { x: 5, y: 0 }).gates.length === 0, "an opened gate is plain road");
ok(nodeAt(flat, grid, 2, 0).walkable && !nodeAt(flat, grid, 2, 0).gate, "gate_open is walkable and no longer a gate");

console.log("resources");
const share = (f) => ({ kind: "share", ...f });
ok(resourcesFor(share({ approach: "risky" })).courage === 1, "RISKY share earns Courage");
ok(resourcesFor(share({ approach: "chaos" })).courage === 1, "CHAOS share earns Courage");
ok(resourcesFor(share({ encounter: "ghost", approach: "risky" })).courage === 1, "the ghost's question earns Courage");
ok(!resourcesFor(share({ approach: "safe" })).courage && !resourcesFor(share({ approach: "curious" })).courage, "safe and curious earn no Courage (and cost nothing)");
ok(resourcesFor(share({ sharing_mode_key: "connection" })).connection === 1, "Connection lens earns Connection");
ok(resourcesFor(share({ encounter: "campfire" })).connection === 1, "campfire share earns Connection");
ok(resourcesFor(share({ approach: "revisit" })).hope === 1, "a revisit earns Hope");
ok(resourcesFor(share({ sharing_mode_key: "gratitude" })).hope === 1, "Gratitude earns Hope");
ok(Object.keys(resourcesFor({ kind: "pass", approach: "risky", encounter: "ghost" })).length === 0, "a pass earns and costs nothing");
const totals = [share({ approach: "chaos", sharing_mode_key: "connection" }), share({ approach: "revisit" }), { kind: "pass" }]
  .reduce((t, e) => addResources(t, e), {});
ok(totals.courage === 1 && totals.connection === 1 && totals.hope === 1, `totals add up: ${JSON.stringify(totals)}`);
