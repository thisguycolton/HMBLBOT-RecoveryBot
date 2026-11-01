import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, ChevronLeft, Copy, HeartHandshake, Lock, Printer, RotateCcw, Send, SlidersHorizontal, Trash2, X } from "lucide-react";
import { api } from "../../groups/lib";
import { Card, ErrorNote, Loading, dangerButton, primaryButton, quietButton } from "../../groups/ui";
import { inputClass, labelClass } from "../../ui/styles";
import { showToast } from "../../../lib/toast";
import { localDate } from "../lib";
import StepSection, { Prose } from "./StepSections";
import StepCustomize from "./StepCustomize";
import { ShareWorksheetDialog } from "./ShareWorksheet";
import WorkSettings from "./WorkSettings";
import { partsOf, workText } from "./stepText";

const ORDINAL = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
export const stepLabel = (w) => (w.tool_key === "drop-the-rock" ? "Steps 6 and 7" : `Step ${w.step}`);

// One worksheet a member is working (/recovery/steps/:id, Api::StepWorksController): the
// sections of their copy of the step tool (StepSections), saved as they write. They can
// customize their copy, mark it done, print it, and send it (or one part) to their sponsor.
export default function StepWorkPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [work, setWork] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("saved"); // saved | unsaved | saving
  const [customizing, setCustomizing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sharing, setSharing] = useState(false);
  const pending = useRef(null);
  const timer = useRef(null);

  useEffect(() => { api(`/step_works/${id}`).then((d) => setWork(d.work)).catch((e) => setError(e.message)); }, [id]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const body = pending.current;
    if (!body) return;
    pending.current = null;
    setStatus("saving");
    try {
      await api(`/step_works/${id}`, { method: "PATCH", body });
      setStatus(pending.current ? "unsaved" : "saved");
      setError(null);
    } catch (e) {
      pending.current = { ...body, ...pending.current };
      setStatus("unsaved");
      setError(e.message);
    }
  }, [id]);
  const queue = (patch) => {
    pending.current = { ...pending.current, ...patch };
    setStatus("unsaved");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 900);
  };
  useEffect(() => {
    const away = () => { if (pending.current) flush(); };
    window.addEventListener("pagehide", away);
    return () => { window.removeEventListener("pagehide", away); away(); };
  }, [flush]);

  const setAnswer = (sectionId, v) => setWork((w) => {
    const answers = { ...w.answers, [sectionId]: v };
    // Sending as they write: the worksheet as text goes along (the server sends it on)
    queue(w.auto_send ? { answers, send_text: workText({ ...w, answers }) } : { answers });
    return { ...w, answers };
  });
  const setSettings = (patch) => setWork((w) => { const settings = { ...w.settings, ...patch }; queue({ settings }); return { ...w, settings }; });
  const save = async (patch, done) => {
    await flush();
    try { const d = await api(`/step_works/${id}`, { method: "PATCH", body: patch }); setWork(d.work); if (done) done(d.work); } catch (e) { setError(e.message); }
  };
  const remove = async () => {
    if (!window.confirm("Delete this worksheet and everything written in it? This can't be undone.")) return;
    await api(`/step_works/${id}`, { method: "DELETE" });
    navigate("/steps");
  };
  const again = async () => {
    const d = await api("/step_works", { method: "POST", body: { copy_of: id } });
    navigate(`/steps/${d.work.id}`);
  };

  if (!work) return <div className="mx-auto max-w-3xl">{error ? <ErrorNote error={error} /> : <Loading />}</div>;
  const parts = partsOf(work.definition);
  const usesHigherPower = JSON.stringify(work.definition).includes("{{higher_power}}");

  return (
    <div className="mx-auto max-w-3xl space-y-8 !font-sans print:max-w-none [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Link to="/steps" className="inline-flex items-center gap-1 text-sm"><ChevronLeft className="size-4" /> Steps</Link>
        <span role="status" className="text-sm text-slate-500 dark:text-neutral-400">
          {status === "saving" ? "Saving…" : status === "unsaved" ? "Not saved yet" : <span className="inline-flex items-center gap-1"><Check className="size-4" /> Saved</span>}
        </span>
      </div>
      <header className="space-y-2">
        <div className="text-sm font-semibold uppercase tracking-wide text-accent">{stepLabel(work)}{work.status === "done" && " · Done"}</div>
        <input aria-label="Name of this worksheet" value={work.name} maxLength={200}
          onChange={(e) => { const name = e.target.value; setWork((w) => ({ ...w, name })); queue({ name }); }}
          className="w-full !bg-transparent p-0 text-3xl font-semibold tracking-tight text-slate-900 outline-none focus:ring-0 dark:text-white" />
        <Prose text={work.definition.intro?.replaceAll("{{higher_power}}", work.settings?.higher_power || "God")} className="text-slate-600 dark:text-neutral-400" />
        {work.credit && <p className="text-xs text-slate-500 dark:text-neutral-400">{work.credit}</p>}
        <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-neutral-400 print:hidden"><Lock className="size-4 shrink-0" /> Private and encrypted. Only you can read it here, unless you send it to your sponsor.</p>
        <div className="flex flex-wrap gap-2 pt-2 print:hidden">
          <button type="button" className={primaryButton} onClick={() => setSending(true)}><Send className="size-4" /> Send to my sponsor</button>
          <button type="button" className={quietButton} onClick={() => setCustomizing(true)}><SlidersHorizontal className="size-4" /> Customize</button>
          <button type="button" className={quietButton} onClick={() => window.print()}><Printer className="size-4" /> Print</button>
          <button type="button" className={quietButton} onClick={() => setSharing(true)} title="Suggest it to a sponsee or share it with a group, without your answers"><Copy className="size-4" /> Share a blank copy</button>
        </div>
      </header>
      <ErrorNote error={error} />

      {usesHigherPower && (
        <Card className="flex flex-wrap items-center gap-3 p-3 print:hidden">
          <label htmlFor="higher-power" className="text-sm font-medium text-slate-700 dark:text-neutral-300">What I call my Higher Power</label>
          <input id="higher-power" className={`${inputClass} max-w-[14rem]`} placeholder="God" value={work.settings?.higher_power || ""} maxLength={60}
            onChange={(e) => setSettings({ higher_power: e.target.value })} />
        </Card>
      )}

      {parts.map((p, n) => (
        <div key={n} className="space-y-8">
          {p.part && <h2 className="border-b border-neutral-200 pb-2 text-xl font-semibold text-slate-900 dark:border-neutral-800 dark:text-white">{p.part}</h2>}
          {p.sections.map((s) => <StepSection key={s.id} section={s} answers={work.answers || {}} setAnswer={setAnswer} definition={work.definition} settings={work.settings} />)}
        </div>
      ))}

      <WorkSettings work={work} save={(patch) => save(patch.auto_send ? { ...patch, send_text: workText(work) || undefined } : patch)} />

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4 print:hidden">
        {work.status === "done"
          ? <span className="text-sm text-slate-600 dark:text-neutral-400">Marked done {new Date(work.done_at).toLocaleDateString()}. You can keep adding to it.</span>
          : <span className="text-sm text-slate-600 dark:text-neutral-400">Finished, or as finished as it's going to get for now?</span>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={dangerButton} onClick={remove}><Trash2 className="size-4" /> Delete</button>
          <button type="button" className={quietButton} onClick={again} title="A fresh copy of this worksheet, keeping your changes to it"><RotateCcw className="size-4" /> Do it again</button>
          {work.status === "done"
            ? <button type="button" className={quietButton} onClick={() => save({ status: "in_progress" })}>Not done after all</button>
            : <button type="button" className={primaryButton} onClick={() => save({ status: "done" }, () => showToast(`${ORDINAL[work.step]} step work marked done.`, { tone: "success" }))}><Check className="size-4" /> Mark done</button>}
        </div>
      </Card>

      {customizing && <StepCustomize work={work} onClose={() => setCustomizing(false)} onSave={(definition) => save({ definition }, () => setCustomizing(false))} />}
      {sending && <SendDialog work={work} parts={parts} onClose={() => setSending(false)} />}
      {sharing && <ShareWorksheetDialog source={{ work_id: work.id }} name={work.name} onClose={() => setSharing(false)} />}
    </div>
  );
}

// Send the whole worksheet, or one part, to their sponsors as text (SponsorshipShare)
function SendDialog({ work, parts, onClose }) {
  const [sponsors, setSponsors] = useState(null);
  const [to, setTo] = useState([]);
  const [part, setPart] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { api("/sponsorships").then((d) => { setSponsors(d.sponsors); setTo(d.sponsors.map((s) => s.id)); }).catch((e) => setError(e.message)); }, []);
  const named = parts.filter((p) => p.part);
  const body = workText(work, part === "all" ? null : part);
  const title = `${stepLabel(work)}: ${work.name}${part === "all" ? "" : ` · ${part}`}`;
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await api("/sponsorship_shares", { method: "POST", body: { sponsorship_ids: to, kind: "step_work", on: localDate(), title, body } });
      showToast(`Sent to ${d.sent_to.join(" and ")}.`, { tone: "success" });
      onClose();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const copy = () => navigator.clipboard?.writeText(`${title}\n\n${body}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); });

  return (
    <div className="fixed inset-0 z-[2600] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Send to my sponsor"
        className="max-h-[90dvh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-sm text-slate-700 shadow-2xl ring-1 ring-neutral-200 sm:rounded-2xl dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white"><HeartHandshake className="size-4" /> Send to my sponsor</p>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:hover:!bg-neutral-800"><X className="size-4" /></button>
        </div>
        {named.length > 0 && (
          <div>
            <label htmlFor="send-part" className={labelClass}>What to send</label>
            <select id="send-part" className={inputClass} value={part} onChange={(e) => setPart(e.target.value)}>
              <option value="all">All of it</option>
              {named.map((p) => <option key={p.part} value={p.part}>{p.part}</option>)}
            </select>
          </div>
        )}
        {sponsors?.length > 1 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {sponsors.map((s) => (
              <label key={s.id} className="inline-flex items-center gap-2">
                <input type="checkbox" checked={to.includes(s.id)} onChange={(e) => setTo((t) => (e.target.checked ? [...t, s.id] : t.filter((x) => x !== s.id)))} />
                {s.person.name}
              </label>
            ))}
          </div>
        )}
        <textarea readOnly value={body || "Nothing written here yet."} rows={10} aria-label="What will be sent"
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-base text-slate-700 sm:text-xs dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200" />
        <ErrorNote error={error} />
        {sponsors && !sponsors.length && (
          <p className="text-slate-600 dark:text-neutral-400">You don't have a sponsor linked here yet. <Link to="/sponsorship">Link up with them</Link>, or copy it to send another way.</p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={quietButton} onClick={copy} disabled={!body}>{copied ? <><Check className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy</>}</button>
          {sponsors?.length > 0 && (
            <button type="button" className={primaryButton} disabled={busy || !body || !to.length} onClick={send}>
              <Send className="size-4" /> {busy ? "Sending…" : sponsors.length > 1 ? "Send" : `Send to ${sponsors[0].person.name}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
