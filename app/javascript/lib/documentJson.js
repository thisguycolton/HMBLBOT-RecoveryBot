// A group document as a RecoveryBot JSON file (File > Download as RecoveryBot JSON), and back
// (File > Import). Word, RTF and Markdown lose what only RecoveryBot has; this keeps all of it:
// the Hosting Command Center's sections with their conditions and reminders, its forms, dynamic
// values, collapsible text, table colors. The editor's own document (Tiptap's JSON) is the source;
// "objects" lists the RecoveryBot parts for a person reading the file, and "html" is the same
// text for other programs. Importing reads "content" only.
export const JSON_FORMAT = "recoverybot-document";
export const JSON_VERSION = 1;

const TOKEN = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
const textOf = (node) => (node.text || "") + (node.content || []).map(textOf).join("");

// The RecoveryBot parts of a document, from its Tiptap JSON
export function describe(content) {
  const objects = { sections: [], forms: [], dynamic_values: [], collapsibles: [] };
  const values = new Set();
  const walk = (node) => {
    if (node.type === "hostSection") {
      const a = node.attrs || {};
      objects.sections.push(Object.fromEntries(Object.entries({ title: a.title, activity_spot: a.kind === "activity" || null, only_when: a.when, only_on_days: a.days, reminder: a.cue }).filter(([, v]) => v)));
    }
    if (node.type === "hostForm") objects.forms.push(node.attrs?.form || "milestones");
    if (node.type === "collapsible") objects.collapsibles.push(textOf(node.content?.[0] || {}));
    if (node.text) for (const m of node.text.matchAll(TOKEN)) values.add(m[1].toLowerCase());
    (node.content || []).forEach(walk);
  };
  walk(content);
  objects.dynamic_values = [...values];
  return objects;
}

// -> the file's text
export function toDocumentJson(editor, details) {
  const content = editor.getJSON();
  return JSON.stringify({
    format: JSON_FORMAT,
    version: JSON_VERSION,
    exported_at: new Date().toISOString(),
    document: details,
    objects: describe(content),
    content,
    html: editor.isEmpty ? "" : editor.getHTML(),
  }, null, 2);
}

// What a file's parts add up to, for the note after importing
const count = (n, one, many = `${one}s`) => (n ? `${n} ${n === 1 ? one : many}` : null);
function summarize(objects) {
  const parts = [count(objects.sections.length, "section"), count(objects.forms.length, "form"), count(objects.collapsibles.length, "collapsible"), count(objects.dynamic_values.length, "dynamic value")].filter(Boolean);
  return parts.length ? `It has ${parts.join(", ")}.` : null;
}

// -> { title, html, notes, kind } from a RecoveryBot JSON file's text, or throws an Error
export async function fromDocumentJson(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("That .json file isn't readable JSON."); }
  if (data?.format !== JSON_FORMAT || !data.content || data.content.type !== "doc") {
    throw new Error("That .json file isn't a RecoveryBot document. Use one made with File > Download as RecoveryBot JSON.");
  }
  if (data.version > JSON_VERSION) throw new Error("That file was made by a newer RecoveryBot. Reload the page and try again.");

  // The editor's parts are loaded only when a JSON file is imported
  const [{ getSchema, getHTMLFromFragment }, { documentExtensions }] = await Promise.all([
    import("@tiptap/core"),
    import("../components/groups/conscience/editorKit"),
  ]);
  const schema = getSchema(documentExtensions());

  // Anything this editor doesn't know is left out, not a reason to refuse the whole file
  let dropped = 0;
  const clean = (node) => {
    if (!node || typeof node !== "object" || !schema.nodes[node.type]) { dropped += 1; return null; }
    const out = { type: node.type };
    if (node.attrs && typeof node.attrs === "object") out.attrs = node.attrs;
    if (node.type === "text") {
      if (typeof node.text !== "string" || !node.text) return null;
      out.text = node.text;
    }
    if (Array.isArray(node.marks)) out.marks = node.marks.filter((m) => m && schema.marks[m.type]);
    if (Array.isArray(node.content)) out.content = node.content.map(clean).filter(Boolean);
    return out;
  };

  let doc;
  try {
    doc = schema.nodeFromJSON(clean(data.content));
    doc.check();
  } catch {
    throw new Error("That RecoveryBot document is damaged and couldn't be imported.");
  }
  const html = doc.textContent.trim() || doc.childCount > 1 || doc.firstChild?.type.name !== "paragraph" ? getHTMLFromFragment(doc.content, schema) : "";
  const notes = [summarize(describe(doc.toJSON())), dropped ? "A few parts this version of RecoveryBot doesn't know were left out." : null].filter(Boolean);
  return { title: String(data.document?.title || "").slice(0, 160), html, notes, kind: data.document?.kind || null };
}
