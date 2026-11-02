import React from "react";
import { fill, partsOf, thingsFor } from "./stepText";

// A worksheet on paper (and on the shared link's page): their own copy of it, so whatever they
// or their sponsor changed (sections, wording, columns, choices) is what prints. With
// `blank`, an empty form to fill in by hand; otherwise what they wrote, with room to keep
// writing wherever something's still empty.

const has = (v) => (Array.isArray(v) ? v.some((x) => (typeof x === "string" ? x.trim() : x)) : typeof v === "string" ? v.trim() !== "" : v != null && v !== "");
const show = (v) => (Array.isArray(v) ? v.filter(Boolean).join(", ") : String(v ?? "").trim());

function Lines({ n = 3 }) {
  return <div aria-hidden="true">{Array.from({ length: n }, (_, i) => <div key={i} className="h-7 border-b border-slate-300" />)}</div>;
}

function Box({ on }) {
  return <span aria-hidden="true" className={`mr-1.5 inline-grid size-3.5 place-items-center rounded-[3px] border border-slate-500 align-[-2px] text-[10px] leading-none ${on ? "bg-slate-800 text-white" : ""}`}>{on ? "✓" : ""}</span>;
}

function Answer({ value, rows = 3, blank }) {
  if (!blank && has(value)) return <div className="whitespace-pre-wrap border-l-2 border-slate-300 pl-3 text-[11pt] leading-relaxed">{show(value)}</div>;
  return <Lines n={rows} />;
}

// A choice (or several) as boxes to tick, the picked ones ticked
function Choices({ options, value, blank }) {
  const picked = Array.isArray(value) ? value : value ? [value] : [];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10.5pt]">
      {options.map((o) => <span key={o}><Box on={!blank && picked.includes(o)} />{o}</span>)}
    </div>
  );
}

function Item({ item, value, blank, settings }) {
  return (
    <div className="break-inside-avoid space-y-1.5">
      <div className="font-medium">{fill(item.label, settings)}</div>
      {item.type ? <Choices options={item.options || []} value={value} blank={blank} /> : <Answer value={value} rows={item.rows || 3} blank={blank} />}
    </div>
  );
}

function Section({ s, definition, answers, settings, blank }) {
  const a = blank ? undefined : answers[s.id];
  const title = s.title && <h3 className="text-[12.5pt] font-semibold">{fill(s.title, settings)}</h3>;
  const help = s.help && <p className="text-[10pt] italic text-slate-600">{fill(s.help, settings)}</p>;
  const head = (title || help) && <div className="space-y-0.5">{title}{help}</div>;

  switch (s.kind) {
    case "reference":
      return (
        <section className="break-inside-avoid space-y-1.5">
          {head}
          <blockquote className="border-l-2 border-slate-400 pl-3 text-[10.5pt] italic text-slate-700">
            {fill(s.body, settings).trim().split(/\s*\n\s*/).map((p, n) => <p key={n} className="mb-1">{p.replaceAll("**", "")}</p>)}
          </blockquote>
        </section>
      );
    case "note":
      return (
        <section className={`break-inside-avoid space-y-1 rounded-lg p-3 text-[10.5pt] ${s.tone === "sponsor" ? "border border-amber-400 bg-amber-50" : "border border-slate-300"}`}>
          {s.tone === "sponsor" && <div className="text-[9pt] font-semibold uppercase tracking-wide text-amber-800">With your sponsor</div>}
          {title}
          {fill(s.body, settings).trim().split(/\s*\n\s*/).map((p, n) => <p key={n}>{p.replaceAll("**", "")}</p>)}
        </section>
      );
    case "questions":
      return (
        <section className="space-y-3">
          {head}
          {(s.items || []).map((i) => <Item key={i.id} item={i} value={a?.[i.id]} blank={blank} settings={settings} />)}
        </section>
      );
    case "list": {
      const items = blank ? [] : (Array.isArray(a) ? a : []).filter((x) => x?.trim());
      const spare = Math.max(blank ? 10 : 3, 0);
      return (
        <section className="space-y-2">
          {head}
          <ol className="space-y-0">
            {items.map((x, n) => <li key={n} className="flex gap-2 border-b border-slate-200 py-1 text-[11pt]"><span className="w-6 shrink-0 text-right text-slate-500">{n + 1}.</span>{x}</li>)}
            {Array.from({ length: spare }, (_, n) => <li key={`b${n}`} className="flex h-7 gap-2 border-b border-slate-300"><span className="w-6 shrink-0 pt-1 text-right text-[10pt] text-slate-400">{items.length + n + 1}.</span></li>)}
          </ol>
        </section>
      );
    }
    case "table": {
      const rows = blank ? [] : (Array.isArray(a) ? a : []).filter((r) => r && Object.values(r).some(has));
      const spare = blank ? 12 : rows.length ? 3 : 6;
      return (
        <section className="space-y-2">
          {head}
          {blank && s.prompts?.length > 0 && <p className="text-[9.5pt] text-slate-600">Think about: {s.prompts.join(" · ")}</p>}
          <table className="w-full table-fixed border-collapse text-[10pt]">
            <thead>
              <tr>{s.columns.map((c) => <th key={c.id} className="border border-slate-400 bg-slate-100 px-1.5 py-1 text-left align-bottom font-semibold">{fill(c.label, settings)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, n) => (
                <tr key={n} className="break-inside-avoid">
                  {s.columns.map((c) => <td key={c.id} className="whitespace-pre-wrap border border-slate-400 px-1.5 py-1 align-top">{show(r[c.id])}</td>)}
                </tr>
              ))}
              {Array.from({ length: spare }, (_, n) => (
                <tr key={`b${n}`}>
                  {s.columns.map((c) => (
                    <td key={c.id} className="h-10 border border-slate-400 px-1.5 align-top text-[8pt] text-slate-500">
                      {c.options?.length ? c.options.map((o) => <span key={o} className="mr-1.5 inline-block max-w-full"><Box />{o}</span>) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      );
    }
    case "picker": {
      const picked = Array.isArray(a) ? a : [];
      const groups = s.options_from ? [] : s.groups || [];
      const extra = picked.filter((p) => !groups.some((g) => g.options.includes(p)));
      return (
        <section className="break-inside-avoid space-y-2">
          {head}
          {groups.map((g, n) => (
            <div key={n} className="space-y-1">
              {g.label && <div className="text-[9.5pt] font-semibold uppercase tracking-wide text-slate-600">{g.label}</div>}
              <Choices options={g.options} value={picked} blank={blank} />
            </div>
          ))}
          {extra.length > 0 && <Choices options={extra} value={picked} blank={blank} />}
          {(blank || !groups.length) && <div><div className="text-[9.5pt] text-slate-600">Others:</div><Lines n={2} /></div>}
          {s.max && <p className="text-[9pt] text-slate-500">Pick up to {s.max}.</p>}
        </section>
      );
    }
    case "each": {
      const things = blank ? (s.over?.length ? s.over : []) : thingsFor(s, definition, answers);
      const list = things.length ? things : [null, null, null];
      return (
        <section className="space-y-3">
          {head}
          {list.map((t, n) => (
            <div key={t || n} className="break-inside-avoid space-y-2 rounded-lg border border-slate-300 p-3">
              <div className="font-semibold">{t || <span className="inline-block w-56 border-b border-slate-400">&nbsp;</span>}</div>
              {(s.items || []).map((i) => <Item key={i.id} item={i} value={t ? a?.[t]?.[i.id] : undefined} blank={blank || !t} settings={settings} />)}
            </div>
          ))}
        </section>
      );
    }
    case "scale": {
      const things = blank ? (s.over?.length ? s.over : []) : thingsFor(s, definition, answers);
      const list = things.length ? things : [null, null, null, null];
      return (
        <section className="break-inside-avoid space-y-2">
          {head}
          <table className="w-full border-collapse text-[10pt]">
            <tbody>
              {list.map((t, n) => (
                <tr key={t || n}>
                  <td className="w-1/3 border-b border-slate-300 py-1.5 pr-2 font-medium">{t || ""}</td>
                  <td className="border-b border-slate-300 py-1.5"><Choices options={s.options} value={t ? (a?.[t] || []).at(-1)?.value : null} blank={blank || !t} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      );
    }
    case "days": {
      const weeks = !blank && Array.isArray(a) && a.length ? a : [{ days: {}, review: {} }];
      return (
        <section className="space-y-3">
          {head}
          {weeks.map((week, w) => (
            <div key={w} className="space-y-2">
              {weeks.length > 1 && <div className="text-[10pt] font-semibold uppercase tracking-wide text-slate-600">Week {w + 1}</div>}
              {(s.items || []).map((i, n) => (
                <div key={i.id} className="break-inside-avoid space-y-1">
                  <div className="text-[10.5pt]"><span className="text-slate-500">Day {n + 1} · </span>{fill(i.label, settings)}</div>
                  <Answer value={week.days?.[i.id]} rows={2} blank={blank} />
                </div>
              ))}
              {s.review?.length > 0 && (
                <div className="break-inside-avoid space-y-2 rounded-lg border border-slate-300 p-3">
                  <div className="text-[10pt] font-semibold">End of the week</div>
                  {s.review.map((i) => <Item key={i.id} item={i} value={week.review?.[i.id]} blank={blank} settings={settings} />)}
                </div>
              )}
            </div>
          ))}
        </section>
      );
    }
    default:
      return null;
  }
}

export default function PrintableWorksheet({ work, label, blank = false, by, className = "" }) {
  const { definition, answers = {}, settings } = work;
  const parts = partsOf(definition);
  return (
    <article className={`printable-worksheet mx-auto max-w-[7.5in] space-y-5 bg-white text-[11pt] text-slate-900 ${className}`}>
      <style>{"@media print { @page { margin: 0.6in 0.6in 0.7in; } .printable-worksheet { max-width: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }"}</style>
      <header className="space-y-1 border-b-2 border-slate-800 pb-3">
        <div className="flex items-baseline justify-between gap-4 text-[9.5pt] font-semibold uppercase tracking-wide text-slate-600">
          <span>{label}</span>
          <span>{blank ? "Name ________________  Date __________" : by ? `${by} · ${new Date(work.updated_at || Date.now()).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}` : null}</span>
        </div>
        <h1 className="text-[20pt] font-bold leading-tight">{work.name}</h1>
        {definition.intro && <div className="space-y-1 text-[10.5pt] text-slate-700">{fill(definition.intro, settings).trim().split(/\s*\n\s*/).map((p, n) => <p key={n}>{p.replaceAll("**", "")}</p>)}</div>}
        {definition.credit && <p className="text-[8.5pt] text-slate-500">{definition.credit}</p>}
        {settings?.from && (
          <div className="mt-2 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-[10pt]">
            <span className="font-semibold">{settings.from}</span>{settings.from_note ? `: “${settings.from_note}”` : ""}
          </div>
        )}
      </header>
      {parts.map((p, n) => (
        <div key={n} className={`space-y-5 ${n > 0 && p.part ? "break-before-page" : ""}`}>
          {p.part && <h2 className="border-b border-slate-400 pb-1 text-[15pt] font-bold">{p.part}</h2>}
          {p.sections.map((s) => <Section key={s.id} s={s} definition={definition} answers={answers} settings={settings} blank={blank} />)}
        </div>
      ))}
      <footer className="pt-4 text-center text-[8pt] text-slate-400">RecoveryBot · {blank ? "a blank copy" : "private: please keep it between you and your sponsor"}</footer>
    </article>
  );
}
