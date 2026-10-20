// Helpers for the Hosting Command Center (CommandCenter.jsx): the script cut into sections,
// chat postings filled in and copied, and library chapters as HTML for sharing on screen.
import { markdownToHtml } from "../../book/Markdown";

// The script document as sections, cut at its top level of headings (h1, else h2, else h3).
// Text before the first heading is its own section. No headings: one section, the whole script.
export async function scriptSections(script) {
  if (!script?.body?.trim()) return [];
  const html = script.body_format === "markdown" ? await markdownToHtml(script.body) : script.body;
  const body = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html").body.firstChild;
  const nodes = [...body.childNodes];
  const level = [1, 2, 3].find((n) => nodes.some((el) => el.tagName === `H${n}`));
  if (!level) return [{ title: script.title, html }];

  const sections = [];
  let current = null;
  for (const node of nodes) {
    if (node.tagName === `H${level}`) {
      current = { title: node.textContent.trim() || "Untitled", parts: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      if (!node.textContent.trim() && node.nodeType !== 1) continue;
      current = { title: "Before we begin", parts: [] };
      sections.push(current);
    }
    current.parts.push(node.nodeType === 1 ? node.outerHTML : node.textContent);
  }
  return sections.map(({ title, parts }) => ({ title, html: parts.join("") }));
}

// "{{meeting}}" and friends in a chat posting, filled in for this meeting and date
export const PLACEHOLDERS = [
  ["meeting", "the meeting's name"],
  ["group", "the group's name"],
  ["date", "today's date"],
  ["host", "the host's name"],
  ["co_host", "the co-host's name"],
  ["zoom_link", "the meeting's Zoom link"],
];

export function fillPosting(body, center) {
  const date = center?.on ? new Date(`${center.on}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) : "";
  const values = {
    meeting: center?.meeting?.name || "",
    group: center?.group?.title || "",
    date,
    host: center?.hosts?.host || "",
    co_host: center?.hosts?.co_host || "",
    zoom_link: center?.meeting?.conference_url || "",
  };
  return (body || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (all, key) => (key in values ? values[key] : all));
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt("Copy this:", text);
    return false;
  }
}

// "05:00": a posting's minute into the meeting, or the timer
export const mmss = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const BLOCKS = { paragraph: "p", blockquote: "blockquote", bulletList: "ul", orderedList: "ol", listItem: "li", table: "table", tableRow: "tr", tableHeader: "th", tableCell: "td" };
const MARKS = { bold: "strong", italic: "em", underline: "u", strike: "s", code: "code", highlight: "mark" };

// A library chapter (Tiptap JSON) as plain HTML to read from: text, headings, lists, quotes and
// tables, without the reader's page numbers and highlights
export function chapterHtml(node) {
  if (!node) return "";
  if (Array.isArray(node)) return node.map(chapterHtml).join("");
  if (node.type === "text") {
    return (node.marks || []).reduce((html, mark) => {
      if (mark.type === "link" && /^https?:\/\//i.test(mark.attrs?.href || "")) return `<a href="${esc(mark.attrs.href)}" target="_blank" rel="noopener noreferrer">${html}</a>`;
      const tag = MARKS[mark.type];
      return tag ? `<${tag}>${html}</${tag}>` : html;
    }, esc(node.text));
  }
  if (node.type === "hardBreak") return "<br>";
  if (node.type === "horizontalRule") return "<hr>";
  const inner = chapterHtml(node.content || []);
  if (node.type === "heading") {
    const level = Math.min(Math.max(Number(node.attrs?.level) || 2, 1), 4);
    return `<h${level}>${inner}</h${level}>`;
  }
  if (node.type === "table") return `<table><tbody>${inner}</tbody></table>`;
  const tag = BLOCKS[node.type];
  if (tag) return `<${tag}>${inner}</${tag}>`;
  return inner; // doc, page breaks and the reader's own nodes: just what's in them
}

export const readerHref = (r) => (r.url ? r.url : `/books/${encodeURIComponent(r.book_slug)}/chapters/${encodeURIComponent(r.chapter_slug)}`);
