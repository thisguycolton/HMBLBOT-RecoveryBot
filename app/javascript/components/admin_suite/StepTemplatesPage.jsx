import React, { useEffect, useRef, useState } from "react";
import { EyeOff, PencilRuler, Plus, Upload } from "lucide-react";
import { api } from "../topicificator_admin/api";
import { buttonClass } from "../topicificator_admin/App";
import { inputClass, labelClass, selectClass } from "../ui/styles";
import { Card } from "./App";

const editPath = (t) => `/recovery/steps/templates/${t.id}/edit`;
const when = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");

function Status({ t }) {
  const [label, tone] = !t.version ? ["Draft, never published", "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200"]
    : t.changed ? [`Unpublished changes · v${t.version}`, "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"]
      : [`Published · v${t.version}`, "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>;
}

// Site Admin > Step worksheets: the worksheets every member can start on the Steps page
// (StepTemplate), by step. Each opens in the HumbleBot Editor, in template mode: changes save as
// a draft, and Publish makes it what new worksheets start from.
export default function StepTemplatesPage({ notify }) {
  const [data, setData] = useState(null);
  const [step, setStep] = useState("");
  const [show, setShow] = useState("all");
  const [newStep, setNewStep] = useState(1);
  const [name, setName] = useState("");
  const fileRef = useRef(null);
  useEffect(() => { api("/step_templates").then(setData).catch((e) => notify(e.message, "error")); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (t) => { window.location.href = editPath(t); };
  const create = async (body) => {
    try { open((await api("/step_templates", { method: "POST", body })).template); } catch (e) { notify(e.message, "error"); }
  };
  const importFile = async (file) => {
    if (!file) return;
    await create({ file: await file.text() });
    fileRef.current.value = "";
  };

  if (!data) return <p className="py-16 text-center text-sm text-slate-500 !font-sans">Loading…</p>;
  const shown = data.templates.filter((t) => (!step || t.steps.includes(Number(step)))
    && (show === "all" || (show === "drafts" && t.changed) || (show === "hidden" && t.hidden)));
  const byStep = data.steps.map((s) => ({ ...s, templates: shown.filter((t) => t.step === s.step) })).filter((s) => s.templates.length);

  return (
    <>
      <Card title="New worksheet" subtitle="Start from a blank worksheet, or import a file in the same shape as the built-in ones (JSON or YAML). It stays a draft only admins see until you publish it.">
        <div className="flex flex-wrap items-end gap-3">
          <label>
            <span className={labelClass}>For step</span>
            <select className={selectClass} value={newStep} onChange={(e) => setNewStep(Number(e.target.value))}>
              {data.steps.map((s) => <option key={s.step} value={s.step}>Step {s.step}</option>)}
            </select>
          </label>
          <label className="min-w-[12rem] flex-1">
            <span className={labelClass}>Name</span>
            <input className={inputClass} maxLength={200} value={name} onChange={(e) => setName(e.target.value)} placeholder="Third step prayer, line by line" />
          </label>
          <button type="button" className={buttonClass.primary} onClick={() => create({ step: newStep, name })}><Plus className="size-4" /> New worksheet</button>
          <input ref={fileRef} type="file" accept=".json,.yml,.yaml,application/json" className="hidden" onChange={(e) => importFile(e.target.files[0])} />
          <button type="button" className={buttonClass.secondary} onClick={() => fileRef.current.click()}><Upload className="size-4" /> Import a file</button>
        </div>
      </Card>

      <Card title="Step worksheets" subtitle="What members can start on the Steps page. Publishing makes a new version for worksheets started from now on; anyone who already started one keeps theirs. Counts are how many worksheets were started, never what anyone wrote."
        actions={(
          <div className="flex flex-wrap gap-2">
            <select aria-label="Step" className={selectClass} value={step} onChange={(e) => setStep(e.target.value)}>
              <option value="">Every step</option>
              {data.steps.map((s) => <option key={s.step} value={s.step}>Step {s.step}</option>)}
            </select>
            <select aria-label="Show" className={selectClass} value={show} onChange={(e) => setShow(e.target.value)}>
              <option value="all">All</option>
              <option value="drafts">Not published yet</option>
              <option value="hidden">Hidden from members</option>
            </select>
          </div>
        )}>
        {byStep.length === 0 ? <p className="text-sm text-slate-500 !font-sans">Nothing here{step || show !== "all" ? " with these filters" : " yet"}.</p> : (
          <div className="space-y-5">
            {byStep.map((s) => (
              <section key={s.step}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 !font-sans dark:text-neutral-400">Step {s.step} · {s.text}</h3>
                <ul className="divide-y divide-slate-200 dark:divide-neutral-800">
                  {s.templates.map((t) => (
                    <li key={t.id}>
                      <a href={editPath(t)} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-neutral-800/60">
                        <PencilRuler className="size-4 shrink-0 text-accent" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-slate-900 !font-sans dark:text-white">{t.name}</span>
                          <span className="block truncate text-xs text-slate-500 !font-sans dark:text-neutral-400">{t.summary || `${t.sections} sections`}</span>
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 !font-sans dark:text-neutral-400">
                          {t.default && <span className="rounded-full bg-accent/10 px-2 py-0.5 font-semibold text-accent dark:bg-accent/25 dark:text-white">Default{t.steps.length > 1 ? ` for Steps ${t.steps.join(" and ")}` : ""}</span>}
                          {t.hidden && <span className="inline-flex items-center gap-1 rounded-full bg-neutral-200 px-2 py-0.5 font-semibold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200"><EyeOff className="size-3" /> Hidden</span>}
                          <Status t={t} />
                          <span>{t.started === 1 ? "1 started" : `${t.started} started`}</span>
                          <span>· {when(t.updated_at)}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
