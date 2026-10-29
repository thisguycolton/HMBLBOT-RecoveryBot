import React, { useState } from "react";
import { Upload } from "lucide-react";
import SegmentedControl from "../ui/SegmentedControl";
import { ErrorNote, quietButton } from "../groups/ui";

const segment = "overflow-hidden rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-700";

// The raised logo: an SVG uploaded (`upload(svg)` -> { relief }), turned into outlines on the server (ChipRelief) and
// pressed into the chip in its own color. Dark parts stand highest, lighter ones lower, white
// none. Saved with the rest of the design.
export function ReliefUpload({ upload: send, relief, onChange }) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const d = await send(await file.text());
      onChange(d.relief);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  return (
    <div className="mt-2 space-y-2">
      <label className={`${quietButton} cursor-pointer`}>
        <Upload className="size-4" /> {busy ? "Reading…" : relief ? "Upload a different SVG" : "Upload an SVG"}
        <input type="file" accept=".svg,image/svg+xml" className="sr-only" onChange={(e) => { upload(e.target.files[0]); e.target.value = ""; }} />
      </label>
      <p className="text-xs text-slate-500 dark:text-neutral-400">
        Your logo, pressed into the chip like a stamped coin. The darker a part of the SVG, the higher it stands; white parts stay flat.
        Turn any text into outlines first. {!relief && "Until there's one, chips show the circle and triangle."}
      </p>
      <ErrorNote error={error} />
    </div>
  );
}

// How the raised logo sits: raised or cut in, how big, and on metal chips how high (or deep)
// and how sharply it rises from the coin (ChipDesign relief_* settings)
export function ReliefControls({ r, set }) {
  const slider = (key, label, min, max, low, high) => (
    <label className="block">
      <span className="flex items-baseline justify-between text-xs font-medium text-slate-600 dark:text-neutral-300">
        {label} <span className="tabular-nums text-slate-400">{r[key]}</span>
      </span>
      <input type="range" min={min} max={max} value={r[key]} onChange={(e) => set({ [key]: Number(e.target.value) })} className="w-full accent-[var(--color-accent)]" />
      <span className="flex justify-between text-[11px] text-slate-400"><span>{low}</span><span>{high}</span></span>
    </label>
  );
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900/60">
      <div className={segment}>
        <SegmentedControl value={r.relief_depth} onChange={(v) => set({ relief_depth: v })} options={[{ value: "raised", label: "Raised" }, { value: "inset", label: "Cut in" }]} />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-200">
        <input type="checkbox" checked={!!r.relief_badge} onChange={(e) => set({ relief_badge: e.target.checked, ...(e.target.checked && r.relief_size < 72 ? { relief_size: 84 } : {}) })} className="size-4 accent-[var(--color-accent)]" />
        A circle over the middle of the logo with the time in it
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        {slider("relief_size", "Size", 40, r.relief_badge ? 96 : 84, "Small", "Large")}
        {slider("relief_height", r.relief_depth === "inset" ? "Depth" : "Height", 1, 10, "Shallow", "Deep")}
        {slider("relief_sharpness", "Sharpness", 1, 10, "Soft slope", "Sharp edge")}
      </div>
      <p className="text-xs text-slate-500 dark:text-neutral-400">
        Height and sharpness shape metal chips, where the logo is struck into the coin. Colored chips get a slight print of it in one color.
      </p>
    </div>
  );
}
