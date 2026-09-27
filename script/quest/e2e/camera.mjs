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
page.on("pageerror", (e) => errors.push(e.message));
const ok = (c, m) => console.log(c ? "  ✓" : "  ✗ FAIL:", m);
async function login() {
  await page.goto(BASE);
  await page.fill('[data-quest="screenName"]', "e2e-cam");
  await page.click('[data-quest="loginScreen"] button');
  await page.waitForSelector('[data-quest="sessionScreen"]:not([hidden])');
}
await login();
await page.click('[data-quest="newJourneyButton"]');
await page.click('[data-quest="topicSetList"] button >> nth=1');
await page.waitForSelector("canvas"); await page.waitForTimeout(1000);
const code = await page.textContent('[data-quest="joinCode"]');
const session = await page.evaluate(async (code) => {
  const p = (await (await fetch("/api/v1/quest_players")).json()).find((p) => p.screen_name === "e2e-cam");
  return (await (await fetch(`/api/v1/quest_players/${p.id}/quest_sessions`)).json()).find((s) => s.join_code === code);
}, code);
const t = seeds.town, last = t.path.at(-1);
await page.goto(BASE); await page.waitForTimeout(300);
const token = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]').content);
await page.evaluate(async ({ id, state, token }) => fetch(`/api/v1/quest_sessions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", "X-CSRF-Token": token }, body: JSON.stringify({ game_state: state }) }),
  { id: session.id, token, state: { version: 3, seed: t.seed, topic_set_id: 2, coins: 0, tools: [], used_topic_ids: [], history: [], current_position: { x: last[0], y: last[1] },
    grid: { "0,0": { type: "start", visited: true }, ...Object.fromEntries(t.path.map(([x, y]) => [`${x},${y}`, { type: "path" }])), "1,1": { type: "topic", visited: true } } } });
await login();
await page.click(`.quest-session-open:has-text("${code}")`);
await page.waitForSelector('[data-quest="fork"]:not([hidden])', { timeout: 8000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: "c0-town.png" });

// go to a building, finish, and check the camera doesn't jump after the card closes
await page.keyboard.press("1");
await page.waitForSelector('[data-quest="modal"]:not([hidden])', { timeout: 10000 });
for (let k = 0; k < 2 && !(await page.$(".quest-lens-prompt")); k++) { await page.waitForSelector(".quest-choice"); await page.keyboard.press("1"); await page.waitForTimeout(400); }
await page.evaluate(() => { document.querySelector('[data-quest="fork"]').hidden = true; });
await page.mouse.move(700, 300);
// drag the map while... first finish the stop
await page.click('button:has-text("Continue the journey")');
await page.waitForTimeout(1500);
await page.evaluate(() => { document.querySelector('[data-quest="fork"]').hidden = true; });
await page.mouse.move(800, 300); await page.mouse.down(); await page.mouse.move(600, 380, { steps: 10 }); await page.mouse.move(450, 420, { steps: 10 }); await page.mouse.up();
await page.waitForTimeout(300);
await page.screenshot({ path: "c1-dragged.png" });
await page.waitForTimeout(2500);
await page.screenshot({ path: "c2-later.png" });
const diff = (a, b) => { try { require; } catch {} };
console.log("errors:", errors.length ? errors : "none");
await page.setViewportSize({ width: 1000, height: 700 });
await page.waitForTimeout(600);
await page.screenshot({ path: "c3-resized.png" });
await page.click('[data-quest-action="click->recenter"]');
await page.waitForTimeout(900);
await page.screenshot({ path: "c4-findme.png" });
await page.evaluate(async ({ id, token }) => fetch(`/api/v1/quest_sessions/${id}`, { method: "DELETE", headers: { "X-CSRF-Token": token } }), { id: session.id, token });
await browser.close();
