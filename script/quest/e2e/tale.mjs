// Part of the ACID QUEST test scripts - see docs/acid_quest.md. Screenshots and generated
// files go to tmp/quest-e2e/. "Tell our tale" on a completed journey's log.
//
// Without an AI configured on the server, the section must stay hidden. With one, it must show
// the five styles; LIVE=1 also writes a real tale (spending free quota) and deletes it again.
//   BASE=http://localhost:3001 LIVE=1 node tale.mjs   (e.g. a second server on Ollama:
//   QUEST_AI_STORY_CHAIN=ollama:<model> bin/rails s -p 3001)
import { mkdirSync as __mkdir } from "node:fs";
const __out = new URL("../../../tmp/quest-e2e/", import.meta.url).pathname;
__mkdir(__out, { recursive: true });
process.chdir(__out);
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
const ROOT = new URL("../../../", import.meta.url).pathname;
const BASE = process.env.BASE || "http://localhost:3000";
const NAME = "e2e-phase2"; // phase2.mjs leaves a completed journey for this player

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && !/quill|vite-dev\/\?token|ERR_CONNECTION_REFUSED|ERR_FAILED/.test(m.text()) && errors.push("console: " + m.text()));
const ok = (c, m) => console.log(c ? "  ✓" : "  ✗ FAIL:", m);

await page.goto(`${BASE}/game/game`);
await page.fill('[data-quest="screenName"]', NAME);
await page.click('[data-quest="loginScreen"] button');
await page.waitForSelector('[data-quest="sessionScreen"]:not([hidden])');
await page.waitForSelector(".quest-session", { timeout: 8000 }).catch(() => {});
const logButton = page.locator(".quest-session-log:not([hidden])").first();
if (!(await logButton.count())) {
  console.log("  ✗ FAIL: no completed journey for e2e-phase2 - run phase2.mjs first");
  process.exit(1);
}
const sessionId = await page.evaluate(async (name) => {
  const p = (await (await fetch("/api/v1/quest_players")).json()).find((x) => x.screen_name === name);
  return (await (await fetch(`/api/v1/quest_players/${p.id}/quest_sessions`)).json()).find((s) => s.status === "completed").id;
}, NAME);
const config = await page.evaluate(async (id) => (await fetch(`/api/v1/quest_sessions/${id}/stories`)).json(), sessionId);
await logButton.click();
await page.waitForSelector("text=The road, step by step");
await page.waitForTimeout(800);

if (!config.enabled) {
  console.log("storyteller not configured");
  ok(!(await page.isVisible(".quest-tale")), "no AI configured: 'Tell our tale' stays hidden");
} else {
  console.log("storyteller configured");
  await page.waitForSelector(".quest-tale:not([hidden])");
  ok(/No names, nothing anyone said/.test(await page.textContent(".quest-tale")), "says what the tale is made from");
  const styles = await page.$$eval(".quest-tale-styles button", (b) => b.map((x) => x.innerText));
  ok(styles.length === 5, `five styles: ${styles.join(", ")}`);
  const before = config.remaining;
  if (!process.env.LIVE) {
    ok(true, "set LIVE=1 to also write a real tale (uses free AI quota)");
    console.log("errors:", errors.length ? errors : "none");
    await browser.close();
    process.exit(0);
  }
  await page.click('.quest-tale-styles button:has-text("Fantasy quest")');
  ok(/gathers the threads/.test(await page.textContent(".quest-tale-status")), "shows the storyteller at work");
  await page.waitForSelector(".quest-tale-story", { timeout: 240000 });
  const title = await page.textContent(".quest-tale-title");
  const body = await page.textContent(".quest-tale-body");
  ok(body.split(/\s+/).length > 120, `a tale arrives: "${title}" (${body.split(/\s+/).length} words)`);
  ok(/fiction/i.test(await page.textContent(".quest-tale-style")), "labelled as fiction");
  ok(new RegExp(`${before - 1} tales? left`).test(await page.textContent(".quest-tale-status")), "counts down the tales left");
  await page.locator(".quest-tale-story").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "tale-1.png" });
  console.log("\n--- tale ---\n" + title + "\n\n" + body.slice(0, 1500) + "\n------------");
  execFileSync("bin/rails", ["runner", `QuestStory.where(quest_session_id: ${sessionId}).where("created_at > ?", 10.minutes.ago).delete_all`],
    { cwd: ROOT, env: { ...process.env, SENTRY_DSN: "" }, stdio: "ignore" });
  ok(true, "test tale deleted");
}

console.log("errors:", errors.length ? errors : "none");
await browser.close();
