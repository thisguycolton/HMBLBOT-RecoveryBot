import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Minus, Moon, Plus, Sun } from "lucide-react";
import { api } from "../lib";
import { Loading, Message } from "../ui";
import { useDarkMode } from "./parts";
import "./hosting.css";

const SIZES = [20, 24, 28, 32, 38, 44];
const iconButton = "inline-grid size-9 shrink-0 place-items-center rounded-xl !bg-transparent text-slate-600 hover:!bg-neutral-100 disabled:opacity-40 dark:text-neutral-300 dark:hover:!bg-neutral-800";

// /groups/:slug/share/service-reading/:id: one version of a service reading on its own, big and
// plain, for a host to share this window in Zoom (opened from the Command Center's Service readings)
export default function ServiceReadingShare() {
  const { slug, id } = useParams();
  const [reading, setReading] = useState(null);
  const [error, setError] = useState(null);
  const [dark, toggleDark] = useDarkMode();
  const [size, setSize] = useState(() => { try { return Number(localStorage.getItem("hosting-share-size")) || 28; } catch { return 28; } });
  useEffect(() => { api(`/groups/${slug}/hosting/service_readings/${id}`).then(setReading).catch((e) => setError(e.message)); }, [slug, id]);
  useEffect(() => { if (reading) document.title = reading.title; }, [reading]);
  const change = (by) => {
    const next = SIZES[Math.min(Math.max(SIZES.indexOf(size) + by, 0), SIZES.length - 1)] || 28;
    setSize(next);
    try { localStorage.setItem("hosting-share-size", next); } catch { /* private window */ }
  };
  if (error) return <Message title="That reading isn't here" text={error} />;
  if (!reading) return <Loading />;
  return (
    <div className={`hc-root min-h-dvh w-full bg-white !font-sans text-slate-900 dark:bg-neutral-950 dark:text-white ${dark ? "doc-dark" : ""}`}>
      <div className="fixed right-3 top-3 z-10 flex items-center rounded-xl bg-white/80 shadow-panel ring-1 ring-neutral-200 backdrop-blur print:hidden dark:bg-neutral-900/80 dark:ring-neutral-800">
        <button type="button" className={iconButton} onClick={() => change(-1)} disabled={size === SIZES[0]} aria-label="Smaller text"><Minus className="size-4" /></button>
        <button type="button" className={iconButton} onClick={() => change(1)} disabled={size === SIZES[SIZES.length - 1]} aria-label="Bigger text"><Plus className="size-4" /></button>
        <button type="button" className={iconButton} onClick={toggleDark} aria-label={dark ? "Light mode" : "Dark mode"}>{dark ? <Sun className="size-5" /> : <Moon className="size-5" />}</button>
      </div>
      <article className="mx-auto max-w-4xl px-6 py-12 sm:px-12">
        <h1 className="font-bold leading-tight" style={{ fontSize: Math.round(size * 1.5) }}>{reading.title}</h1>
        {reading.source && <p className="mt-1 text-slate-500 dark:text-neutral-400" style={{ fontSize: Math.round(size * 0.7) }}>{reading.source}</p>}
        <div className="doc-prose hc-script hc-share mt-8 !max-w-none" style={{ fontSize: size }} dangerouslySetInnerHTML={{ __html: reading.html }} />
      </article>
    </div>
  );
}
