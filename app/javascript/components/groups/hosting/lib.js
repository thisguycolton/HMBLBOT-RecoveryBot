// Helpers for the Hosting Command Center (CommandCenter.jsx): the script cut into sections,
// chat postings filled in and copied, and library chapters as HTML for sharing on screen.
import { markdownToHtml } from "../../book/Markdown";

const squish = (text) => (text || "").replace(/\s+/g, " ").trim();
const isHeading = (node) => /^H[1-6]$/.test(node.tagName || "");

// A paragraph that is only bold text, short, like "(Top of the hour)": a script's time cues
const isCue = (node) => {
  const text = squish(node.textContent);
  return node.tagName === "P" && text.length > 0 && text.length <= 80 &&
    [...node.childNodes].every((n) => (n.nodeType === 3 && !n.textContent.trim()) || /^(STRONG|B)$/.test(n.tagName || ""));
};
const cueTitle = (node) => {
  const text = squish(node.textContent).replace(/^\((.*)\)$/, "$1").replace(/^\*+|\*+$/g, "").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Where the day's reading or activity goes when nobody said: the line most formats have there
export const AUTO_ANCHOR = /you choose the format|reading\s*\/\s*activity|speaker,\s*topic/i;
export const ACTIVITY_TITLE = "Reading / activity";

// The script's top-level blocks (paragraphs, headings, lists...) as DOM nodes
async function scriptNodes(script) {
  if (!script?.body?.trim()) return [];
  const html = script.body_format === "markdown" ? await markdownToHtml(script.body) : script.body;
  const body = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html").body.firstChild;
  return [...body.childNodes].filter((n) => n.nodeType === 1 || n.textContent.trim());
}

// The script's paragraphs, for picking which one the reading / activity follows
export async function scriptParagraphs(script) {
  return (await scriptNodes(script)).map((n) => squish(n.textContent)).filter((t) => t.length > 0);
}

const matchesAnchor = (node, anchor) => {
  const text = squish(node.textContent);
  if (!text) return false;
  return anchor ? text.startsWith(anchor.slice(0, 160)) : AUTO_ANCHOR.test(text);
};

// The script document as sections. It is cut at its headings (the top level with two or more:
// h1, else h2, else h3), or failing that at its bold time cues ("(Top of the hour)"); with
// neither it is one section. The day's reading / activity gets a section of its own, right after
// the paragraph `anchor` begins (by itself: the "You choose the format!" line; "none": no spot).
export async function scriptSections(script, anchor = null) {
  const nodes = await scriptNodes(script);
  if (!nodes.length) return [];
  const level = [1, 2, 3].find((n) => nodes.filter((el) => el.tagName === `H${n}`).length >= 2);
  const breaks = level ? (node) => node.tagName === `H${level}` : nodes.filter(isCue).length >= 2 ? isCue : () => false;
  const titleOf = (node) => (level ? squish(node.textContent) || "Untitled" : cueTitle(node));
  const spot = anchor === "none" ? null : nodes.find((n) => !breaks(n) && matchesAnchor(n, anchor));

  const sections = [];
  let current = null;
  let lastTitle = script.title;
  for (const node of nodes) {
    if (breaks(node)) {
      lastTitle = titleOf(node);
      current = { title: lastTitle, parts: [] };
      sections.push(current);
      continue;
    }
    if (!current || current.activity) {
      current = { title: current?.activity ? `${lastTitle} (continued)` : sections.length ? lastTitle : "Before we begin", parts: [] };
      sections.push(current);
    }
    current.parts.push(node.outerHTML || node.textContent);
    if (node === spot) {
      current = { title: ACTIVITY_TITLE, parts: [], activity: true };
      sections.push(current);
    }
  }
  // a section that is only a heading (the document's title above the first cue) joins the next one
  const merged = [];
  let carry = [];
  for (const sec of sections) {
    const onlyHeadings = !sec.activity && sec.parts.length > 0 && sec.parts.every((p) => /^<h[1-6][\s>]/i.test(p));
    if (onlyHeadings && sec !== sections[sections.length - 1]) { carry = carry.concat(sec.parts); continue; }
    merged.push({ ...sec, parts: carry.concat(sec.parts) });
    carry = [];
  }
  return merged.map(({ title, parts, activity }) => ({ title, html: parts.join(""), ...(activity ? { activity: true } : {}) }));
}

// "{{meeting}}" and friends in a chat posting, filled in for this meeting and date
export const PLACEHOLDERS = [
  ["meeting", "the meeting's name"],
  ["group", "the group's name"],
  ["date", "today's date"],
  ["host", "the host's name"],
  ["co_host", "the co-host's name"],
  ["zoom_link", "the meeting's Zoom link"],
  ["activity", "the day's reading or activity"],
];

// "Daily Reflections: October 20", "Topic: Gratitude", "Speaker: Kim R."
export function activityLabel(activity) {
  if (!activity) return "";
  if (activity.kind === "topics") {
    const last = activity.topics?.[activity.topics.length - 1];
    return last ? `Topic: ${last.title}` : activity.topic_set_name || "Topicificator";
  }
  const kind = { reading: "", daily: "", speaker: "Speaker", meditation: "Meditation", other: "" }[activity.kind] ?? "";
  const title = [activity.book_title, activity.title].filter(Boolean).join(": ");
  return kind ? (activity.title ? `${kind}: ${activity.title}` : kind) : title || "Reading / activity";
}

export function fillPosting(body, center, activity = null) {
  const date = center?.on ? new Date(`${center.on}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) : "";
  const values = {
    meeting: center?.meeting?.name || "",
    group: center?.group?.title || "",
    date,
    host: center?.hosts?.host || "",
    co_host: center?.hosts?.co_host || "",
    zoom_link: center?.meeting?.conference_url || "",
    activity: activityLabel(activity),
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
