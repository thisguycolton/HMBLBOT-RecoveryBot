import React, { useEffect, useState } from "react";
import { BookText, ChevronRight, Maximize2, X } from "lucide-react";
import { api } from "../lib";
import LucideIcon from "../../ui/LucideIcon";

const label = "!text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400";
const row = "flex w-full items-center gap-3 rounded-xl !bg-transparent px-2.5 py-2 text-left text-sm text-slate-700 hover:!bg-neutral-100 dark:text-neutral-300 dark:hover:!bg-neutral-800";

// A service reading in its own window, big, to share that window in Zoom (ServiceReadingShare.jsx)
export const shareServiceReading = (slug, id) => window.open(`/groups/${slug}/share/service-reading/${id}`, "hosting-reading", "popup,width=1100,height=850");

// The site's service readings (How It Works, the Traditions, the Promises...) in the Command
// Center's left column. A reading with more than one version (its sources) opens a box to pick
// one; the one picked opens in its own window, ready to share.
// `grid`: as cards, two across, for the middle of a deck.
export default function ServiceReadings({ slug, grid = false }) {
  const [groups, setGroups] = useState(null);
  const [picking, setPicking] = useState(null);
  useEffect(() => {
    api(`/groups/${slug}/hosting/service_readings`).then((d) => {
      const byTitle = new Map();
      d.readings.forEach((r) => byTitle.set(r.title || "Untitled", [...(byTitle.get(r.title || "Untitled") || []), r]));
      setGroups([...byTitle.entries()].map(([title, versions]) => ({ title, versions, icon: versions.find((v) => v.icon)?.icon })));
    }).catch(() => setGroups([]));
  }, [slug]);
  if (!groups?.length) return null;
  const open = (g) => (g.versions.length === 1 ? shareServiceReading(slug, g.versions[0].id) : setPicking(g));
  return (
    <section>
      <h2 className={`${label} mb-2`}>Service readings</h2>
      <ul className={grid ? "grid gap-2 sm:grid-cols-2" : "space-y-0.5"}>
        {groups.map((g) => (
          <li key={g.title}>
            <button type="button" className={grid ? `${row} !bg-white py-3 shadow-panel ring-1 ring-neutral-200 hover:!bg-white hover:ring-accent/40 dark:!bg-neutral-900 dark:ring-neutral-800` : row} onClick={() => open(g)} title={g.versions.length > 1 ? "Pick a version" : "Opens in its own window, to share in Zoom"}>
              <LucideIcon name={g.icon} fallback={BookText} size={20} className="shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 truncate">{g.title}</span>
              {g.versions.length > 1 ? <span className="rounded-full bg-neutral-200 px-1.5 text-[11px] font-semibold text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">{g.versions.length}</span> : <Maximize2 className="size-3.5 text-slate-400" />}
            </button>
          </li>
        ))}
      </ul>
      {picking && <VersionPicker slug={slug} group={picking} onClose={() => setPicking(null)} />}
    </section>
  );
}

function VersionPicker({ slug, group, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="sr-pick-title" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-neutral-900">
        <header className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <LucideIcon name={group.icon} fallback={BookText} size={20} className="text-accent" />
          <div className="min-w-0 flex-1">
            <h2 id="sr-pick-title" className="truncate font-semibold">{group.title}</h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400">Which version? It opens in its own window, ready to share.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-grid size-9 place-items-center rounded-xl !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:hover:!bg-neutral-800"><X className="size-5" /></button>
        </header>
        <ul className="max-h-[60vh] space-y-1 overflow-y-auto p-2">
          {group.versions.map((v) => (
            <li key={v.id}>
              <button type="button" className={`${row} !py-3`} onClick={() => { shareServiceReading(slug, v.id); onClose(); }}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900 dark:text-white">{v.source || v.short_title || `Version ${v.id}`}</span>
                  {v.short_title && v.source && <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{v.short_title}</span>}
                </span>
                <ChevronRight className="size-4 text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
