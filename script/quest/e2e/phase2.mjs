// Part of the ACID QUEST test scripts - see docs/acid_quest.md. Screenshots and generated
// files go to tmp/quest-e2e/. Phase 2 in the browser: the choice-vs-risk dial, Courage /
// Connection / Hope, revisits and the Memory Stone, locked gates and fog.
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
const csrf = () => page.evaluate(() => document.querySelector('meta[name="csrf-token"]').content);
const NAME = "e2e-phase2";
let session;
async function login() {
  await page.goto("http://localhost:3000/game/game");
  await page.fill('[data-quest="screenName"]', NAME);
  await page.click('[data-quest="loginScreen"] button');
  await page.waitForSelector('[data-quest="sessionScreen"]:not([hidden])');
}
async function getSession(code) {
  return page.evaluate(async ({ code, NAME }) => {
    const p = (await (await fetch("/api/v1/quest_players")).json()).find((p) => p.screen_name === NAME);
    return (await (await fetch(`/api/v1/quest_players/${p.id}/quest_sessions`)).json()).find((s) => s.join_code === code);
  }, { code, NAME });
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
// let cards finish popping in before a screenshot
const shot = async (path) => { await page.waitForTimeout(350); await page.screenshot({ path }); };
const forkRows = () => page.$$eval(".quest-fork-row", (r) => r.map((x) => x.innerText.replace(/\s+/g, " ")));
const pick = async (label) => { const rows = await forkRows(); const i = rows.findIndex((r) => r.includes(label)); await page.keyboard.press(String(i + 1)); return i; };
const hud = async () => Object.fromEntries(await page.$$eval('[data-quest="items"] .quest-resource', (s) => s.map((x) => [x.title, Number(x.innerText)])));
const stage = () => page.textContent('[data-quest="cardStage"]');
const state = () => page.evaluate(async (id) => (await (await fetch(`/api/v1/quest_sessions/${id}`)).json()).game_state, session.id);
const finish = async () => { await page.click('button:has-text("Continue the journey")'); await page.waitForSelector('[data-quest="fork"]:not([hidden])'); };

await login();
await page.click('[data-quest="newJourneyButton"]');
await page.click('[data-quest="topicSetList"] button:has-text("Micah")');
await page.waitForSelector("canvas"); await page.waitForTimeout(1200);
session = await getSession(await page.textContent('[data-quest="joinCode"]'));

// Flat meadow (no seed): four topic stops around the start
const cross = (extra = {}) => ({
  "0,0": { type: "start", visited: true },
  "1,0": { type: "path" }, "2,0": { type: "path" }, "3,0": { type: "topic", kind: "topic", category_id: null, visited: false },
  "-1,0": { type: "path" }, "-2,0": { type: "path" }, "-3,0": { type: "topic", kind: "topic", category_id: null, visited: false },
  "0,1": { type: "path" }, "0,2": { type: "path" }, "0,3": { type: "topic", kind: "topic", category_id: null, visited: false },
  "0,-1": { type: "path" }, "0,-2": { type: "path" }, "0,-3": { type: "topic", kind: "topic", category_id: null, visited: false },
  ...extra,
});
const base = { version: 3, topic_set_id: 2, used_topic_ids: [], history: [], tools: [], coins: 0, current_position: { x: 0, y: 0 } };

console.log("the dial");
await load({ ...base, grid: cross() });
await page.waitForSelector('[data-quest="fork"]:not([hidden])');
ok((await hud()).Courage === 0, `HUD shows Courage / Connection / Hope: ${JSON.stringify(await hud())}`);
await page.keyboard.press("1");
await page.waitForSelector(".quest-dial", { timeout: 8000 });
const dial = await page.$$eval(".quest-dial .quest-choice strong", (b) => b.map((x) => x.innerText));
ok(dial.length === 4 && /Safe/.test(dial[0]) && /Curious/.test(dial[1]) && /Risky/.test(dial[2]) && /Chaos/.test(dial[3]), `four approaches: ${dial.join(" | ")}`);
ok(/earns Courage/.test(await stage()), "risky options say they earn Courage");
ok(await page.isVisible('.quest-card-foot button:has-text("Pass")'), "Pass is on the dial");
ok(!(await page.isVisible('button:has-text("Revisit an earlier topic")')), "no revisit before anything was shared");
await shot("p2-1-dial.png");
await page.keyboard.press("Enter");
await page.waitForSelector(".quest-path-title:has-text('Choose your path')", { timeout: 8000 });
ok(await page.isVisible('button:has-text("Different topic")'), "curious (Enter): lenses with Different topic");
const curiousTopic = await page.textContent(".quest-topic-title");
await page.keyboard.press("1"); await page.waitForSelector(".quest-lens-prompt");
const curiousLens = await page.textContent(".quest-lens-name");
await finish();
const afterCurious = await hud();
ok(!afterCurious.Courage, "a curious share earns no Courage");

console.log("safe");
await page.keyboard.press("1");
await page.waitForSelector(".quest-dial");
await page.keyboard.press("1");
await page.waitForSelector(".quest-path-title:has-text('Choose a topic')", { timeout: 8000 });
const safe = await page.$$eval(".quest-choice strong", (b) => b.map((x) => x.innerText));
ok(safe.length === 3, `three topics to choose from: ${safe.join(" | ")}`);
await shot("p2-2-safe.png");
await page.keyboard.press("2");
await page.waitForSelector(".quest-path-title:has-text('Choose your path')");
ok((await page.textContent(".quest-topic-title")) === safe[1], "picked topic is shown");
ok(await page.isVisible('button:has-text("Revisit an earlier topic")'), "revisit offered once a topic was shared");
await page.keyboard.press("P");
await page.waitForSelector('[data-quest="fork"]:not([hidden])');

console.log("risky");
await page.keyboard.press("1");
await page.waitForSelector(".quest-dial");
await page.keyboard.press("3");
await page.waitForSelector(".quest-path-title:has-text('Choose your path')", { timeout: 8000 });
ok(/The road chose this one/.test(await stage()), "risky: the road's topic, take it or pass");
ok(!(await page.isVisible('button:has-text("Different topic")')), "risky: no Different topic");
await shot("p2-3-risky.png");
await page.keyboard.press("1"); await page.waitForSelector(".quest-lens-prompt");
await finish();
ok((await hud()).Courage === 1, `risky share earns Courage: ${JSON.stringify(await hud())}`);

console.log("chaos");
await page.keyboard.press("1");
await page.waitForSelector(".quest-dial");
await page.keyboard.press("4");
await page.waitForSelector(".quest-lens-prompt", { timeout: 8000 });
ok(true, `chaos goes straight to a random lens: ${await page.textContent(".quest-lens-name")}`);
await finish();
ok((await hud()).Courage === 2, `chaos share earns Courage: ${JSON.stringify(await hud())}`);

console.log("revisit");
await load({ ...base, coins: 3, grid: cross(), history: [
  { kind: "topic", topic_id: 1, title: "A topic from earlier", subtitle: "", passed: false },
  { kind: "topic", topic_id: 2, title: "A topic we passed", subtitle: "", passed: true },
], topic_modes: { 1: ["story"] }, resources: { courage: 2, connection: 0, hope: 0 } });
await page.waitForSelector('[data-quest="fork"]:not([hidden])');
ok((await hud()).Courage === 2, "resources persist with the journey");
await page.keyboard.press("1");
await page.waitForSelector(".quest-dial");
await page.click('button:has-text("Revisit an earlier topic")');
await page.waitForSelector(".quest-path-title:has-text('Return to a topic')");
const earlier = await page.$$eval(".quest-choice", (b) => b.map((x) => x.innerText.replace(/\s+/g, " ")));
ok(earlier.length === 1 && /A topic from earlier/.test(earlier[0]) && /Story/.test(earlier[0]), `only shared topics, with the lens used: ${earlier}`);
await shot("p2-4-revisit.png");
await page.keyboard.press("1");
await page.waitForSelector(".quest-lens-prompt");
const revisitLens = await page.textContent(".quest-lens-name");
ok(revisitLens !== "Story", `revisit uses a lens not used before: ${revisitLens}`);
await finish();
ok((await hud()).Hope >= 1, `revisit earns Hope: ${JSON.stringify(await hud())}`);

console.log("memory stone");
await load({ ...base, grid: cross({ "3,0": { type: "topic", kind: "memory", visited: false } }), history: [
  { kind: "topic", topic_id: 1, title: "A topic from earlier", subtitle: "", passed: false },
], topic_modes: { 1: ["story"] } });
await page.waitForSelector('[data-quest="fork"]:not([hidden])');
ok((await forkRows()).some((r) => /Memory Stone/.test(r)), "fork names the Memory Stone");
await shot("p2-5-memory-map.png");
await pick("Memory Stone");
await page.waitForSelector(".quest-path-title:has-text('Return to a topic')", { timeout: 8000 });
ok(/remembers the road/.test(await stage()), "memory stone flavor");
await shot("p2-6-memory-card.png");
await page.keyboard.press("P");
await page.waitForSelector('[data-quest="fork"]:not([hidden])');

console.log("locked gate");
await load({ ...base, grid: {
  "0,0": { type: "start", visited: true },
  "1,0": { type: "path", axis: "h" }, "2,0": { type: "gate", axis: "h" }, "3,0": { type: "path", axis: "h" }, "4,0": { type: "topic", kind: "ghost", visited: false },
  "0,1": { type: "path", axis: "v" }, "0,2": { type: "gate", axis: "v" }, "0,3": { type: "path", axis: "v" }, "0,4": { type: "topic", kind: "topic", category_id: null, visited: false },
  "-1,0": { type: "path" }, "-2,0": { type: "path" }, "-3,0": { type: "topic", kind: "campfire", visited: false },
} });
await page.waitForSelector('[data-quest="fork"]:not([hidden])');
const gateRows = await forkRows();
ok(gateRows.filter((r) => /locked gate/.test(r)).length === 2, `fork warns about locked gates: ${gateRows.join(" | ")}`);
await shot("p2-7-gates-map.png");
await pick("ghost");
await page.waitForSelector("text=Ask the room: open it", { timeout: 5000 });
ok(true, "choosing a gated road asks the room");
await shot("p2-8-gate-vote.png");
await page.keyboard.press("2");
await page.waitForSelector('[data-quest="fork"]:not([hidden])');
let st = await state();
ok(st.grid["2,0"].type === "gate" && st.current_position.x === 0, "declining keeps the gate shut and the group in place");
await pick("ghost");
await page.waitForSelector("text=Ask the room: open it");
await page.keyboard.press("1");
await page.waitForSelector('[data-quest="modalCategory"]:has-text("ghost")', { timeout: 8000 });
await page.waitForTimeout(600);
st = await state();
ok(st.grid["2,0"].type === "gate_open" && st.current_position.x === 4, "opening walks through to the stop");
ok(st.grid["0,2"].type === "gate", "the other gate stays locked");
await shot("p2-9-through-gate.png");

console.log("fog");
// seed 777: the road west of (-7, 23) runs into a fog bank
await load({ ...base, seed: 777, current_position: { x: -14, y: 23 }, grid: {
  "0,0": { type: "start", visited: true },
  "-14,23": { type: "topic", kind: "topic", visited: true },
  ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`${-13 + i},23`, { type: "path", axis: "h" }])),
  "-5,23": { type: "topic", kind: "ghost", visited: false },
  "-14,24": { type: "path", axis: "v" }, "-14,25": { type: "path", axis: "v" }, "-14,26": { type: "topic", kind: "campfire", visited: false },
} });
await page.waitForSelector('[data-quest="fork"]:not([hidden])');
const fogRows = await forkRows();
ok(fogRows.some((r) => /\?\?\?.*Hidden in the fog/.test(r)), `fork shows the fogged stop as ???: ${fogRows.join(" | ")}`);
ok(!fogRows.some((r) => /ghost/i.test(r)), "the fog hides what the stop is");
await shot("p2-10-fog.png");
await pick("???");
await page.waitForSelector('[data-quest="modalCategory"]:has-text("ghost")', { timeout: 8000 });
ok(true, "reaching it reveals the ghost");
await page.click('button:has-text("Not today")');
await page.waitForSelector('[data-quest="fork"]:not([hidden])');
await shot("p2-11-fog-lifted.png");

console.log("quest complete");
page.once("dialog", (d) => d.accept());
await page.click('button:has-text("End journey")');
await page.waitForSelector('[data-quest="summary"]:not([hidden])', { timeout: 8000 });
const summary = await page.textContent('[data-quest="summaryBody"]');
ok(/What the group gathered/.test(summary) && /Courage \d/.test(summary) && /Hope \d/.test(summary), "Quest Complete shows Courage / Connection / Hope");
ok(!/pass/i.test(summary), "no passes anywhere on the summary");
await shot("p2-12-complete.png");

console.log("journey log");
await page.click('button:has-text("Back to journeys")');
await page.waitForSelector('[data-quest="sessionScreen"]:not([hidden])');
await page.click(`button[aria-label="Journey log for ${session.join_code}"]`);
await page.waitForSelector("text=The road, step by step", { timeout: 8000 });
const log = await page.$$eval(".quest-timeline li", (l) => l.map((x) => x.innerText));
ok(log.some((l) => /^Walked \d/.test(l)), `log has walks: ${log.slice(0, 4).join(" | ")}`);
ok(log.some((l) => /took the risk|chaos/.test(l)), "log shows the risks the room took");
ok(log.some((l) => /opened a locked gate/.test(l)) && log.some((l) => /another road at a locked gate/.test(l)), "log shows the gate votes");
ok(!log.some((l) => /pass/i.test(l)), "no passes in the log");
await shot("p2-15-journey-log.png");
await page.click('button:has-text("Back to journeys")');

console.log("mobile");
await page.setViewportSize({ width: 390, height: 780 });
await load({ ...base, grid: cross(), resources: { courage: 3, connection: 1, hope: 2 } });
await page.waitForSelector('[data-quest="fork"]:not([hidden])');
await shot("p2-13-mobile-hud.png");
await page.keyboard.press("1");
await page.waitForSelector(".quest-dial");
await shot("p2-14-mobile-dial.png");

console.log("errors:", errors.length ? errors : "none");
await browser.close();
