// Part of the ACID QUEST test scripts - see docs/acid_quest.md. Screenshots and generated
// files go to tmp/quest-e2e/.
import { mkdirSync as __mkdir } from "node:fs";
const __out = new URL("../../../tmp/quest-e2e/", import.meta.url).pathname;
__mkdir(__out, { recursive: true });
process.chdir(__out);
import { chromium } from "playwright-core";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors = [], draws = [];
page.on("response", async (r) => { if (r.url().includes("/quest_topics/draw")) { const u = new URL(r.url()); draws.push({ asked: u.searchParams.get("category_id"), got: (await r.json()).map((t) => t.topic_category_id) }); } });
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:3000/game/game");
await page.fill('[data-quest="screenName"]', "e2e-open");
await page.click('[data-quest="loginScreen"] button');
await page.waitForSelector('[data-quest="sessionScreen"]:not([hidden])');
await page.click('[data-quest="newJourneyButton"]');
await page.click('[data-quest="topicSetList"] button:has-text("Original")');
await page.waitForSelector('[data-quest="fork"]:not([hidden])', { timeout: 8000 });
await page.waitForTimeout(800);
console.log("fork:", await page.$$eval(".quest-fork-row", (r) => r.map((x) => x.innerText.replace(/\s+/g, " "))));
await page.screenshot({ path: process.argv[2] + "-map.png" });
const rows = await page.$$eval(".quest-fork-row", (r) => r.map((x) => x.innerText));
await page.keyboard.press(String(Math.max(0, rows.findIndex((r) => /Open road/i.test(r))) + 1));
await page.waitForSelector(".quest-choice", { timeout: 8000 });
await page.waitForTimeout(500);
console.log("header:", await page.textContent('[data-quest="modalCategory"]'), (await page.getAttribute('[data-quest="modalIcon"]', "src")).split("/").pop());
console.log("lens icons:", await page.$$eval(".quest-choice img", (i) => i.map((x) => x.getAttribute("src").split("/").pop().split("?")[0])));
await page.screenshot({ path: process.argv[2] + "-card.png" });
draws.length = 0;
for (let i = 0; i < 3; i++) { await page.click('button:has-text("Different topic")'); await page.waitForTimeout(500); }
console.log("different topic draws:", JSON.stringify(draws), draws.every((d) => d.asked === "none" && d.got.every((c) => c === null)) ? "✓ stays on the Open Road" : "✗");
const code = await page.textContent('[data-quest="joinCode"]');
await page.evaluate(async (code) => {
  const p = (await (await fetch("/api/v1/quest_players")).json()).find((p) => p.screen_name === "e2e-open");
  for (const s of await (await fetch(`/api/v1/quest_players/${p.id}/quest_sessions`)).json())
    await fetch(`/api/v1/quest_sessions/${s.id}`, { method: "DELETE", headers: { "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]').content } });
}, code);
console.log("errors:", errors.length ? errors : "none");
await browser.close();
