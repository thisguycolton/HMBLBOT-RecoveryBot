import React, { useEffect, useRef, useState } from "react";

// A progress ring for a share picture or video the server is drawing (QuoteCard). The page
// makes up a token, sends it with the picture's request (?progress=<token>), and while that
// request is out asks GET /api/card_progress/:token how far along it is.
//
//   const token = newProgressToken();
//   fetch(`${src}&progress=${token}`) ...
//   const progress = useCardProgress(waiting ? token : null);   // { stage, percent, secondsLeft } or null

export const newProgressToken = () =>
  (window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`).replace(/[^A-Za-z0-9_-]/g, "");

const POLL_MS = 700;

export function useCardProgress(token) {
  const [progress, setProgress] = useState(null);
  const started = useRef(0);

  useEffect(() => {
    setProgress(null);
    if (!token) return undefined;
    started.current = Date.now();
    let stopped = false;
    let timer;
    const ask = async () => {
      try {
        const res = await fetch(`/api/card_progress/${token}`, { credentials: "same-origin", headers: { Accept: "application/json" } });
        if (!stopped && res.status === 200) {
          const { stage, percent } = await res.json();
          // Time spent waiting for another video doesn't count toward how long this one takes
          if (stage === "waiting") started.current = Date.now();
          const elapsed = (Date.now() - started.current) / 1000;
          // How long is left, going by how long it's taken so far (once there's enough to go by)
          const secondsLeft = stage !== "waiting" && percent >= 8 && percent < 100 ? Math.max(1, Math.round((elapsed * (100 - percent)) / percent)) : null;
          setProgress((last) => ({ stage, percent: Math.max(percent, last?.stage === stage ? last.percent : 0), secondsLeft }));
        }
      } catch {
        // A missed answer: the next one will do
      }
      if (!stopped) timer = setTimeout(ask, POLL_MS);
    };
    // Most pictures are back before the first ask would be
    timer = setTimeout(ask, 500);
    return () => { stopped = true; clearTimeout(timer); };
  }, [token]);

  return progress;
}

// What it's doing, in words
export function progressLabel(progress, noun = "video") {
  if (!progress) return `Making your ${noun}…`;
  if (progress.stage === "waiting") return "Waiting for another video to finish…";
  if (progress.stage === "drawing") return "Drawing the pages…";
  if (progress.stage === "encoding") return `Putting your ${noun} together…`;
  return "Almost there…";
}

export function timeLeft(progress) {
  const s = progress?.secondsLeft;
  if (!s) return null;
  if (s <= 3) return "A few seconds left";
  return `About ${s} seconds left`;
}

// The ring itself: fills as `percent` goes up, with the number in the middle. With no
// percent yet, a short arc turns round (it's started, nothing to measure yet).
export function ProgressRing({ percent = null, size = 76, stroke = 6, label = "Progress", className = "" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const known = typeof percent === "number";
  const value = known ? Math.min(100, Math.max(0, percent)) : 0;
  return (
    <div className={`relative grid place-items-center ${className}`} style={{ width: size, height: size }}
      role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={known ? value : undefined}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={`-rotate-90 ${known ? "" : "motion-safe:animate-spin"}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-black/10 dark:stroke-white/15" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" className="stroke-accent"
          strokeDasharray={c} strokeDashoffset={known ? c * (1 - value / 100) : c * 0.78}
          style={{ transition: known ? "stroke-dashoffset 0.7s linear" : undefined }} />
      </svg>
      {known && <span className="absolute text-sm font-semibold tabular-nums text-slate-800 dark:text-white">{Math.round(value)}%</span>}
    </div>
  );
}
