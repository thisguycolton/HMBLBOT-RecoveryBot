// Part of the ACID QUEST test scripts - see docs/acid_quest.md. A long random journey on a
// real generated world (not part of run_all.sh; it takes a few minutes). Reports how often
// gates, fog and Memory Stones came up, the HUD at the end, and any page errors.
// Usage: node soak.mjs [steps=220]
import { mkdirSync as __mkdir } from "node:fs";
const __out = new URL("../../../tmp/quest-e2e/", import.meta.url).pathname;
__mkdir(__out, { recursive: true });
process.chdir(__out);
import { chromium } from "playwright-core";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !/quill|vite-dev|ERR_/.test(m.text()) && errors.push(m.text()));
await page.goto("http://localhost:3000/game/game");
await page.fill('[data-quest="screenName"]', "e2e-soak"); await page.click('[data-quest="loginScreen"] button');
await page.waitForSelector('[data-quest="sessionScreen"]:not([hidden])');
await page.click('[data-quest="newJourneyButton"]'); await page.click('[data-quest="topicSetList"] button:has-text("Original")');
await page.waitForSelector("canvas"); await page.waitForTimeout(1500);
const seen = { gate: 0, fog: 0, memory: 0, dial: 0, votes: 0 }; const kinds = {};
const vis = (q) => page.isVisible(q);
for (let step = 0; step < Number(process.argv[2] || 220); step++) {
  if (await vis('[data-quest="help"]:not([hidden])')) { await page.click('[data-quest="helpOptions"] button'); await page.waitForTimeout(800); }
  else if (await vis('[data-quest="fork"]:not([hidden])')) {
    const rows = await page.$$eval(".quest-fork-row", (r) => r.map((x) => x.innerText.replace(/\s+/g, " ")));
    rows.forEach((r) => { if (/locked gate/.test(r)) seen.gate++; if (/\?\?\?/.test(r)) seen.fog++; if (/Memory Stone/.test(r)) seen.memory++; });
    const pref = rows.findIndex((r) => /locked gate|\?\?\?|Memory/.test(r) && !/needs/.test(r));
    const free = rows.findIndex((r) => !/needs/.test(r));
    await page.keyboard.press(String((pref >= 0 ? pref : Math.max(0, free)) + 1)); await page.waitForTimeout(400);
  } else if (await vis('[data-quest="modal"]:not([hidden])')) {
    const cat = await page.textContent('[data-quest="modalCategory"]');
    if (/locked gate/i.test(cat)) { seen.votes++; await page.keyboard.press("1"); }
    else if (await page.$('button:has-text("Aim the cannon")')) await page.click('button:has-text("Walk on")');
    else if (await page.$(".quest-dial")) { seen.dial++; kinds[cat] = 1; await page.keyboard.press(String(1 + Math.floor(Math.random() * 4))); }
    else if (await page.$(".quest-lens-prompt")) await page.click('button:has-text("Continue the journey")');
    else if (await page.$('button:has-text("Take the ghost")')) await page.click('button:has-text("Take the ghost")');
    else if (await page.$(".quest-choice")) { kinds[cat] = 1; await page.keyboard.press("1"); }
    else await page.keyboard.press("p");
    await page.waitForTimeout(700);
  } else await page.waitForTimeout(1500);
}
const st = await page.evaluate(() => document.querySelector('[data-quest="items"]').innerText.replace(/\s+/g, " "));
console.log("seen:", JSON.stringify(seen), "| hud:", st, "| stops:", await page.textContent('[data-quest="stepCount"]'));
console.log("cards:", Object.keys(kinds).join(" / "));
await page.screenshot({ path: "soak-end.png" });
console.log("errors:", errors.length ? errors : "none");
await browser.close();
