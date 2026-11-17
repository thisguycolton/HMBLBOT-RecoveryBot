// RTF to HTML, for importing documents. It reads what word processors write for text: paragraphs
// and line breaks, bold / italic / underline / strike, alignment, headings (from the style
// names), bulleted and numbered lists, simple tables, and accented and Unicode characters.
// Pictures, headers, footers, fonts, colours and sizes are left out. The HTML is cleaned again
// by the server before it is kept (DocumentHtml), so it only has to be well formed.

// Groups that hold something other than the document's text
const SKIP = new Set([
  "fonttbl", "colortbl", "info", "pict", "listtable", "listoverridetable", "rsidtbl", "generator", "fldinst", "object",
  "themedata", "datastore", "latentstyles", "xmlnstbl", "colorschememapping", "header", "headerl", "headerr", "headerf",
  "footer", "footerl", "footerr", "footerf", "footnote", "private", "revtbl", "mmathPr", "pgdsctbl", "pnseclvl",
  "background", "shpinst", "nonshppict", "wgrffmtfilter", "factoidname", "userprops", "filetbl", "expandedcolortbl",
]);
const SYMBOLS = {
  lquote: "‘", rquote: "’", ldblquote: "“", rdblquote: "”", endash: "–", emdash: "—",
  bullet: "•", emspace: " ", enspace: " ", tab: " ",
};
const ALIGN = { ql: null, qr: "right", qc: "center", qj: "justify" };
const TITLES = { title: 1, subtitle: 2 };

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Windows-1252 differs from Latin-1 only in 0x80-0x9F
const CP1252 = "\u20AC\u0081\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u008D\u017D\u008F\u0090\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u009D\u017E\u0178";
const decode1252 = (code) => (code >= 0x80 && code <= 0x9f ? CP1252[code - 0x80] : String.fromCharCode(code));

export function rtfToHtml(source) {
  const text = String(source);
  if (!/^\s*\{\\rtf/.test(text)) throw new Error("That doesn't look like an RTF file.");

  const headingOf = {}; // \sN -> heading level, from the stylesheet's style names
  const stack = [];
  // formatting state, kept per group
  let g = { skip: false, b: false, i: false, u: false, s: false, uc: 1, sheet: false, styleNo: null, listText: false };
  let pendingSkip = 0; // characters standing in for the last \uN, to ignore
  let sheetName = "";

  let runs = []; // the paragraph being written: [{ t, b, i, u, s }]
  let para = { align: null, list: false, styleNo: null };
  let listText = "";
  const blocks = []; // { html, align, level, list, ordered } or { table }
  let cell = null; // blocks of the table cell being written
  let row = null; // finished cells of the table row being written
  let table = null; // finished rows

  const inline = (r) => {
    let h = esc(r.t);
    if (r.s) h = `<s>${h}</s>`;
    if (r.u) h = `<u>${h}</u>`;
    if (r.i) h = `<em>${h}</em>`;
    if (r.b) h = `<strong>${h}</strong>`;
    return h;
  };
  const addText = (t) => {
    if (!t || g.skip) return;
    if (g.listText) { listText += t; return; }
    const last = runs[runs.length - 1];
    if (last && last.b === g.b && last.i === g.i && last.u === g.u && last.s === g.s) last.t += t;
    else runs.push({ t, b: g.b, i: g.i, u: g.u, s: g.s });
  };
  const flushTable = () => {
    if (!table) return;
    const rows = table.map((r) => `<tr>${r.map((c) => `<td>${c.map((b) => `<p>${b.html}</p>`).join("") || "<p></p>"}</td>`).join("")}</tr>`).join("");
    blocks.push({ table: `<table><tbody>${rows}</tbody></table>` });
    table = null;
  };
  const endParagraph = () => {
    const empty = !runs.some((r) => r.t.trim());
    const block = {
      html: runs.map(inline).join(""), align: para.align, level: headingOf[para.styleNo] || 0, list: para.list,
      ordered: /^\s*(\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[.)]/.test(listText),
    };
    runs = [];
    listText = "";
    para = { ...para, list: false, styleNo: null };
    if (cell) cell.push(block);
    else if (!empty) { flushTable(); blocks.push(block); }
  };
  // The name of the style just read in the stylesheet, if it's a heading
  const endStyle = () => {
    const name = sheetName.replace(/;/g, "").trim().toLowerCase();
    const level = /^heading (\d)/.exec(name)?.[1];
    if (g.styleNo != null) {
      if (level) headingOf[g.styleNo] = Math.min(Number(level), 4);
      else if (TITLES[name]) headingOf[g.styleNo] = TITLES[name];
    }
    sheetName = "";
  };

  const n = text.length;
  let i = 0;
  while (i < n) {
    const c = text[i];
    if (c === "{") {
      stack.push({ ...g });
      if (g.sheet) { g.styleNo = null; sheetName = ""; }
      i += 1;
      continue;
    }
    if (c === "}") {
      if (g.sheet && g.styleNo != null) endStyle();
      g = stack.pop() || g;
      i += 1;
      continue;
    }
    if (c === "\r" || c === "\n") { i += 1; continue; }
    if (c !== "\\") {
      let j = i;
      while (j < n && !"{}\\\r\n".includes(text[j])) j += 1;
      let chunk = text.slice(i, j);
      i = j;
      if (pendingSkip > 0) { const cut = Math.min(pendingSkip, chunk.length); chunk = chunk.slice(cut); pendingSkip -= cut; }
      if (g.sheet) sheetName += chunk;
      else addText(chunk);
      continue;
    }

    // a control: \\ \{ \} \~ \_ \- \* \' \<newline>, or a control word
    const next = text[i + 1];
    if (next === "\\" || next === "{" || next === "}") { addText(next); i += 2; continue; }
    if (next === "~") { addText(" "); i += 2; continue; }
    if (next === "_") { addText("‑"); i += 2; continue; }
    if (next === "-") { i += 2; continue; }
    if (next === "\r" || next === "\n") { endParagraph(); i += 2; continue; }
    if (next === "*") { g.skip = true; i += 2; continue; } // an optional destination
    if (next === "'") {
      const code = parseInt(text.slice(i + 2, i + 4), 16);
      i += 4;
      if (pendingSkip > 0) { pendingSkip -= 1; continue; }
      if (!Number.isNaN(code)) addText(decode1252(code));
      continue;
    }
    const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(text.slice(i, i + 40));
    if (!m) { i += 1; continue; }
    i += m[0].length;
    const word = m[1];
    const arg = m[2] === undefined ? null : Number(m[2]);
    const on = arg !== 0;

    if (word === "stylesheet") { g.sheet = true; continue; }
    if (g.sheet) { if (word === "s") g.styleNo = arg; continue; }
    if (word === "listtext" || word === "pntext") { g.listText = true; para.list = true; continue; }
    if (SKIP.has(word)) { g.skip = true; continue; }

    switch (word) {
      case "par": endParagraph(); break;
      case "line": addText("\n"); break;
      case "pard": para = { align: null, list: false, styleNo: null }; break;
      case "plain": g.b = g.i = g.u = g.s = false; break;
      case "b": g.b = on; break;
      case "i": g.i = on; break;
      case "ul": g.u = on; break;
      case "ulnone": g.u = false; break;
      case "strike": g.s = on; break;
      case "ql": case "qr": case "qc": case "qj": para.align = ALIGN[word]; break;
      case "ls": para.list = true; break;
      case "s": para.styleNo = arg; break;
      case "uc": g.uc = arg ?? 1; break;
      case "u": addText(String.fromCharCode(arg < 0 ? arg + 65536 : arg)); pendingSkip = g.uc; break;
      case "trowd": case "intbl": row = row || []; cell = cell || []; break;
      case "cell": endParagraph(); row = row || []; row.push(cell || []); cell = []; break;
      case "row": table = table || []; if (row) table.push(row); row = null; cell = null; break;
      default: if (SYMBOLS[word]) addText(SYMBOLS[word]);
    }
  }
  endParagraph();
  flushTable();

  const out = [];
  let list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const b of blocks) {
    if (b.table) { closeList(); out.push(b.table); continue; }
    const body = b.html.replace(/\n/g, "<br>");
    if (b.list) {
      const tag = b.ordered ? "ol" : "ul";
      if (list !== tag) { closeList(); out.push(`<${tag}>`); list = tag; }
      out.push(`<li><p>${body}</p></li>`);
      continue;
    }
    closeList();
    const style = b.align ? ` style="text-align:${b.align}"` : "";
    out.push(b.level ? `<h${b.level}${style}>${body}</h${b.level}>` : `<p${style}>${body}</p>`);
  }
  closeList();
  return out.join("");
}
