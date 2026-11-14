import React, { useCallback, useState } from "react";
import { Minus, Plus } from "lucide-react";

// Text size for a reading's words (meeting readings and service readings share one setting).
// Scales the .reading-prose base size (1.2rem). Saved in this browser's local storage
// ("reading-text-size", listed in the privacy policy).
const KEY = "reading-text-size";
export const TEXT_SCALES = [0.85, 1, 1.15, 1.3, 1.5, 1.75, 2];

function stored() {
  try {
    const value = Number(localStorage.getItem(KEY));
    return TEXT_SCALES.includes(value) ? value : 1;
  } catch {
    return 1;
  }
}

export function useReadingTextSize() {
  const [scale, setScale] = useState(stored);

  const change = useCallback((by) => {
    setScale((current) => {
      const i = Math.min(Math.max(TEXT_SCALES.indexOf(current) + by, 0), TEXT_SCALES.length - 1);
      const next = TEXT_SCALES[i];
      try { localStorage.setItem(KEY, String(next)); } catch { /* private window */ }
      return next;
    });
  }, []);

  // For the reading's container: inline font size that its paragraphs inherit
  const style = { fontSize: `${(1.2 * scale).toFixed(3)}rem` };

  return { scale, change, style };
}

const buttonBase =
  "grid size-9 place-items-center rounded-lg !bg-transparent transition disabled:opacity-35 disabled:hover:!bg-transparent focus-visible:outline-none focus-visible:ring-2";

const LOOKS = {
  // On the page
  plain: {
    group: "rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900",
    button: `${buttonBase} text-slate-600 hover:!bg-neutral-100 hover:text-slate-900 focus-visible:ring-accent dark:text-neutral-300 dark:hover:!bg-neutral-800 dark:hover:text-white`,
    label: "text-slate-500 dark:text-neutral-400",
  },
  // In a reading's blue hero, beside its ghost buttons
  hero: {
    group: "rounded-xl border border-white/30",
    button: `${buttonBase} !text-white hover:!bg-white/10 focus-visible:ring-white/80`,
    label: "text-white/85",
  },
};

// Smaller / size / bigger, as one small pill
export function TextSizeControl({ scale, change, look = "plain", className = "" }) {
  const first = scale === TEXT_SCALES[0];
  const last = scale === TEXT_SCALES[TEXT_SCALES.length - 1];
  const styles = LOOKS[look] || LOOKS.plain;

  return (
    <div
      role="group"
      aria-label="Text size"
      className={`inline-flex items-center gap-0.5 p-0.5 !font-sans print:hidden ${styles.group} ${className}`}
    >
      <button type="button" className={styles.button} onClick={() => change(-1)} disabled={first} aria-label="Smaller text" title="Smaller text">
        <Minus className="size-4" />
      </button>
      <span className={`min-w-[3.25rem] select-none text-center text-xs font-semibold tabular-nums ${styles.label}`} aria-live="polite">
        <span aria-hidden="true" className="mr-0.5 text-sm">A</span>
        {Math.round(scale * 100)}%
      </span>
      <button type="button" className={styles.button} onClick={() => change(1)} disabled={last} aria-label="Bigger text" title="Bigger text">
        <Plus className="size-4" />
      </button>
    </div>
  );
}
