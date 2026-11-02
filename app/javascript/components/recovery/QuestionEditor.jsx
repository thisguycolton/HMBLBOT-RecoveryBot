import React, { useState } from "react";
import { ArrowDown, ArrowUp, Plus, RotateCcw, SlidersHorizontal, Trash2, X } from "lucide-react";
import { api } from "../groups/lib";
import { ErrorNote, primaryButton, quietButton } from "../groups/ui";
import { inputClass, labelClass } from "../ui/styles";
import { showToast } from "../../lib/toast";

let made = 0;
const newKey = () => `mine-${Date.now().toString(36)}${(made += 1)}`;

// Their own 10th step questions (Api::InventoryQuestionsController): reword, reorder, drop or
// add questions, each a yes or no with a note or written out, or start from one of the sets.
// Nights already written keep theirs; the night they're on (`on`) takes the new ones.
export default function QuestionEditor({ data, on, written, onClose, onSaved }) {
  const [list, setList] = useState(data.questions.map((q) => ({ ...q, open: !!q.open })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (i, patch) => setList((l) => l.map((q, n) => (n === i ? { ...q, ...patch } : q)));
  const move = (i, by) => setList((l) => {
    const next = [...l];
    const [q] = next.splice(i, 1);
    next.splice(i + by, 0, q);
    return next;
  });
  const useTemplate = (key) => {
    const t = data.templates.find((x) => x.key === key);
    if (t && window.confirm(`Start from "${t.name}"? This replaces the questions in this list (nothing is saved until you press Save).`)) setList(t.questions.map((q) => ({ ...q, open: !!q.open })));
  };
  const save = async (body) => {
    setBusy(true);
    setError(null);
    try {
      const d = await api("/inventory_questions", { method: "PATCH", body: { ...body, apply_to: on } });
      showToast(body.reset ? "Back to the Big Book's questions." : "Your questions are saved.", { tone: "success" });
      onSaved(d, written);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[2600] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Your 10th step questions"
        className="max-h-[92dvh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-sm text-slate-700 shadow-2xl ring-1 ring-neutral-200 sm:rounded-2xl dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white"><SlidersHorizontal className="size-4" /> Your 10th step questions</p>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:hover:!bg-neutral-800"><X className="size-4" /></button>
        </div>
        <p className="text-slate-600 dark:text-neutral-400">
          Change them to suit how you and your sponsor work. Nights you've already written keep the questions they were written with.
        </p>
        <div>
          <label htmlFor="q-template" className={labelClass}>Start from</label>
          <select id="q-template" className={inputClass} value="" onChange={(e) => useTemplate(e.target.value)}>
            <option value="">Pick a set…</option>
            {data.templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
          </select>
        </div>
        <ol className="space-y-2">
          {list.map((q, i) => (
            <li key={q.key} className="space-y-2 rounded-2xl bg-neutral-50 p-3 dark:bg-neutral-800/60">
              <div className="flex items-start gap-2">
                <span className="mt-2 w-5 shrink-0 text-right text-xs font-semibold text-slate-400">{i + 1}</span>
                <textarea aria-label={`Question ${i + 1}`} rows={1} maxLength={300} className={`${inputClass} min-h-[2.5rem] flex-1`} value={q.text}
                  onChange={(e) => set(i, { text: e.target.value })} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pl-7">
                <div role="group" aria-label="How it's answered" className="inline-flex overflow-hidden rounded-xl text-xs ring-1 ring-neutral-200 dark:ring-neutral-700">
                  {[[false, "Yes or no, with a note"], [true, "Written out"]].map(([open, label]) => (
                    <button key={label} type="button" aria-pressed={q.open === open} onClick={() => set(i, { open })}
                      className={`px-3 py-1 font-semibold ${q.open === open ? "!bg-accent !text-white" : "!bg-white text-slate-700 hover:!bg-neutral-50 dark:!bg-neutral-900 dark:text-neutral-200"}`}>{label}</button>
                  ))}
                </div>
                <div className="flex gap-1">
                  <button type="button" className={quietButton} aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></button>
                  <button type="button" className={quietButton} aria-label="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></button>
                  <button type="button" className={quietButton} aria-label="Remove" disabled={list.length === 1} onClick={() => setList((l) => l.filter((_, n) => n !== i))}><Trash2 className="size-4" /></button>
                </div>
              </div>
            </li>
          ))}
        </ol>
        {list.length < data.max && (
          <button type="button" className={quietButton} onClick={() => setList((l) => [...l, { key: newKey(), text: "", open: false }])}><Plus className="size-4" /> Add a question</button>
        )}
        <ErrorNote error={error} />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/70 pt-3 dark:border-neutral-800">
          {data.custom
            ? <button type="button" className={quietButton} disabled={busy} onClick={() => save({ reset: true })}><RotateCcw className="size-4" /> Back to the Big Book's</button>
            : <span />}
          <div className="flex gap-2">
            <button type="button" className={quietButton} onClick={onClose}>Cancel</button>
            <button type="button" className={primaryButton} disabled={busy || !list.some((q) => q.text.trim())} onClick={() => save({ questions: list })}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
