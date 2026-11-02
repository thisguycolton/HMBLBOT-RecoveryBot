// Step work as plain text (StepTool, StepWork), for sending to a sponsor and copying: each
// section's title and what was written, leaving out anything empty. `only` is a part's title
// to send just that part.

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

function sectionText(s, definition, answers, settings) {
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
    default:
  }
  return out.length ? `${s.title ? `${s.title.toUpperCase()}\n` : ""}${out.join("\n\n")}` : "";
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
