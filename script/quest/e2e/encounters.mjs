// Part of the ACID QUEST test scripts - see docs/acid_quest.md. Screenshots and generated
// files go to tmp/quest-e2e/.
import { mkdirSync as __mkdir } from "node:fs";
const __out = new URL("../../../tmp/quest-e2e/", import.meta.url).pathname;
__mkdir(__out, { recursive: true });
process.chdir(__out);
import { chromium } from "playwright-core";
import fs from "node:fs";
const seeds = JSON.parse(fs.readFileSync("seeds.json", "utf8"));
const W = 1200, H = 800;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message + " " + (e.stack || "").split("\n").slice(1, 3).join(" ")));
page.on("console", (m) => m.type() === "error" && !/quill|vite-dev\/\?token|ERR_CONNECTION_REFUSED|ERR_FAILED/.test(m.text()) && errors.push("console: " + m.text()));
const ok = (c, m) => console.log(c ? "  ✓" : "  ✗ FAIL:", m);
const csrf = () => page.evaluate(() => document.querySelector('meta[name="csrf-token"]').content);
let session;
async function login() {
  await page.goto("http://localhost:3000/game/game");
  await page.fill('[data-quest="screenName"]', "e2e-enc");
  await page.click('[data-quest="loginScreen"] button');
  await page.waitForSelector('[data-quest="sessionScreen"]:not([hidden])');
}
async function getSession(code) {
  return page.evaluate(async (code) => {
    const p = (await (await fetch("/api/v1/quest_players")).json()).find((p) => p.screen_name === "e2e-enc");
    return (await (await fetch(`/api/v1/quest_players/${p.id}/quest_sessions`)).json()).find((s) => s.join_code === code);
  }, code);
}
async function load(state) {
  await page.goto("http://localhost:3000/game/game"); // fresh page: no pending saves from the last board
  await page.waitForTimeout(300);
  await page.evaluate(async ({ id, state, token }) => fetch(`/api/v1/quest_sessions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", "X-CSRF-Token": token }, body: JSON.stringify({ game_state: state }) }), { id: session.id, state, token: await csrf() });
  await login();
  await page.click(`.quest-session-open:has-text("${session.join_code}")`);
  await page.waitForSelector("canvas");
  await page.waitForTimeout(1500);
}
const pick = async (label) => { const rows = await page.$$eval(".quest-fork-row", (r) => r.map((x) => x.innerText)); const i = rows.findIndex((r) => r.includes(label)); await page.keyboard.press(String(i + 1)); return i; };

await login();
await page.click('[data-quest="newJourneyButton"]');
await page.click('[data-quest="topicSetList"] button:has-text("Micah")');
await page.waitForSelector("canvas"); await page.waitForTimeout(1200);
session = await getSession(await page.textContent('[data-quest="joinCode"]'));

const base = { version: 3, topic_set_id: 2, used_topic_ids: [], history: [], inventory: { boat: 0, pickaxe: 0, axe: 0, rope: 0 } };
await load({ ...base, coins: 1, current_position: { x: 0, y: 0 }, grid: {
  "0,0": { type: "start", visited: true },
  "1,0": { type: "path" }, "2,0": { type: "path" }, "3,0": { type: "topic", kind: "merchant", visited: false },
  "-1,0": { type: "path" }, "-2,0": { type: "path" }, "-3,0": { type: "topic", kind: "campfire", visited: false },
  "0,1": { type: "path" }, "0,2": { type: "path" }, "0,3": { type: "topic", kind: "mystery", mystery: true, visited: false },
} });
await page.waitForSelector('[data-quest="fork"]:not([hidden])');
await page.screenshot({ path: "e5-0-map.png" });
console.log("fork:", await page.$$eval(".quest-fork-row", (r) => r.map((x) => x.innerText.replace(/\s+/g, " "))));

console.log("merchant");
await pick("Merchant");
await page.waitForSelector(".quest-choice", { timeout: 8000 });
const offer = await page.$$eval(".quest-choice", (b) => b.map((x) => x.innerText.replace(/\s+/g, " ")));
ok(offer.length === 3, `3 topics on offer: ${offer.join(" | ")}`);
ok(/costs 1 trail coin. You have 1/.test(await page.textContent('[data-quest="cardStage"]')), "shows price and coins");
await page.screenshot({ path: "e5-1-merchant.png" });
await page.keyboard.press("2");
await page.waitForSelector(".quest-path-title");
ok(/×0/.test(await page.textContent('[data-quest="items"] .quest-item')), "coin spent");
await page.keyboard.press("1"); await page.waitForSelector(".quest-lens-prompt");
await page.click('button:has-text("Continue the journey")');
await page.waitForSelector('[data-quest="fork"]:not([hidden])');

console.log("campfire");
await pick("Campfire");
await page.waitForSelector(".quest-choice", { timeout: 8000 });
await page.waitForTimeout(300);
const gentle = await page.$$eval(".quest-choice strong", (b) => b.map((x) => x.innerText));
ok(gentle.every((g) => /Check-In|Gratitude|Funny Story|Connection/i.test(g)), `gentle lenses only: ${gentle}`);
ok(await page.isVisible('button:has-text("just check in")'), "check-in-only option");
await page.screenshot({ path: "e5-2-campfire.png" });
await page.click('button:has-text("just check in")');
await page.waitForSelector(".quest-lens-prompt");
ok(/Check-In/i.test(await page.textContent(".quest-lens-name")), "check-in without a topic");
await page.click('button:has-text("Continue the journey")');
await page.waitForSelector('[data-quest="fork"]:not([hidden])');

console.log("mystery");
await pick("unknown");
await page.waitForSelector(".quest-lens-prompt", { timeout: 8000 });
ok(true, `mystery goes straight to a random path: ${await page.textContent(".quest-lens-name")}`);
ok(/Mystery/.test(await page.textContent('[data-quest="modalCategory"]')), "mystery header");
await page.screenshot({ path: "e5-3-mystery.png" });
await page.click('button:has-text("Continue the journey")');
await page.waitForTimeout(1200);

console.log("merchant with no coins");
await load({ ...base, coins: 0, current_position: { x: 0, y: 0 }, grid: {
  "0,0": { type: "start", visited: true }, "1,0": { type: "path" }, "2,0": { type: "topic", kind: "merchant", visited: false } } });
await pick("Merchant");
await page.waitForSelector(".quest-choice", { timeout: 8000 });
ok(/Pay me next time/.test(await page.textContent('[data-quest="cardStage"]')), "broke: the merchant gives credit");
await page.keyboard.press("1");
await page.waitForSelector(".quest-path-title");
ok(true, "bought on credit");
await page.click('[data-quest-action="click->closeModal"]');

const j = await page.evaluate(async (id) => (await fetch(`/api/v1/quest_sessions/${id}/journey`)).json(), session.id);
console.log("journey encounters:", j.encounters.join(","), "| shares:", j.stats.stories_shared, "| modes:", j.sharing_modes.join(","));

console.log("town with villagers, seed", seeds.town.seed);
const last = seeds.town.path.at(-1);
await load({ ...base, seed: seeds.town.seed, coins: 0, current_position: { x: last[0], y: last[1] },
  grid: { "0,0": { type: "start", visited: true }, ...Object.fromEntries(seeds.town.path.map(([x, y]) => [`${x},${y}`, { type: "path" }])), "1,1": { type: "topic", visited: true } } });
await page.click('[data-quest-action="click->zoomOut"]');
await page.waitForTimeout(2500);
await page.screenshot({ path: "e5-4-town.png" });
console.log("fork in town:", await page.$$eval(".quest-fork-row", (r) => r.map((x) => x.innerText.replace(/\s+/g, " "))));

await page.evaluate(async ({ id, token }) => fetch(`/api/v1/quest_sessions/${id}`, { method: "DELETE", headers: { "X-CSRF-Token": token } }), { id: session.id, token: await csrf() });
console.log("errors:", errors.length ? errors.join("\n") : "none");
await browser.close();
