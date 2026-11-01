import React, { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { Card, ErrorNote, dangerButton, primaryButton, quietButton } from "../../groups/ui";
import { inputClass, labelClass, selectClass } from "../../ui/styles";

// Customize (/recovery/steps/:id): change their own copy of a worksheet. Every section's title
// and help, its questions, columns, pick lists and choices; move or take sections out, or add
// new ones. What they already wrote stays under each section's id, so renaming keeps it.
// The server keeps only what it understands (StepTool.clean).

const KIND_NAMES = {
  reference: "Reading", note: "Note", questions: "Questions", list: "List", table: "Table", picker: "Pick from a list",
  each: "Questions for each one", scale: "Rating for each one", days: "A question a day",
};
const newId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
const lines = (text) => text.split("\n").map((x) => x.trim()).filter(Boolean);
const area = `${inputClass} [field-sizing:content] min-h-[3rem]`;

function Mover({ list, n, set, label }) {
  const move = (d) => { const next = [...list]; [next[n], next[n + d]] = [next[n + d], next[n]]; set(next); };
  const iconButton = "inline-flex size-8 items-center justify-center rounded-lg !bg-transparent text-slate-500 hover:!bg-neutral-100 disabled:opacity-30 dark:hover:!bg-neutral-800";
  return (
    <div className="flex shrink-0">
      <button type="button" aria-label={`Move ${label} up`} disabled={n === 0} onClick={() => move(-1)} className={iconButton}><ArrowUp className="size-4" /></button>
      <button type="button" aria-label={`Move ${label} down`} disabled={n === list.length - 1} onClick={() => move(1)} className={iconButton}><ArrowDown className="size-4" /></button>
      <button type="button" aria-label={`Take ${label} out`} onClick={() => set(list.filter((_, j) => j !== n))} className={`${iconButton} hover:!text-rose-600`}><X className="size-4" /></button>
    </div>
  );
}

// Questions (or a table's columns): a label each, a type, and choices for the choice types
function Items({ items = [], set, columns = false }) {
  return (
    <div className="space-y-2">
      {items.map((it, n) => (
        <div key={it.id} className="space-y-2 rounded-xl bg-neutral-50 p-2 dark:bg-neutral-950">
          <div className="flex items-start gap-1">
            <input className={inputClass} value={it.label} aria-label={columns ? "Column name" : "Question"}
              onChange={(e) => set(items.map((x, j) => (j === n ? { ...x, label: e.target.value } : x)))} />
            <Mover list={items} n={n} set={set} label={columns ? "this column" : "this question"} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className={`${selectClass} max-w-[13rem]`} aria-label="Answered with" value={it.type || "text"}
              onChange={(e) => set(items.map((x, j) => (j === n ? { ...x, type: e.target.value === "text" ? undefined : e.target.value } : x)))}>
              <option value="text">Writing</option>
              <option value="choice">Pick one</option>
              <option value="choices">Pick any</option>
              {columns && <option value="date">A date</option>}
            </select>
            {it.role === "who" && <span className="text-xs text-slate-500">Names here carry into later steps</span>}
            {it.role === "my_part" && <span className="text-xs text-slate-500">Carries into Step 6</span>}
          </div>
          {(it.type === "choice" || it.type === "choices") && (
            <textarea className={area} aria-label="Choices, one on each line" placeholder="One choice on each line" value={(it.options || []).join("\n")}
              onChange={(e) => set(items.map((x, j) => (j === n ? { ...x, options: e.target.value.split("\n") } : x)))} />
          )}
        </div>
      ))}
      <button type="button" className={quietButton} onClick={() => set([...items, { id: newId(columns ? "col" : "q"), label: columns ? "New column" : "New question" }])}>
        <Plus className="size-4" /> {columns ? "Add a column" : "Add a question"}
      </button>
    </div>
  );
}

function SectionEditor({ section: s, change }) {
  const set = (patch) => change({ ...s, ...patch });
  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass} htmlFor={`t-${s.id}`}>Title</label>
        <input id={`t-${s.id}`} className={inputClass} value={s.title || ""} onChange={(e) => set({ title: e.target.value })} />
      </div>
      {(
        <div>
          <label className={labelClass} htmlFor={`p-${s.id}`}>Starts a part</label>
          <input id={`p-${s.id}`} className={inputClass} value={s.part || ""} placeholder="Leave empty to keep going in the same part" onChange={(e) => set({ part: e.target.value })} />
        </div>
      )}
      {!["reference", "note"].includes(s.kind) && (
        <div>
          <label className={labelClass} htmlFor={`h-${s.id}`}>Help text</label>
          <textarea id={`h-${s.id}`} className={area} value={s.help || ""} onChange={(e) => set({ help: e.target.value })} />
        </div>
      )}
      {["reference", "note"].includes(s.kind) && (
        <div>
          <label className={labelClass} htmlFor={`b-${s.id}`}>Text</label>
          <textarea id={`b-${s.id}`} className={area} value={s.body || ""} onChange={(e) => set({ body: e.target.value })} />
        </div>
      )}
      {["questions", "each"].includes(s.kind) && <Items items={s.items} set={(items) => set({ items })} />}
      {s.kind === "days" && (
        <>
          <Items items={s.items} set={(items) => set({ items: items.slice(0, 14) })} />
          <div className="text-sm font-medium text-slate-700 dark:text-neutral-300">End of the week</div>
          <Items items={s.review || []} set={(review) => set({ review })} />
        </>
      )}
      {s.kind === "table" && (
        <>
          <div>
            <label className={labelClass} htmlFor={`f-${s.id}`}>Filled in</label>
            <select id={`f-${s.id}`} className={selectClass} value={s.fill || "row"} onChange={(e) => set({ fill: e.target.value })}>
              <option value="column">A column at a time (every name first, then every cause…)</option>
              <option value="row">A row at a time</option>
            </select>
          </div>
          <Items items={s.columns} set={(columns) => set({ columns })} columns />
          <div>
            <label className={labelClass} htmlFor={`pr-${s.id}`}>Places to look (one on each line)</label>
            <textarea id={`pr-${s.id}`} className={area} value={(s.prompts || []).join("\n")} onChange={(e) => set({ prompts: e.target.value.split("\n") })} />
          </div>
        </>
      )}
      {s.kind === "picker" && !s.options_from && (
        <div className="space-y-2">
          {(s.groups || []).map((g, n) => (
            <div key={n} className="space-y-2 rounded-xl bg-neutral-50 p-2 dark:bg-neutral-950">
              <div className="flex items-start gap-1">
                <input className={inputClass} value={g.label || ""} aria-label="Group name" placeholder="Group name"
                  onChange={(e) => set({ groups: s.groups.map((x, j) => (j === n ? { ...x, label: e.target.value } : x)) })} />
                <Mover list={s.groups} n={n} set={(groups) => set({ groups })} label="this group" />
              </div>
              <textarea className={area} aria-label="Choices, one on each line" value={(g.options || []).join("\n")}
                onChange={(e) => set({ groups: s.groups.map((x, j) => (j === n ? { ...x, options: e.target.value.split("\n") } : x)) })} />
            </div>
          ))}
          <button type="button" className={quietButton} onClick={() => set({ groups: [...(s.groups || []), { label: "New group", options: [] }] })}><Plus className="size-4" /> Add a group</button>
        </div>
      )}
      {s.kind === "scale" && (
        <div>
          <label className={labelClass} htmlFor={`o-${s.id}`}>Choices (one on each line)</label>
          <textarea id={`o-${s.id}`} className={area} value={(s.options || []).join("\n")} onChange={(e) => set({ options: e.target.value.split("\n") })} />
        </div>
      )}
    </div>
  );
}

// Tidy what was typed: choices one a line, nothing blank
function tidy(definition) {
  const clean = (list) => (list || []).map((x) => ({ ...x, ...(x.options ? { options: lines(x.options.join("\n")) } : {}) }));
  return {
    ...definition,
    sections: definition.sections.map((s) => ({
      ...s,
      ...(s.items ? { items: clean(s.items) } : {}),
      ...(s.review ? { review: clean(s.review) } : {}),
      ...(s.columns ? { columns: clean(s.columns) } : {}),
      ...(s.groups ? { groups: s.groups.map((g) => ({ ...g, options: lines((g.options || []).join("\n")) })) } : {}),
      ...(s.options ? { options: lines(s.options.join("\n")) } : {}),
      ...(s.prompts ? { prompts: lines(s.prompts.join("\n")) } : {}),
      part: s.part || undefined,
    })),
  };
}

export default function StepCustomize({ work, onClose, onSave }) {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(work.definition)));
  const [open, setOpen] = useState(null);
  const [error, setError] = useState(null);
  const sections = draft.sections;
  const setSections = (next) => setDraft((d) => ({ ...d, sections: next }));
  const add = (kind) => {
    const base = { id: newId(kind), kind, title: { questions: "More questions", list: "A list", table: "A table", note: "" }[kind] };
    const extra = {
      questions: { items: [{ id: newId("q"), label: "New question" }] },
      list: {},
      table: { fill: "row", columns: [{ id: newId("col"), label: "Column", type: "text" }] },
      note: { body: "Talk this over with your sponsor.", tone: "sponsor" },
    }[kind];
    setSections([...sections, { ...base, ...extra }]);
    setOpen(base.id);
  };
  const submit = () => {
    if (!sections.length) return setError("Keep at least one section.");
    return onSave(tidy(draft));
  };

  return (
    <div className="fixed inset-0 z-[2600] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-label="Customize this worksheet"
        className="flex max-h-[94dvh] w-full max-w-2xl flex-col rounded-t-3xl bg-white text-sm text-slate-700 shadow-2xl ring-1 ring-neutral-200 sm:rounded-2xl dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700">
        <div className="flex items-center justify-between gap-2 border-b border-neutral-200 p-4 dark:border-neutral-800">
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Customize this worksheet</p>
            <p className="text-xs text-slate-500 dark:text-neutral-400">Only your copy changes. What you've written stays with each section.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:hover:!bg-neutral-800"><X className="size-4" /></button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          <div>
            <label className={labelClass} htmlFor="c-intro">Introduction</label>
            <textarea id="c-intro" className={area} value={draft.intro || ""} onChange={(e) => setDraft((d) => ({ ...d, intro: e.target.value }))} />
          </div>
          {sections.map((s, n) => (
            <Card key={s.id} className="p-3">
              <div className="flex items-center gap-2">
                <button type="button" className="min-w-0 flex-1 !bg-transparent p-0 text-left" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
                  <div className="truncate font-medium text-slate-900 dark:text-white">{s.title || s.body?.slice(0, 60) || KIND_NAMES[s.kind]}</div>
                  <div className="text-xs text-slate-500">{s.part ? `${s.part} · ` : ""}{KIND_NAMES[s.kind]}</div>
                </button>
                <Mover list={sections} n={n} set={setSections} label="this section" />
              </div>
              {open === s.id && <div className="mt-3 border-t border-neutral-200/70 pt-3 dark:border-neutral-800"><SectionEditor section={s} change={(next) => setSections(sections.map((x) => (x.id === s.id ? next : x)))} /></div>}
            </Card>
          ))}
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="self-center text-xs font-semibold uppercase tracking-wide text-slate-500">Add</span>
            <button type="button" className={quietButton} onClick={() => add("questions")}><Plus className="size-4" /> Questions</button>
            <button type="button" className={quietButton} onClick={() => add("list")}><Plus className="size-4" /> A list</button>
            <button type="button" className={quietButton} onClick={() => add("table")}><Plus className="size-4" /> A table</button>
            <button type="button" className={quietButton} onClick={() => add("note")}><Plus className="size-4" /> A note</button>
          </div>
          <ErrorNote error={error} />
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-200 p-4 dark:border-neutral-800">
          <button type="button" className={dangerButton} onClick={onClose}><Trash2 className="size-4" /> Discard changes</button>
          <button type="button" className={primaryButton} onClick={submit}>Save my version</button>
        </div>
      </div>
    </div>
  );
}
