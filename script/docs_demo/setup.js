// Makes the demo data that's easiest to make through the app itself (highlights in the reader).
// Run once after seed.rb: node script/docs_demo/setup.js
const { BASE, launch, contextFor, settle, selectText } = require("./lib");
const CHAPTER = "/books/the-big-book-of-alcoholics-anonymous/chapters/";

const HIGHLIGHTS = [
  ["sam", "chapter-5-how-it-works", "Those who do not recover are people who cannot or will not completely give themselves to this simple program", "yellow"],
  ["sam", "chapter-5-how-it-works", "Half measures availed us nothing", "cyan"],
  ["sam", "chapter-6-into-action", "We will not regret the past nor wish to shut the door on it", "lime"],
  ["riley", "chapter-6-into-action", "We will not regret the past nor wish to shut the door on it", "pink"],
];

(async () => {
  const b = await launch();
  for (const [who, chapter, phrase, color] of HIGHLIGHTS) {
    const ctx = await contextFor(b, who, false);
    const p = await ctx.newPage();
    await p.goto(BASE + CHAPTER + chapter); await settle(p, 1200);
    try {
      await selectText(p, phrase);
      await p.getByRole("button", { name: `Highlight ${color}` }).first().click();
      await settle(p, 800);
      console.log("ok  ", who, phrase.slice(0, 40));
    } catch (e) { console.log("FAIL", who, phrase.slice(0, 40), e.message.split("\n")[0]); }
    await p.close();
  }
  await b.close();
})();
