// A group document out of the editor as a file: Word (.docx), RTF or Markdown. Each walks the
// editor's HTML (what DocumentHtml keeps: headings, paragraphs, lists, quotes, tables, links,
// bold/italic/underline/strike, text and highlight colors, alignment) and writes that format.
import JSZip from "jszip";

// A list item's own text is its paragraphs; lists, tables and quotes inside it come after
const BLOCKY = ["UL", "OL", "TABLE", "BLOCKQUOTE"];
const ownText = (li) => [...li.children].filter((c) => !BLOCKY.includes(c.tagName));
const inner = (li) => [...li.children].filter((c) => BLOCKY.includes(c.tagName));

const parse = (html) => new DOMParser().parseFromString(`<body>${html}</body>`, "text/html").body;

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const safeName = (title) => (title || "Document").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Document";

// "rgb(220, 38, 38)" or "#dc2626" -> "DC2626"
function hex(color) {
  if (!color) return null;
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) return m.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
  const h = color.replace("#", "");
  if (/^[0-9a-f]{6}$/i.test(h)) return h.toUpperCase();
  if (/^[0-9a-f]{3}$/i.test(h)) return h.split("").map((c) => c + c).join("").toUpperCase();
  return null;
}

// The runs of text in a block, each with its formatting
function runs(node, style = {}, out = []) {
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent) out.push({ text: child.textContent, ...style });
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const tag = child.tagName.toLowerCase();
    if (tag === "br") { out.push({ br: true }); return; }
    const next = { ...style };
    if (tag === "strong" || tag === "b") next.bold = true;
    if (tag === "em" || tag === "i") next.italic = true;
    if (tag === "u") next.underline = true;
    if (tag === "s" || tag === "strike") next.strike = true;
    if (tag === "a") next.href = child.getAttribute("href");
    if (child.style?.color) next.color = hex(child.style.color);
    if (tag === "mark") next.highlight = hex(child.style.backgroundColor || child.getAttribute("data-color")) || "FEF08A";
    runs(child, next, out);
  });
  return out;
}

// ---- Markdown ----

function mdInline(node) {
  return runs(node).map((r) => {
    if (r.br) return "  \n";
    let t = r.text.replace(/([*_`[\]\\])/g, "\\$1");
    if (r.bold) t = `**${t}**`;
    if (r.italic) t = `*${t}*`;
    if (r.strike) t = `~~${t}~~`;
    if (r.href) t = `[${t}](${r.href})`;
    return t;
  }).join("").replace(/\*\*\*\*/g, "");
}

function mdBlocks(parent, depth = 0) {
  const out = [];
  parent.childNodes.forEach((el) => {
    if (el.nodeType !== Node.ELEMENT_NODE) return;
    const tag = el.tagName.toLowerCase();
    if (/^h[1-4]$/.test(tag)) out.push(`${"#".repeat(Number(tag[1]))} ${mdInline(el)}`);
    else if (tag === "p") out.push(mdInline(el));
    else if (tag === "hr") out.push("---");
    else if (tag === "blockquote") out.push(mdBlocks(el).split("\n").map((l) => `> ${l}`).join("\n"));
    else if (tag === "ul" || tag === "ol") {
      const items = [...el.children].filter((c) => c.tagName === "LI").map((li, i) => {
        const marker = tag === "ol" ? `${i + 1}.` : "-";
        const text = ownText(li).map(mdInline).join(" ") || (inner(li).length ? "" : mdInline(li));
        const sub = inner(li).map((n) => (["UL", "OL"].includes(n.tagName) ? mdBlocks({ childNodes: [n] }, depth + 1) : `\n${mdBlocks({ childNodes: [n] })}\n`)).join("\n");
        return `${"  ".repeat(depth)}${marker} ${text}${sub ? `\n${sub}` : ""}`;
      });
      out.push(items.join("\n"));
    } else if (tag === "table") {
      const rows = [...el.querySelectorAll("tr")].map((tr) => [...tr.children].map((c) => mdInline(c).replace(/\|/g, "\\|").replace(/\n/g, " ")));
      if (rows.length) {
        const width = Math.max(...rows.map((r) => r.length));
        const line = (r) => `| ${Array.from({ length: width }, (_, i) => r[i] || "").join(" | ")} |`;
        out.push([line(rows[0]), `| ${Array(width).fill("---").join(" | ")} |`, ...rows.slice(1).map(line)].join("\n"));
      }
    } else out.push(mdBlocks(el, depth));
  });
  return out.filter((b) => b !== "").join(depth ? "\n" : "\n\n");
}

export function toMarkdown(html, title) {
  const body = mdBlocks(parse(html));
  return `${title ? `# ${title}\n\n` : ""}${body}\n`;
}

// ---- RTF ----

function rtfEscape(text) {
  return text.replace(/\\/g, "\\\\").replace(/{/g, "\\{").replace(/}/g, "\\}")
    .replace(/[^\x00-\x7f]/g, (c) => { const code = c.charCodeAt(0); return `\\u${code > 32767 ? code - 65536 : code}?`; });
}

export function toRtf(html, title) {
  const colors = [];
  const colorIndex = (h) => { if (!h) return 0; let i = colors.indexOf(h); if (i < 0) { colors.push(h); i = colors.length - 1; } return i + 1; };
  const inline = (node) => runs(node).map((r) => {
    if (r.br) return "\\line ";
    const on = [r.bold && "\\b", r.italic && "\\i", r.underline && "\\ul", r.strike && "\\strike", r.color && `\\cf${colorIndex(r.color)}`, r.highlight && `\\highlight${colorIndex(r.highlight)}`].filter(Boolean).join("");
    return `{${on}${on ? " " : ""}${rtfEscape(r.text)}}`;
  }).join("");
  const align = (el) => ({ center: "\\qc", right: "\\qr", justify: "\\qj" }[el.style?.textAlign] || "\\ql");
  const blocks = (parent, listDepth = 0) => {
    let out = "";
    parent.childNodes.forEach((el) => {
      if (el.nodeType !== Node.ELEMENT_NODE) return;
      const tag = el.tagName.toLowerCase();
      const size = { h1: 40, h2: 32, h3: 28, h4: 24 }[tag];
      if (size) out += `{\\pard${align(el)}\\sb240\\sa120\\b\\fs${size} ${inline(el)}\\par}\n`;
      else if (tag === "p") out += `{\\pard${align(el)}\\sa160\\fs24 ${inline(el)}\\par}\n`;
      else if (tag === "hr") out += "{\\pard\\brdrb\\brdrs\\brdrw10\\brsp20\\par}\n";
      else if (tag === "blockquote") out += `{\\pard\\li720\\i ${[...el.children].map(inline).join("\\line ")}\\par}\n`;
      else if (tag === "ul" || tag === "ol") {
        [...el.children].filter((c) => c.tagName === "LI").forEach((li, i) => {
          const marker = tag === "ol" ? `${i + 1}.` : "\\bullet";
          const text = ownText(li).map(inline).join(" ") || (inner(li).length ? "" : inline(li));
          out += `{\\pard\\fi-360\\li${720 * (listDepth + 1)}\\sa80\\fs24 ${marker}\\tab ${text}\\par}\n`;
          inner(li).forEach((n) => { out += blocks({ childNodes: [n] }, ["UL", "OL"].includes(n.tagName) ? listDepth + 1 : 0); });
        });
      } else if (tag === "table") {
        [...el.querySelectorAll("tr")].forEach((tr) => {
          const cells = [...tr.children];
          const w = Math.floor(9360 / Math.max(cells.length, 1));
          out += `\\trowd\\trgaph108${cells.map((c, i) => `${c.style.backgroundColor ? `\\clcbpat${colorIndex(hex(c.style.backgroundColor))}` : ""}\\clbrdrt\\brdrs\\clbrdrl\\brdrs\\clbrdrb\\brdrs\\clbrdrr\\brdrs\\cellx${w * (i + 1)}`).join("")}\n`;
          out += cells.map((c) => `\\pard\\intbl${c.tagName === "TH" ? "\\b" : ""} ${[...c.children].map(inline).join("\\line ") || inline(c)}\\cell`).join("") + "\\row\n";
        });
        out += "\\pard\\par\n";
      } else out += blocks(el, listDepth);
    });
    return out;
  };
  const body = blocks(parse(html));
  const head = title ? `{\\pard\\sa240\\b\\fs48 ${rtfEscape(title)}\\par}\n` : "";
  const table = `{\\colortbl;${colors.map((h) => `\\red${parseInt(h.slice(0, 2), 16)}\\green${parseInt(h.slice(2, 4), 16)}\\blue${parseInt(h.slice(4, 6), 16)};`).join("")}}`;
  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}${table}\n\\f0\\fs24\n${head}${body}}`;
}

// ---- Word (.docx) ----

const xml = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function toDocx(html, title) {
  const links = [];
  const run = (r) => {
    if (r.br) return "<w:r><w:br/></w:r>";
    const props = [r.bold && "<w:b/>", r.italic && "<w:i/>", r.underline && '<w:u w:val="single"/>', r.strike && "<w:strike/>",
      r.color && `<w:color w:val="${r.color}"/>`, r.highlight && `<w:shd w:val="clear" w:color="auto" w:fill="${r.highlight}"/>`,
      r.href && !r.underline && '<w:u w:val="single"/>', r.href && !r.color && '<w:color w:val="2563EB"/>'].filter(Boolean).join("");
    const body = `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${xml(r.text)}</w:t></w:r>`;
    if (!r.href) return body;
    links.push(r.href);
    return `<w:hyperlink r:id="rIdLink${links.length}">${body}</w:hyperlink>`;
  };
  const jc = (el) => ({ center: "center", right: "right", justify: "both" }[el.style?.textAlign]);
  const para = (el, { style, numId, ilvl = 0, quote } = {}) => {
    const props = [style && `<w:pStyle w:val="${style}"/>`, numId && `<w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${numId}"/></w:numPr>`,
      quote && '<w:ind w:left="720"/>', jc(el) && `<w:jc w:val="${jc(el)}"/>`].filter(Boolean).join("");
    return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ""}${runs(el).map(run).join("")}</w:p>`;
  };
  const blocks = (parent, depth = 0, quote = false) => {
    let out = "";
    parent.childNodes.forEach((el) => {
      if (el.nodeType !== Node.ELEMENT_NODE) return;
      const tag = el.tagName.toLowerCase();
      if (/^h[1-4]$/.test(tag)) out += para(el, { style: `Heading${tag[1]}` });
      else if (tag === "p") out += para(el, { quote });
      else if (tag === "hr") out += '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="AAAAAA"/></w:pBdr></w:pPr></w:p>';
      else if (tag === "blockquote") out += blocks(el, depth, true);
      else if (tag === "ul" || tag === "ol") {
        [...el.children].filter((c) => c.tagName === "LI").forEach((li) => {
          const own = ownText(li);
          if (own.length || !inner(li).length) (own.length ? own : [li]).forEach((p) => { out += para(p, { numId: tag === "ol" ? 2 : 1, ilvl: depth }); });
          inner(li).forEach((n) => { out += blocks({ childNodes: [n] }, ["UL", "OL"].includes(n.tagName) ? depth + 1 : 0); });
        });
      } else if (tag === "table") {
        const rows = [...el.querySelectorAll("tr")];
        const cols = Math.max(...rows.map((r) => r.children.length), 1);
        const w = Math.floor(9360 / cols);
        out += `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => `<w:${s} w:val="single" w:sz="4" w:color="CBD5E1"/>`).join("")}</w:tblBorders></w:tblPr>`;
        out += `<w:tblGrid>${Array(cols).fill(`<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`;
        rows.forEach((tr) => {
          out += "<w:tr>";
          [...tr.children].forEach((c) => {
            const fill = hex(c.style.backgroundColor) || (c.tagName === "TH" ? "F1F5F9" : null);
            const border = hex(c.style.borderColor);
            const size = Math.round((parseFloat(c.style.borderWidth) || 0) * 6);
            const borders = border || size ? `<w:tcBorders>${["top", "left", "bottom", "right"].map((s) => `<w:${s} w:val="${size === 0 && c.style.borderWidth ? "nil" : "single"}" w:sz="${size || 4}" w:color="${border || "CBD5E1"}"/>`).join("")}</w:tcBorders>` : "";
            const inner = [...c.children].length ? blocks(c) : para(c);
            const content = c.tagName === "TH" ? inner.replace(/<w:r>(?!<w:rPr>)/g, "<w:r><w:rPr><w:b/></w:rPr>") : inner;
            out += `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ""}${borders}</w:tcPr>${content || "<w:p/>"}</w:tc>`;
          });
          out += "</w:tr>";
        });
        out += "</w:tbl><w:p/>";
      } else out += blocks(el, depth, quote);
    });
    return out;
  };

  const titlePara = title ? `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t xml:space="preserve">${xml(title)}</w:t></w:r></w:p>` : "";
  const body = blocks(parse(html));
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${titlePara}${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const heading = (n, size) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr></w:style>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="48"/></w:rPr></w:style>${heading(1, 36)}${heading(2, 30)}${heading(3, 26)}${heading(4, 24)}</w:styles>`;
  const level = (i, fmt, text) => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr></w:lvl>`;
  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${W}><w:abstractNum w:abstractNumId="0">${[0, 1, 2, 3].map((i) => level(i, "bullet", ["•", "◦", "▪", "•"][i])).join("")}</w:abstractNum><w:abstractNum w:abstractNumId="1">${[0, 1, 2, 3].map((i) => level(i, ["decimal", "lowerLetter", "lowerRoman", "decimal"][i], `%${i + 1}.`)).join("")}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${links.map((href, i) => `<Relationship Id="rIdLink${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xml(href)}" TargetMode="External"/>`).join("")}</Relationships>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", document);
  zip.file("word/styles.xml", styles);
  zip.file("word/numbering.xml", numbering);
  zip.file("word/_rels/document.xml.rels", rels);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
