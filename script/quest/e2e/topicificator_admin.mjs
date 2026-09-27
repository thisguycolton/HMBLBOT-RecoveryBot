// Part of the ACID QUEST test scripts - see docs/acid_quest.md. Screenshots and generated
// files go to tmp/quest-e2e/. The Topicificator admin (React, admins only): topics with
// difficulty, tags and per-topic ways to share, topic sets, categories - and that the game's
// draw API only ever sees approved wording.
//
// Needs a local admin: quest-e2e-admin@example.test / quest-e2e-admin-pw (see docs). Everything
// it creates (a topic, a set, a category, a tag) is deleted again at the end.
import { mkdirSync as __mkdir } from "node:fs";
const __out = new URL("../../../tmp/quest-e2e/", import.meta.url).pathname;
__mkdir(__out, { recursive: true });
process.chdir(__out);
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
const ROOT = new URL("../../../", import.meta.url).pathname;
// Remove anything a run (or an earlier crashed run) left behind: test topics and tags
const sweep = () => execFileSync("bin/rails", ["runner",
  "Topic.where(\"title LIKE 'E2E % Letting go'\").find_each { |t| t.destroy unless QuestLogEntry.exists?(topic_id: t.id) }; Tag.where(\"title LIKE 'E2E % tag'\").destroy_all; TopicSet.where(\"name LIKE 'E2E % set'\").destroy_all; TopicCategory.where(\"title LIKE 'E2E % category'\").destroy_all"],
  { cwd: ROOT, env: { ...process.env, SENTRY_DSN: "" }, stdio: "ignore" });
sweep();
const APP = "http://localhost:3000/admin_panel/topicificator";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
// ignored: the sign-in page's old layout (Quill CSS), and the test's own "is it deleted?" 404
page.on("console", (m) => m.type() === "error" && !page.url().includes("/users/sign_in") && !/\/api\/admin\/topics\/\d+$/.test(m.location()?.url || "") && !/vite-dev|ERR_CONNECTION_REFUSED|ERR_FAILED|favicon|Download the React DevTools/.test(m.text()) && errors.push(`console (${page.url().replace("http://localhost:3000", "")}): ${m.text()} ${m.location()?.url || ""}`));
const ok = (c, m) => console.log(c ? "  ✓" : "  ✗ FAIL:", m);
const shot = async (path) => { await page.waitForTimeout(300); await page.screenshot({ path, fullPage: false }); };
const flash = () => page.textContent('[role="status"]').catch(() => "");
const STAMP = `E2E ${Date.now() % 100000}`;

console.log("access");
await page.goto(APP);
ok(!page.url().startsWith(APP), `signed out: sent away (${page.url().replace("http://localhost:3000", "")})`);
await page.goto("http://localhost:3000/users/sign_in");
await page.fill('input[name="user[email]"]', "quest-e2e-admin@example.test");
await page.fill('input[name="user[password]"]', "quest-e2e-admin-pw");
await Promise.all([page.waitForNavigation(), page.click('input[type="submit"], button[type="submit"]')]);
await page.goto(APP);
await page.waitForSelector("text=Topicificator admin");
await page.waitForSelector("button[aria-current], main button:has-text('·')", { timeout: 10000 }).catch(() => {});
await page.waitForFunction(() => /\d+ topics?/.test(document.body.innerText));
const total = Number((await page.innerText("body")).match(/(\d+) topics?\b/)[1]);
ok(total > 100, `topic list loads: ${total} topics`);
await shot("ta-1-topics.png");

console.log("filters");
await page.fill('input[aria-label="Search topics"]', "gratitude");
await page.waitForFunction((t) => { const m = document.body.innerText.match(/(\d+) topics?\b/); return m && Number(m[1]) < t; }, total);
ok(/q=gratitude/.test(page.url()), "search is kept in the URL");
await page.fill('input[aria-label="Search topics"]', "");
await page.waitForFunction((t) => { const m = document.body.innerText.match(/(\d+) topics?\b/); return m && Number(m[1]) === t; }, total);

console.log("new topic");
await page.click('button:has-text("New")');
await page.waitForSelector("text=New topic");
await page.locator('label:has-text("Title") input').first().fill(`${STAMP} Letting go`);
await page.locator('label:has-text("Number") input').fill("9999");
await page.click('button:has-text("Create topic")');
await page.waitForSelector("h2:text-is(\"Ways to share\")", { timeout: 8000 });
const topicId = Number(page.url().match(/topics\/(\d+)/)[1]);
ok(topicId > 0 && /Topic created/.test(await flash()), `created topic ${topicId}`);

console.log("difficulty and tags");
await page.click('button[aria-pressed]:has-text("Deep")');
await page.fill('input[aria-label="Add a tag"]', `${STAMP} tag`);
await page.keyboard.press("Enter");
ok(await page.isVisible(`text=${STAMP} tag (new)`), "a new tag shows as new before saving");
ok(await page.isVisible("text=Unsaved changes"), "unsaved changes are flagged");
await page.click('button:has-text("Save")');
await page.waitForFunction(() => /Topic saved/.test(document.body.innerText));
ok(!(await page.isVisible("text=Unsaved changes")), "saved");
await shot("ta-2-editor.png");

console.log("ways to share");
const row = (name) => page.locator(`button[aria-expanded]:has(span:text-is("${name}"))`);
await row("Story").click();
await page.fill('textarea[aria-label="Wording for Story"]', "Tell us about a time you had to let something go.");
await page.click('button:has-text("Approve")');
await page.waitForFunction(() => /Custom/.test(document.body.innerText));
ok(true, "Story: custom wording approved");
await row("Funny Story").click();
await page.click('button:has-text("Off for this topic")');
await page.waitForFunction(() => document.body.innerText.includes("Off"));
ok(true, "Funny Story: switched off for this topic");
await row("Lesson").click();
await page.fill('textarea[aria-label="Wording for Lesson"]', "What did letting go teach you?");
await page.click('button:has-text("Save draft")');
await page.waitForFunction(() => /1 draft waiting for review/.test(document.body.innerText));
ok(true, "Lesson: saved as a draft");
await shot("ta-3-ways-to-share.png");

const game = await page.evaluate(async (id) => (await fetch(`/api/v1/quest_topics/${id}`)).json(), topicId);
const byKey = Object.fromEntries(game.prompts.map((p) => [p.key, p]));
ok(game.difficulty === "deep", "the game sees the difficulty");
ok(byKey.story?.text === "Tell us about a time you had to let something go.", "the game gets the approved wording");
ok(byKey.funny_story?.enabled === false, "the game knows Funny Story is off");
ok(!byKey.lesson, "drafts never reach the game");

console.log("list reflects curation");
await page.goto(`${APP}/?difficulty=deep&prompts=draft`);
await page.waitForSelector(`text=${STAMP} Letting go`, { timeout: 8000 });
ok(true, "filters find it by difficulty and drafts");
const rowText = await page.locator(`button:has-text("${STAMP} Letting go")`).innerText();
ok(/deep/.test(rowText) && /1 draft/.test(rowText) && /1 tag/.test(rowText) && /1 custom/.test(rowText) && /1 off/.test(rowText), `row shows badges: ${rowText.replace(/\s+/g, " ")}`);

console.log("topic sets");
await page.click('nav a:has-text("Topic sets")');
await page.waitForSelector('button:has-text("New topic set")');
await shot("ta-4-sets.png");
await page.click('button:has-text("New topic set")');
await page.locator('label:has-text("Name") input').fill(`${STAMP} set`);
await page.click('button[type="submit"]:has-text("Save")');
await page.waitForSelector(`text=${STAMP} set`);
ok(/Topic set created/.test(await flash()), "set created");
page.once("dialog", (d) => d.accept());
await page.click(`button[aria-label="Delete ${STAMP} set"]`);
await page.waitForFunction((s) => !document.body.innerText.includes(`${s} set`), STAMP);
ok(true, "set deleted");

console.log("categories");
await page.click('nav a:has-text("Categories")');
await page.waitForSelector('button:has-text("New category")');
await shot("ta-5-categories.png");
ok(await page.isVisible('span[title="compass"]') && await page.isVisible('span[title="heart"]'), "existing categories show their Lucide icons");
await page.click('button:has-text("New category")');
await page.locator('label:has-text("Title") input').fill(`${STAMP} category`);
const suggested = await page.$$eval('[role="radiogroup"] [role="radio"]', (b) => b.length);
ok(suggested > 40, `icon picker shows suggestions: ${suggested}`);
await page.fill('input[aria-label^="Search icons"]', "coffee");
await page.waitForSelector('[role="radio"][aria-label="coffee"] svg', { timeout: 8000 });
ok((await page.$$eval('[role="radiogroup"] [role="radio"]', (b) => b.length)) < suggested, "search narrows the icons");
await page.click('[role="radio"][aria-label="coffee"]');
ok((await page.getAttribute('[role="radio"][aria-label="coffee"]', "aria-checked")) === "true", "picked icon is selected");
await shot("ta-8-icon-picker.png");
await page.click('button[type="submit"]:has-text("Save")');
await page.waitForSelector(`text=${STAMP} category`);
ok(/Category created/.test(await flash()), "category created");
ok(await page.isVisible('span[title="coffee"] svg'), "the new category shows its icon");
const saved = await page.evaluate(async (t) => (await (await fetch("/topic_categories.json")).json()).find((c) => c.title === t), `${STAMP} category`);
ok(saved?.icon_name === "coffee", "icon_name saved and in /topic_categories.json");
await shot("ta-9-categories-icons.png");
page.once("dialog", (d) => d.accept());
await page.click(`button[aria-label="Delete ${STAMP} category"]`);
await page.waitForFunction((s) => !document.body.innerText.includes(`${s} category`), STAMP);
ok(true, "category deleted");

console.log("old pages send admins here");
await page.goto("http://localhost:3000/topic_sets");
ok(page.url().startsWith(`${APP}/sets`), `/topic_sets -> ${page.url().replace("http://localhost:3000", "")}`);
await page.goto(`http://localhost:3000/topics/${topicId}/edit`);
await page.waitForSelector("h2:text-is(\"Ways to share\")");
ok(page.url().endsWith(`/topics/${topicId}`), "/topics/:id/edit opens the React editor");

console.log("mobile and dark");
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => localStorage.setItem("theme", "dark"));
await page.reload();
await page.waitForSelector("h2:text-is(\"Ways to share\")");
await shot("ta-6-mobile-dark-editor.png");
await page.click('button:has-text("Back")');
await page.waitForFunction(() => /\d+ topics?\b/.test(document.body.innerText));
await shot("ta-7-mobile-dark-list.png");
await page.evaluate(() => localStorage.removeItem("theme"));
await page.setViewportSize({ width: 1280, height: 900 });

console.log("clean up");
await page.goto(`${APP}/topics/${topicId}`);
await page.waitForSelector("h2:text-is(\"Ways to share\")");
page.once("dialog", (d) => d.accept());
await page.click('button:has-text("Delete")');
await page.waitForFunction(() => /Topic deleted/.test(document.body.innerText));
const gone = await page.evaluate(async (id) => (await fetch(`/api/admin/topics/${id}`)).status, topicId);
ok(gone === 404, "test topic deleted");

console.log("errors:", errors.length ? errors : "none");
await browser.close();
sweep();
console.log("left behind: none (swept)");
