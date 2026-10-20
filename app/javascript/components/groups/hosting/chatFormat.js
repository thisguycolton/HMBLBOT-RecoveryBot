// What a chat posting is written in, and how it reaches the Zoom chat.
//
// A posting is Markdown, written in a MarkdownTextarea (notes/MarkdownTextarea.jsx) with the
// pill that floats over selected text: **bold**, *italic*, ++underline++, ~~strikethrough~~,
// `code`, [links](https://…) and, for the colors, [text]{color=#dc2626 bg=#fde047}. Line breaks
// stay line breaks (it's chat, not a page).
//
// Copying puts two things on the clipboard (copyPosting in lib.js): this text as HTML with the
// formatting inline (what Zoom's chat takes on paste, and any other app), and as plain text, with
// the marks taken out and links written out, for a chat box that only takes text.

export const SAFE_URL = /^(https?:\/\/|mailto:)/i;
const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

// The swatches the pill offers for text and for the highlight behind it
export const TEXT_COLORS = [
  ["Red", "#dc2626"], ["Orange", "#ea580c"], ["Green", "#16a34a"], ["Blue", "#2563eb"], ["Purple", "#7c3aed"], ["Gray", "#6b7280"],
];
export const BACKGROUND_COLORS = [
  ["Yellow", "#fef08a"], ["Green", "#bbf7d0"], ["Blue", "#bfdbfe"], ["Pink", "#fbcfe8"], ["Orange", "#fed7aa"], ["Gray", "#e5e7eb"],
];

// "color=#dc2626 bg=#fde047" as { color, bg } (only colors that are real hex values)
export function parseAttrs(text) {
  const out = {};
  for (const pair of String(text || "").split(/\s+/)) {
    const [key, value] = pair.split("=");
    if ((key === "color" || key === "bg") && COLOR.test(value || "")) out[key] = value.toLowerCase();
  }
  return out;
}

// The other way, in a fixed order; "" when there is nothing left
export const formatAttrs = (attrs) => ["color", "bg"].filter((k) => attrs[k]).map((k) => `${k}=${attrs[k]}`).join(" ");

const escapeHtml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// One regex, one group per kind of mark; the span comes before the link, which it only differs
// from by what follows the brackets
const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(~~[^~\n]+~~)|(\+\+[^+\n]+\+\+)|(\[[^\]\n]+\]\{[^}\n]*\})|(\[[^\]\n]+\]\([^)\s]+\))|(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/;

// Walks a line's marks, calling `out` for each kind with its (already converted) inside
function walk(text, out) {
  let result = "";
  let last = 0;
  let m;
  const re = new RegExp(INLINE.source, "g"); // its own, since the marks inside a mark are walked too
  while ((m = re.exec(text))) {
    result += out.text(text.slice(last, m.index));
    const t = m[0];
    if (m[1]) result += out.code(t.slice(1, -1));
    else if (m[2]) result += out.bold(walk(t.slice(2, -2), out));
    else if (m[3]) result += out.italic(walk(t.slice(1, -1), out));
    else if (m[4]) result += out.strike(walk(t.slice(2, -2), out));
    else if (m[5]) result += out.underline(walk(t.slice(2, -2), out));
    else if (m[6]) {
      const [, label, attrs] = t.match(/^\[([^\]]+)\]\{([^}]*)\}$/);
      result += out.span(walk(label, out), parseAttrs(attrs));
    } else if (m[7]) {
      const [, label, href] = t.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      result += SAFE_URL.test(href) ? out.link(walk(label, out), href, label) : walk(label, out);
    } else result += out.link(out.text(t), t, t);
    last = m.index + t.length;
  }
  return result + out.text(text.slice(last));
}

const HTML = {
  text: escapeHtml,
  code: (t) => `<code>${escapeHtml(t)}</code>`,
  bold: (t) => `<strong>${t}</strong>`,
  italic: (t) => `<em>${t}</em>`,
  strike: (t) => `<s>${t}</s>`,
  underline: (t) => `<u>${t}</u>`,
  span: (t, a) => {
    const style = [a.color && `color:${a.color}`, a.bg && `background-color:${a.bg}`].filter(Boolean).join(";");
    return style ? `<span style="${style}">${t}</span>` : t;
  },
  link: (t, href) => `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${t}</a>`,
};

const PLAIN = {
  text: (t) => t,
  code: (t) => t,
  bold: (t) => t,
  italic: (t) => t,
  strike: (t) => t,
  underline: (t) => t,
  span: (t) => t,
  // a label that isn't the address is followed by it, since plain text can't hide it
  link: (t, href, label) => (label === href ? t : `${t} (${href})`),
};

const lines = (markdown) => String(markdown || "").replace(/\r\n?/g, "\n").split("\n");

// The posting as HTML: only tags written here, with the text and addresses escaped and the colors
// checked, so it is safe to show and to paste
export const postingHtml = (markdown) => lines(markdown).map((l) => walk(l, HTML)).join("<br>");

// The posting as plain text, the marks taken out
export const postingText = (markdown) => lines(markdown).map((l) => walk(l, PLAIN)).join("\n");

// Copies a posting for the Zoom chat: formatted where the chat takes formatting, plain where not
export async function copyPosting(markdown) {
  const html = `<div>${postingHtml(markdown)}</div>`;
  const text = postingText(markdown);
  try {
    await navigator.clipboard.write([new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([text], { type: "text/plain" }),
    })]);
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      window.prompt("Copy this:", text);
      return false;
    }
  }
}
