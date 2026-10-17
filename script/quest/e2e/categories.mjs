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
const errors = [], draws = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", async (r) => {
  if (!r.url().includes("/quest_topics/draw")) return;
  const u = new URL(r.url());
  draws.push({ asked: u.searchParams.get("category_id"), got: (await r.json()).map((t) => t.topic_category_id) });
});
const ok = (c, m) => console.log(c ? "  ✓" : "  ✗ FAIL:", m);
async function login() {
  await page.goto(BASE);
  await page.fill('[data-quest="screenName"]', "e2e-cat");
  await page.click('[data-quest="loginScreen"] button');
  await page.waitForSelector('[data-quest="sessionScreen"]:not([hidden])');
}
await login();
await page.click('[data-quest="newJourneyButton"]');
await page.click('[data-quest="topicSetList"] button:has-text("Newcomers")');
await page.waitForSelector("canvas"); await page.waitForTimeout(1000);
const code = await page.textContent('[data-quest="joinCode"]');
const session = await page.evaluate(async (code) => {
  const p = (await (await fetch("/api/v1/quest_players")).json()).find((p) => p.screen_name === "e2e-cat");
  return (await (await fetch(`/api/v1/quest_players/${p.id}/quest_sessions`)).json()).find((s) => s.join_code === code);
}, code);
await page.goto(BASE); await page.waitForTimeout(300);
const token = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]').content);
await page.evaluate(async ({ id, state, token }) => fetch(`/api/v1/quest_sessions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", "X-CSRF-Token": token }, body: JSON.stringify({ game_state: state }) }),
  { id: session.id, token, state: { version: 3, topic_set_id: 3, coins: 0, tools: [], used_topic_ids: [], history: [], current_position: { x: 0, y: 0 },
    grid: { "0,0": { type: "start", visited: true }, "1,0": { type: "path" }, "2,0": { type: "path" }, "3,0": { type: "path" }, "4,0": { type: "topic", category_id: 4, visited: false },
      "-1,0": { type: "path" }, "-2,0": { type: "path" }, "-3,0": { type: "path" }, "-4,0": { type: "topic", kind: "mystery", mystery: true, visited: false } } } });
await login();
await page.click(`.quest-session-open:has-text("${code}")`);
await page.waitForSelector('[data-quest="fork"]:not([hidden])', { timeout: 8000 });

async function open(label) {
  const rows = await page.$$eval(".quest-fork-row", (r) => r.map((x) => x.innerText));
  await page.keyboard.press(String(rows.findIndex((r) => r.includes(label)) + 1));
  await page.waitForSelector('[data-quest="modal"]:not([hidden])', { timeout: 8000 });
  await page.waitForTimeout(800);
  // regular stops ask which way in first; take the default (curious)
  if (await page.$(".quest-dial")) {
    await page.keyboard.press("Enter");
    await page.waitForSelector(".quest-path-title:has-text('Choose your path')", { timeout: 8000 });
    await page.waitForTimeout(300);
  }
}
const header = async () => ({ label: await page.textContent('[data-quest="modalCategory"]'), icon: (await page.getAttribute('[data-quest="modalIcon"]', "src")).split("/").pop().split("?")[0] });
const lensIcons = () => page.$$eval(".quest-choice img", (i) => i.map((x) => x.getAttribute("src").split("/").pop().split("?")[0]));

console.log("category stop (Fellowship & Service)");
await open("Service");
let h = await header();
console.log("   header:", h, "| lens icons:", await lensIcons());
ok(/Fellowship/.test(h.label) && /icon_follow/.test(h.icon), "header shows the category");
ok((await lensIcons()).every((i) => /icon_follow/.test(i)), "lens tiles show the category icon");
await page.screenshot({ path: "k1-lenses.png" });
draws.length = 0;
for (let i = 0; i < 4; i++) { await page.click('button:has-text("Different topic")'); await page.waitForTimeout(500); }
ok(draws.length === 4 && draws.every((d) => d.asked === "4" && d.got.every((c) => c === 4)), `different topic stays in the category: ${JSON.stringify(draws)}`);
await page.click('[data-quest-action="click->closeModal"]'); await page.waitForTimeout(500);

console.log("mystery stop");
await open("unknown");
h = await header();
const firstCat = draws.at(-1).got[0];
console.log("   header:", h, "| first mystery topic category:", firstCat);
ok(firstCat ? !/Mystery$/.test(h.label) : true, "mystery card names the drawn topic's category");
await page.click('button:has-text("Choose a different path")');
await page.waitForSelector(".quest-choice");
draws.length = 0;
for (let i = 0; i < 3; i++) { await page.click('button:has-text("Different topic")'); await page.waitForTimeout(500); }
ok(!firstCat || draws.every((d) => d.asked === String(firstCat) && d.got.every((c) => c === firstCat)), `mystery re-draws stay in that category: ${JSON.stringify(draws)}`);
await page.screenshot({ path: "k2-mystery.png" });

await page.evaluate(async ({ id, token }) => fetch(`/api/v1/quest_sessions/${id}`, { method: "DELETE", headers: { "X-CSRF-Token": token } }), { id: session.id, token });
console.log("errors:", errors.length ? errors : "none");
await browser.close();
