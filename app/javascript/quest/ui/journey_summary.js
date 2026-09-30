import { h } from "./topic_flow";
import { RESOURCES } from "../resources";
import { ENCOUNTERS } from "../encounters";
import { describeTool } from "../tools";

// QUEST COMPLETE: journey statistics (never scores) and the topics the group explored.
// Passes are intentionally absent.
// tale (optional): { load() -> { enabled, styles, remaining, stories }, create(style) -> story }
export function renderSummary(el, summary, { modeNames, iconUrl, onCopy, onClose, tale }) {
  const s = summary.stats;
  const found = { courage: s.courage_found, connection: s.connections_made, hope: s.hope_found };
  const stat = (value, label) => h("div", { class: "quest-stat" }, h("strong", {}, String(value)), h("span", {}, label));
  el.replaceChildren(...[
    h("p", { class: "quest-complete-title" }, "\u{1F3C6} Quest complete"),
    h("div", { class: "quest-stats" },
      stat(s.miles_traveled, "miles traveled"),
      stat(s.stories_shared, "stories shared"),
      stat(s.topics_explored, "topics explored"),
      stat(s.encounters, "encounters"),
    ),
    h("p", { class: "quest-path-title" }, "What the group gathered"),
    h("div", { class: "quest-resources quest-resources-summary" }, ...RESOURCES.map((r) =>
      h("span", { class: "quest-resource", title: r.name },
        h("img", { src: iconUrl(r.icon), alt: "" }), `${r.name} ${found[r.key] || 0}`))),
    summary.topics.length
      ? h("div", { class: "quest-topic-log" },
          h("p", { class: "quest-path-title" }, "Topics explored"),
          h("ul", {}, ...summary.topics.map((t) =>
            h("li", {}, h("strong", {}, t.title), t.modes.length ? ` · ${t.modes.map((k) => modeNames[k] || k).join(", ")}` : ""))))
      : null,
    tale ? taleSection(tale) : null,
    summary.timeline?.length
      ? h("div", { class: "quest-topic-log quest-timeline" },
          h("p", { class: "quest-path-title" }, "The road, step by step"),
          h("ol", {}, ...timelineLines(summary.timeline, modeNames).map((line) => h("li", {}, line))))
      : null,
    h("div", { class: "quest-card-foot" },
      h("button", { class: "quest-btn quest-btn-secondary", type: "button", onclick: onCopy }, "Copy topics"),
      h("button", { class: "quest-btn", type: "button", onclick: onClose }, "Back to journeys")),
  ].filter(Boolean));
}

// Same shape as the Topicificator's "copy covered topics"
export async function copySummary(summary) {
  const header = "ACID QUEST · The Topicificator 9002";
  const lines = summary.topics.map((t) => `• ${t.title}`);
  const html = [`<strong>${header}</strong>`, ...lines].join("<br>");
  const text = [header, ...lines].join("\n");
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) }),
    ]);
  } catch {
    await navigator.clipboard?.writeText(text).catch(() => {});
  }
}

// The journey log as sentences. Passes are never in the timeline; walks between stops merge.
const OBSTACLE_NAMES = { ford: "a river", boulder: "a boulder", log: "a fallen tree", climb: "a cliff" };
const TOOL_WORDS = { ford: "boat", boulder: "pickaxe", log: "axe", climb: "rope" };

export function timelineLines(timeline, modeNames = {}) {
  const lines = [];
  let miles = 0, cannon = false;
  const walk = () => {
    if (miles > 0) lines.push(cannon ? `Flew ${miles.toFixed(1)} miles by cannon` : `Walked ${miles.toFixed(1)} miles`);
    miles = 0; cannon = false;
  };
  for (const e of timeline) {
    if (e.kind === "move") { miles += (e.data?.tiles || 0) * 0.1; cannon ||= !!e.data?.cannon; continue; }
    // plain stops aren't listed: an arrival with no share after it would show a pass
    if (e.kind === "encounter" && !ENCOUNTERS[e.encounter]?.label) continue;
    walk();
    if (e.kind === "encounter") {
      if (e.encounter === "cannon" && e.data?.fired === undefined) lines.push("Found an old cannon");
      else if (e.encounter !== "cannon") lines.push(`Came to: ${ENCOUNTERS[e.encounter].label}`);
    } else if (e.kind === "share") {
      const how = { risky: " \u00b7 took the risk", chaos: " \u00b7 chaos", revisit: " \u00b7 revisited" }[e.approach] || "";
      const mode = modeNames[e.sharing_mode] || e.sharing_mode || "A share";
      lines.push(e.topic ? `${mode}: \u201c${e.topic}\u201d${how}` : `${mode}${how}`);
    } else if (e.kind === "item" && e.data?.item) {
      lines.push(`Received ${describeTool({ type: e.data.item, uses: e.data.uses ?? 1, max: e.data.uses ?? 1, legendary: !!e.data.legendary })}`);
    } else if (e.kind === "obstacle" && e.data?.obstacle) {
      lines.push(`Crossed ${OBSTACLE_NAMES[e.data.obstacle] || "an obstacle"} with the ${TOOL_WORDS[e.data.obstacle] || "right tool"}`);
    } else if (e.kind === "help") {
      lines.push(e.data?.mode === "friend" ? "A friend came to help" : "A wandering merchant helped out");
    } else if (e.kind === "gate") {
      lines.push(e.data?.opened ? "The room opened a locked gate" : "Chose another road at a locked gate");
    }
  }
  walk();
  return lines;
}

// "Tell our tale": opt-in, clearly fiction. Hidden when the server has no storyteller set up.
function taleSection(tale) {
  const box = h("div", { class: "quest-tale", hidden: "" });
  const list = h("div", { class: "quest-tale-list" });
  const status = h("p", { class: "quest-muted quest-tale-status" });
  const buttons = h("div", { class: "quest-tale-styles" });
  let state = null;

  const showStory = (story) => {
    const text = h("div", { class: "quest-tale-body" }, ...story.body.split(/\n\s*\n/).map((p) => h("p", {}, p.trim())));
    list.prepend(h("article", { class: "quest-tale-story" },
      h("p", { class: "quest-tale-title" }, story.title || "Our tale"),
      h("p", { class: "quest-tale-style" }, `${story.style_name} \u00b7 fiction`),
      text,
      h("button", { class: "quest-link", type: "button", onclick: () => navigator.clipboard?.writeText(`${story.title || "Our tale"}\n\n${story.body}`) }, "Copy tale")));
  };

  const renderButtons = () => {
    buttons.replaceChildren(...state.styles.map((s) =>
      h("button", { class: "quest-btn quest-btn-secondary", type: "button", disabled: state.remaining <= 0 ? "" : null, onclick: () => tell(s) }, s.name)));
    status.textContent = state.remaining > 0
      ? `Pick a style. ${state.remaining} tale${state.remaining === 1 ? "" : "s"} left for this journey.`
      : "This journey has all its tales.";
  };

  const tell = async (style) => {
    buttons.querySelectorAll("button").forEach((b) => (b.disabled = true));
    status.textContent = "The storyteller gathers the threads\u2026";
    try {
      const story = await tale.create(style.key);
      state.remaining -= 1;
      showStory(story);
    } catch (e) {
      status.textContent = e.message || "The storyteller couldn't finish this one. Try again.";
      buttons.querySelectorAll("button").forEach((b) => (b.disabled = false));
      return;
    }
    renderButtons();
  };

  tale.load().then((s) => {
    state = s;
    if (!s.enabled && !s.stories.length) return;
    s.stories.forEach(showStory);
    if (s.enabled) renderButtons();
    box.hidden = false;
  }).catch(() => {});

  box.append(
    h("p", { class: "quest-path-title" }, "Tell our tale"),
    h("p", { class: "quest-muted" }, "A made-up story of this journey, written by AI from the road alone: places, topics and ways of sharing. No names, nothing anyone said."),
    buttons, status, list);
  return box;
}
