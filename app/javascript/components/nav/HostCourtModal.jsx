import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, FileCheck2, X } from "lucide-react";

const ROLE_LABEL = { host: "You host", co_host: "You co-host" };

// "Court verification" in a host's account menu (/api/hosting): straight to the form for the one
// meeting they serve, or a window asking which meeting when they serve in several
export default function HostCourtModal({ open, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    setError(null);
    fetch("/api/hosting", { headers: { Accept: "application/json" }, credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load your meetings."))))
      .then((d) => {
        const only = d.meetings.length === 1 ? d.meetings[0] : d.meetings.length === 0 && d.groups.length === 1 ? d.groups[0] : null;
        if (only) window.location.href = only.court_url;
        else setData(d);
      })
      .catch((e) => setError(e.message));
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;

  // the groups they can host for, each with the meetings they serve in it
  const groups = data && data.groups.map((g) => ({ ...g, meetings: data.meetings.filter((m) => m.group_slug === g.slug) }));
  return createPortal(
    <div className="fixed inset-0 z-[2500] flex items-start justify-center overflow-y-auto p-4 pt-20 sm:pt-24" role="dialog" aria-modal="true" aria-label="Court verification">
      <button type="button" aria-label="Close" className="fixed inset-0 !bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl dark:bg-neutral-900 !font-sans">
        <div className="mb-1 flex items-center gap-2">
          <h2 className="flex-1 !text-lg font-semibold text-slate-900 dark:text-white">Court verification</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-8 place-items-center rounded-full !bg-transparent text-slate-500 hover:!bg-slate-100 dark:hover:!bg-neutral-800"><X className="size-4" /></button>
        </div>
        {error && <p className="text-sm text-rose-700">{error}</p>}
        {!data && !error && <p className="py-6 text-center text-sm text-slate-500">Loading…</p>}
        {data && (
          <>
            <p className="mb-3 !font-sans text-sm text-slate-600 dark:text-neutral-300">Which meeting is it for?</p>
            {groups.length === 0 && <p className="py-2 !font-sans text-sm text-slate-600 dark:text-neutral-300">You're not on a group's host schedule right now.</p>}
            <div className="space-y-3">
              {groups.map((g) => (
                <div key={g.slug}>
                  {groups.length > 1 && <p className="mb-1 px-2 !font-sans text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{g.title}</p>}
                  <ul className="space-y-1">
                    {g.meetings.map((m) => (
                      <li key={m.meeting_id}>
                        <a href={m.court_url} className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-neutral-800">
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"><FileCheck2 className="size-5" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-slate-900 dark:text-white">{m.name}</span>
                            <span className="block text-xs text-slate-500 dark:text-neutral-400">{m.label} · {m.roles.map((r) => ROLE_LABEL[r]).join(", ")}</span>
                          </span>
                          <ChevronRight className="size-4 text-slate-400" />
                        </a>
                      </li>
                    ))}
                    <li>
                      <a href={g.court_url} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm text-accent hover:bg-slate-100 dark:hover:bg-neutral-800">
                        {g.meetings.length ? `Another ${g.title} meeting` : `A ${g.title} meeting`} <ChevronRight className="ml-auto size-4 text-slate-400" />
                      </a>
                    </li>
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
