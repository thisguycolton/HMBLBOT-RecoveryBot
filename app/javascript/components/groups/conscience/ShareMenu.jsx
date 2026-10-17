import React, { useEffect, useRef, useState } from "react";
import { Check, Copy, Globe, Link2, Lock, Users } from "lucide-react";
import { api } from "../lib";
import { selectClass } from "../../ui/styles";
import { quietButton } from "../ui";
import { VISIBILITIES } from "./lib";

const WHO = {
  public: [Globe, "Anyone with the link can read this document."],
  members: [Users, "Only members of this group can open the link."],
  keepers: [Lock, "Only the group's record keepers can open the link."],
};

// "Share link" at the top of a document: copies its address and says who can open it. Record
// keepers can change that right here (it takes effect at once, and isn't a new copy of the text).
export default function ShareMenu({ group, doc, canEdit, onChanged }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const box = useRef(null);
  const url = `${window.location.origin}/groups/${group.slug}/conscience/documents/${doc.id}`;
  const [Icon, note] = WHO[doc.visibility];

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("keydown", esc); };
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };
  const setVisibility = async (visibility) => {
    if (visibility === "public" && !window.confirm("This will be visible to anyone who opens the group's page. Make it Public?")) return;
    setError(null);
    try {
      const saved = await api(`/groups/${group.slug}/documents/${doc.id}`, { method: "PATCH", body: { document: { visibility } } });
      onChanged(saved);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div ref={box} className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} title="Share link" aria-label="Share link" className={quietButton}><Link2 className="size-4" /> <span className="max-sm:sr-only">Share link</span></button>
      {open && (
        <div role="dialog" aria-label="Share link" className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] space-y-3 rounded-2xl bg-white p-4 text-sm shadow-xl ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700">
          <div className="flex gap-2">
            <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Link to this document" className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-slate-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200" />
            <button type="button" onClick={copy} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl !bg-accent px-3 py-2 text-xs font-semibold !text-white">
              {copied ? <><Check className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy</>}
            </button>
          </div>
          <p className="flex items-start gap-2 text-slate-600 dark:text-neutral-300"><Icon className="mt-0.5 size-4 shrink-0" /> {note}</p>
          {canEdit && (
            <div>
              <label htmlFor="share-visibility" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Who can see it</label>
              <select id="share-visibility" className={selectClass} value={doc.visibility} onChange={(e) => setVisibility(e.target.value)}>
                {VISIBILITIES.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
              </select>
            </div>
          )}
          {error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
        </div>
      )}
    </div>
  );
}
