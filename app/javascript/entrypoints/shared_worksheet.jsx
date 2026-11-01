// A worksheet someone shared with its own link and a password (/worksheet/:token,
// SharedWorksheetsController): asks for the password, then shows the worksheet and what's
// written in it, read only. Nothing is shown, or kept in the browser, until the password is right.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Lock, Printer } from "lucide-react";

import "../styles/tailwind.css";
import "../styles/reader.css";

import { api } from "../components/groups/lib";
import { ErrorNote, primaryButton, quietButton } from "../components/groups/ui";
import { inputClass, labelClass } from "../components/ui/styles";
import { partsOf, workText } from "../components/recovery/steps/stepText";

function SharedWorksheet({ token }) {
  const [password, setPassword] = useState("");
  const [work, setWork] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const open = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const d = await api(`/shared_worksheets/${encodeURIComponent(token)}`, { method: "POST", body: { password } });
      setWork(d.work);
      setPassword("");
      document.title = `${d.work.name} | RecoveryBot`;
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  if (!work) {
    return (
      <form onSubmit={open} className="mx-auto mt-16 w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-panel ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
        <p className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white"><Lock className="size-5" /> Shared step work</p>
        <p className="text-sm text-slate-600 dark:text-neutral-400">Someone shared their step work with you. Enter the password they gave you to read it.</p>
        <div>
          <label htmlFor="ws-password" className={labelClass}>Password</label>
          <input id="ws-password" type="password" autoComplete="off" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </div>
        <ErrorNote error={error} />
        <div className="flex justify-end"><button type="submit" className={primaryButton} disabled={busy || !password}>{busy ? "Opening…" : "Open"}</button></div>
        <p className="text-xs text-slate-500 dark:text-neutral-400">Please keep what you read here between the two of you.</p>
      </form>
    );
  }

  const parts = partsOf(work.definition);
  return (
    <article className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 !font-sans [&_*]:!font-sans">
      <header className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-accent">{work.label}{work.status === "done" ? " · Done" : ""}</div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{work.name}</h1>
        <p className="text-sm text-slate-500 dark:text-neutral-400">Shared by {work.by} · last changed {new Date(work.updated_at).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</p>
        <div className="flex gap-2 pt-2 print:hidden">
          <button type="button" className={quietButton} onClick={() => window.print()}><Printer className="size-4" /> Print</button>
          <button type="button" className={quietButton} onClick={() => setWork(null)}><Lock className="size-4" /> Close</button>
        </div>
      </header>
      {parts.map((p, n) => {
        const text = workText(work, p.part);
        if (!text) return null;
        return (
          <section key={n} className="space-y-2">
            {p.part && <h2 className="border-b border-neutral-200 pb-2 text-xl font-semibold text-slate-900 dark:border-neutral-800 dark:text-white">{p.part}</h2>}
            <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800 dark:text-neutral-100">{text}</div>
          </section>
        );
      })}
      {!workText(work) && <p className="text-slate-600 dark:text-neutral-400">Nothing written here yet.</p>}
    </article>
  );
}

const mount = document.getElementById("shared-worksheet-root");
if (mount) createRoot(mount).render(<SharedWorksheet token={mount.dataset.token} />);
