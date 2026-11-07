// The Docs' Markdown (doc_pages.body) to HTML for the reader, plus the page's headings for
// "On this page". On top of plain Markdown (markdown-it, raw HTML shown as text, not run):
//   > [!TIP] ...      a callout (TIP, NOTE, WARNING, PRIVACY), the way GitHub writes them
//   - [ ] / - [x]     a checklist
//   ## Heading        gets an id from its words, so #links and the side list can find it
import MarkdownIt from "markdown-it";

export const CALLOUTS = {
  tip: { label: "Tip" },
  note: { label: "Note" },
  warning: { label: "Heads up" },
  privacy: { label: "Privacy" },
};
const CALLOUT_RE = /^\[!(tip|note|warning|privacy)\][ \t]*/i;

export const slugify = (text) =>
  text.toLowerCase().replace(/<[^>]*>/g, "").replace(/&[a-z]+;/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-").slice(0, 80) || "section";

function callouts(md) {
  md.core.ruler.push("doc_callouts", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i += 1) {
      if (tokens[i].type !== "blockquote_open") continue;
      const inline = tokens[i + 2];
      if (!inline || inline.type !== "inline" || tokens[i + 1].type !== "paragraph_open") continue;
      const m = inline.content.match(CALLOUT_RE);
      if (!m) continue;
      const kind = m[1].toLowerCase();
      tokens[i].attrJoin("class", `doc-callout doc-callout-${kind}`);
      tokens[i].attrSet("data-label", CALLOUTS[kind].label);
      inline.content = inline.content.replace(CALLOUT_RE, "");
      const first = inline.children[0];
      if (first?.type === "text") {
        first.content = first.content.replace(CALLOUT_RE, "");
        // "[!TIP]" on a line of its own: drop the line break after it too
        if (!first.content && inline.children[1]?.type === "softbreak") inline.children.splice(0, 2);
      }
    }
  });
}

function checklists(md) {
  md.core.ruler.push("doc_checklists", (state) => {
    const tokens = state.tokens;
    for (let i = 2; i < tokens.length; i += 1) {
      const inline = tokens[i];
      if (inline.type !== "inline" || tokens[i - 1].type !== "paragraph_open" || tokens[i - 2].type !== "list_item_open") continue;
      const m = inline.content.match(/^\[([ xX])\]\s+/);
      if (!m) continue;
      const done = m[1] !== " ";
      tokens[i - 2].attrJoin("class", `doc-check${done ? " doc-check-done" : ""}`);
      const first = inline.children[0];
      if (first?.type === "text") first.content = first.content.replace(/^\[([ xX])\]\s+/, "");
      const box = new state.Token("html_inline", "", 0);
      box.content = `<span class="doc-checkbox" aria-hidden="true">${done ? "✓" : ""}</span>`;
      inline.children.unshift(box);
      // the list it's in loses its bullets
      for (let j = i - 3; j >= 0; j -= 1) {
        if (tokens[j].type === "bullet_list_open" && tokens[j].level === tokens[i - 2].level - 1) {
          tokens[j].attrJoin("class", "doc-checklist");
          break;
        }
      }
    }
  });
}

function headingIds(md, headings) {
  md.core.ruler.push("doc_heading_ids", (state) => {
    const used = new Map();
    state.tokens.forEach((token, i) => {
      if (token.type !== "heading_open") return;
      const text = state.tokens[i + 1].children.filter((c) => c.type === "text" || c.type === "code_inline").map((c) => c.content).join("");
      let id = slugify(text);
      const n = used.get(id) || 0;
      used.set(id, n + 1);
      if (n) id = `${id}-${n + 1}`;
      token.attrSet("id", id);
      const level = Number(token.tag.slice(1));
      if (level === 2 || level === 3) headings.push({ id, text, level });
    });
  });
}

// Every line of the text (paragraph, list item, quote, table) gets an address, #l-<code>, so a
// link can point at it (DocShare). The code comes from the line's own words, so the link keeps
// working when other lines change. A paragraph inside a list item or quote shares the item's.
export const lineCode = (text) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(6, "0").slice(-6);
};

const LINES = { paragraph_open: true, list_item_open: true, blockquote_open: true, table_open: true };
const WRAPS = { list_item_open: 1, list_item_close: -1, blockquote_open: 1, blockquote_close: -1, table_open: 1, table_close: -1 };

function lineIds(md) {
  md.core.ruler.push("doc_line_ids", (state) => {
    const { tokens } = state;
    const used = new Map();
    let inside = 0;
    tokens.forEach((token, i) => {
      if (LINES[token.type] && (inside === 0 || token.type === "list_item_open")) {
        const close = token.type.replace("_open", "_close");
        const words = [];
        for (let j = i + 1; j < tokens.length; j += 1) {
          if (tokens[j].type === close && tokens[j].level === token.level) break;
          if (tokens[j].type === "inline") words.push(tokens[j].content);
        }
        const text = words.join(" ").replace(/\s+/g, " ").trim();
        if (text) {
          let id = `l-${lineCode(text)}`;
          const n = used.get(id) || 0;
          used.set(id, n + 1);
          if (n) id = `${id}-${n + 1}`;
          token.attrSet("id", id);
        }
      }
      inside += WRAPS[token.type] || 0;
    });
  });
}

// { html, headings: [{ id, text, level }] }
export function renderDoc(source) {
  const headings = [];
  const md = new MarkdownIt({ html: false, linkify: true, breaks: false, typographer: true }).enable(["table", "strikethrough"]);
  md.use(callouts).use(checklists).use((m) => headingIds(m, headings)).use(lineIds);
  // Links that leave the site open in a new tab
  const defaultLink = md.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet("href") || "";
    if (/^https?:\/\//.test(href) && !href.startsWith(window.location.origin)) {
      tokens[idx].attrSet("target", "_blank");
      tokens[idx].attrSet("rel", "noreferrer");
    }
    return defaultLink(tokens, idx, options, env, self);
  };
  md.renderer.rules.image = (tokens, idx) => {
    const t = tokens[idx];
    const alt = md.utils.escapeHtml(t.content || "");
    return `<img src="${md.utils.escapeHtml(t.attrGet("src") || "")}" alt="${alt}" loading="lazy" class="doc-image">`;
  };
  const html = md.render(source || "");
  return { html, headings };
}
