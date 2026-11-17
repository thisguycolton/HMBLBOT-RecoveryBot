// Shared helpers for the Docs screenshot scripts (script/docs_demo/shoot.js).
// Needs the app running on BASE with the demo data from script/docs_demo/seed.rb.
const { chromium, devices } = require("playwright");

// recoverybot.test is mapped to the local server so screenshots never show "localhost"
const BASE = process.env.BASE || "http://recoverybot.test";
const PASSWORD = "demo-password-123";
const EMAILS = {
  sam: "demo-admin@example.com", jordan: "jordan@example.com", riley: "riley@example.com", alex: "alex@example.com",
  morgan: "morgan@example.com", casey: "casey@example.com", quinn: "quinn@example.com",
};
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const PHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

// Things that never belong in a public docs screenshot
const HIDE_CSS = `
  a[href*="court_verification"] { display: none !important; }
`;

async function launch() {
  return chromium.launch({ args: ["--host-resolver-rules=MAP recoverybot.test 127.0.0.1:3000", "--unsafely-treat-insecure-origin-as-secure=http://recoverybot.test"] });
}

const contexts = {};
async function contextFor(browser, who, phone, dark) {
  const key = `${who}-${phone ? "phone" : "desk"}-${dark ? "dark" : "light"}`;
  if (contexts[key]) return contexts[key];
  const opts = phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: PHONE_UA }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, userAgent: UA };
  const ctx = await browser.newContext({ ...opts, timezoneId: "America/Phoenix", locale: "en-US", colorScheme: dark ? "dark" : "light" });
  await ctx.addInitScript((key) => { try { localStorage.setItem(key, "1"); } catch (e) {} }, "installNudge.dismissed");
  await ctx.addInitScript((css) => {
    const add = () => { const s = document.createElement("style"); s.textContent = css; (document.head || document.documentElement).appendChild(s); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add); else add();
  }, HIDE_CSS);
  if (who && who !== "guest") {
    const p = await ctx.newPage();
    await p.goto(`${BASE}/users/sign_in`);
    await p.fill('input[type=email]', EMAILS[who]);
    await p.fill('input[type=password]', PASSWORD);
    await Promise.all([p.waitForNavigation().catch(() => {}), p.keyboard.press("Enter")]);
    await p.waitForLoadState("networkidle").catch(() => {});
    await p.close();
  }
  contexts[key] = ctx;
  return ctx;
}

async function settle(page, ms = 700) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(ms);
}

module.exports = { BASE, launch, contextFor, settle, devices };

// Selects `phrase` in the page's text, as a reader dragging over it would
async function selectText(page, phrase) {
  const ok = await page.evaluate((phrase) => {
    const w = document.createTreeWalker(document.querySelector(".stage") || document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const i = n.textContent.indexOf(phrase);
      if (i < 0) continue;
      const r = document.createRange();
      r.setStart(n, i); r.setEnd(n, i + phrase.length);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      n.parentElement.scrollIntoView({ block: "center" });
      n.parentElement.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      document.dispatchEvent(new Event("selectionchange"));
      return true;
    }
    return false;
  }, phrase);
  if (!ok) throw new Error(`Couldn't find "${phrase}" to select`);
  await page.waitForTimeout(600);
}

module.exports.selectText = selectText;
