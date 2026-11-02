import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, KeyRound, Lightbulb, QrCode as QrCodeIcon, Users, X } from "lucide-react";
import { QrDialog } from "../../ui/QrCode";
import { api } from "../../groups/lib";
import { ErrorNote, primaryButton, quietButton } from "../../groups/ui";
import { inputClass, labelClass } from "../../ui/styles";
import { showToast } from "../../../lib/toast";

const NOTE_MAX = 500;

// Share a worksheet as a blank copy (only the worksheet, with any changes made to it, never
// what's written in it): suggest it to sponsees (StepSuggestion), or share it with a group they
// host for or run (GroupStepTool). `source` is { work_id } or { tool_key }.
export function ShareWorksheetDialog({ source, name, onClose }) {
  const [data, setData] = useState(null);
  const [to, setTo] = useState([]);
  const [note, setNote] = useState("");
  const [group, setGroup] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api("/step_works").then((d) => { setData(d); setTo(d.sponsees.length === 1 ? [d.sponsees[0].id] : []); setGroup(d.publish_groups[0]?.slug || ""); })
      .catch((e) => setError(e.message));
  }, []);

  const suggest = async () => {
    setBusy("suggest");
    setError(null);
    try {
      const d = await api("/step_suggestions", { method: "POST", body: { ...source, sponsorship_ids: to, note } });
      showToast(`Suggested to ${d.sent_to.join(" and ")}.`, { tone: "success" });
      onClose();
    } catch (e) { setError(e.message); }
    setBusy(null);
  };
  const publish = async () => {
    setBusy("group");
    setError(null);
    try {
      await api("/group_step_tools", { method: "POST", body: { ...source, group_slug: group, summary } });
      showToast(`Shared with ${data.publish_groups.find((g) => g.slug === group)?.title}.`, { tone: "success" });
      onClose();
    } catch (e) { setError(e.message); }
    setBusy(null);
  };

  return (
    <div className="fixed inset-0 z-[2600] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Share a blank copy"
        className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-sm text-slate-700 shadow-2xl ring-1 ring-neutral-200 sm:rounded-2xl dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white"><Copy className="size-4" /> Share a blank copy</p>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:hover:!bg-neutral-800"><X className="size-4" /></button>
        </div>
        <p className="text-slate-600 dark:text-neutral-400">
          Shares <strong>{name}</strong> as a worksheet, with any changes you made to it. Nothing you wrote in it goes along.
        </p>
        <ErrorNote error={error} />
        {data && (
          <>
            {data.sponsees.length > 0 && (
              <section className="space-y-2 rounded-2xl bg-neutral-50 p-3 dark:bg-neutral-800/60">
                <p className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-white"><Lightbulb className="size-4" /> Suggest it to a sponsee</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {data.sponsees.map((s) => (
                    <label key={s.id} className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={to.includes(s.id)} onChange={(e) => setTo((t) => (e.target.checked ? [...t, s.id] : t.filter((x) => x !== s.id)))} />
                      {s.name}
                    </label>
                  ))}
                </div>
                <label htmlFor="suggest-note" className={labelClass}>A note with it (optional)</label>
                <textarea id="suggest-note" className={inputClass} rows={2} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Start with the first two columns and we'll go over it Thursday." />
                <p className="text-xs text-slate-500 dark:text-neutral-400">They choose whether to start it. It never replaces work they've already started.</p>
                <div className="flex justify-end">
                  <button type="button" className={primaryButton} disabled={!to.length || busy} onClick={suggest}>{busy === "suggest" ? "Suggesting…" : "Suggest it"}</button>
                </div>
              </section>
            )}
            {data.publish_groups.length > 0 && (
              <section className="space-y-2 rounded-2xl bg-neutral-50 p-3 dark:bg-neutral-800/60">
                <p className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-white"><Users className="size-4" /> Share it with a group</p>
                <p className="text-xs text-slate-500 dark:text-neutral-400">For a step study: members see it on their Steps page and start their own copy.</p>
                {data.publish_groups.length > 1 && (
                  <select aria-label="Group" className={inputClass} value={group} onChange={(e) => setGroup(e.target.value)}>
                    {data.publish_groups.map((g) => <option key={g.slug} value={g.slug}>{g.title}</option>)}
                  </select>
                )}
                <label htmlFor="group-summary" className={labelClass}>What it's for (optional)</label>
                <input id="group-summary" className={inputClass} maxLength={500} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Our Sunday step study, weeks 3 to 6" />
                <div className="flex justify-end">
                  <button type="button" className={primaryButton} disabled={!group || busy} onClick={publish}>
                    {busy === "group" ? "Sharing…" : `Share with ${data.publish_groups.length > 1 ? "the group" : data.publish_groups[0].title}`}
                  </button>
                </div>
              </section>
            )}
            {!data.sponsees.length && !data.publish_groups.length && (
              <p className="text-slate-600 dark:text-neutral-400">
                You can suggest worksheets to people you sponsor (<Link to="/sponsorship">Sponsorship</Link>), and share them with groups you host for or run.
              </p>
            )}
          </>
        )}
        <div className="flex justify-end"><button type="button" className={quietButton} onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

// On a sponsee's page: suggest one of the built-in worksheets or one of your own
export function SuggestWorksheet({ sponsorshipId, name, onDone }) {
  const [data, setData] = useState(null);
  const [pick, setPick] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  useEffect(() => { api("/step_works").then(setData).catch((e) => setError(e.message)); }, []);
  if (!data) return <ErrorNote error={error} />;

  const suggest = async () => {
    setBusy(true);
    setError(null);
    const [kind, value] = pick.split(":");
    try {
      await api("/step_suggestions", { method: "POST", body: { sponsorship_ids: [sponsorshipId], note, [kind === "work" ? "work_id" : "tool_key"]: value } });
      setDone(pick);
      setPick("");
      setNote("");
      onDone?.();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  return (
    <div className="space-y-2 p-4">
      <label htmlFor="suggest-pick" className={labelClass}>Suggest a worksheet to {name}</label>
      <select id="suggest-pick" className={inputClass} value={pick} onChange={(e) => { setPick(e.target.value); setDone(null); }}>
        <option value="">Pick one…</option>
        {data.works.length > 0 && (
          <optgroup label="Your own copies (with your changes)">
            {data.works.map((w) => <option key={w.id} value={`work:${w.id}`}>Step {w.step}: {w.name}</option>)}
          </optgroup>
        )}
        <optgroup label="Built in">
          {data.tools.map((t) => <option key={t.key} value={`tool:${t.key}`}>Step {t.step}: {t.name}</option>)}
        </optgroup>
      </select>
      {pick && (
        <>
          <textarea aria-label="A note with it (optional)" className={inputClass} rows={2} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note with it (optional)" />
          <p className="text-xs text-slate-500 dark:text-neutral-400">Only the worksheet goes, never anything you wrote in it.</p>
        </>
      )}
      <ErrorNote error={error} />
      <div className="flex items-center justify-end gap-2">
        {done && <span className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400"><Check className="size-4" /> Suggested</span>}
        <button type="button" className={primaryButton} disabled={!pick || busy} onClick={suggest}>{busy ? "Suggesting…" : "Suggest it"}</button>
      </div>
    </div>
  );
}

// Its own link with a password (StepWork#share!): read only, the worksheet and everything in
// it, for a sponsor who isn't on RecoveryBot, or to open on another screen. Change the
// password, make a new link, or turn it off.
export function WorksheetLinkDialog({ work, onChanged, onClose }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState(false);
  const url = work.link && `${window.location.origin}${work.link.path}`;

  const call = async (method, body, done) => {
    setBusy(true);
    setError(null);
    try {
      const d = await api(`/step_works/${work.id}/link`, { method, body });
      onChanged(d.work);
      setPassword("");
      if (done) showToast(done, { tone: "success" });
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const copy = () => navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); });

  return (
    <div className="fixed inset-0 z-[2600] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Share a link"
        className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-sm text-slate-700 shadow-2xl ring-1 ring-neutral-200 sm:rounded-2xl dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white"><KeyRound className="size-4" /> Share a link with a password</p>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:hover:!bg-neutral-800"><X className="size-4" /></button>
        </div>
        <p className="text-slate-600 dark:text-neutral-400">
          Anyone with the link <strong>and</strong> the password can read this worksheet and everything you've written in it, including what you add
          later, without an account. They can't change anything. Give the password separately (say it out loud, or in another message), and turn the link off when you're done.
        </p>
        {url && (
          <div className="space-y-2 rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-500/10">
            <p className="flex items-center gap-1.5 font-medium text-emerald-800 dark:text-emerald-200"><Check className="size-4" /> The link is on</p>
            <input readOnly value={url} aria-label="The link" onFocus={(e) => e.target.select()} className={`${inputClass} font-mono text-xs`} />
            <p className="text-xs text-slate-500 dark:text-neutral-400">{work.link.viewed_at ? `Last opened ${new Date(work.link.viewed_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.` : "Not opened yet."}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={quietButton} disabled={busy} onClick={() => window.confirm("Turn the link off? It stops working right away.") && call("DELETE", null, "The link is off.")}>Turn off</button>
              <button type="button" className={quietButton} onClick={() => setQr(true)}><QrCodeIcon className="size-4" /> QR code</button>
              <button type="button" className={primaryButton} onClick={copy}>{copied ? <><Check className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy link</>}</button>
            </div>
          </div>
        )}
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); call("POST", { password }, url ? "Password changed." : "The link is on."); }}>
          <label htmlFor="link-password" className={labelClass}>{url ? "Change the password" : "Pick a password"}</label>
          <input id="link-password" type="text" autoComplete="off" className={inputClass} minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters" />
          <ErrorNote error={error} />
          <div className="flex flex-wrap justify-end gap-2">
            {url && <button type="button" className={quietButton} disabled={busy || password.length < 6} onClick={() => call("POST", { password, new_link: true }, "New link made. The old one stopped working.")}>New link</button>}
            <button type="submit" className={primaryButton} disabled={busy || password.length < 6}>{url ? "Change password" : "Turn on the link"}</button>
          </div>
        </form>
        {qr && url && <QrDialog url={url} title={work.name} text="They'll need the password too." onClose={() => setQr(false)} />}
      </div>
    </div>
  );
}
