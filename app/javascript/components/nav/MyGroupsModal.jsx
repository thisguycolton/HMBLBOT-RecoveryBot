import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, MapPinned, X } from "lucide-react";
import GroupLogo from "../groups/GroupLogo";

// "My groups" from the nav: the groups you're in (and the ones you asked to join), in a window
// over the page, so it works for everyone and not only for the site admins who have /groups.
export default function MyGroupsModal({ open, onClose, isSuiteAdmin }) {
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    setError(null);
    fetch("/api/groups", { headers: { Accept: "application/json" }, credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load your groups."))))
      .then((d) => setGroups(d.groups.filter((g) => g.membership_status)))
      .catch((e) => setError(e.message));
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;

  // On <body>: the nav's backdrop blur would otherwise trap a fixed window inside the nav bar
  return createPortal(
    <div className="fixed inset-0 z-[2500] flex items-start justify-center overflow-y-auto p-4 pt-20 sm:pt-24" role="dialog" aria-modal="true" aria-label="My groups">
      <button type="button" aria-label="Close" className="fixed inset-0 !bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl dark:bg-neutral-900 !font-sans">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex-1 !text-lg font-semibold text-slate-900 dark:text-white">My groups</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-8 place-items-center rounded-full !bg-transparent text-slate-500 hover:!bg-slate-100 dark:hover:!bg-neutral-800"><X className="size-4" /></button>
        </div>
        {error && <p className="text-sm text-rose-700">{error}</p>}
        {!groups && !error && <p className="py-6 text-center text-sm text-slate-500">Loading…</p>}
        {groups && groups.length === 0 && (
          <p className="py-4 text-sm text-slate-600 dark:text-neutral-300">You're not in a group yet. Find your home group's meeting and ask to join from its page.</p>
        )}
        {groups && groups.length > 0 && (
          <ul className="space-y-1">
            {groups.map((g) => (
              <li key={g.slug}>
                <a href={`/groups/${g.slug}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-neutral-800">
                  <GroupLogo group={g} className="size-10 text-sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900 dark:text-white">{g.title}</span>
                    <span className="block text-xs text-slate-500 dark:text-neutral-400">
                      {g.membership_status === "requested" ? "Request sent" : g.role === "admin" ? "Group admin" : "Member"}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-slate-400" />
                </a>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3 text-sm dark:border-neutral-800">
          <a href="/groups/meetings" className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline"><MapPinned className="size-4" /> Find a meeting</a>
          {isSuiteAdmin && <a href="/groups" className="ml-auto font-medium text-accent hover:underline">All groups (admin)</a>}
        </div>
      </div>
    </div>,
    document.body
  );
}
