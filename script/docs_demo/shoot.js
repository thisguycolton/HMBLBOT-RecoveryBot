// Takes the Docs screenshots from the demo data (script/docs_demo/seed.rb) and saves them as WebP in
// public/docs-images/<section>/<name>.webp, where the Docs pages' Markdown points.
//
//   node script/docs_demo/shoot.js            every shot in shots.js
//   node script/docs_demo/shoot.js chat chips  only shots whose name contains one of these words
//
// Needs the app running on port 3000 (RAILS_DEVELOPMENT_HOSTS=recoverybot.test) and ImageMagick.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { BASE, launch, contextFor, settle } = require("./lib");
const SHOTS = require("./shots");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "public/docs-images");
const TMP = process.env.TMP_SHOTS || "/tmp/docs-shots";

// Takes out bits that must never be in the public docs (court verification) without changing layout
async function scrub(page) {
  await page.evaluate(() => {
    document.querySelectorAll("h1,h2,h3,h4,p,span,div,a,button").forEach((el) => {
      const text = (el.textContent || "").trim();
      if (text.length > 40 || !/court verification/i.test(text)) return;
      {
        // the heading's own block (a page section) or the link itself
        const box = el.closest("a") || (el.closest("section")?.textContent.length < 400 ? el.closest("section") : el);
        box.style.display = "none";
      }
    });
  });
}

// The area to keep: "window" (everything), "stage" (the page without the sidebar), or a region
// starting at `from` (a locator) inside the stage, `height` tall
async function region(page, shot) {
  const vp = page.viewportSize();
  if (shot.clip === "window" && shot.height) return { x: 0, y: 0, width: vp.width, height: shot.height };
  if (shot.clip === "window" || (!shot.clip && shot.phone)) return null;
  const stage = await page.locator(shot.within || ".stage").first().boundingBox().catch(() => null);
  const scrollY = await page.evaluate(() => window.scrollY);
  let x = stage ? stage.x : 0, w = stage ? stage.width : vp.width;
  if (shot.inset) { x += shot.inset; w -= shot.inset * 2; }
  let y = stage ? stage.y + scrollY : 0;
  if (shot.card) {
    // the rounded card (or panel) the `card` locator sits in, with a margin around it
    const el = page.locator(shot.card).first();
    await el.scrollIntoViewIfNeeded();
    const box = await el.evaluate((node, minWidth) => {
      let n = node;
      while (n && n !== document.body) {
        const cs = getComputedStyle(n);
        const r = n.getBoundingClientRect();
        if (r.width >= minWidth && parseFloat(cs.borderTopLeftRadius) >= 10 && (cs.borderTopWidth !== "0px" || cs.boxShadow !== "none" || cs.backgroundColor !== "rgba(0, 0, 0, 0)")) break;
        n = n.parentElement;
      }
      const r = (n || node).getBoundingClientRect();
      return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height };
    }, shot.minWidth || 300);
    const pad = shot.pad ?? 14;
    return { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + 2 * pad, height: (shot.height || box.height) + 2 * pad };
  }
  if (shot.from) {
    const el = page.locator(shot.from).first();
    const box = await el.boundingBox();
    y = box.y + scrollY - (shot.pad ?? 24);
    if (shot.fit) { x = box.x - (shot.pad ?? 24); w = box.width + 2 * (shot.pad ?? 24); }
  }
  const h = shot.height || (shot.fit && shot.from ? null : vp.height - (y - scrollY));
  let height = h;
  if (!height) {
    const box = await page.locator(shot.from).first().boundingBox();
    height = box.height + 2 * (shot.pad ?? 24);
  }
  return { x: Math.max(0, x), y: Math.max(0, y), width: w, height };
}

(async () => {
  const only = process.argv.slice(2);
  // Tokens and ids the demo data got (POLL, EVENT, DOC, WORK in shots.js addresses)
  const ids = JSON.parse(execFileSync("bin/rails", ["runner", `puts({
    POLL: Poll.order(:id).first&.token, EVENT: Event.order(:id).first&.token,
    DOC: GroupDocument.find_by(title: "Thursday meeting format")&.id, WORK: User.find_by(email: "demo-admin@example.com")&.step_works&.first&.id,
  }.to_json)`], { cwd: ROOT, encoding: "utf8" }).trim().split("\n").pop());
  const list = SHOTS.map((s) => ({ ...s, url: s.url.replace(/\b(POLL|EVENT|DOC|WORK)\b/, (k) => ids[k]) })).filter((s) => !only.length || only.some((o) => s.name.includes(o)));
  fs.mkdirSync(TMP, { recursive: true });
  const browser = await launch();
  let failed = 0;
  for (const shot of list) {
    const ctx = await contextFor(browser, shot.who || "sam", !!shot.phone, !!shot.dark);
    const page = await ctx.newPage();
    try {
      await page.goto((shot.base || BASE) + shot.url);
      await settle(page, shot.wait || 900);
      if (shot.prep) { await shot.prep(page); await settle(page, 500); }
      await scrub(page);
      const clip = await region(page, shot);
      const png = path.join(TMP, `${shot.name.replace(/\//g, "__")}.png`);
      await page.screenshot({ path: png, clip: clip || undefined, fullPage: !!clip || !!shot.full });
      const out = path.join(OUT, `${shot.name}.webp`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      execFileSync("convert", [png, "-quality", "82", "-define", "webp:method=6", out]);
      if (shot.after) await shot.after(page);
      console.log("ok  ", shot.name, Math.round(fs.statSync(out).size / 1024) + "KB");
    } catch (e) {
      failed += 1;
      console.log("FAIL", shot.name, e.message.split("\n")[0]);
    }
    await page.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
