import React, { useEffect, useState } from "react";
import { Printer, SlidersHorizontal } from "lucide-react";
import { inputClass } from "../ui/styles";
import { api } from "../groups/lib";
import { Card, primaryButton, quietButton } from "../groups/ui";
import QuestionEditor from "./QuestionEditor";
import { PrintableInventory } from "./PrintableEntry";
import { EntryShell, useEntry } from "./EntryShell";
import EntryShare from "./EntryShare";
import { dayLabel } from "./lib";

// The Big Book's questions (InventoryQuestions::DEFAULT), until their own load; each night
// keeps the questions it was written with
const QUESTIONS = [
  { key: "resentful", text: "Was I resentful?" },
  { key: "selfish", text: "Was I selfish?" },
  { key: "dishonest", text: "Was I dishonest?" },
  { key: "afraid", text: "Was I afraid?" },
  { key: "apology", text: "Do I owe an apology?" },
  { key: "kept", text: "Have I kept something to myself that I should talk over with another person?" },
  { key: "kind", text: "Was I kind and loving toward all?" },
  { key: "better", text: "What could I have done better?", open: true },
  { key: "others", text: "Was I thinking of myself most of the time, or of what I could do for others?", open: true },
];
const SHORT = { resentful: "Resentful", selfish: "Selfish", dishonest: "Dishonest", afraid: "Afraid", apology: "Apology owed", kept: "Something to talk over" };

// "Resentful, afraid · apology owed", or the first words written
function summary(entry) {
  const yes = Object.entries(entry.answers || {}).filter(([k, a]) => a.answer === "yes" && SHORT[k]).map(([k]) => SHORT[k]);
  if (yes.length) return yes.join(", ");
  const firstNote = Object.values(entry.answers || {}).map((a) => a.note).find(Boolean) || entry.notes;
  return firstNote ? firstNote.slice(0, 120) : "Written";
}

// The night as plain text to share (EntryShare): each question answered, with its note
// unless `notes` is off, and the closing notes
function shareText(questions, answers, notes, { notes: withNotes }) {
  const lines = questions.flatMap((q) => {
    const a = answers[q.key] || {};
    const note = withNotes ? (a.note || "").trim() : "";
    if (!a.answer && !note) return [];
    const said = [a.answer === "yes" ? "Yes." : a.answer === "no" ? "No." : "", note].filter(Boolean).join(" ");
    return [`${q.text}\n${said}`];
  });
  if (withNotes && notes.trim()) lines.push(`Anything else, and what I'll do about it tomorrow\n${notes.trim()}`);
  return lines.join("\n\n");
}

// The 10th step (/recovery/inventory): the nightly review from the Big Book (page 86), one a
// day, or their own questions (QuestionEditor). Each question takes a yes or no and a note, or
// is written out.
export default function InventoryPage() {
  const state = useEntry("step_inventories", ["night", "nights"]);
  const { entry, on, saving, saved, setSaved, save } = state;
  const [answers, setAnswers] = useState({});
  const [notes, setNotes] = useState("");
  const [mine, setMine] = useState(null); // { questions, templates, custom, max }
  const [editing, setEditing] = useState(false);
  const [printBlank, setPrintBlank] = useState(false);
  const print = (blank) => { setPrintBlank(blank); setTimeout(() => window.print(), 50); };
  useEffect(() => { api("/inventory_questions").then(setMine).catch(() => {}); }, []);
  // A night already written keeps its questions; a new one uses theirs
  const questions = (entry?.questions || mine?.questions || QUESTIONS).map((q) => ({ ...q, open: !!q.open }));
  useEffect(() => {
    if (entry === undefined) return;
    setAnswers(entry?.answers || {});
    setNotes(entry?.notes || "");
  }, [entry, on]);

  const set = (key, patch) => { setAnswers((a) => ({ ...a, [key]: { ...a[key], ...patch } })); setSaved(false); };
  const submit = (e) => {
    e.preventDefault();
    save({ answers, notes }, ({ kind, count: n }) => (kind.endsWith("-streak")
      ? { title: `${n} nights in a row`, text: `${n} nights of honest inventory in a row. Keep it going.` }
      : { title: n === 1 ? "Your first 10th step" : `${n.toLocaleString()} 10th steps`, text: `That's ${n === 1 ? "your first nightly inventory" : `${n.toLocaleString()} nightly inventories`}. Continue to take personal inventory, and when we're wrong, promptly admit it.` }));
  };

  return (
    <EntryShell base="inventory" title="10th step" state={state} summary={summary} reminder="step"
      printable={<PrintableInventory questions={printBlank ? (mine?.questions || questions) : questions} answers={answers} notes={notes} date={dayLabel(on)} blank={printBlank} />}
      intro="When we retire at night, we constructively review our day. A few honest minutes, then rest.">
      <form onSubmit={submit} className="space-y-4">
        <Card className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
          {questions.map((q) => {
            const a = answers[q.key] || {};
            return (
              <div key={q.key} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor={`q-${q.key}`} className="font-medium text-slate-900 dark:text-white">{q.text}</label>
                  {!q.open && (
                    <div role="group" aria-label={q.text} className="inline-flex overflow-hidden rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-700">
                      {["yes", "no"].map((v) => (
                        <button key={v} type="button" aria-pressed={a.answer === v} onClick={() => set(q.key, { answer: a.answer === v ? null : v })}
                          className={`px-4 py-1.5 text-sm font-semibold ${a.answer === v ? "!bg-accent !text-white" : "!bg-white text-slate-700 hover:!bg-neutral-50 dark:!bg-neutral-900 dark:text-neutral-200"}`}>
                          {v === "yes" ? "Yes" : "No"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {(q.open || a.answer || a.note) && (
                  <textarea id={`q-${q.key}`} rows={q.open ? 3 : 2} maxLength={4000} className={inputClass} value={a.note || ""}
                    placeholder={q.open ? "" : a.answer === "yes" ? "What happened, and with whom?" : "Anything to note"}
                    onChange={(e) => set(q.key, { note: e.target.value })} />
                )}
              </div>
            );
          })}
          <div className="space-y-2 p-4">
            <label htmlFor="q-notes" className="font-medium text-slate-900 dark:text-white">Anything else, and what I'll do about it tomorrow</label>
            <textarea id="q-notes" rows={3} maxLength={10000} className={inputClass} value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(false); }} />
          </div>
        </Card>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="mr-auto flex flex-wrap gap-2">
            {mine && <button type="button" className={quietButton} onClick={() => setEditing(true)}><SlidersHorizontal className="size-4" /> Change the questions</button>}
            <button type="button" className={quietButton} onClick={() => print(false)}><Printer className="size-4" /> Print</button>
            <button type="button" className={quietButton} onClick={() => print(true)} title="An empty sheet with your questions, to fill in by hand"><Printer className="size-4" /> Print blank</button>
          </div>
          {saved && <span role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{entry ? "Saved." : "Cleared."}</span>}
          <EntryShare tool="10th-step" kind="inventory" on={on} what="10th step" title={`My 10th step · ${dayLabel(on)}`}
            disabled={!shareText(questions, answers, notes, { notes: true })}
            choices={[{ key: "notes", label: "Include what I wrote, not just yes and no" }]}
            build={(o) => shareText(questions, answers, notes, o)} />
          <button type="submit" disabled={saving} className={primaryButton}>{saving ? "Saving…" : "Save inventory"}</button>
        </div>
      </form>
      {editing && (
        <QuestionEditor data={mine} on={on} written={!!entry}
          onClose={() => setEditing(false)}
          onSaved={(d, applied) => { setMine(d); if (applied) state.setEntry?.((e) => (e ? { ...e, questions: d.questions } : e)); setEditing(false); }} />
      )}
    </EntryShell>
  );
}
