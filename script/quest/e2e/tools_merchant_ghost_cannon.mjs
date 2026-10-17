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
page.on("pageerror", (e) => errors.push("pageerror: " + e.message + " " + (e.stack || "").split("\n").slice(1, 3).join(" ")));
page.on("console", (m) => m.type() === "error" && !/quill|vite-dev\/\?token|ERR_CONNECTION_REFUSED|ERR_FAILED/.test(m.text()) && errors.push("console: " + m.text()));
const ok = (c, m) => console.log(c ? "  ✓" : "  ✗ FAIL:", m);
const csrf = () => page.evaluate(() => document.querySelector('meta[name="csrf-token"]').content);
let session;
async function login() {
  await page.goto(BASE);
  await page.fill('[data-quest="screenName"]', "e2e-feat");
  await page.click('[data-quest="loginScreen"] button');
  await page.waitForSelector('[data-quest="sessionScreen"]:not([hidden])');
}
const getSession = () => page.evaluate(async (id) => (await (await fetch(`/api/v1/quest_sessions/${id}`)).json()), session.id);
async function load(state) {
  await page.goto(BASE); await page.waitForTimeout(300);
  await page.evaluate(async ({ id, state, token }) => fetch(`/api/v1/quest_sessions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", "X-CSRF-Token": token }, body: JSON.stringify({ game_state: state }) }), { id: session.id, state, token: await csrf() });
  await login();
  await page.click(`.quest-session-open:has-text("${session.join_code}")`);
  await page.waitForSelector("canvas");
  await page.waitForTimeout(1500);
}
const tap = async (pos, x, y, zoom = 4) => {
  await page.evaluate(() => { const f = document.querySelector('[data-quest="fork"]'); if (f) f.hidden = true; });
  await page.mouse.click(W / 2 + (x - pos.x) * 16 * zoom, H / 2 + ((y - pos.y) * 16 + 3) * zoom);
};
const modalOpen = () => page.waitForSelector('[data-quest="modal"]:not([hidden])', { timeout: 8000 }).then(() => true, () => false);
const toolsOf = async () => (await getSession()).game_state.tools || [];
// regular stops ask which way in first; take the default (curious)
async function throughDial() {
  if (!(await page.$(".quest-dial"))) return;
  await page.keyboard.press("Enter");
  await page.waitForSelector(".quest-path-title:has-text('Choose your path')", { timeout: 8000 });
}
async function finishStop() {
  await page.waitForSelector(".quest-choice, .quest-lens-prompt", { timeout: 8000 });
  await throughDial();
  for (let k = 0; k < 2 && !(await page.$(".quest-lens-prompt")); k++) { await page.keyboard.press("1"); await page.waitForTimeout(400); }
  await page.click('button:has-text("Continue the journey")');
  await page.waitForTimeout(1300);
}
const base = { version: 3, topic_set_id: 2, used_topic_ids: [], history: [], coins: 3 };

await login();
await page.click('[data-quest="newJourneyButton"]');
await page.click('[data-quest="topicSetList"] button:has-text("Micah")');
await page.waitForSelector("canvas"); await page.waitForTimeout(1200);
session = await page.evaluate(async (code) => {
  const p = (await (await fetch("/api/v1/quest_players")).json()).find((p) => p.screen_name === "e2e-feat");
  return (await (await fetch(`/api/v1/quest_players/${p.id}/quest_sessions`)).json()).find((s) => s.join_code === code);
}, await page.textContent('[data-quest="joinCode"]'));

console.log("durability, breaking, legendary");
await load({ ...base, current_position: { x: 0, y: 0 },
  tools: [{ id: "a", type: "pickaxe", uses: 2, max: 2, legendary: false }, { id: "b", type: "axe", uses: null, max: null, legendary: true }],
  grid: { "0,0": { type: "start", visited: true },
    "1,0": { type: "path" }, "2,0": { type: "boulder" }, "3,0": { type: "path" }, "4,0": { type: "topic", category_id: 1, visited: false },
    "-1,0": { type: "path" }, "-2,0": { type: "log", axis: "h" }, "-3,0": { type: "path" }, "-4,0": { type: "topic", category_id: 3, visited: false },
    "0,1": { type: "path" }, "0,2": { type: "boulder" }, "0,3": { type: "path" }, "0,4": { type: "topic", category_id: 4, visited: false } } });
ok((await page.$$(".quest-slot")).length === 9, "toolbar has 9 slots");
ok(await page.$(".quest-slot-legendary"), "legendary slot is highlighted");
await page.screenshot({ path: "f0-toolbar.png" });
await tap({ x: 0, y: 0 }, 4, 0); ok(await modalOpen(), "crossed a boulder");
await page.click('[data-quest-action="click->closeModal"]'); await page.waitForTimeout(900);
let t = await toolsOf();
ok(t.find((x) => x.type === "pickaxe")?.uses === 1, `pickaxe worn to 1 use (${JSON.stringify(t.map((x) => [x.type, x.uses]))})`);
await tap({ x: 4, y: 0 }, 0, 4); ok(await modalOpen(), "crossed a second boulder");
await page.click('[data-quest-action="click->closeModal"]'); await page.waitForTimeout(900);
t = await toolsOf();
ok(!t.some((x) => x.type === "pickaxe"), "pickaxe wore out and left the toolbar");
await tap({ x: 0, y: 4 }, -4, 0); ok(await modalOpen(), "crossed the fallen tree");
await page.click('[data-quest-action="click->closeModal"]'); await page.waitForTimeout(900);
t = await toolsOf();
ok(t.some((x) => x.type === "axe" && x.legendary), "legendary axe is still there");

console.log("merchant wares");
await load({ ...base, coins: 2, current_position: { x: 0, y: 0 }, tools: [],
  grid: { "0,0": { type: "start", visited: true }, "1,0": { type: "path" }, "2,0": { type: "path" }, "3,0": { type: "topic", kind: "merchant", visited: false } } });
await tap({ x: 0, y: 0 }, 3, 0); await modalOpen();
await page.waitForSelector(".quest-choice");
const wares = await page.$$eval(".quest-choice", (b) => b.map((x) => x.innerText.replace(/\s+/g, " ")));
console.log("   wares:", wares);
ok(wares.length === 3 && /Reward: \w/.test(wares[0]) && /A topic from/.test(wares[1]) && /mystery topic.*Reward: \?\?\?/i.test(wares[2]), "a topic, a category topic and a mystery; mystery reward hidden");
await page.screenshot({ path: "f1-merchant.png" });
await page.keyboard.press("1");
await page.waitForSelector(".quest-path-title");
ok(/earn: \w/.test(await page.textContent(".quest-reward")), `reward shown on the card: ${await page.textContent(".quest-reward")}`);
await page.screenshot({ path: "f2-topicfirst.png" });
await finishStop();
t = await toolsOf();
ok(t.length === 1, `merchant paid out: ${JSON.stringify(t.map((x) => [x.type, x.uses]))}`);

console.log("merchant mystery");
await load({ ...base, coins: 1, current_position: { x: 0, y: 0 }, tools: [],
  grid: { "0,0": { type: "start", visited: true }, "1,0": { type: "path" }, "2,0": { type: "path" }, "3,0": { type: "topic", kind: "merchant", visited: false } } });
await tap({ x: 0, y: 0 }, 3, 0); await modalOpen(); await page.waitForSelector(".quest-choice");
await page.keyboard.press("3");
await page.waitForSelector(".quest-path-title");
ok(/\?\?\?/.test(await page.textContent(".quest-reward")), "mystery reward stays hidden");
await finishStop();
t = await toolsOf();
ok(t.length === 1 && (t[0].legendary || t[0].uses >= 4), `mystery paid a legendary or a 4-5 use tool: ${JSON.stringify(t[0])}`);
console.log("   toast:", await page.textContent('[data-quest="toast"]'));

console.log("ghost and the spirit lantern");
await load({ ...base, current_position: { x: 0, y: 0 }, tools: [],
  grid: { "0,0": { type: "start", visited: true }, "1,0": { type: "path" }, "2,0": { type: "path" }, "3,0": { type: "topic", kind: "ghost", visited: false },
    "-1,0": { type: "path" }, "-2,0": { type: "path" }, "-3,0": { type: "topic", category_id: 1, visited: false } } });
await tap({ x: 0, y: 0 }, -3, 0); await modalOpen(); await page.waitForSelector(".quest-choice");
await throughDial(); await page.keyboard.press("1"); await page.waitForSelector(".quest-lens-prompt");
ok(!(await page.$('button:has-text("Someone else shares")')), "no lantern: 'someone else shares' is not offered");
await page.click('button:has-text("Continue the journey")'); await page.waitForTimeout(1300);
await tap({ x: -3, y: 0 }, 3, 0); await modalOpen();
await page.waitForSelector('button:has-text("Take the ghost")');
ok(/spirit lantern/i.test(await page.textContent('[data-quest="cardStage"]')), "ghost offers a spirit lantern");
await page.screenshot({ path: "f3-ghost.png" });
await page.click('button:has-text("Take the ghost")');
await finishStop();
t = await toolsOf();
const lantern = t.find((x) => x.type === "lantern");
ok(lantern && lantern.uses >= 1 && lantern.uses <= 3, `lantern earned: ${JSON.stringify(lantern)}`);

console.log("lantern lets someone else share");
await load({ ...base, current_position: { x: 0, y: 0 }, tools: [{ id: "l", type: "lantern", uses: 1, max: 1, legendary: false }],
  grid: { "0,0": { type: "start", visited: true }, "1,0": { type: "path" }, "2,0": { type: "path" }, "3,0": { type: "topic", category_id: 1, visited: false } } });
await tap({ x: 0, y: 0 }, 3, 0); await modalOpen(); await page.waitForSelector(".quest-choice");
await throughDial(); await page.keyboard.press("1"); await page.waitForSelector(".quest-lens-prompt");
ok(await page.$('button:has-text("Someone else shares")'), "with a lantern the button appears");
await page.screenshot({ path: "f4-share.png" });
await page.click('button:has-text("Someone else shares")'); await page.waitForTimeout(300);
ok(!(await page.$('button:has-text("Someone else shares")')), "the lantern's only use is spent");
await page.click('button:has-text("Continue the journey")'); await page.waitForTimeout(1300);
const j = await page.evaluate(async (id) => (await fetch(`/api/v1/quest_sessions/${id}/journey`)).json(), session.id);
console.log("   stories shared so far:", j.stats.stories_shared);

console.log("cannon");
await load({ ...base, current_position: { x: 2, y: 0 }, tools: [],
  grid: { "0,0": { type: "start", visited: true }, "1,0": { type: "path" }, "2,0": { type: "topic", kind: "cannon", visited: false },
    "0,-1": { type: "path" }, "0,-2": { type: "boulder" }, "0,-3": { type: "path" }, "0,-4": { type: "path" }, "0,-5": { type: "topic", category_id: 2, visited: false } } });
await tap({ x: 2, y: 0 }, 2, 0); await modalOpen();
ok(/Cannon/.test(await page.textContent('[data-quest="modalCategory"]')), "cannon card");
await page.screenshot({ path: "f5-cannon.png" });
await page.click('button:has-text("Aim the cannon")');
await page.waitForSelector('[data-quest="aim"]:not([hidden])');
await tap({ x: 2, y: 0 }, 0, -5);
ok(await modalOpen(), "flew over the boulder and landed on the stop");
await page.waitForTimeout(1000);
const s2 = await getSession();
ok(s2.game_state.current_position.y === -5 && s2.game_state.grid["0,-2"].type === "boulder" && s2.game_state.grid["2,0"].visited, "boulder untouched, cannon spent");
await page.screenshot({ path: "f6-landed.png" });
await page.click('[data-quest-action="click->closeModal"]');

await page.evaluate(async ({ id, token }) => fetch(`/api/v1/quest_sessions/${id}`, { method: "DELETE", headers: { "X-CSRF-Token": token } }), { id: session.id, token: await csrf() });
console.log("errors:", errors.length ? errors.join("\n") : "none");
await browser.close();
