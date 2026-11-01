import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronRight, Lock, Plus } from "lucide-react";
import { api } from "../../groups/lib";
import { Card, ErrorNote, Loading, Pill, Tray, primaryButton, quietButton } from "../../groups/ui";
import { stepLabel } from "./StepWorkPage";

const when = (iso) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

// Working the steps (/recovery/steps, Api::StepWorksController): their worksheets in progress
// and done, then each of the Twelve Steps with the worksheets there are for it (StepTool).
// Starting one makes it theirs to fill in and change.
export default function StepsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const navigate = useNavigate();
  useEffect(() => { api("/step_works").then(setData).catch((e) => setError(e.message)); }, []);

  const start = async (key) => {
    setBusy(key);
    try {
      const d = await api("/step_works", { method: "POST", body: { tool_key: key } });
      navigate(`/steps/${d.work.id}`);
    } catch (e) { setError(e.message); setBusy(null); }
  };

  if (!data) return error ? <ErrorNote error={error} /> : <Loading />;
  const going = data.works.filter((w) => w.status !== "done");
  const done = data.works.filter((w) => w.status === "done");
  const toolsFor = (n) => data.tools.filter((t) => t.steps.includes(n));

  const WorkRow = ({ w }) => (
    <Card>
      <Link to={`/steps/${w.id}`} className="flex items-center gap-3 p-3 !text-inherit hover:opacity-80">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-accent">{stepLabel(w)}</div>
          <div className="truncate font-medium text-slate-900 dark:text-white">{w.name}</div>
          <div className="text-sm text-slate-500 dark:text-neutral-400">{w.status === "done" ? `Done ${when(w.done_at)}` : `Last worked on ${when(w.updated_at)}`}</div>
        </div>
        <ChevronRight className="size-4 text-slate-400" />
      </Link>
    </Card>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Steps</h1>
        <p className="mt-1 text-slate-600 dark:text-neutral-400">
          Worksheets for working the steps with your sponsor. Pick one to start; it's yours to fill in at your own pace and change to suit
          how you and your sponsor work.
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500 dark:text-neutral-400"><Lock className="size-4 shrink-0" /> Private and encrypted. Only you can read your work, unless you send it to your sponsor.</p>
      </header>
      <ErrorNote error={error} />

      {going.length > 0 && <Tray label="Working on"><div className="space-y-1.5">{going.map((w) => <WorkRow key={w.id} w={w} />)}</div></Tray>}

      <Tray label="The Twelve Steps">
        <div className="space-y-1.5">
          {data.steps.map(({ step, text }) => {
            const tools = toolsFor(step);
            const builtIn = step === 10 ? [{ href: "/inventory", name: "Nightly review", summary: "The 10th step questions from page 86 of the Big Book, one night at a time." }] : [];
            return (
              <Card key={step} className="space-y-3 p-4">
                <div className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/10 text-sm font-semibold text-accent dark:bg-accent/25 dark:text-white">{step}</span>
                  <p className="text-slate-800 dark:text-neutral-100">{text}</p>
                </div>
                {tools.length + builtIn.length > 0 ? (
                  <div className="space-y-2 pl-11">
                    {builtIn.map((t) => (
                      <div key={t.href} className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 flex-1"><div className="font-medium text-slate-900 dark:text-white">{t.name}</div><div className="text-sm text-slate-500 dark:text-neutral-400">{t.summary}</div></div>
                        <Link to={t.href} className={quietButton}>Open</Link>
                      </div>
                    ))}
                    {tools.map((t) => (
                      t.step === step && (
                        <div key={t.key} className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 font-medium text-slate-900 dark:text-white">{t.name}{t.default && tools.length > 1 && <Pill tone="accent">Default</Pill>}</div>
                            <div className="text-sm text-slate-500 dark:text-neutral-400">{t.summary}</div>
                          </div>
                          <button type="button" className={t.default ? primaryButton : quietButton} disabled={busy === t.key} onClick={() => start(t.key)}><Plus className="size-4" /> Start</button>
                        </div>
                      )
                    ))}
                    {tools.some((t) => t.step !== step) && <p className="text-sm text-slate-500 dark:text-neutral-400">{tools.filter((t) => t.step !== step).map((t) => t.name).join(", ")} (under Step {tools.find((t) => t.step !== step).step}) covers this step too.</p>}
                  </div>
                ) : <p className="pl-11 text-sm text-slate-400">Worksheets for this step are coming.</p>}
              </Card>
            );
          })}
        </div>
      </Tray>

      {done.length > 0 && <Tray label={<span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3.5" /> Done</span>}><div className="space-y-1.5">{done.map((w) => <WorkRow key={w.id} w={w} />)}</div></Tray>}
    </div>
  );
}
