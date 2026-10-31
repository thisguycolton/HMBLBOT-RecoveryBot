import React, { useEffect, useRef, useState } from "react";
import { Check, Copy, Mail, MessageCircle, Share2, X } from "lucide-react";
import { quietButton } from "../groups/ui";

// "Share" on a gratitude list or 10th step: the day's writing as plain text to paste
// anywhere (a text to a sponsor, an email, a group chat), with a link at the top. The link
// is the same for everyone (/start/gratitude, /start/10th-step, StartToolsController): it
// opens the reader's own page if they have an account, or sign-up if they don't, and says
// nothing about who sent it. Nothing is sent or saved here; the text only leaves the device
// when they paste or send it themselves.
//
// `what` names it ("gratitude list"), `title` heads the text. `build(options)` makes the text from what's on the form now; `options` are the checkboxes
// (`choices`: [{ key, label, initial }]) for what to put in.
export default function EntryShare({ tool, what, title, build, choices = [], disabled }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState(() => Object.fromEntries(choices.map((c) => [c.key, c.initial ?? true])));
  const [copied, setCopied] = useState(false);
  const box = useRef(null);
  const link = new URL(`/start/${tool}`, window.location.origin).toString();
  const body = open ? build(opts) : "";
  const text = `${title}\nStart your own (free, and private): ${link}\n\n${body}`.trim();

  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    box.current?.querySelector("button[data-copy]")?.focus();
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      box.current?.querySelector("textarea")?.select();
    }
  };
  const canShare = typeof navigator.share === "function";
  const nativeShare = async () => {
    try { await navigator.share({ title, text }); } catch { /* they closed the share sheet */ }
  };
  const enc = encodeURIComponent;

  return (
    <>
      <button type="button" className={quietButton} disabled={disabled} onClick={() => setOpen(true)}
        title={disabled ? "Write something first" : undefined}>
        <Share2 className="size-4" /> Share
      </button>
      {open && (
        <div className="fixed inset-0 z-[2600] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div ref={box} role="dialog" aria-modal="true" aria-label={`Share your ${what}`}
            className="max-h-[90dvh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-left text-sm text-slate-700 shadow-2xl ring-1 ring-neutral-200 sm:rounded-2xl sm:pb-4 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-slate-900 dark:text-white">Share your {what}</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                className="grid size-8 place-items-center rounded-lg !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:text-neutral-400 dark:hover:!bg-neutral-800"><X className="size-4" /></button>
            </div>
            <p className="text-slate-600 dark:text-neutral-400">
              Copy it and paste it to your sponsor or a friend. The link at the top opens their own page if they have an account, or lets them make one. It doesn't show them anything of yours.
            </p>
            {choices.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {choices.map((c) => (
                  <label key={c.key} className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={!!opts[c.key]} onChange={(e) => setOpts((o) => ({ ...o, [c.key]: e.target.checked }))} />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
            <textarea readOnly value={text} rows={10} aria-label="What will be copied" onFocus={(e) => e.target.select()}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-base text-slate-700 sm:text-xs dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200" />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" data-copy onClick={copy} className="inline-flex items-center gap-1.5 rounded-xl !bg-accent px-4 py-2 text-sm font-semibold !text-white">
                {copied ? <><Check className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy</>}
              </button>
              <a href={`sms:?&body=${enc(text)}`} className={quietButton}><MessageCircle className="size-4" /> Text</a>
              <a href={`mailto:?subject=${enc(title)}&body=${enc(text)}`} className={quietButton}><Mail className="size-4" /> Email</a>
              {canShare && <button type="button" onClick={nativeShare} className={quietButton}><Share2 className="size-4" /> More…</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
