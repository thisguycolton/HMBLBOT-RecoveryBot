import { h } from "./topic_flow";
import { RESOURCES } from "../resources";

// QUEST COMPLETE: journey statistics (never scores) and the topics the group explored.
// Passes are intentionally absent.
export function renderSummary(el, summary, { modeNames, iconUrl, onCopy, onClose }) {
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
