import React from "react";

// A small Markdown renderer for highlight notes. It builds React elements
// directly (no HTML strings), so a note can never inject markup or scripts.
// Supports: paragraphs, line breaks, # headings, > quotes, - / 1. lists,
// | tables |, ``` code blocks, **bold**, *italic*, `code`, ~~strike~~ and [links](https://…).

const SAFE_URL = /^(https?:\/\/|mailto:|\/(?!\/))/i;

function inline(text, keyBase = "i") {
  const out = [];
  const re = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\*[^*\n]+\*|_[^_\n]+_)|(~~[^~\n]+~~)|(\[[^\]\n]+\]\([^)\s]+\))|(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
  let last = 0, m, n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${keyBase}-${n++}`;
    const t = m[0];
    if (m[1]) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k}>{inline(t.slice(2, -2), k)}</strong>);
    else if (m[3]) out.push(<em key={k}>{inline(t.slice(1, -1), k)}</em>);
    else if (m[4]) out.push(<s key={k}>{inline(t.slice(2, -2), k)}</s>);
    else if (m[5]) {
      const [, label, href] = t.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      out.push(SAFE_URL.test(href)
        ? <a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow">{inline(label, k)}</a>
        : label);
    } else if (m[6]) out.push(<a key={k} href={t} target="_blank" rel="noopener noreferrer nofollow">{t}</a>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function withBreaks(lines, key) {
  return lines.flatMap((l, i) => (i ? [<br key={`${key}-br${i}`} />, ...inline(l, `${key}-${i}`)] : inline(l, `${key}-${i}`)));
}

// | a | b | rows with a |---|:---:| divider under the header
const TABLE_DIVIDER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const isTableStart = (lines, i) => lines[i].includes("|") && i + 1 < lines.length && lines[i + 1].includes("-") && TABLE_DIVIDER.test(lines[i + 1]);

function blocks(src, keyBase = "b") {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0, n = 0;
  const key = () => `${keyBase}-${n++}`;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (/^```/.test(line)) {
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      out.push(<pre key={key()}><code>{body.join("\n")}</code></pre>);
      continue;
    }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const Tag = `h${h[1].length + 2}`; // # -> h3, keeps notes below the page's own headings
      out.push(<Tag key={key()}>{inline(h[2], key())}</Tag>);
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ""));
      const k = key();
      out.push(<blockquote key={k}>{blocks(body.join("\n"), k)}</blockquote>);
      continue;
    }

    if (isTableStart(lines, i)) {
      const head = cells(line);
      const align = cells(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? "center" : /-:$/.test(c) ? "right" : undefined));
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) rows.push(cells(lines[i++]));
      const k = key();
      out.push(
        <div key={k} className="wb-md__table">
          <table>
            <thead><tr>{head.map((c, j) => <th key={j} style={{ textAlign: align[j] }}>{inline(c, `${k}-h${j}`)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{head.map((_, j) => <td key={j} style={{ textAlign: align[j] }}>{inline(r[j] || "", `${k}-${ri}-${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }

    const listRe = /^\s*([-*+]|\d+[.)])\s+(.*)$/;
    if (listRe.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items = [];
      while (i < lines.length && listRe.test(lines[i])) {
        const [, , text] = lines[i].match(listRe);
        const k = key();
        items.push(<li key={k}>{inline(text, k)}</li>);
        i++;
      }
      out.push(ordered ? <ol key={key()}>{items}</ol> : <ul key={key()}>{items}</ul>);
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,3}\s|>|\s*([-*+]|\d+[.)])\s)/.test(lines[i]) && !isTableStart(lines, i)) para.push(lines[i++]);
    if (!para.length) para.push(lines[i++]);
    const k = key();
    out.push(<p key={k}>{withBreaks(para, k)}</p>);
  }
  return out;
}

export default function Markdown({ source, className = "" }) {
  if (!source?.trim()) return null;
  return <div className={`wb-md ${className}`}>{blocks(source)}</div>;
}
