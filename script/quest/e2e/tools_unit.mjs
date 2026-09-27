// Part of the ACID QUEST test scripts - see docs/acid_quest.md. Screenshots and generated
// files go to tmp/quest-e2e/.
import { mkdirSync as __mkdir } from "node:fs";
const __out = new URL("../../../tmp/quest-e2e/", import.meta.url).pathname;
__mkdir(__out, { recursive: true });
process.chdir(__out);
const { makeTool, addTool, MAX_USES } = await import(new URL("../../../app/javascript/quest/tools.js", import.meta.url).pathname);
const ok = (c, m) => console.log(c ? "  ✓" : "  ✗ FAIL:", m);
let tools = [];
addTool(tools, makeTool("pickaxe", { uses: 2 }));
let r = addTool(tools, makeTool("pickaxe", { uses: 2 }));
ok(tools.length === 1 && tools[0].uses === 4 && tools[0].max === 4 && r.merged && r.wasted === 0, `2 + 2 pickaxe -> one pickaxe with 4 uses (${JSON.stringify(tools[0])})`);
r = addTool(tools, makeTool("pickaxe", { uses: 3 }));
ok(tools.length === 1 && tools[0].uses === MAX_USES && tools[0].max === 5 && r.wasted === 2, `4 + 3 caps at 5, 2 wasted (${JSON.stringify(tools[0])})`);
addTool(tools, makeTool("boat", { uses: 1 }));
ok(tools.length === 2, "a new type takes its own slot");
r = addTool(tools, makeTool("boat", { legendary: true }));
ok(tools.length === 2 && tools.find((t) => t.type === "boat").legendary && r.replaced?.length === 1, "legendary replaces the ordinary boat");
r = addTool(tools, makeTool("boat", { uses: 3 }));
ok(tools.length === 2 && r.alreadyLegendary && tools.find((t) => t.type === "boat").legendary, "an ordinary boat is left behind when you have a legendary one");
tools = [];
addTool(tools, makeTool("lantern", { uses: 1 }));
addTool(tools, makeTool("lantern", { uses: 2 }));
ok(tools.length === 1 && tools[0].uses === 3, "lanterns merge too");
