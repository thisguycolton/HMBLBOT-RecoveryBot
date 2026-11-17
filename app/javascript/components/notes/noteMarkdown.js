// A note's Markdown to the HTML the note editor (MarkdownEditor) opens, and the editor's
// document back to Markdown, in the subset book/Markdown.jsx shows: paragraphs, line breaks,
// # headings (to ###), > quotes, flat - / 1. lists, ``` code, **bold**, *italic*,
// ++underline++, ~~strike~~, `code` and links. Raw HTML in the Markdown stays text.
import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: false, linkify: false, breaks: true }).enable(["strikethrough"]);

// ++underline++ (not standard Markdown, so it's added here)
md.inline.ruler.before("emphasis", "underline", (state, silent) => {
  const { src, pos } = state;
  if (src.slice(pos, pos + 2) !== "++") return false;
  const close = src.indexOf("++", pos + 2);
  if (close < 0 || close === pos + 2 || src.slice(pos + 2, close).includes("\n")) return false;
  if (!silent) {
    state.push("u_open", "u", 1);
    const oldMax = state.posMax;
    state.pos = pos + 2;
    state.posMax = close;
    state.md.inline.tokenize(state);
    state.posMax = oldMax;
    state.push("u_close", "u", -1);
  }
  state.pos = close + 2;
  return true;
});

export const markdownToNoteHtml = (source) => md.render(source || "");

// Notes the editor can't hold (it has no tables), so they stay in the plain text box
export const editorCanHold = (source) => !/^\s*\|.*\|\s*$/m.test(source || "");

// Outermost first: bold can hold italic (book/Markdown.jsx reads ***both***), and a link's
// words keep their marks
const MARKS = [
  ["link", (m) => ["[", `](${m.attrs.href})`]],
  ["bold", () => ["**", "**"]],
  ["italic", () => ["*", "*"]],
  ["strike", () => ["~~", "~~"]],
  ["underline", () => ["++", "++"]],
];

const text = (node) => node.text || "";
const has = (node, type) => (node.marks || []).find((m) => m.type === type);

// Inline content: each mark wraps the longest runs that have it, nested in MARKS order.
// Spaces at a run's edges go outside its markers, where Markdown needs them.
function inline(nodes, depth = 0) {
  if (depth === MARKS.length) {
    return nodes.map((n) => {
      if (n.type === "hardBreak") return "\n";
      return has(n, "code") ? `\`${text(n)}\`` : text(n);
    }).join("");
  }
  const [type, markers] = MARKS[depth];
  let out = "";
  for (let i = 0; i < nodes.length;) {
    const mark = has(nodes[i], type);
    let j = i + 1;
    const same = (n) => (mark ? has(n, type) && (type !== "link" || has(n, type).attrs.href === mark.attrs.href) : !has(n, type));
    while (j < nodes.length && same(nodes[j])) j++;
    const inner = inline(nodes.slice(i, j), depth + 1);
    if (!mark) out += inner;
    else if (type === "link" && inner === mark.attrs.href) out += inner; // a bare link stays bare
    else {
      const [, lead, core, trail] = inner.match(/^(\s*)([\s\S]*?)(\s*)$/);
      const [open, close] = markers(mark);
      out += core ? `${lead}${open}${core}${close}${trail}` : inner;
    }
    i = j;
  }
  return out;
}

function block(node, prefix = "") {
  const kids = node.content || [];
  switch (node.type) {
    case "paragraph": return inline(kids);
    case "heading": return `${"#".repeat(Math.min(node.attrs?.level || 1, 3))} ${inline(kids).replace(/\n/g, " ")}`;
    case "codeBlock": return `\`\`\`\n${kids.map(text).join("")}\n\`\`\``;
    case "blockquote": return kids.map((k) => block(k)).join("\n\n").split("\n").map((l) => `> ${l}`.trimEnd()).join("\n");
    case "bulletList":
    case "orderedList":
      return kids.map((item, i) => {
        const bullet = node.type === "orderedList" ? `${(node.attrs?.start || 1) + i}.` : "-";
        // Lists show flat, one line each, so nested items and extra paragraphs follow on
        const lines = (item.content || []).map((k) => (k.type.endsWith("List") ? block(k, `${prefix}  `) : block(k).replace(/\n/g, " ")));
        return `${prefix}${bullet} ${lines.join("\n")}`;
      }).join("\n");
    default: return inline(kids);
  }
}

// The editor's document (editor.getJSON()) as Markdown
export function noteJsonToMarkdown(doc) {
  return (doc.content || []).map((n) => block(n)).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}
