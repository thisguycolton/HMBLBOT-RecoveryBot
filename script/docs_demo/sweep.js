// Quick look at pages: node script/docs_demo/sweep.js [phone:][who@]/path ...  -> scratch PNGs
const { BASE, launch, contextFor, settle } = require("./lib");
const OUT = process.env.OUT || "/tmp/claude-0/shots";
(async () => {
  const b = await launch();
  for (let arg of process.argv.slice(2)) {
    let phone = false, who = "sam";
    if (arg.startsWith("phone:")) { phone = true; arg = arg.slice(6); }
    const m = arg.match(/^(\w+)@(.*)$/); if (m) { who = m[1]; arg = m[2]; }
    const ctx = await contextFor(b, who, phone);
    const p = await ctx.newPage();
    try {
      await p.goto(BASE + arg); await settle(p, 1200);
      const f = `${OUT}/s${phone ? "p" : ""}${arg.replace(/\W+/g, "_")}.png`;
      await p.screenshot({ path: f, fullPage: !!process.env.FULL });
      const heads = await p.$$eval("h1,h2", (hs) => hs.slice(0, 8).map((h) => h.textContent.trim().slice(0, 40)));
      console.log(arg, "->", p.url().replace(BASE, ""), "|", heads.join(" / "), "\n   ", f);
    } catch (e) { console.log(arg, "ERR", e.message.split("\n")[0]); }
    await p.close();
  }
  await b.close();
})();
