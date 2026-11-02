import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Columns3, Download, Plus, Rows3, X } from "lucide-react";
import { api } from "../../groups/lib";
import { Card, quietButton } from "../../groups/ui";
import { inputClass } from "../../ui/styles";
import { fill, thingsFor } from "./stepText";

// How each kind of step tool section looks and takes answers (StepTool describes the kinds and
// what their answers look like). `value` is the section's answers, `set(next)` saves them.

const area = `${inputClass} min-h-[4.5rem] [field-sizing:content]`;
const STEP_WORD = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

function Text({ value, onChange, placeholder, rows = 2, label, id }) {
  return (
    <textarea id={id} aria-label={label} className={area} rows={rows} value={value || ""} placeholder={placeholder || ""}
      onChange={(e) => onChange(e.target.value)} />
  );
}

// Tap to pick: one (`multi` false) or several
function Chips({ options, value, onChange, multi = true, label }) {
  const picked = multi ? (Array.isArray(value) ? value : []) : value;
  const on = (o) => (multi ? picked.includes(o) : picked === o);
  const toggle = (o) => (multi ? onChange(on(o) ? picked.filter((x) => x !== o) : [...picked, o]) : onChange(on(o) ? "" : o));
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={on(o)} onClick={() => toggle(o)}
          className={`rounded-full px-3 py-1 text-sm ring-1 ${on(o)
            ? "!bg-accent !text-white ring-accent"
            : "!bg-white text-slate-700 ring-neutral-200 hover:!bg-neutral-50 dark:!bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

// One answer of any item or column type
function Field({ def, value, onChange, settings, id }) {
  if (def.type === "choices") return <Chips options={def.options || []} value={value} onChange={onChange} label={def.label} />;
  if (def.type === "choice") return <Chips options={def.options || []} value={value} onChange={onChange} multi={false} label={def.label} />;
  if (def.type === "date") return <input id={id} type="date" aria-label={def.label} className={`${inputClass} max-w-[12rem]`} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  return <Text id={id} value={value} onChange={onChange} placeholder={fill(def.placeholder, settings)} rows={def.rows || 2} label={def.label} />;
}

function Questions({ section, value, set, settings }) {
  const a = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return (
    <div className="space-y-4">
      {(section.items || []).map((i) => (
        <div key={i.id} className="space-y-1.5">
          <label htmlFor={`${section.id}-${i.id}`} className="block font-medium text-slate-900 dark:text-white">{fill(i.label, settings)}</label>
          <Field id={`${section.id}-${i.id}`} def={i} value={a[i.id]} settings={settings} onChange={(v) => set({ ...a, [i.id]: v })} />
        </div>
      ))}
    </div>
  );
}

function List({ section, value, set }) {
  const items = Array.isArray(value) && value.length ? value : [""];
  const change = (next) => set(next);
  return (
    <div className="space-y-2">
      {items.map((item, n) => (
        <div key={n} className="flex items-center gap-2">
          <span className="w-6 shrink-0 text-right text-sm tabular-nums text-slate-400">{n + 1}.</span>
          <input className={inputClass} value={item} placeholder={n === 0 ? section.placeholder || "" : ""} aria-label={`${section.title} ${n + 1}`}
            onChange={(e) => change(items.map((x, j) => (j === n ? e.target.value : x)))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); change([...items.slice(0, n + 1), "", ...items.slice(n + 1)]); } }} />
          <button type="button" aria-label="Take this off" onClick={() => change(items.filter((_, j) => j !== n))}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg !bg-transparent text-slate-400 hover:!bg-neutral-100 dark:hover:!bg-neutral-800"><X className="size-4" /></button>
        </div>
      ))}
      <button type="button" className={`${quietButton} ml-8`} onClick={() => change([...items, ""])}><Plus className="size-4" /> Another</button>
    </div>
  );
}

// Offer what an earlier step's work holds (`link`: { step, role, label })
function usePull(link) {
  const [values, setValues] = useState(null);
  useEffect(() => {
    if (!link) return;
    api(`/step_works/pull?step=${link.step}&role=${link.role}`).then((d) => setValues(d.values)).catch(() => setValues([]));
  }, [link?.step, link?.role]); // eslint-disable-line react-hooks/exhaustive-deps
  return values;
}

function Table({ section, value, set, definition, answers }) {
  const rows = Array.isArray(value) ? value : [];
  const [mode, setMode] = useState(section.fill || "row");
  const [col, setCol] = useState(0);
  const first = section.columns[0];
  const pulled = usePull(section.rows_from);

  // A row for each thing picked in a picker here, filled in from `defaults`
  const picks = section.rows_from_section ? thingsFor({ from: section.rows_from_section.section }, definition, answers) : null;
  useEffect(() => {
    if (!picks) return;
    const key = section.rows_from_section.column;
    const have = new Set(rows.map((r) => r?.[key]));
    const missing = picks.filter((p) => !have.has(p));
    if (missing.length) set([...rows, ...missing.map((p) => ({ [key]: p, ...(section.defaults?.[p] || {}) }))]);
  }, [picks?.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCell = (n, c, v) => set(rows.map((r, j) => (j === n ? { ...r, [c]: v } : r)));
  const addRow = (seed = {}) => set([...rows, seed]);
  const remove = (n) => window.confirm("Take this row off?") && set(rows.filter((_, j) => j !== n));
  const fromEarlier = (pulled || []).filter((v) => !rows.some((r) => (r?.[first.id] || "").trim().toLowerCase() === v.toLowerCase()));

  return (
    <div className="space-y-3">
      {section.prompts?.length > 0 && (
        <p className="text-sm text-slate-500 dark:text-neutral-400"><span className="font-medium">Some places to look:</span> {section.prompts.join(" · ")}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-neutral-100 p-0.5 text-sm dark:bg-neutral-800" role="group" aria-label="Fill in by">
          <button type="button" aria-pressed={mode === "column"} onClick={() => setMode("column")}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 ${mode === "column" ? "!bg-white shadow-sm dark:!bg-neutral-900" : "!bg-transparent text-slate-500"}`}><Columns3 className="size-3.5" /> A column at a time</button>
          <button type="button" aria-pressed={mode === "row"} onClick={() => setMode("row")}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 ${mode === "row" ? "!bg-white shadow-sm dark:!bg-neutral-900" : "!bg-transparent text-slate-500"}`}><Rows3 className="size-3.5" /> A row at a time</button>
        </div>
        {section.rows_from && fromEarlier.length > 0 && (
          <button type="button" className={quietButton} onClick={() => set([...rows, ...fromEarlier.map((v) => ({ [first.id]: v }))])}>
            <Download className="size-4" /> {section.rows_from.label || `Add from my ${STEP_WORD[section.rows_from.step]} step`} ({fromEarlier.length})
          </button>
        )}
      </div>

      {mode === "column" ? (
        <div className="space-y-3">
          <div className="flex gap-1 overflow-x-auto pb-1" role="tablist">
            {section.columns.map((c, n) => (
              <button key={c.id} type="button" role="tab" aria-selected={col === n} onClick={() => setCol(n)}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-sm ${col === n ? "!bg-accent !text-white" : "!bg-neutral-100 text-slate-700 dark:!bg-neutral-800 dark:text-neutral-200"}`}>
                {n + 1}. {c.label}
              </button>
            ))}
          </div>
          {section.columns[col]?.help && <p className="text-sm text-slate-500 dark:text-neutral-400">{section.columns[col].help}</p>}
          {rows.map((r, n) => (
            <div key={n} className="space-y-1.5">
              {col > 0 && <div className="text-sm font-medium text-slate-900 dark:text-white">{n + 1}. {r?.[first.id] || <span className="text-slate-400">(no name yet)</span>}</div>}
              <div className="flex items-start gap-2">
                {col === 0 && <span className="mt-2 w-6 shrink-0 text-right text-sm tabular-nums text-slate-400">{n + 1}.</span>}
                <div className="min-w-0 flex-1"><Field def={section.columns[col]} value={r?.[section.columns[col].id]} onChange={(v) => setCell(n, section.columns[col].id, v)} /></div>
                {col === 0 && <button type="button" aria-label="Take this row off" onClick={() => remove(n)}
                  className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg !bg-transparent text-slate-400 hover:!bg-neutral-100 dark:hover:!bg-neutral-800"><X className="size-4" /></button>}
              </div>
            </div>
          ))}
          {col === 0
            ? <button type="button" className={quietButton} onClick={() => addRow()}><Plus className="size-4" /> Another</button>
            : col < section.columns.length - 1 && rows.length > 0 && <button type="button" className={quietButton} onClick={() => setCol(col + 1)}>Next column <ChevronRight className="size-4" /></button>}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r, n) => (
            <Card key={n} className="space-y-3 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{n + 1}</span>
                <button type="button" aria-label="Take this row off" onClick={() => remove(n)}
                  className="inline-flex size-7 items-center justify-center rounded-lg !bg-transparent text-slate-400 hover:!bg-neutral-100 dark:hover:!bg-neutral-800"><X className="size-4" /></button>
              </div>
              {section.columns.map((c) => (
                <div key={c.id} className="space-y-1">
                  <label htmlFor={`${section.id}-${n}-${c.id}`} className="block text-sm font-medium text-slate-700 dark:text-neutral-300">{c.label}</label>
                  {c.help && <p className="text-xs text-slate-500 dark:text-neutral-400">{c.help}</p>}
                  <Field id={`${section.id}-${n}-${c.id}`} def={c} value={r?.[c.id]} onChange={(v) => setCell(n, c.id, v)} />
                </div>
              ))}
            </Card>
          ))}
          <button type="button" className={quietButton} onClick={() => addRow()}><Plus className="size-4" /> Add a row</button>
        </div>
      )}
    </div>
  );
}

function Picker({ section, value, set, definition, answers }) {
  const picked = Array.isArray(value) ? value : [];
  const [other, setOther] = useState("");
  const suggested = usePull(section.suggest_from);
  const groups = section.options_from
    ? [{ label: null, options: thingsFor({ from: section.options_from }, definition, answers) }]
    : [...(suggested?.length ? [{ label: section.suggest_from.label || "From earlier steps", options: [...new Set(suggested)] }] : []), ...(section.groups || [])];
  const known = new Set(groups.flatMap((g) => g.options));
  const own = picked.filter((p) => !known.has(p));
  const full = section.max && picked.length >= section.max;
  const toggle = (o) => (picked.includes(o) ? set(picked.filter((x) => x !== o)) : !full && set([...picked, o]));
  const add = (e) => { e.preventDefault(); const v = other.trim(); if (v && !picked.includes(v) && !full) set([...picked, v]); setOther(""); };

  return (
    <div className="space-y-3">
      {groups.map((g, n) => (
        <div key={n} className="space-y-1.5">
          {g.label && <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{g.label}</div>}
          {g.options.length ? <Chips options={g.options} value={picked} onChange={(next) => { const added = next.find((x) => !picked.includes(x)); if (added) toggle(added); else set(next); }} label={g.label || section.title} />
            : <p className="text-sm text-slate-500">Pick some above first.</p>}
        </div>
      ))}
      {own.length > 0 && <div className="space-y-1.5"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">My own</div><Chips options={own} value={picked} onChange={set} label="My own" /></div>}
      {!section.options_from && (
        <form onSubmit={add} className="flex gap-2">
          <input className={inputClass} value={other} placeholder="Add my own…" aria-label="Add my own" onChange={(e) => setOther(e.target.value)} />
          <button type="submit" className={quietButton} disabled={!other.trim() || full}><Plus className="size-4" /> Add</button>
        </form>
      )}
      {section.max && <p className="text-xs text-slate-500">{picked.length} of {section.max} picked</p>}
    </div>
  );
}

// The same questions for each thing, one at a time
function Each({ section, value, set, definition, answers, settings }) {
  const things = thingsFor(section, definition, answers);
  const a = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const [at, setAt] = useState(0);
  if (!things.length) return <p className="text-sm text-slate-500 dark:text-neutral-400">This fills in once you've written some above.</p>;
  const n = Math.min(at, things.length - 1);
  const thing = things[n];
  const vals = a[thing] || {};
  const done = (t) => Object.values(a[t] || {}).some((v) => (Array.isArray(v) ? v.length : (v || "").toString().trim()));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {things.map((t, j) => (
          <button key={t} type="button" aria-current={j === n} onClick={() => setAt(j)}
            className={`rounded-full px-3 py-1 text-sm ${j === n ? "!bg-accent !text-white" : done(t) ? "!bg-accent/15 text-slate-800 dark:text-white" : "!bg-neutral-100 text-slate-600 dark:!bg-neutral-800 dark:text-neutral-300"}`}>{t}</button>
        ))}
      </div>
      <Card className="space-y-4 p-4">
        <div className="text-lg font-semibold text-slate-900 dark:text-white">{thing}</div>
        {(section.items || []).map((i) => (
          <div key={i.id} className="space-y-1.5">
            <label htmlFor={`${section.id}-${n}-${i.id}`} className="block font-medium text-slate-800 dark:text-neutral-100">{fill(i.label, settings)}</label>
            <Field id={`${section.id}-${n}-${i.id}`} def={i} value={vals[i.id]} settings={settings} onChange={(v) => set({ ...a, [thing]: { ...vals, [i.id]: v } })} />
          </div>
        ))}
        <div className="flex items-center justify-between">
          <button type="button" className={quietButton} disabled={n === 0} onClick={() => setAt(n - 1)}><ChevronLeft className="size-4" /> Back</button>
          <span className="text-sm text-slate-500">{n + 1} of {things.length}</span>
          <button type="button" className={quietButton} disabled={n === things.length - 1} onClick={() => setAt(n + 1)}>Next <ChevronRight className="size-4" /></button>
        </div>
      </Card>
    </div>
  );
}

const shortDate = (iso) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });

// A choice for each thing, keeping the earlier ones so they can see it change
function Scale({ section, value, set, definition, answers }) {
  const things = thingsFor(section, definition, answers);
  const a = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  if (!things.length) return <p className="text-sm text-slate-500 dark:text-neutral-400">This fills in once you've picked some above.</p>;
  const choose = (thing, v) => {
    const history = a[thing] || [];
    const today = new Date().toISOString().slice(0, 10);
    const next = history.length && history.at(-1).at?.slice(0, 10) === today ? [...history.slice(0, -1), { value: v, at: new Date().toISOString() }] : [...history, { value: v, at: new Date().toISOString() }];
    set({ ...a, [thing]: next });
  };
  return (
    <div className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
      {things.map((t) => {
        const history = a[t] || [];
        const now = history.at(-1)?.value;
        const before = history.slice(0, -1).filter((h, j, all) => j === 0 || all[j - 1].value !== h.value);
        return (
          <div key={t} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div>
              <div className="font-medium text-slate-900 dark:text-white">{t}</div>
              {before.length > 0 && <div className="text-xs text-slate-500">Was {before.map((h) => `${h.value.toLowerCase()} (${shortDate(h.at)})`).join(", then ")}</div>}
            </div>
            <Chips options={section.options} value={now || ""} multi={false} onChange={(v) => v && choose(t, v)} label={`${t}: ${section.title}`} />
          </div>
        );
      })}
    </div>
  );
}

// A question a day for a week, then the week's review; a new week whenever they like
function Days({ section, value, set }) {
  const weeks = Array.isArray(value) && value.length ? value : [{ started_on: new Date().toISOString().slice(0, 10), days: {}, review: {} }];
  const [w, setW] = useState(weeks.length - 1);
  const week = weeks[Math.min(w, weeks.length - 1)];
  const setWeek = (patch) => set(weeks.map((x, j) => (j === Math.min(w, weeks.length - 1) ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-4">
      {weeks.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {weeks.map((x, j) => (
            <button key={j} type="button" aria-current={j === w} onClick={() => setW(j)}
              className={`rounded-full px-3 py-1 text-sm ${j === w ? "!bg-accent !text-white" : "!bg-neutral-100 text-slate-600 dark:!bg-neutral-800 dark:text-neutral-300"}`}>Week {j + 1}</button>
          ))}
        </div>
      )}
      {(section.items || []).map((i, n) => (
        <div key={i.id} className="space-y-1.5">
          <label htmlFor={`${section.id}-${w}-${i.id}`} className="block font-medium text-slate-900 dark:text-white"><span className="text-slate-400">Day {n + 1} · </span>{i.label}</label>
          <Text id={`${section.id}-${w}-${i.id}`} value={week.days?.[i.id]} onChange={(v) => setWeek({ days: { ...week.days, [i.id]: v } })} />
        </div>
      ))}
      {section.review?.length > 0 && (
        <div className="space-y-3 rounded-2xl bg-neutral-50 p-3 dark:bg-neutral-950">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">End of the week</div>
          {section.review.map((i) => (
            <div key={i.id} className="space-y-1.5">
              <label htmlFor={`${section.id}-${w}-r-${i.id}`} className="block text-sm font-medium text-slate-800 dark:text-neutral-100">{i.label}</label>
              <Text id={`${section.id}-${w}-r-${i.id}`} value={week.review?.[i.id]} onChange={(v) => setWeek({ review: { ...week.review, [i.id]: v } })} />
            </div>
          ))}
        </div>
      )}
      <button type="button" className={quietButton} onClick={() => { set([...weeks, { started_on: new Date().toISOString().slice(0, 10), days: {}, review: {} }]); setW(weeks.length); }}>
        <Plus className="size-4" /> Start another week
      </button>
    </div>
  );
}

// A paragraph for each line, with **bold**: enough for intros and readings
export function Prose({ text, className = "" }) {
  if (!text) return null;
  return (
    <div className={`space-y-2 ${className}`}>
      {text.trim().split(/\s*\n\s*/).map((para, n) => (
        <p key={n}>{para.split(/(\*\*[^*]+\*\*)/).map((bit, j) => (bit.startsWith("**") ? <strong key={j}>{bit.slice(2, -2)}</strong> : bit))}</p>
      ))}
    </div>
  );
}

const KINDS = { questions: Questions, list: List, table: Table, picker: Picker, each: Each, scale: Scale, days: Days };

export default function StepSection({ section, answers, setAnswer, definition, settings }) {
  if (section.kind === "note") {
    return (
      <div className={`rounded-2xl px-4 py-3 text-sm ${section.tone === "sponsor" ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100" : "bg-neutral-100 dark:bg-neutral-800"}`}>
        {section.tone === "sponsor" && <div className="mb-1 text-xs font-semibold uppercase tracking-wide">With your sponsor</div>}
        <Prose text={section.body} />
      </div>
    );
  }
  const Kind = KINDS[section.kind];
  return (
    <section className="space-y-3" aria-labelledby={`h-${section.id}`}>
      {section.title && <h3 id={`h-${section.id}`} className="text-lg font-semibold text-slate-900 dark:text-white">{section.title}</h3>}
      {section.help && <Prose text={section.help} className="text-sm text-slate-600 dark:text-neutral-400" />}
      {section.kind === "reference"
        ? <blockquote className="rounded-2xl border-l-4 border-accent/50 bg-neutral-50 px-4 py-3 italic text-slate-700 dark:bg-neutral-950 dark:text-neutral-200"><Prose text={section.body} /></blockquote>
        : Kind && <Kind section={section} value={answers[section.id]} set={(v) => setAnswer(section.id, v)} definition={definition} answers={answers} settings={settings} />}
    </section>
  );
}
