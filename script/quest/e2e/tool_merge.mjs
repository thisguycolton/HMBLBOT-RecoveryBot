// Part of the ACID QUEST test scripts - see docs/acid_quest.md. Screenshots and generated
// files go to tmp/quest-e2e/.
import { mkdirSync as __mkdir } from "node:fs";
const __out = new URL("../../../tmp/quest-e2e/", import.meta.url).pathname;
__mkdir(__out, { recursive: true });
process.chdir(__out);
import { chromium } from "playwright-core";
const W = 1200, H = 800, BASE = "http://localhost:3000/game/game";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ok = (c, m) => console.log(c ? "  ✓" : "  ✗ FAIL:", m);
async function login() {
  await page.goto(BASE);
  await page.fill('[data-quest="screenName"]', "e2e-merge");
  await page.click('[data-quest="loginScreen"] button');
  await page.waitForSelector('[data-quest="sessionScreen"]:not([hidden])');
}
await login();
await page.click('[data-quest="newJourneyButton"]');
await page.click('[data-quest="topicSetList"] button >> nth=1');
await page.waitForSelector("canvas"); await page.waitForTimeout(1000);
const code = await page.textContent('[data-quest="joinCode"]');
const session = await page.evaluate(async (code) => {
  const p = (await (await fetch("/api/v1/quest_players")).json()).find((p) => p.screen_name === "e2e-merge");
  return (await (await fetch(`/api/v1/quest_players/${p.id}/quest_sessions`)).json()).find((s) => s.join_code === code);
}, code);
await page.goto(BASE); await page.waitForTimeout(300);
const token = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]').content);
// one pickaxe use, but the road ahead needs two: the mystery rewards a pickaxe
await page.evaluate(async ({ id, state, token }) => fetch(`/api/v1/quest_sessions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", "X-CSRF-Token": token }, body: JSON.stringify({ game_state: state }) }),
  { id: session.id, token, state: { version: 3, topic_set_id: 2, coins: 0, used_topic_ids: [], history: [], current_position: { x: 0, y: 0 },
    tools: [{ id: "p", type: "pickaxe", uses: 1, max: 1, legendary: false }],
    grid: { "0,0": { type: "start", visited: true }, "1,0": { type: "boulder" }, "2,0": { type: "boulder" }, "3,0": { type: "path" }, "4,0": { type: "topic", category_id: 1, visited: false },
      "0,1": { type: "path" }, "0,2": { type: "path" }, "0,3": { type: "path" }, "0,4": { type: "topic", kind: "mystery", mystery: true, visited: false } } } });
await login();
await page.click(`.quest-session-open:has-text("${code}")`);
await page.waitForSelector('[data-quest="fork"]:not([hidden])', { timeout: 8000 });
const rows = await page.$$eval(".quest-fork-row", (r) => r.map((x) => x.innerText));
await page.keyboard.press(String(rows.findIndex((r) => r.includes("unknown")) + 1));
await page.waitForSelector(".quest-lens-prompt", { timeout: 8000 });
const reward = await page.textContent(".quest-reward");
console.log("   card reward:", reward);
const promised = Number(reward.match(/(\d) use/)[1]);
await page.click('button:has-text("Continue the journey")');
await page.waitForTimeout(1500);
console.log("   toast:", await page.textContent('[data-quest="toast"]'));
const tools = (await page.evaluate(async (id) => (await (await fetch(`/api/v1/quest_sessions/${id}`)).json()), session.id)).game_state.tools;
const picks = tools.filter((t) => t.type === "pickaxe");
ok(picks.length === 1 && picks[0].uses === Math.min(5, 1 + promised), `one pickaxe with ${picks[0]?.uses} uses (1 + ${promised}, capped at 5)`);
ok((await page.$$(".quest-slot img")).length === 1, "the toolbar shows a single pickaxe slot");
await page.screenshot({ path: "merge.png" });
await page.evaluate(async ({ id, token }) => fetch(`/api/v1/quest_sessions/${id}`, { method: "DELETE", headers: { "X-CSRF-Token": token } }), { id: session.id, token });
console.log("errors:", errors.length ? errors : "none");
await browser.close();
