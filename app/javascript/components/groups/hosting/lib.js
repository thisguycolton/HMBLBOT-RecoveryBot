// Helpers for the Hosting Command Center (CommandCenter.jsx): the script cut into sections,
// chat postings filled in and copied, and library chapters as HTML for sharing on screen.
import { markdownToHtml } from "../../book/Markdown";
import { passcodeLabel } from "../MeetingPasscode";

// "{{ service_hiw }}" in a script or a chat posting: whoever is doing that service today
const ROLE_TOKEN = /\{\{\s*service_([a-z0-9_]+)\s*\}\}/gi;
export const roleToken = (key) => `{{ service_${key} }}`;
// The key a new role gets from its label, as HostingKit makes it ("Closing reading" is closing_reading)
export const roleKey = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

// Who is doing each service today: what the hosts typed, else the schedule's host and co-host
export const serviceNames = (center, live) => ({ host: center?.hosts?.host || "", co_host: center?.hosts?.co_host || "", ...(live?.service || {}) });

// The dynamic values a script or chat posting names as {{ key }}, filled in for the meeting and
// date. The service roles ({{ service_hiw }}) come on top, from the kit. Host coordinators pick
// which ones the document editor offers (Insert > Dynamic values); "service" stands for the roles.
export const DYNAMIC_VALUES = [
  { key: "meeting", label: "Meeting name", what: "the meeting's name" },
  { key: "group", label: "Group name", what: "the group's name" },
  { key: "date", label: "Date", what: "today's date" },
  { key: "start_time", label: "Start time", what: "when the meeting starts" },
  { key: "host", label: "Host", what: "the host's name" },
  { key: "co_host", label: "Co-host", what: "the co-host's name" },
  { key: "zoom_link", label: "Zoom link", what: "the meeting's Zoom link" },
  { key: "zoom_passcode", label: "Zoom passcode", what: "the meeting's passcode, like “Password: 415542”" },
  { key: "activity", label: "Reading / activity", what: "the day's reading or activity" },
  { key: "speaker_name", label: "Speaker's name", what: "the speaker, when today's activity is a speaker" },
  { key: "topic", label: "Topic", what: "the latest topic drawn" },
  { key: "milestones", label: "Milestones", what: "who's celebrating, like “Kim (30 days) and Sam (1 year)”" },
];
export const SERVICE_VALUES = "service";
export const valueToken = (key) => `{{ ${key} }}`;

// The values the document editor offers: what the kit allows (null: all), with the roles as their own chips
export function offeredValues(allowed, roles = []) {
  const ok = (key) => !allowed || allowed.includes(key);
  return [
    ...DYNAMIC_VALUES.filter((v) => ok(v.key)),
    // the schedule's host and co-host are already above
    ...(ok(SERVICE_VALUES) ? roles.filter((r) => !["host", "co_host"].includes(r.key)).map((r) => ({ key: `service_${r.key}`, label: r.label, what: `who's doing ${r.label} today`, service: true })) : []),
  ];
}

// "Kim (30 days) and Sam (1 year)"
export function milestonesText(milestones = []) {
  const parts = milestones.map((m) => (m.length ? `${m.name} (${m.length})` : m.name));
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0] || "";
}

// Every value for this meeting and date, by key (the roles as service_KEY)
export function dynamicValues(center, live = null) {
  const names = serviceNames(center, live);
  const activity = live?.activity;
  const topics = activity?.kind === "topics" ? activity.topics || [] : [];
  const values = {
    meeting: center?.meeting?.name || "",
    group: center?.group?.title || "",
    date: center?.on ? new Date(`${center.on}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) : "",
    start_time: center?.starts_at ? new Date(center.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", ...(center.meeting?.time_zone ? { timeZone: center.meeting.time_zone } : {}) }) : "",
    host: center?.hosts?.host || "",
    co_host: center?.hosts?.co_host || "",
    zoom_link: center?.meeting?.conference_url || "",
    zoom_passcode: passcodeLabel(center?.meeting?.conference_url_notes),
    activity: activityLabel(activity),
    speaker_name: activity?.kind === "speaker" ? activity.title || "" : "",
    topic: topics.length ? topics[topics.length - 1].title : "",
    milestones: live?.milestones_text ?? milestonesText(live?.milestones),
  };
  Object.entries(names).forEach(([key, name]) => { values[`service_${key}`] = name; });
  return values;
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const VALUE_TOKEN = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
const VALUE_MARK = /⟦v:([a-z0-9_]+)⟧/g;

// A section's HTML with today's values in it. One nobody has yet (a service role not filled in, no
// milestones) shows what it is, dimmed; an unknown {{ name }} stays as it was typed.
export function fillValues(html, center, live, roles = []) {
  const values = dynamicValues(center, live);
  return html.replace(VALUE_MARK, (_, key) => {
    if (!(key in values) && !key.startsWith("service_")) return `{{ ${key} }}`;
    if (values[key]) return `<span class="hc-role">${esc(values[key])}</span>`;
    const role = key.startsWith("service_") && roles.find((r) => `service_${r.key}` === key);
    const known = DYNAMIC_VALUES.find((v) => v.key === key);
    const name = role?.label || (key === "milestones" ? "nobody celebrating yet" : known?.label) || key.replace(/^service_/, "").replace(/_/g, " ");
    const hint = role ? "Nobody yet: fill it in on the first section" : key === "milestones" ? "Add them under Celebrating milestones" : "Not known yet";
    return `<span class="hc-role hc-role--empty" title="${hint}">${esc(name)}</span>`;
  });
}

const squish = (text) => (text || "").replace(/\s+/g, " ").trim();

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
// What comes before the script's first section, unless the kit (or deck) names it
export const INTRO_TITLE = "Before we begin";

// What a section can be shown for (a section's "Only when today's activity is"): the activity
// kinds, with the three kinds of reading as one
export const ACTIVITY_CONDITIONS = [["reading", "A reading"], ["topics", "Topicificator"], ["speaker", "Speaker"], ["meditation", "Meditation"], ["other", "Something else"]];
export const conditionOf = (kind) => (["reading", "daily", "my_reading"].includes(kind) ? "reading" : kind);
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// A section's reminder: "start+30" is 30 minutes in, "end-10" ten minutes before the end
export function parseCue(text) {
  const m = /^(start|end)([+-]\d{1,3})?$/.exec(String(text || "").trim());
  return m ? { from: m[1], minutes: Number(m[2] || 0) } : null;
}
export function cueLabel(cue) {
  if (!cue) return "";
  const n = Math.abs(cue.minutes);
  if (cue.from === "start") return cue.minutes > 0 ? `${n} min in` : cue.minutes < 0 ? `${n} min before the start` : "At the start";
  return cue.minutes < 0 ? `${n} min before the end` : cue.minutes > 0 ? `${n} min after the end` : "At the end";
}
// When a section's reminder goes off (ms), for the meeting's start and end
export function cueTime(cue, startsAt, endsAt) {
  const base = cue?.from === "start" ? startsAt : endsAt;
  return cue && base ? new Date(base).getTime() + cue.minutes * 60000 : null;
}

// The script's top-level blocks (paragraphs, headings, lists, section marks...) as DOM nodes
async function scriptNodes(script) {
  if (!script?.body?.trim()) return [];
  // {{ service_hiw }}, {{ milestones }}... become a mark Markdown leaves alone (an underscore could
  // start italics), filled in when the section shows (fillValues)
  const source = script.body.replace(VALUE_TOKEN, (_, key) => `⟦v:${key.toLowerCase()}⟧`);
  const html = script.body_format === "markdown" ? await markdownToHtml(source) : source;
  const body = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html").body.firstChild;
  return [...body.childNodes].filter((n) => n.nodeType === 1 || n.textContent.trim());
}

// The script's paragraphs, for picking which one the reading / activity follows
export async function scriptParagraphs(script) {
  return (await scriptNodes(script)).filter((n) => !isMarker(n)).map((n) => squish(n.textContent)).filter((t) => t.length > 0);
}

const matchesAnchor = (node, anchor) => {
  const text = squish(node.textContent);
  if (!text) return false;
  return anchor ? text.startsWith(anchor.slice(0, 160)) : AUTO_ANCHOR.test(text);
};

// A section mark (Insert > Add Section in the document editor): <div data-hc-section data-title=...>
export const isMarker = (node) => node.tagName === "DIV" && node.hasAttribute?.("data-hc-section");
const list = (text) => String(text || "").split(",").map((x) => x.trim()).filter(Boolean);
export function markerInfo(node) {
  const days = list(node.getAttribute("data-days")).map(Number).filter((d) => d >= 0 && d <= 6);
  const when = list(node.getAttribute("data-when"));
  const cue = parseCue(node.getAttribute("data-cue"));
  return {
    title: squish(node.getAttribute("data-title")) || "Untitled section",
    ...(node.getAttribute("data-kind") === "activity" ? { activity: true } : {}),
    ...(when.length ? { when } : {}),
    ...(days.length ? { days } : {}),
    ...(cue ? { cue } : {}),
  };
}

// The script document as sections. Sections made in the document editor (Insert > Add Section)
// cut it, each with its title and conditions; else it is cut at its headings (the top level with
// two or more: h1, else h2, else h3), or at its bold time cues ("(Top of the hour)"); with none
// of those it is one section. What comes before the first cut is `intro` ("Before we begin" unless
// the kit or deck names it).
// The day's reading / activity is the section marked as its spot, or else gets a section of its
// own right after the paragraph `anchor` begins (by itself: the "You choose the format!" line;
// "none": no spot).
export async function scriptSections(script, anchor = null, intro = null) {
  const nodes = await scriptNodes(script);
  if (!nodes.length) return [];
  const marked = nodes.some(isMarker);
  const level = !marked && [1, 2, 3].find((n) => nodes.filter((el) => el.tagName === `H${n}`).length >= 2);
  const breaks = marked ? isMarker : level ? (node) => node.tagName === `H${level}` : nodes.filter(isCue).length >= 2 ? isCue : () => false;
  const headOf = (node) => (marked ? markerInfo(node) : { title: level ? squish(node.textContent) || "Untitled" : cueTitle(node) });
  const hasSpot = marked && nodes.some((n) => isMarker(n) && n.getAttribute("data-kind") === "activity");
  const spot = anchor === "none" || hasSpot ? null : nodes.find((n) => !breaks(n) && matchesAnchor(n, anchor));

  const sections = [];
  let current = null;
  let last = { title: script.title };
  for (const node of nodes) {
    if (breaks(node)) {
      last = headOf(node);
      current = { ...last, parts: [] };
      sections.push(current);
      continue;
    }
    if (!current || current.spot) {
      // after the reading / activity spot, the rest of that section carries on (and keeps its conditions)
      const { activity, ...rest } = last;
      current = current?.spot ? { ...rest, title: `${last.title} (continued)`, parts: [] } : { title: sections.length ? last.title : intro || INTRO_TITLE, parts: [] };
      sections.push(current);
    }
    current.parts.push(node.outerHTML || node.textContent);
    if (node === spot) {
      current = { title: ACTIVITY_TITLE, parts: [], activity: true, spot: true };
      sections.push(current);
    }
  }
  // a section that is only a heading (the document's title above the first cue) joins the next one
  const merged = [];
  let carry = [];
  for (const sec of sections) {
    const onlyHeadings = !marked && !sec.activity && sec.parts.length > 0 && sec.parts.every((p) => /^<h[1-6][\s>]/i.test(p));
    if (onlyHeadings && sec !== sections[sections.length - 1]) { carry = carry.concat(sec.parts); continue; }
    merged.push({ ...sec, parts: carry.concat(sec.parts) });
    carry = [];
  }
  return merged.map(({ parts, spot: _, ...sec }) => ({ ...sec, html: parts.join("") }));
}

// Whether a section is for today: its days, and the day's reading or activity. Returns null when
// it is, or why it's skipped ("Only with a speaker", "Only on Sat").
export function skipReason(section, { activity, weekday }) {
  if (section.days && !section.days.includes(weekday)) return `Only on ${section.days.map((d) => WEEKDAYS[d]).join(", ")}`;
  if (section.when && !(activity && section.when.includes(conditionOf(activity.kind)))) {
    const names = section.when.map((w) => (ACTIVITY_CONDITIONS.find(([k]) => k === w)?.[1] || w).toLowerCase());
    return `Only with ${names.join(" or ")}`;
  }
  return null;
}

// "{{meeting}}" and friends in a chat posting, filled in for this meeting and date
export const PLACEHOLDERS = DYNAMIC_VALUES.map((v) => [v.key, v.what]);

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

export function fillPosting(body, center, live = null) {
  const values = dynamicValues(center, live);
  return (body || "")
    .replace(ROLE_TOKEN, (_, key) => values[`service_${key.toLowerCase()}`] || "")
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (all, key) => (key in values ? values[key] : all));
}

// The posting that goes with a reading picked from the hosts' own (activity kind "my_reading"):
// what the reading's page copies (its title, its link and the example topics), so it is ready to
// paste when the reading comes up. It isn't one of the kit's postings; the Command Center puts it
// first in the list while that reading is today's.
export function readingPosting(activity) {
  if (activity?.kind !== "my_reading" || !activity.reading_id) return null;
  const rule = "====================";
  const lines = [rule, "**Reading:**", activity.title, `${window.location.origin}${activity.reading_path}`, rule];
  if (activity.reading_topics) lines.push("**Example Topics For Sharing:**", "Feel free to check in!", "---------------------", activity.reading_topics);
  return { id: "reading", title: `Reading: ${activity.title}`, icon: "book-open", minute: 0, body: lines.join("\n"), virtual: true };
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

// "05:00": a posting's minute into the meeting, or the timer (a countdown, before the start)
export const mmss = (seconds) => {
  const s = Math.abs(Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};

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
