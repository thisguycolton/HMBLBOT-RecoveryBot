// Part of the ACID QUEST test scripts - see docs/acid_quest.md. Screenshots and generated
// files go to tmp/quest-e2e/.
import { mkdirSync as __mkdir } from "node:fs";
const __out = new URL("../../../tmp/quest-e2e/", import.meta.url).pathname;
__mkdir(__out, { recursive: true });
process.chdir(__out);
import { chromium } from "playwright-core";
const W = 1200, H = 800;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message + " " + (e.stack || "").split("\n").slice(1, 3).join(" ")));
page.on("console", (m) => m.type() === "error" && !/quill|vite-dev\/\?token|ERR_CONNECTION_REFUSED|ERR_FAILED/.test(m.text()) && errors.push("console: " + m.text()));
const ok = (c, m) => console.log(c ? "  ✓" : "  ✗ FAIL:", m);
const text = (q) => page.textContent(`[data-quest="${q}"]`);

await page.goto("http://localhost:3000/game/game");
await page.fill('[data-quest="screenName"]', "e2e-loop");
await page.click('[data-quest="loginScreen"] button');
await page.waitForSelector('[data-quest="sessionScreen"]:not([hidden])');
await page.click('[data-quest="newJourneyButton"]');
await page.waitForSelector('[data-quest="topicSets"]:not([hidden])');
await page.screenshot({ path: "l0-sets.png" });
await page.click('[data-quest="topicSetList"] button:has-text("Micah")');
await page.waitForSelector("canvas");
await page.waitForSelector('[data-quest="fork"]:not([hidden])', { timeout: 6000 });
await page.screenshot({ path: "l1-fork.png" });
const forkRows = await page.$$eval(".quest-fork-row", (rows) => rows.map((r) => r.innerText.replace(/\s+/g, " ")));
console.log("fork:", forkRows);
ok(forkRows.length >= 2, "fork lists several roads");

// pick the first plain topic road if there is one
const idx = Math.max(0, forkRows.findIndex((r) => !/Merchant|Campfire|unknown/.test(r)));
await page.keyboard.press(String(idx + 1));
await page.waitForSelector('[data-quest="modal"]:not([hidden])', { timeout: 10000 });
await page.waitForSelector(".quest-choice", { timeout: 5000 });
await page.waitForTimeout(300);
const lenses = await page.$$eval(".quest-choice", (b) => b.map((x) => x.innerText.replace(/\s+/g, " ")));
console.log("card:", await text("modalCategory"), "|", await page.textContent(".quest-topic-title"));
console.log("lenses:", lenses);
ok(lenses.length === 3, "three lenses offered");
await page.screenshot({ path: "l2-lenses.png" });
await page.keyboard.press("1");
await page.waitForSelector(".quest-lens-prompt");
await page.keyboard.press(" ");
await page.waitForTimeout(2200);
ok(/2:5/.test(await page.textContent(".quest-timer")), `timer runs: ${await page.textContent(".quest-timer")}`);
await page.screenshot({ path: "l3-share.png" });
ok(!(await page.$('button:has-text("Someone else shares")')), "no spirit lantern, so no 'someone else shares'");
await page.click('button:has-text("Continue the journey")');
await page.waitForSelector('[data-quest="fork"]:not([hidden])', { timeout: 6000 });
console.log("hud:", (await page.textContent('[data-quest="items"]')).replace(/\s+/g, " "), await text("stepCount"));
ok(/×1/.test(await page.textContent('[data-quest="items"]')), "earned a trail coin");
await page.screenshot({ path: "l4-after.png" });

// pass on the next stop
await page.keyboard.press("1");
await page.waitForSelector('[data-quest="modal"]:not([hidden])', { timeout: 10000 });
await page.waitForTimeout(800);
await page.keyboard.press("p");
await page.waitForTimeout(500);
ok(await page.isHidden('[data-quest="modal"]'), "pass closes the card");
console.log("toast:", await text("toast"));
await page.waitForSelector('[data-quest="fork"]:not([hidden])', { timeout: 6000 });
ok(/×2/.test(await page.textContent('[data-quest="items"]')), "pass still earns a coin and the road continues");

// end journey
page.once("dialog", (d) => d.accept());
await page.click('[data-quest-action="click->endJourney"]');
await page.waitForSelector('[data-quest="summary"]:not([hidden])', { timeout: 6000 });
const summary = (await text("summaryBody")).replace(/\s+/g, " ");
console.log("summary:", summary);
ok(/1\s*stories shared/.test(summary) && !/pass/i.test(summary), "summary counts the story and never mentions passing");
await page.waitForTimeout(800); await page.screenshot({ path: "l5-summary.png" });
console.log("errors:", errors.length ? errors.join("\n") : "none");
await browser.close();
