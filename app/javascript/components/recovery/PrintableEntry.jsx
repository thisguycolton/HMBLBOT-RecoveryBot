import React from "react";

// The nightly 10th step and the gratitude list on paper: their own questions (or the Big
// Book's), what they wrote, and room to write by hand; `blank` for an empty sheet.

function Lines({ n = 2 }) {
  return <div aria-hidden="true">{Array.from({ length: n }, (_, i) => <div key={i} className="h-7 border-b border-slate-300" />)}</div>;
}
function Box({ on }) {
  return <span aria-hidden="true" className={`mr-1.5 inline-grid size-3.5 place-items-center rounded-[3px] border border-slate-500 align-[-2px] text-[10px] leading-none ${on ? "bg-slate-800 text-white" : ""}`}>{on ? "✓" : ""}</span>;
}

function Sheet({ kind, title, date, blank, children }) {
  return (
    <article className="printable-entry mx-auto max-w-[7.5in] space-y-5 bg-white text-[11pt] text-slate-900 !font-sans [&_*]:!font-sans">
      <style>{"@media print { @page { margin: 0.6in; } .printable-entry { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }"}</style>
      <header className="space-y-1 border-b-2 border-slate-800 pb-3">
        <div className="flex items-baseline justify-between gap-4 text-[9.5pt] font-semibold uppercase tracking-wide text-slate-600">
          <span>{kind}</span><span>{blank ? "Date ______________" : date}</span>
        </div>
        <h1 className="text-[16pt] font-bold leading-tight">{title}</h1>
      </header>
      {children}
      <footer className="pt-4 text-center text-[8pt] text-slate-400">RecoveryBot</footer>
    </article>
  );
}

export function PrintableInventory({ questions, answers = {}, notes = "", date, blank = false }) {
  return (
    <Sheet kind="Step 10 · Nightly review" title="When we retire at night, we constructively review our day." date={date} blank={blank}>
      <div className="space-y-4">
        {questions.map((q, n) => {
          const a = blank ? {} : answers[q.key] || {};
          return (
            <div key={q.key} className="break-inside-avoid space-y-1.5">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium"><span className="mr-1 text-slate-500">{n + 1}.</span>{q.text}</span>
                {!q.open && <span className="shrink-0 text-[10.5pt]"><Box on={a.answer === "yes"} />Yes <span className="ml-3" /><Box on={a.answer === "no"} />No</span>}
              </div>
              {a.note?.trim() ? <div className="whitespace-pre-wrap border-l-2 border-slate-300 pl-3">{a.note}</div> : <Lines n={q.open ? 3 : 2} />}
            </div>
          );
        })}
        <div className="break-inside-avoid space-y-1.5">
          <div className="font-medium">Anything else, and what I'll do about it tomorrow</div>
          {!blank && notes.trim() ? <div className="whitespace-pre-wrap border-l-2 border-slate-300 pl-3">{notes}</div> : <Lines n={4} />}
        </div>
      </div>
    </Sheet>
  );
}

export function PrintableGratitude({ items = [], date, blank = false }) {
  const filled = blank ? [] : items.filter((x) => x.trim());
  const spare = Math.max(10 - filled.length, 3);
  return (
    <Sheet kind="Gratitude list" title="Today I'm grateful for" date={date} blank={blank}>
      <ol>
        {filled.map((x, n) => <li key={n} className="flex gap-2 border-b border-slate-200 py-1.5"><span className="w-6 shrink-0 text-right text-slate-500">{n + 1}.</span>{x}</li>)}
        {Array.from({ length: spare }, (_, n) => <li key={`b${n}`} className="flex h-8 gap-2 border-b border-slate-300"><span className="w-6 shrink-0 pt-1.5 text-right text-[10pt] text-slate-400">{filled.length + n + 1}.</span></li>)}
      </ol>
    </Sheet>
  );
}
