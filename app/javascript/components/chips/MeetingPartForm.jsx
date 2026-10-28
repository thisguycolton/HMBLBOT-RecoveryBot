import React from "react";
import { RotateCcw } from "lucide-react";
import SegmentedControl from "../ui/SegmentedControl";
import { inputClass, labelClass } from "../ui/styles";
import SceneControls from "./SceneControls";

const segment = "overflow-hidden rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-700";

// The Meeting Maker chip's look: shape, the count or a template's art in the middle, the words,
// and its color
export default function MeetingPartForm({ id, slug, base, templates, onTemplates, part, set }) {
  const scene = part.emblem === "scene";
  const sideLabels = part.shape === "round" ? ["Around the top", "Then", "Around the bottom"] : ["Left side", "Right side", "Bottom"];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className={labelClass}>Shape</div>
          <div className={segment}>
            <SegmentedControl value={part.shape} onChange={(v) => set({ shape: v })} options={[{ value: "triangle", label: "Triangle" }, { value: "round", label: "Round" }]} />
          </div>
        </div>
        <div>
          <div className={labelClass}>In the middle</div>
          <div className={segment}>
            <SegmentedControl value={part.emblem} onChange={(v) => set({ emblem: v })} options={[{ value: "number", label: "The count" }, { value: "scene", label: "Illustration" }]} />
          </div>
        </div>
      </div>
      {scene && (
        <SceneControls slug={slug} base={base} templates={templates} onTemplates={onTemplates} words={false}
          fits={part.shape === "round" ? "round" : "triangle"} part={part} onChange={set} />
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        {sideLabels.map((label, i) => (
          <div key={label}>
            <label htmlFor={`m-${id}-${i}`} className={labelClass}>{label}</label>
            <input id={`m-${id}-${i}`} maxLength={24} className={inputClass} value={part.sides[i] || ""}
              onChange={(e) => set({ sides: [0, 1, 2].map((j) => (j === i ? e.target.value : part.sides[j] || "")) })} />
          </div>
        ))}
      </div>
      <p className="-mt-1 text-xs text-slate-500 dark:text-neutral-400">Leave the last one blank and it shows the meeting's name.</p>
      <div>
        <label htmlFor={`m-${id}-back`} className={labelClass}>On the back</label>
        <input id={`m-${id}-back`} maxLength={80} className={inputClass} value={part.back_text || ""} onChange={(e) => set({ back_text: e.target.value })} />
      </div>
      {!scene && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56">
            <div className={labelClass}>Finish</div>
            <div className={segment}>
              <SegmentedControl value={part.finish} onChange={(v) => set({ finish: v })} options={[{ value: "plastic", label: "Colored" }, { value: "metal", label: "Metal" }]} />
            </div>
          </div>
          <div className="w-44">
            <ColorField label="Color" value={part.color} fallback={base.meeting.color} onChange={(v) => set({ color: v })} />
          </div>
        </div>
      )}
    </div>
  );
}

export function ColorField({ label, value, fallback, onChange }) {
  return (
    <label className="flex items-center gap-2 rounded-xl px-2 py-1.5 ring-1 ring-neutral-200 dark:ring-neutral-700">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-7 shrink-0 cursor-pointer rounded-md border-0 !bg-transparent p-0" />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-neutral-200">{label}</span>
      {value !== fallback && (
        <button type="button" title="Back to the usual color" aria-label={`${label}: back to the usual color`} onClick={() => onChange(fallback)}
          className="!bg-transparent p-0 text-slate-400 hover:text-slate-700"><RotateCcw className="size-3.5" /></button>
      )}
    </label>
  );
}
