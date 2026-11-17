// What changed between two versions of a group document, the way its History shows it: the
// document split into blocks (paragraphs, headings, list items, table rows), blocks matched
// up, and the words inside each changed block compared, git style. The server keeps a
// summary of each version's change the same way (app/services/document_diff.rb).

const BLOCK_TAGS = ["P", "H1", "H2", "H3", "H4", "LI", "TR", "PRE", "SUMMARY"];
const HEADINGS = ["H1", "H2", "H3", "H4"];
// Past this many pairs to compare, a changed stretch counts as all removed and all added
const PAIRS_MAX = 250_000;

const squish = (s) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const words = (text) => (text ? text.split(" ") : []);
export const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The document as [{ tag, text, html, section, list }]: html is the block as it's drawn alone
// (a list item in its list, a row in a table), section the heading above it
export function toBlocks(html) {
  const body = new DOMParser().parseFromString(`<body>${html || ""}</body>`, "text/html").body;
  body.querySelectorAll("br").forEach((br) => br.replaceWith(" "));
  const selector = BLOCK_TAGS.join(",").toLowerCase();
  const list = [];
  let section = null;
  body.querySelectorAll(selector).forEach((node) => {
    if (node.parentElement?.closest(selector)) return; // a list item's own paragraph is the item, a cell's is its row
    const text = squish(node.tagName === "TR" ? [...node.querySelectorAll("th,td")].map((c) => c.textContent).join(" | ") : node.textContent);
    if (!text) return;
    if (HEADINGS.includes(node.tagName)) section = text;
    const listTag = node.tagName === "LI" ? (node.parentElement?.tagName === "OL" ? "ol" : "ul") : null;
    let shown = node.outerHTML;
    if (listTag) shown = `<${listTag}>${shown}</${listTag}>`;
    if (node.tagName === "TR") shown = `<table><tbody>${shown}</tbody></table>`;
    if (node.tagName === "SUMMARY") shown = `<p class="doc-diff-summary">${node.innerHTML}</p>`;
    list.push({ tag: node.tagName, text, html: shown, section, list: listTag });
  });
  // Text with no paragraphs around it (a document saved before the editor) is one block
  const loose = !list.length && squish(body.textContent);
  return loose ? [{ tag: "P", text: loose, html: `<p>${escapeHtml(loose)}</p>`, section: null, list: null }] : list;
}

// The longest common subsequence of two lists, as [[index in a, index in b], ...]
export function lcs(a, b, same = (x, y) => x === y) {
  let start = 0;
  while (start < a.length && start < b.length && same(a[start], b[start])) start += 1;
  let finish = 0;
  while (finish < a.length - start && finish < b.length - start && same(a[a.length - 1 - finish], b[b.length - 1 - finish])) finish += 1;
  const midA = a.slice(start, a.length - finish);
  const midB = b.slice(start, b.length - finish);
  const pairs = [];
  for (let k = 0; k < start; k += 1) pairs.push([k, k]);
  if (midA.length && midB.length && midA.length * midB.length <= PAIRS_MAX) {
    const n = midA.length, m = midB.length;
    const lengths = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let x = n - 1; x >= 0; x -= 1) {
      for (let y = m - 1; y >= 0; y -= 1) {
        lengths[x][y] = same(midA[x], midB[y]) ? lengths[x + 1][y + 1] + 1 : Math.max(lengths[x + 1][y], lengths[x][y + 1]);
      }
    }
    let x = 0, y = 0;
    while (x < n && y < m) {
      if (same(midA[x], midB[y])) { pairs.push([start + x, start + y]); x += 1; y += 1; }
      else if (lengths[x + 1][y] >= lengths[x][y + 1]) x += 1;
      else y += 1;
    }
  }
  for (let k = finish - 1; k >= 0; k -= 1) pairs.push([a.length - 1 - k, b.length - 1 - k]);
  return pairs;
}

// Calls fn(old blocks, new blocks, kept pair) for each stretch: the blocks that differ, then the matching pair after them
function eachStretch(olds, news, fn) {
  const pairs = lcs(olds, news, (x, y) => x.text === y.text);
  let i = 0, j = 0;
  [...pairs, [olds.length, news.length]].forEach(([oi, nj]) => {
    fn(olds.slice(i, oi), news.slice(j, nj), oi < olds.length ? [olds[oi], news[nj]] : null);
    i = oi + 1;
    j = nj + 1;
  });
}

// Word-by-word changes inside a block, as [["same" | "add" | "del", text], ...], spaces kept
export function wordOps(oldText, newText) {
  const a = oldText.split(/(\s+)/).filter(Boolean);
  const b = newText.split(/(\s+)/).filter(Boolean);
  const pairs = lcs(a, b);
  const ops = [];
  const push = (op, text) => {
    const last = ops[ops.length - 1];
    if (last && last[0] === op) last[1] += text; else ops.push([op, text]);
  };
  let i = 0, j = 0;
  [...pairs, [a.length, b.length]].forEach(([ai, bj]) => {
    a.slice(i, ai).forEach((t) => push("del", t));
    b.slice(j, bj).forEach((t) => push("add", t));
    if (ai < a.length) push("same", a[ai]);
    i = ai + 1;
    j = bj + 1;
  });
  return ops;
}

// How alike two blocks' words are, 0 to 1
function likeness(a, b) {
  const x = new Set(words(a.text.toLowerCase()));
  const y = new Set(words(b.text.toLowerCase()));
  if (!x.size || !y.size) return 0;
  let both = 0;
  x.forEach((w) => { if (y.has(w)) both += 1; });
  return both / Math.max(x.size, y.size);
}

// The changes from one version's HTML to another's, as display items in the new one's order:
// { kind: "same" | "formatted" | "changed" | "added" | "removed", block, old?, ops? }
export function diffDocuments(oldHtml, newHtml) {
  const items = [];
  eachStretch(toBlocks(oldHtml), toBlocks(newHtml), (olds, news, kept) => {
    let j = 0;
    olds.forEach((o) => {
      let k = j;
      while (k < news.length && likeness(o, news[k]) < 0.34) k += 1;
      if (k < news.length) {
        news.slice(j, k).forEach((n) => items.push({ kind: "added", block: n }));
        items.push({ kind: "changed", block: news[k], old: o, ops: wordOps(o.text, news[k].text) });
        j = k + 1;
      } else items.push({ kind: "removed", block: o });
    });
    news.slice(j).forEach((n) => items.push({ kind: "added", block: n }));
    if (kept) items.push({ kind: kept[0].html === kept[1].html ? "same" : "formatted", block: kept[1], old: kept[0] });
  });
  return items;
}

// A changed block drawn with its words marked: in its own kind of element, plain text
export function changedHtml(item) {
  const inner = item.ops.map(([op, text]) => (op === "same" ? escapeHtml(text) : `<${op === "add" ? "ins" : "del"}>${escapeHtml(text)}</${op === "add" ? "ins" : "del"}>`)).join("");
  const tag = item.block.tag.toLowerCase();
  if (tag === "li") return `<${item.block.list}><li><p>${inner}</p></li></${item.block.list}>`;
  if (tag === "tr" || tag === "summary") return `<p>${inner}</p>`;
  return `<${tag}>${inner}</${tag}>`;
}

// Words added and removed, and the sections they were in (as the server counts them)
export function diffStats(oldHtml, newHtml) {
  let added = 0, removed = 0;
  const sections = [];
  eachStretch(toBlocks(oldHtml), toBlocks(newHtml), (olds, news) => {
    if (!olds.length && !news.length) return;
    const a = olds.flatMap((b) => words(b.text));
    const b = news.flatMap((x) => words(x.text));
    const kept = lcs(a, b).length;
    if (a.length === kept && b.length === kept) return;
    added += b.length - kept;
    removed += a.length - kept;
    (news.length ? news : olds).forEach((x) => sections.push(HEADINGS.includes(x.tag) ? x.text : x.section));
  });
  return { words_added: added, words_removed: removed, sections: [...new Set(sections.filter(Boolean))].slice(0, 6) };
}
