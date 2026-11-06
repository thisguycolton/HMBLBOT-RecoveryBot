// Step work as plain text (StepTool, StepWork), for sending to a sponsor and copying: each
// section's title and what was written, leaving out anything empty. `only` is a part's title
// to send just that part.

import { readingPieces } from "./readingLinks";

const fill = (text, settings) => (text || "").replaceAll("{{higher_power}}", settings?.higher_power || "God");

// The sections in each part, in order: [{ part, sections }]
export function partsOf(definition) {
  const parts = [];
  (definition.sections || []).forEach((s) => {
    if (s.part || !parts.length) parts.push({ part: s.part || null, sections: [] });
    parts[parts.length - 1].sections.push(s);
  });
  return parts;
}

// A Reading section with a list of readings to tick off (answers: { reading id => date read })
export const isReadingList = (s) => s.kind === "reference" && s.items?.length > 0;
// Where a reading opens in the library: its own link, or the first reading its label names
export const readingHref = (item) => item.href || readingPieces(item.label).find((p) => typeof p !== "string")?.href || null;
const takesAnswers = (s) => !["reference", "note"].includes(s.kind);

// The worksheet a page at a time: [{ id, number, title, part, sections }]. `id` is the id of the
// page's first section (so where someone stopped survives pages being moved). A section with
// `page` (its title) starts a page; when none has one, each section that takes answers starts a
// page, a reading just before it joins it, a note stays with the page it follows, and a `part`
// always starts one. A page's `line` (`page_line`) is a sentence under its title. Pages that are
// nothing but reading lists are left out (those show on the Welcome page), unless `all`.
// A page with only reading lists (a note may sit with them) shows on the Welcome page instead
export const readingsOnly = (p) => p.sections.some(isReadingList) && p.sections.every((s) => isReadingList(s) || s.kind === "note");

export function pagesOf(definition, { all = false } = {}) {
  const sections = definition.sections || [];
  const manual = sections.some((s) => s.page);
  const pages = [];
  let part = null;
  sections.forEach((s) => {
    if (s.part) part = s.part;
    const cur = pages[pages.length - 1];
    let fresh;
    if (!cur) fresh = true;
    else if (manual) fresh = !!(s.page || s.part);
    else if (s.part) fresh = true;
    else if (s.kind === "note") fresh = false;
    else fresh = cur.sections.some(takesAnswers);
    if (fresh) pages.push({ id: s.id, part, title: s.page?.trim() || null, line: s.page_line?.trim() || null, sections: [] });
    pages[pages.length - 1].sections.push(s);
  });
  const kept = pages.length > 1 && !all ? pages.filter((p) => !readingsOnly(p)) : pages;
  return kept.map((p, n) => ({ ...p, number: n + 1, title: p.title || (p.sections.find(takesAnswers) || p.sections[0])?.title || `Page ${n + 1}` }));
}

const filled = (v) => {
  if (v == null || v === false) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.some(filled);
  if (typeof v === "object") return Object.values(v).some(filled);
  return true;
};
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// How far along a section is: { started, hint } ("2 of 5 answered", "3 written")
export function sectionProgress(s, answers, definition) {
  const a = answers?.[s.id];
  const list = Array.isArray(a) ? a : [];
  let n;
  switch (s.kind) {
    case "questions":
      n = (s.items || []).filter((i) => filled(a?.[i.id])).length;
      return { started: n > 0, hint: n ? `${n} of ${(s.items || []).length} answered` : null };
    case "list":
      n = list.filter(filled).length;
      return { started: n > 0, hint: n ? `${n} written` : null };
    case "table":
      n = list.filter(filled).length;
      return { started: n > 0, hint: n ? count(n, "row", "rows") : null };
    case "picker":
      n = list.length;
      return { started: n > 0, hint: n ? `${n} picked` : null };
    case "each": {
      const things = thingsFor(s, definition, answers);
      n = things.filter((t) => filled(a?.[t])).length;
      return { started: n > 0, hint: n ? `${n} of ${things.length} done` : null };
    }
    case "days":
      n = list.filter((w) => filled(w?.days) || filled(w?.review)).length;
      return { started: n > 0, hint: n ? count(n, "week", "weeks") : null };
    default:
      return { started: filled(a), hint: null };
  }
}

export function pageProgress(page, answers, definition) {
  const each = page.sections.filter(takesAnswers).map((s) => sectionProgress(s, answers, definition));
  const started = each.some((p) => p.started);
  return { started, hint: !started ? "Not started" : (each.length === 1 && each[0].hint) || "Started" };
}

// What an `each` or `scale` section goes over: a table's rows (by its first column), a picker's
// picks, or a fixed list
export function thingsFor(section, definition, answers) {
  if (section.over?.length) return section.over;
  const from = (definition.sections || []).find((s) => s.id === section.from);
  if (!from) return [];
  const a = answers[from.id];
  if (from.kind === "picker") return Array.isArray(a) ? a : [];
  if (from.kind === "table") {
    const col = from.columns[0]?.id;
    return (Array.isArray(a) ? a : []).map((r) => (r?.[col] || "").trim()).filter(Boolean);
  }
  return [];
}

const show = (v) => (Array.isArray(v) ? v.join(", ") : (v || "").toString().trim());

function sectionText(s, definition, answers, settings, withTitle = true) {
  const a = answers[s.id];
  const out = [];
  switch (s.kind) {
    case "questions":
      (s.items || []).forEach((i) => { const v = show(a?.[i.id]); if (v) out.push(`${fill(i.label, settings)}\n${v}`); });
      break;
    case "list":
      (Array.isArray(a) ? a : []).filter((x) => x?.trim()).forEach((x, n) => out.push(`${n + 1}. ${x.trim()}`));
      break;
    case "table":
      (Array.isArray(a) ? a : []).forEach((row, n) => {
        const cells = s.columns.map((c) => [c.label, show(row?.[c.id])]).filter(([, v]) => v);
        if (cells.length) out.push(`${n + 1}. ${cells.map(([l, v]) => `${l}: ${v}`).join("\n   ")}`);
      });
      break;
    case "picker":
      if (Array.isArray(a) && a.length) out.push(a.join(", "));
      break;
    case "each":
      thingsFor(s, definition, answers).forEach((thing) => {
        const vals = a?.[thing] || {};
        const lines = (s.items || []).map((i) => [i.label, show(vals[i.id])]).filter(([, v]) => v);
        if (lines.length) out.push(`${thing}\n${lines.map(([l, v]) => `  ${l} ${v}`).join("\n")}`);
      });
      break;
    case "scale":
      thingsFor(s, definition, answers).forEach((thing) => {
        const last = (a?.[thing] || []).at(-1);
        if (last) out.push(`${thing}: ${last.value}`);
      });
      break;
    case "days":
      (Array.isArray(a) ? a : []).forEach((week, n) => {
        const lines = [...(s.items || []), ...(s.review || [])]
          .map((i) => [i.label, show(week?.days?.[i.id] ?? week?.review?.[i.id])]).filter(([, v]) => v);
        if (lines.length) out.push(`Week ${n + 1}\n${lines.map(([l, v]) => `  ${l} ${v}`).join("\n")}`);
      });
      break;
    case "reference":
      (s.items || []).filter((r) => a?.[r.id]).forEach((r) => out.push(`✓ ${r.label} (read ${a[r.id]})`));
      break;
    default:
  }
  return out.length ? `${withTitle && s.title ? `${s.title.toUpperCase()}\n` : ""}${out.join("\n\n")}` : "";
}

// A page's answers as one short line, for the Review page
export function pageSummary(page, work) {
  const { definition, answers = {}, settings } = work;
  const text = page.sections.filter(takesAnswers).map((s) => sectionText(s, definition, answers, settings, false)).filter(Boolean).join(" · ");
  const line = text.replace(/\s*\n\s*/g, " · ").replace(/\s+/g, " ").trim();
  return line.length > 160 ? `${line.slice(0, 157).trimEnd()}…` : line;
}

export function workText(work, only = null) {
  const { definition, answers = {}, settings } = work;
  return partsOf(definition)
    .filter((p) => only === null || p.part === only)
    .map((p) => {
      const body = p.sections.map((s) => sectionText(s, definition, answers, settings)).filter(Boolean).join("\n\n");
      return body && p.part && only === null ? `== ${p.part} ==\n\n${body}` : body;
    })
    .filter(Boolean)
    .join("\n\n");
}

export { fill };
