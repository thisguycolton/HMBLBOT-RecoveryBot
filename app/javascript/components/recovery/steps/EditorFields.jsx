import React from "react";
import {
  ArrowDown, ArrowUp, BookOpen, CalendarDays, Gauge, ListChecks, ListOrdered, MessageCircleQuestion, Plus, Repeat, StickyNote, Table2, X,
} from "lucide-react";
import { quietButton } from "../../groups/ui";
import { inputClass, labelClass, selectClass } from "../../ui/styles";

// The fields of the HumbleBot Editor (WorksheetEditor): one section of a worksheet, every
// setting StepTool understands for its kind. What someone already wrote is kept under each
// section's and question's id, so rewording or moving things never loses it.

export const KINDS = {
  questions: { name: "Questions", icon: MessageCircleQuestion, about: "Questions to write answers to, or to pick an answer for." },
  table: { name: "Table", icon: Table2, about: "Rows and columns, like the Big Book's four columns or an amends list." },
  list: { name: "List", icon: ListOrdered, about: "One line for each thing: names, fears, gratitudes." },
  picker: { name: "Pick from a list", icon: ListChecks, about: "Choices to tick, in groups, like character defects." },
  each: { name: "Questions for each one", icon: Repeat, about: "The same questions for every row of a table or every pick." },
  scale: { name: "Rating for each one", icon: Gauge, about: "Rate each pick (for example, how willing) and see it change over time." },
  days: { name: "A question a day", icon: CalendarDays, about: "One question for each day of the week, with an end-of-week look back." },
  reference: { name: "Reading", icon: BookOpen, about: "A passage to read: a prayer, a page reference, a quote." },
  note: { name: "Note", icon: StickyNote, about: "A highlighted box, or one to talk over with a sponsor." },
};

const ROLES = {
  who: "Names (they carry into Steps 5, 8 and 9)",
  my_part: "My part (carries into Steps 6 and 7)",
  my_part_flag: "Marks a defect as mine (carries into Steps 6 and 7)",
};

let made = 0;
export const newId = (prefix) => `${prefix}-${Date.now().toString(36)}${(made += 1)}`;
const lines = (text) => (text || "").split("\n").map((x) => x.trim()).filter(Boolean);
export const area = `${inputClass} [field-sizing:content] min-h-[3rem]`;
const iconButton = "inline-flex size-8 items-center justify-center rounded-lg !bg-transparent text-slate-500 hover:!bg-neutral-100 disabled:opacity-30 dark:hover:!bg-neutral-800";

export function Mover({ list, n, set, label, remove = true }) {
  const move = (d) => { const next = [...list]; [next[n], next[n + d]] = [next[n + d], next[n]]; set(next); };
  return (
    <div className="flex shrink-0">
      <button type="button" aria-label={`Move ${label} up`} disabled={n === 0} onClick={() => move(-1)} className={iconButton}><ArrowUp className="size-4" /></button>
      <button type="button" aria-label={`Move ${label} down`} disabled={n === list.length - 1} onClick={() => move(1)} className={iconButton}><ArrowDown className="size-4" /></button>
      {remove && <button type="button" aria-label={`Take ${label} out`} onClick={() => set(list.filter((_, j) => j !== n))} className={`${iconButton} hover:!text-rose-600`}><X className="size-4" /></button>}
    </div>
  );
}

function Field({ id, label, hint, children }) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">{hint}</p>}
    </div>
  );
}

// Lines of text kept as a list (choices, starter ideas), one on each line
function LinesField({ id, label, hint, value, onChange, placeholder = "One on each line" }) {
  return (
    <Field id={id} label={label} hint={hint}>
      <textarea id={id} className={area} placeholder={placeholder} value={(value || []).join("\n")} onChange={(e) => onChange(e.target.value.split("\n"))} />
    </Field>
  );
}

// Questions (or a table's columns): the words, how it's answered, choices, and the finer settings
function Items({ items = [], set, columns = false, max = 60, addLabel }) {
  const change = (n, patch) => set(items.map((x, j) => (j === n ? { ...x, ...patch } : x)));
  const what = columns ? "column" : "question";
  return (
    <div className="space-y-2">
      {items.map((it, n) => (
        <div key={it.id} className="space-y-2 rounded-xl bg-neutral-50 p-2.5 ring-1 ring-neutral-200/70 dark:bg-neutral-950 dark:ring-neutral-800">
          <div className="flex items-start gap-1">
            <span className="mt-2.5 w-5 shrink-0 text-right text-xs font-semibold text-slate-400">{n + 1}</span>
            <textarea className={`${area} min-h-[2.5rem]`} rows={1} value={it.label} aria-label={columns ? `Column ${n + 1}` : `Question ${n + 1}`} maxLength={500}
              onChange={(e) => change(n, { label: e.target.value })} />
            <Mover list={items} n={n} set={set} label={`this ${what}`} />
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-6">
            <select className={`${selectClass} !w-auto`} aria-label="Answered with" value={it.type && it.type !== "text" ? it.type : "text"}
              onChange={(e) => change(n, { type: e.target.value === "text" ? (columns ? "text" : undefined) : e.target.value, options: it.options || [] })}>
              <option value="text">Writing</option>
              <option value="choice">Pick one</option>
              <option value="choices">Pick any</option>
              {columns && <option value="date">A date</option>}
            </select>
          </div>
          {(it.type === "choice" || it.type === "choices") && (
            <div className="pl-6">
              <textarea className={area} aria-label="Choices, one on each line" placeholder="Choices, one on each line" value={(it.options || []).join("\n")}
                onChange={(e) => change(n, { options: e.target.value.split("\n") })} />
            </div>
          )}
          <details className="pl-6 text-sm">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 dark:text-neutral-400">More settings</summary>
            <div className="mt-2 space-y-2">
              {columns
                ? <Field id={`${it.id}-help`} label="A hint under the column"><input id={`${it.id}-help`} className={inputClass} maxLength={500} value={it.help || ""} onChange={(e) => change(n, { help: e.target.value })} /></Field>
                : (!it.type || it.type === "text") && (
                  <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
                    <Field id={`${it.id}-ph`} label="Example in the box"><input id={`${it.id}-ph`} className={inputClass} maxLength={300} value={it.placeholder || ""} onChange={(e) => change(n, { placeholder: e.target.value })} /></Field>
                    <Field id={`${it.id}-rows`} label="Lines of room">
                      <input id={`${it.id}-rows`} type="number" min={1} max={20} className={inputClass} value={it.rows || ""} placeholder="2"
                        onChange={(e) => change(n, { rows: e.target.value ? Math.min(20, Math.max(1, Number(e.target.value))) : undefined })} />
                    </Field>
                  </div>
                )}
              <Field id={`${it.id}-role`} label="Carries into later steps" hint="Later steps find what's written here, whatever you call it.">
                <select id={`${it.id}-role`} className={selectClass} value={it.role || ""} onChange={(e) => change(n, { role: e.target.value || undefined })}>
                  <option value="">No</option>
                  {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>
          </details>
        </div>
      ))}
      {items.length < max && (
        <button type="button" className={quietButton} onClick={() => set([...items, columns ? { id: newId("col"), label: "", type: "text" } : { id: newId("q"), label: "" }])}>
          <Plus className="size-4" /> {addLabel || (columns ? "Add a column" : "Add a question")}
        </button>
      )}
    </div>
  );
}

// "Bring in from an earlier step": names (who) or my part from that step's worksheets
function StepLink({ id, label, value, onChange, roles = ["who"] }) {
  const current = value ? `${value.step}:${value.role}` : "";
  return (
    <div className="space-y-2">
      <Field id={id} label={label}>
        <select id={id} className={selectClass} value={current}
          onChange={(e) => {
            if (!e.target.value) return onChange(undefined);
            const [step, role] = e.target.value.split(":");
            return onChange({ ...(value || {}), step: Number(step), role });
          }}>
          <option value="">No</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).flatMap((s) => roles.map((r) => (
            <option key={`${s}:${r}`} value={`${s}:${r}`}>{r === "who" ? `Names from Step ${s}` : `My part from Step ${s}`}</option>
          )))}
        </select>
      </Field>
      {value && (
        <Field id={`${id}-label`} label="Button wording">
          <input id={`${id}-label`} className={inputClass} maxLength={100} placeholder={`Add from my Step ${value.step} work`} value={value.label || ""} onChange={(e) => onChange({ ...value, label: e.target.value })} />
        </Field>
      )}
    </div>
  );
}

// Another section this one goes over (each, scale) or takes its choices from (picker)
function SectionPick({ id, label, value, onChange, sections, kinds, hint, none }) {
  const options = sections.filter((x) => kinds.includes(x.kind));
  return (
    <Field id={id} label={label} hint={hint}>
      <select id={id} className={selectClass} value={value || ""} onChange={(e) => onChange(e.target.value || undefined)}>
        {none && <option value="">{none}</option>}
        {!none && !value && <option value="">Pick a section…</option>}
        {options.map((x) => <option key={x.id} value={x.id}>{x.title || KINDS[x.kind].name}</option>)}
      </select>
      {!options.length && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Add a {kinds.map((k) => KINDS[k].name.toLowerCase()).join(" or ")} first.</p>}
    </Field>
  );
}

export function SectionEditor({ section: s, sections, change }) {
  const set = (patch) => change({ ...s, ...patch });
  const others = sections.filter((x) => x.id !== s.id);
  const text = ["reference", "note"].includes(s.kind);
  return (
    <div className="space-y-4">
      {s.kind !== "note" && (
        <Field id={`t-${s.id}`} label="Title"><input id={`t-${s.id}`} className={inputClass} maxLength={200} value={s.title || ""} onChange={(e) => set({ title: e.target.value })} /></Field>
      )}
      {s.kind !== "note" && (
        <Field id={`h-${s.id}`} label="Help text" hint="Shown under the title. **Two stars** make words bold.">
          <textarea id={`h-${s.id}`} className={area} maxLength={2000} value={s.help || ""} onChange={(e) => set({ help: e.target.value })} />
        </Field>
      )}
      {text && (
        <Field id={`b-${s.id}`} label={s.kind === "note" ? "The note" : "The reading"} hint="A new line starts a new paragraph. Write {{higher_power}} where their name for their Higher Power should go.">
          <textarea id={`b-${s.id}`} className={`${area} min-h-[6rem]`} maxLength={4000} value={s.body || ""} onChange={(e) => set({ body: e.target.value })} />
        </Field>
      )}
      {s.kind === "note" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.tone === "sponsor"} onChange={(e) => set({ tone: e.target.checked ? "sponsor" : undefined })} />
          Mark it "With your sponsor" (amber)
        </label>
      )}

      {s.kind === "questions" && <Items items={s.items} set={(items) => set({ items })} />}

      {s.kind === "list" && (
        <Field id={`ph-${s.id}`} label="Example in each line"><input id={`ph-${s.id}`} className={inputClass} maxLength={200} value={s.placeholder || ""} onChange={(e) => set({ placeholder: e.target.value })} /></Field>
      )}

      {s.kind === "table" && (
        <>
          <div className="text-sm font-semibold text-slate-800 dark:text-neutral-100">Columns</div>
          <Items items={s.columns} set={(columns) => set({ columns })} columns max={12} />
          <Field id={`f-${s.id}`} label="Filled in">
            <select id={`f-${s.id}`} className={selectClass} value={s.fill || "row"} onChange={(e) => set({ fill: e.target.value })}>
              <option value="row">A row at a time</option>
              <option value="column">A column at a time (every name first, then every cause…)</option>
            </select>
          </Field>
          <LinesField id={`pr-${s.id}`} label="Places to look" hint="Starter ideas shown above the table, like people, institutions, principles." value={s.prompts} onChange={(prompts) => set({ prompts })} />
          <StepLink id={`rf-${s.id}`} label="Offer names from an earlier step" value={s.rows_from} onChange={(rows_from) => set({ rows_from })} />
        </>
      )}

      {s.kind === "picker" && (
        <>
          <SectionPick id={`of-${s.id}`} label="Choices come from" value={s.options_from} onChange={(options_from) => set({ options_from })}
            sections={others} kinds={["picker"]} none="The groups below" hint="Or narrow down what they picked in another list." />
          {!s.options_from && (
            <div className="space-y-2">
              {(s.groups || []).map((g, n) => (
                <div key={n} className="space-y-2 rounded-xl bg-neutral-50 p-2.5 ring-1 ring-neutral-200/70 dark:bg-neutral-950 dark:ring-neutral-800">
                  <div className="flex items-start gap-1">
                    <input className={inputClass} value={g.label || ""} aria-label={`Group ${n + 1} name`} placeholder="Group name (optional)" maxLength={100}
                      onChange={(e) => set({ groups: s.groups.map((x, j) => (j === n ? { ...x, label: e.target.value } : x)) })} />
                    <Mover list={s.groups} n={n} set={(groups) => set({ groups })} label="this group" />
                  </div>
                  <textarea className={area} aria-label={`Group ${n + 1} choices, one on each line`} placeholder="Choices, one on each line" value={(g.options || []).join("\n")}
                    onChange={(e) => set({ groups: s.groups.map((x, j) => (j === n ? { ...x, options: e.target.value.split("\n") } : x)) })} />
                </div>
              ))}
              <button type="button" className={quietButton} onClick={() => set({ groups: [...(s.groups || []), { label: "", options: [] }] })}><Plus className="size-4" /> Add a group of choices</button>
            </div>
          )}
          <Field id={`max-${s.id}`} label="Most they can pick" hint="Leave empty for no limit.">
            <input id={`max-${s.id}`} type="number" min={1} max={100} className={`${inputClass} max-w-[8rem]`} value={s.max || ""}
              onChange={(e) => set({ max: e.target.value ? Math.min(100, Math.max(1, Number(e.target.value))) : undefined })} />
          </Field>
          <StepLink id={`sf-${s.id}`} label="Suggest from an earlier step" value={s.suggest_from} onChange={(suggest_from) => set({ suggest_from })} roles={["my_part", "who"]} />
        </>
      )}

      {s.kind === "each" && (
        <>
          <SectionPick id={`from-${s.id}`} label="Goes over" value={s.from} onChange={(from) => set({ from })} sections={others} kinds={["table", "picker"]}
            none={s.over?.length ? "The fixed list below" : undefined} hint="Each row of a table (by its first column) or each pick." />
          <LinesField id={`over-${s.id}`} label="Or a fixed list" hint="When this has lines, it's used instead." value={s.over} onChange={(over) => set({ over })} />
          <div className="text-sm font-semibold text-slate-800 dark:text-neutral-100">Questions for each one</div>
          <Items items={s.items} set={(items) => set({ items })} />
        </>
      )}

      {s.kind === "scale" && (
        <>
          <SectionPick id={`from-${s.id}`} label="Rates each of" value={s.from} onChange={(from) => set({ from })} sections={others} kinds={["picker", "table"]} />
          <LinesField id={`o-${s.id}`} label="The scale, lowest first" hint="Up to 10." value={s.options} onChange={(options) => set({ options })} />
        </>
      )}

      {s.kind === "days" && (
        <>
          <div className="text-sm font-semibold text-slate-800 dark:text-neutral-100">A question for each day</div>
          <Items items={s.items} set={(items) => set({ items: items.slice(0, 14) })} max={14} addLabel="Add a day" />
          <div className="text-sm font-semibold text-slate-800 dark:text-neutral-100">End of the week</div>
          <Items items={s.review || []} set={(review) => set({ review })} />
        </>
      )}

      <Field id={`p-${s.id}`} label="Starts a new part" hint="A heading above this section. Parts print on their own pages and can be sent to a sponsor one at a time.">
        <input id={`p-${s.id}`} className={inputClass} maxLength={200} value={s.part || ""} placeholder="Leave empty to keep going in the same part" onChange={(e) => set({ part: e.target.value })} />
      </Field>
    </div>
  );
}

// A new section of a kind, ready to fill in
export function newSection(kind, sections) {
  const id = newId(kind);
  const firstOf = (kinds) => sections.find((x) => kinds.includes(x.kind))?.id;
  const base = { id, kind, title: kind === "note" ? undefined : KINDS[kind].name };
  return {
    ...base,
    ...{
      questions: { items: [{ id: newId("q"), label: "" }] },
      list: {},
      table: { fill: "row", columns: [{ id: newId("col"), label: "Who", type: "text" }, { id: newId("col"), label: "", type: "text" }] },
      picker: { groups: [{ label: "", options: [] }] },
      each: { from: firstOf(["table", "picker"]), items: [{ id: newId("q"), label: "" }] },
      scale: { from: firstOf(["picker", "table"]), options: ["Not yet", "Somewhat", "Ready"] },
      days: { items: Array.from({ length: 7 }, (_, i) => ({ id: `d${i + 1}-${Date.now().toString(36)}`, label: "" })), review: [] },
      reference: { body: "" },
      note: { body: "", tone: "sponsor" },
    }[kind],
  };
}

// Tidy what was typed before saving: choices one a line, nothing blank, empty settings dropped
export function tidy(definition) {
  const clean = (list) => (list || []).filter((x) => x.label?.trim()).map((x) => ({ ...x, ...(x.options ? { options: lines(x.options.join("\n")) } : {}) }));
  return {
    ...definition,
    sections: definition.sections.map((s) => ({
      ...s,
      ...(s.items ? { items: clean(s.items) } : {}),
      ...(s.review ? { review: clean(s.review) } : {}),
      ...(s.columns ? { columns: clean(s.columns) } : {}),
      ...(s.groups ? { groups: s.groups.map((g) => ({ ...g, options: lines((g.options || []).join("\n")) })).filter((g) => g.options.length) } : {}),
      ...(s.options ? { options: lines(s.options.join("\n")) } : {}),
      ...(s.prompts ? { prompts: lines(s.prompts.join("\n")) } : {}),
      ...(s.over ? { over: lines(s.over.join("\n")) } : {}),
      part: s.part?.trim() || undefined,
    })),
  };
}

// What's missing before a section can be saved, in words, or null
export function problem(s) {
  const name = s.title || KINDS[s.kind].name;
  const filled = (list) => (list || []).some((x) => x.label?.trim());
  if (["questions", "each"].includes(s.kind) && !filled(s.items)) return `${name} needs at least one question.`;
  if (s.kind === "days" && !filled(s.items)) return `${name} needs at least one day's question.`;
  if (s.kind === "table" && !filled(s.columns)) return `${name} needs at least one column with a name.`;
  if (s.kind === "scale" && !lines((s.options || []).join("\n")).length) return `${name} needs its scale.`;
  if (s.kind === "scale" && !s.from) return `Pick what ${name} rates.`;
  if (s.kind === "each" && !s.from && !lines((s.over || []).join("\n")).length) return `Pick what ${name} goes over.`;
  if (["reference", "note"].includes(s.kind) && !s.body?.trim()) return `${name} is empty.`;
  return null;
}
