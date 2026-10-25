import React from "react";

// A small Markdown renderer for highlight notes. It builds React elements
// directly (no HTML strings), so a note can never inject markup or scripts.
// Supports: paragraphs, line breaks, # headings, > quotes, - / 1. lists,
// | tables |, ``` code blocks, **bold**, *italic*, ++underline++, `code`, ~~strike~~ and [links](https://…).
// Bold can hold italic, so ***both*** and **bold *and italic* words** work.

const SAFE_URL = /^(https?:\/\/|mailto:|\/(?!\/))/i;

const INLINE = String.raw`(\x60[^\x60\n]+\x60)|(\*\*(?:[^*\n]|\*[^*\n]+\*)+?\*\*|__[^_\n]+__)|(\*[^*\n]+\*|_[^_\n]+_)|(~~[^~\n]+~~)|(\[[^\]\n]+\]\([^)\s]+\))|(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])|(\+\+[^+\n]+\+\+)`;
// A #hashtag, found as app/models/hashtags.rb finds them
const HASHTAG = String.raw`((?<![\p{L}\p{N}_&#/])#\p{L}[\p{L}\p{N}_]{0,49}(?![\p{L}\p{N}_]))`;

// `opts.hashtags`: #tags link to their page (/people/tags/:tag), as in timeline notes
function inline(text, keyBase = "i", opts = {}) {
  const out = [];
  const re = opts.hashtags ? new RegExp(`${INLINE}|${HASHTAG}`, "gu") : new RegExp(INLINE, "g");
  let last = 0, m, n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${keyBase}-${n++}`;
    const t = m[0];
    if (m[1]) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k}>{inline(t.slice(2, -2), k, opts)}</strong>);
    else if (m[3]) out.push(<em key={k}>{inline(t.slice(1, -1), k, opts)}</em>);
    else if (m[4]) out.push(<s key={k}>{inline(t.slice(2, -2), k, opts)}</s>);
    else if (m[5]) {
      const [, label, href] = t.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      out.push(SAFE_URL.test(href)
        ? <a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow">{inline(label, k)}</a>
        : label);
    } else if (m[6]) out.push(<a key={k} href={t} target="_blank" rel="noopener noreferrer nofollow">{t}</a>);
    else if (m[7]) out.push(<u key={k}>{inline(t.slice(2, -2), k, opts)}</u>);
    else if (m[8]) out.push(<a key={k} className="wb-hashtag" href={`/people/tags/${encodeURIComponent(t.slice(1).toLowerCase())}`}>{t}</a>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function withBreaks(lines, key, opts) {
  return lines.flatMap((l, i) => (i ? [<br key={`${key}-br${i}`} />, ...inline(l, `${key}-${i}`, opts)] : inline(l, `${key}-${i}`, opts)));
}

// | a | b | rows with a |---|:---:| divider under the header
const TABLE_DIVIDER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const isTableStart = (lines, i) => lines[i].includes("|") && i + 1 < lines.length && lines[i + 1].includes("-") && TABLE_DIVIDER.test(lines[i + 1]);

// `base` is added to a heading's level: notes keep theirs under the page's own headings (# is h3)
function blocks(src, keyBase = "b", base = 2, opts = {}) {
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
      const Tag = `h${h[1].length + base}`;
      out.push(<Tag key={key()}>{inline(h[2], key(), opts)}</Tag>);
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ""));
      const k = key();
      out.push(<blockquote key={k}>{blocks(body.join("\n"), k, base, opts)}</blockquote>);
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
            <thead><tr>{head.map((c, j) => <th key={j} style={{ textAlign: align[j] }}>{inline(c, `${k}-h${j}`, opts)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{head.map((_, j) => <td key={j} style={{ textAlign: align[j] }}>{inline(r[j] || "", `${k}-${ri}-${j}`, opts)}</td>)}</tr>)}</tbody>
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
        items.push(<li key={k}>{inline(text, k, opts)}</li>);
        i++;
      }
      out.push(ordered ? <ol key={key()}>{items}</ol> : <ul key={key()}>{items}</ul>);
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,3}\s|>|\s*([-*+]|\d+[.)])\s)/.test(lines[i]) && !isTableStart(lines, i)) para.push(lines[i++]);
    if (!para.length) para.push(lines[i++]);
    const k = key();
    out.push(<p key={k}>{withBreaks(para, k, opts)}</p>);
  }
  return out;
}

// `hashtags`: #tags are links to their page
export default function Markdown({ source, className = "", hashtags = false }) {
  if (!source?.trim()) return null;
  return <div className={`wb-md ${className}`}>{blocks(source, "b", 2, { hashtags })}</div>;
}

// The same Markdown as an HTML string, with # as h1, for opening an older document in the
// document editor
export async function markdownToHtml(source) {
  if (!source?.trim()) return "";
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(<>{blocks(source, "b", 0)}</>);
}
