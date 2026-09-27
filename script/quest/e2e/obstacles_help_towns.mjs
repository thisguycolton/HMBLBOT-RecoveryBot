// Part of the ACID QUEST test scripts - see docs/acid_quest.md. Screenshots and generated
// files go to tmp/quest-e2e/.
import { mkdirSync as __mkdir } from "node:fs";
const __out = new URL("../../../tmp/quest-e2e/", import.meta.url).pathname;
__mkdir(__out, { recursive: true });
process.chdir(__out);
import { chromium } from "playwright-core";
import fs from "node:fs";
const seeds = JSON.parse(fs.readFileSync("seeds.json", "utf8"));
const W = 1200, H = 800, BASE = "http://localhost:3000/game/game";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message + " " + (e.stack || "").split("\n").slice(1, 3).join(" ")));
page.on("console", (m) => m.type() === "error" && !/quill|vite-dev\/\?token|ERR_CONNECTION_REFUSED|ERR_FAILED/.test(m.text()) && errors.push("console: " + m.text()));
const log = (...a) => console.log(...a);
const ok = (cond, msg) => console.log(cond ? "  ✓" : "  ✗ FAIL:", msg);

const csrf = () => page.evaluate(() => document.querySelector('meta[name="csrf-token"]').content);
let session;
async function login(url = BASE) {
  await page.goto(url);
  await page.fill('[data-quest="screenName"]', "e2e-world");
  await page.click('[data-quest="loginScreen"] button');
  await page.waitForSelector('[data-quest="sessionScreen"]:not([hidden])');
}
async function createSession() {
  await page.click('[data-quest="newJourneyButton"]');
  await page.click('[data-quest="topicSetList"] button >> nth=1');
  await page.waitForSelector("canvas");
  await page.waitForTimeout(1500);
  const code = await page.textContent('[data-quest="joinCode"]');
  session = await getSession(code);
}
async function getSession(code = session.join_code) {
  return page.evaluate(async (code) => {
    const p = (await (await fetch("/api/v1/quest_players")).json()).find((p) => p.screen_name === "e2e-world");
    return (await (await fetch(`/api/v1/quest_players/${p.id}/quest_sessions`)).json()).find((s) => s.join_code === code);
  }, code);
}
async function loadState(state, url = BASE) {
  await page.goto(BASE); await page.waitForTimeout(300);
  await page.evaluate(async ({ id, state, token }) => fetch(`/api/v1/quest_sessions/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", "X-CSRF-Token": token }, body: JSON.stringify({ game_state: state }),
  }), { id: session.id, state, token: await csrf() });
  await login(url);
  await page.click(`.quest-session-open:has-text("${session.join_code}")`);
  await page.waitForSelector("canvas");
  await page.waitForTimeout(1500);
}
let zoom = 4;
async function setZoom(z) { while (zoom > z) { await page.click('[data-quest-action="click->zoomOut"]'); zoom--; } await page.waitForTimeout(200); }
const tap = (pos, x, y) => page.mouse.click(W / 2 + (x - pos.x) * 16 * zoom, H / 2 + ((y - pos.y) * 16 + 3) * zoom);
const modalOpen = () => page.waitForSelector('[data-quest="modal"]:not([hidden])', { timeout: 8000 }).then(() => true, () => false);
const text = (q) => page.textContent(`[data-quest="${q}"]`);
const inv = async () => (await getSession()).game_state.inventory;
const settle = () => page.waitForTimeout(1300);
const cnt = (g) => Object.fromEntries(["boat", "pickaxe", "axe", "rope"].map((t) => [t, (g.tools || []).filter((x) => x.type === t).reduce((a, x) => a + (x.legendary ? 99 : x.uses), 0)]));
// finish a stop in the new flow: pick the first path if offered, then continue the journey
async function finishStop() {
  await page.waitForSelector(".quest-choice, .quest-lens-prompt", { timeout: 8000 });
  if (await page.$(".quest-choice")) { await page.keyboard.press("1"); await page.waitForSelector(".quest-lens-prompt"); }
  await page.click('button:has-text("Continue the journey")');
}

await login();
await createSession();
await page.screenshot({ path: "e3-0-new.png" });

// ---------- A: obstacles on a flat board ----------
log("A: obstacles");
const base = { version: 3, used_topic_ids: [], history: [] };
await loadState({ ...base, current_position: { x: 0, y: 0 }, inventory: { boat: 1, pickaxe: 0, axe: 1, rope: 1 }, grid: {
  "0,0": { type: "start", visited: true },
  "1,0": { type: "path" }, "2,0": { type: "boulder" }, "3,0": { type: "path" }, "4,0": { type: "topic", category_id: 1, visited: false },
  "-1,0": { type: "path" }, "-2,0": { type: "ford", axis: "h", crossing: "-2,0" }, "-3,0": { type: "ford", axis: "h", crossing: "-2,0" }, "-4,0": { type: "path" }, "-5,0": { type: "topic", category_id: 2, visited: false },
  "0,-1": { type: "path" }, "0,-2": { type: "climb", axis: "v" }, "0,-3": { type: "path" }, "0,-4": { type: "topic", category_id: 4, visited: false },
  "0,1": { type: "log", axis: "v" }, "0,2": { type: "path" }, "0,3": { type: "topic", category_id: 3, visited: false, mystery: true },
} });
await page.screenshot({ path: "e3-A0.png" });
await setZoom(3);
await tap({ x: 0, y: 0 }, 4, 0); await page.waitForTimeout(400);
ok(/boulder blocks the way.*pickaxe/i.test(await text("toast")), `blocked toast: "${await text("toast")}"`);
await tap({ x: 0, y: 0 }, 0, 3);
ok(await modalOpen(), "mystery card opened after passing the fallen tree");
await page.waitForTimeout(400);
ok(/Mystery/.test(await text("modalCategory")) && /pickaxe/i.test(await page.textContent(".quest-reward").catch(() => "")), `mystery card: "${await text("modalCategory")}" / "${await page.textContent(".quest-reward").catch(() => "")}"`);
await page.screenshot({ path: "e3-A1-mystery.png" });
await finishStop(); await settle();
let s = await getSession();
ok(s.game_state.grid["0,1"].type === "stump" && cnt(s.game_state).axe === 0, `log -> ${s.game_state.grid["0,1"].type}, axe ${cnt(s.game_state).axe}`);
ok(cnt(s.game_state).pickaxe >= 1, `mystery gave a pickaxe (${JSON.stringify(cnt(s.game_state))})`);
const pickBefore = cnt(s.game_state).pickaxe;
await tap({ x: 0, y: 3 }, 4, 0);
ok(await modalOpen(), "reached the boulder stop");
await page.click('[data-quest-action="click->closeModal"]'); await settle();
s = await getSession();
ok(s.game_state.grid["2,0"].type === "path" && cnt(s.game_state).pickaxe === pickBefore - 1, `boulder -> ${s.game_state.grid["2,0"].type}, pickaxe uses ${pickBefore} -> ${cnt(s.game_state).pickaxe}`);
await tap({ x: 4, y: 0 }, -5, 0);
ok(await modalOpen(), "crossed the river");
await page.click('[data-quest-action="click->closeModal"]'); await settle();
s = await getSession();
ok(s.game_state.grid["-2,0"].type === "bridge" && s.game_state.grid["-3,0"].type === "bridge" && cnt(s.game_state).boat === 0, `2-wide crossing: ${s.game_state.grid["-2,0"].type}/${s.game_state.grid["-3,0"].type}, boats ${cnt(s.game_state).boat}`);
await page.screenshot({ path: "e3-A2-bridge.png" });
await tap({ x: -5, y: 0 }, 0, -4);
ok(await modalOpen(), "climbed the cliff");
await page.click('[data-quest-action="click->closeModal"]'); await settle();
s = await getSession();
ok(s.game_state.grid["0,-2"].type === "ladder" && cnt(s.game_state).rope === 0, `climb -> ${s.game_state.grid["0,-2"].type}, rope ${cnt(s.game_state).rope}`);

// ---------- B: fully blocked, merchant then friend ----------
log("B: asking for help");
const blocked = { ...base, current_position: { x: 0, y: 0 }, inventory: { boat: 0, pickaxe: 0, axe: 0, rope: 0 }, grid: {
  "0,0": { type: "start", visited: true },
  "1,0": { type: "path" }, "2,0": { type: "log", axis: "h" }, "3,0": { type: "path" }, "4,0": { type: "topic", category_id: 1, visited: false },
  "-1,0": { type: "path" }, "-2,0": { type: "boulder" }, "-3,0": { type: "path" }, "-4,0": { type: "topic", category_id: 2, visited: false },
} };
zoom = 4;
await loadState(blocked);
const helpOpen = await page.waitForSelector('[data-quest="help"]:not([hidden])', { timeout: 4000 }).then(() => true, () => false);
ok(helpOpen, "help dialog opened by itself when stuck");
ok(/merchant/i.test(await text("helpTitle")), `merchant: "${await text("helpBody")}"`);
await page.screenshot({ path: "e3-B1-merchant.png" });
await page.click('[data-quest="helpOptions"] button');
ok(await modalOpen(), "merchant story card opened");
await page.waitForTimeout(400);
ok(/merchant/i.test(await text("modalCategory")), `card: "${await text("modalCategory")}" / "${await page.textContent(".quest-reward").catch(() => "")}"`);
await finishStop(); await settle();
s = await getSession();
const got = Object.entries(cnt(s.game_state)).filter(([, n]) => n > 0).map(([i]) => i);
ok(got.length === 1 && ["axe", "pickaxe"].includes(got[0]), `merchant gave ${got}`);
ok(s.game_state.history.at(-1)?.help === "merchant", "help recorded in history");
await tap({ x: 0, y: 0 }, got[0] === "axe" ? 4 : -4, 0);
ok(await modalOpen(), "moved on with the merchant's item");
await page.click('[data-quest-action="click->closeModal"]'); await settle();

zoom = 4;
await loadState(blocked, `${BASE}?help=friend`);
await page.waitForSelector('[data-quest="help"]:not([hidden])', { timeout: 4000 }).catch(() => {});
ok(/friend/i.test(await text("helpTitle")), `friend mode: "${await text("helpTitle")}"`);
const buttons = await page.$$('[data-quest="helpOptions"] button');
ok(buttons.length >= 4, `category choices: ${buttons.length}`);
await page.screenshot({ path: "e3-B2-friend.png" });
await buttons[2].click();
ok(await modalOpen(), "friend topic card opened");
await page.waitForTimeout(300);
log("   card:", await text("modalCategory"));
await finishStop(); await settle();
s = await getSession();
ok((s.game_state.tools || []).length === 1 && s.game_state.history.at(-1)?.help === "friend", `friend gave ${JSON.stringify(s.game_state.tools)}`);

// ---------- C: a real generated town and castle ----------
log("C: town and castle, seed", seeds.town.seed);
const pathGrid = (cells) => Object.fromEntries(cells.map(([x, y]) => [`${x},${y}`, { type: "path" }]));
const t = seeds.town, last = t.path.at(-1);
zoom = 4;
await loadState({ ...base, seed: t.seed, current_position: { x: last[0], y: last[1] }, inventory: { boat: 0, pickaxe: 0, axe: 0, rope: 0 },
  grid: { "0,0": { type: "start", visited: true }, ...pathGrid(t.path), "1,1": { type: "topic", category_id: 1, visited: true } } });
await setZoom(2);
await page.screenshot({ path: "e3-C0-town.png" });
const here = { x: last[0], y: last[1] };
const dist = (st) => Math.abs(st.x - here.x) + Math.abs(st.y - here.y);
const house = t.stops.filter((st) => st.kind === "house").sort((p, q) => dist(p) - dist(q))[0], well = t.stops.find((st) => st.kind === "well");
log("   here", here, "house", house, "well", well);
await tap(here, house.x, house.y);
ok(await modalOpen(), "walked to a house");
await page.waitForTimeout(400);
ok(/Village house/.test(await text("modalCategory")), `house card: "${await text("modalCategory")}"`);
await page.screenshot({ path: "e3-C1-house.png" });
await finishStop(); await settle();
s = await getSession();
ok(s.game_state.grid[`${house.x},${house.y}`]?.visited, "house visit recorded");
await tap(house, well.x, well.y);
ok(await modalOpen(), "walked to the well");
await page.waitForTimeout(400);
ok(/Village well/.test(await text("modalCategory")) && /earn/.test(await page.textContent(".quest-reward").catch(() => "")), `well card: "${await text("modalCategory")}" / "${await page.textContent(".quest-reward").catch(() => "")}"`);
await finishStop(); await settle();
s = await getSession();
ok((s.game_state.tools || []).length === 1, `well gave ${JSON.stringify(s.game_state.tools)}`);
await page.screenshot({ path: "e3-C2-after.png" });

const c = seeds.castle, clast = c.path.at(-1), gate = c.stops[0];
zoom = 4;
await loadState({ ...base, seed: c.seed, current_position: { x: clast[0], y: clast[1] }, inventory: { boat: 0, pickaxe: 0, axe: 0, rope: 0 },
  grid: { "0,0": { type: "start", visited: true }, ...pathGrid(c.path), "1,1": { type: "topic", category_id: 1, visited: true } } });
await setZoom(3);
await page.screenshot({ path: "e3-C3-castle.png" });
await tap({ x: clast[0], y: clast[1] }, gate.x, gate.y);
ok(await modalOpen(), "walked to the castle");
await page.waitForTimeout(400);
ok(/Castle/.test(await text("modalCategory")), `castle card: "${await text("modalCategory")}"`);
await page.screenshot({ path: "e3-C4-castle-card.png" });
await page.click('[data-quest-action="click->closeModal"]');

// ---------- D: older journey ----------
log("D: version 2 journey");
zoom = 4;
await loadState({ version: 2, current_position: { x: 0, y: 0 }, inventory: { boat: 0 }, used_topic_ids: [], history: [], grid: {
  "0,0": { type: "start", visited: true }, "1,0": { type: "path" }, "2,0": { type: "bridge", axis: "h" }, "2,-1": { type: "water" }, "2,1": { type: "water" }, "3,0": { type: "path" }, "4,0": { type: "topic", category_id: 1, visited: false },
} });
await page.screenshot({ path: "e3-D-legacy.png" });
await tap({ x: 0, y: 0 }, 4, 0);
ok(await modalOpen(), "old journey still plays");

await page.evaluate(async ({ id, token }) => fetch(`/api/v1/quest_sessions/${id}`, { method: "DELETE", headers: { "X-CSRF-Token": token } }), { id: session.id, token: await csrf() });
log("errors:", errors.length ? errors.join("\n") : "none");
await browser.close();
