// Tools: every boat, pickaxe, axe, rope (and the ghost's spirit lantern) is its own item with
// a few uses. Legendary tools never wear out. The toolbar holds TOOLBAR_SLOTS of them.
//
//   { id, type, uses, max, legendary }

export const TOOL_TYPES = ["boat", "pickaxe", "axe", "rope"];
export const TOOLBAR_SLOTS = 9;
export const TOOL_NAMES = { boat: "boat", pickaxe: "pickaxe", axe: "axe", rope: "climbing rope", lantern: "spirit lantern" };
export const TOOL_A = { boat: "a boat", pickaxe: "a pickaxe", axe: "an axe", rope: "a climbing rope", lantern: "a spirit lantern" };

// No tool holds more than this many uses, even after merging duplicates
export const MAX_USES = 5;

// Durability odds: 1 use is common, 5 is rare
const USE_WEIGHTS = [[1, 35], [2, 28], [3, 20], [4, 12], [5, 5]];

let counter = 0;
const newId = () => `t${Date.now().toString(36)}${(counter++).toString(36)}`;

export function rollUses(rng = Math.random, { min = 1, max = 5 } = {}) {
  const pool = USE_WEIGHTS.filter(([n]) => n >= min && n <= max);
  let r = rng() * pool.reduce((s, [, w]) => s + w, 0);
  for (const [n, w] of pool) if ((r -= w) < 0) return n;
  return pool[pool.length - 1][0];
}

export function makeTool(type, { uses, legendary = false, rng = Math.random, min, max } = {}) {
  if (legendary) return { id: newId(), type, uses: null, max: null, legendary: true };
  const n = uses ?? rollUses(rng, { min, max });
  return { id: newId(), type, uses: n, max: n, legendary: false };
}

// Older journeys stored counts ({ boat: 2 }); turn them into tools
export function normalizeTools(state) {
  if (!Array.isArray(state.tools)) {
    state.tools = [];
    for (const type of TOOL_TYPES) {
      let n = state.inventory?.[type] || 0;
      while (n > 0) {
        const uses = Math.min(5, n);
        state.tools.push(makeTool(type, { uses }));
        n -= uses;
      }
    }
  }
  delete state.inventory;
  return state.tools;
}

// How many more obstacles of this type the group can get past (Infinity with a legendary)
export function usesLeft(tools, type) {
  let n = 0;
  for (const t of tools) {
    if (t.type !== type) continue;
    if (t.legendary) return Infinity;
    n += t.uses;
  }
  return n;
}

export const canAfford = (needs, tools) => TOOL_TYPES.every((type) => usesLeft(tools, type) >= (needs[type] || 0));

export const missingTool = (needs, tools) => TOOL_TYPES.find((type) => usesLeft(tools, type) < (needs[type] || 0));

// Use a tool of this type: a legendary if there is one, otherwise wear down the most worn
// copy first. Returns { tool, broke }.
export function useTool(tools, type) {
  const legendary = tools.find((t) => t.type === type && t.legendary);
  if (legendary) return { tool: legendary, broke: false };
  const worn = tools.filter((t) => t.type === type && t.uses > 0).sort((a, b) => a.uses - b.uses)[0];
  if (!worn) return { tool: null, broke: false };
  worn.uses -= 1;
  if (worn.uses > 0) return { tool: worn, broke: false };
  tools.splice(tools.indexOf(worn), 1);
  return { tool: worn, broke: true };
}

// Add a tool to the toolbar. Returns what happened:
//   { kept, merged, wasted, replaced, dropped }
// - a duplicate ordinary tool adds its uses to the one already carried (capped at MAX_USES;
//   anything over the cap is `wasted`)
// - a legendary replaces ordinary tools of its type; a tool the group already has a legendary
//   of is left behind (`kept` is the legendary, `wasted` its uses)
// - a new type takes a free slot; with a full toolbar the most worn ordinary tool makes room
//   (`dropped`), or the new tool is left behind if nothing is worse
export function addTool(tools, tool) {
  const same = tools.filter((t) => t.type === tool.type);
  const legendary = same.find((t) => t.legendary);
  if (legendary) return { kept: legendary, merged: false, wasted: tool.legendary ? 0 : tool.uses, alreadyLegendary: true };

  if (tool.legendary && same.length) {
    tools.splice(tools.indexOf(same[0]), 1, tool);
    same.slice(1).forEach((t) => tools.splice(tools.indexOf(t), 1));
    return { kept: tool, replaced: same };
  }

  if (!tool.legendary && same.length) {
    const target = same.sort((a, b) => a.uses - b.uses)[0];
    const total = target.uses + tool.uses;
    target.uses = Math.min(MAX_USES, total);
    target.max = Math.min(MAX_USES, Math.max(target.max, target.uses));
    return { kept: target, merged: true, wasted: Math.max(0, total - MAX_USES) };
  }

  if (tools.length < TOOLBAR_SLOTS) {
    tools.push(tool);
    return { kept: tool };
  }
  const spare = tools.filter((t) => !t.legendary).sort((a, b) => a.uses - b.uses)[0];
  if (!spare || (!tool.legendary && spare.uses >= tool.uses)) return { kept: null, dropped: tool };
  tools.splice(tools.indexOf(spare), 1, tool);
  return { kept: tool, dropped: spare };
}

export function describeTool(tool) {
  const name = TOOL_NAMES[tool.type];
  if (tool.legendary) return `Legendary ${name}`;
  return `${name[0].toUpperCase()}${name.slice(1)} · ${tool.uses} use${tool.uses === 1 ? "" : "s"}`;
}

export const toolIcon = (tool) => `tool_${tool.type}${tool.legendary ? "_legendary" : ""}`;
