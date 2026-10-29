import React from "react";
import SegmentedControl from "../ui/SegmentedControl";
import { inputClass, labelClass } from "../ui/styles";
import { RoundChip } from "../recovery/Chip";
import SceneControls from "./SceneControls";
import MilestoneLooks from "./MilestoneLooks";
import { ReliefControls, ReliefUpload } from "./Relief";

const segment = "overflow-hidden rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-700";

// Round chips' look (ChipDesign "round"), the same everywhere they're designed: a group's chips
// (Group dashboard > Chips), its Special Editions, and RecoveryBot's own sobriety chips (Site
// Admin > Sobriety chips). The words on both sides, what's in the middle (the circle and
// triangle, a template's art, a logo, a raised logo, or just the number), finish, numerals, and
// each milestone's own look. `design` is the whole design, `set` changes its round part, `base`
// is RecoveryBot's default. A group's logo is only offered with `logo` (true; `logoUrl` is it),
// the raised logo with `uploadRelief(svg)`, and importing art with a group `slug`. `id` keeps
// the fields' ids apart when two forms are on a page.
export default function RoundPartForm({ id = "c", design, set, base, templates, onTemplates, slug, logo = false, logoUrl, uploadRelief, ringTop, backNote }) {
  const part = design.round;
  const emblems = [
    { value: "triangle", label: "Circle and triangle" }, { value: "scene", label: "Illustration" },
    ...(logo ? [{ value: "logo", label: "Group logo" }] : []),
    ...(uploadRelief ? [{ value: "relief", label: "Raised logo" }] : []),
    { value: "none", label: "Just the number" },
  ];
  return (
    <>
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor={`${id}-top`} className={labelClass}>Around the top</label>
        <input id={`${id}-top`} maxLength={40} className={inputClass} value={part.top_text} onChange={(e) => set({ top_text: e.target.value })} />
      </div>
      <div>
        <label htmlFor={`${id}-bottom`} className={labelClass}>Around the bottom</label>
        <input id={`${id}-bottom`} maxLength={40} className={inputClass} value={part.bottom_text} onChange={(e) => set({ bottom_text: e.target.value })} />
      </div>
    </div>
    <div>
      <label htmlFor={`${id}-back`} className={labelClass}>On the back</label>
      <textarea id={`${id}-back`} rows={5} maxLength={240} className={inputClass} value={part.back_text} onChange={(e) => set({ back_text: e.target.value })} />
      <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Each line here is a line on the chip. {backNote}</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor={`${id}-ring-top`} className={labelClass}>Around the back, top</label>
        <input id={`${id}-ring-top`} maxLength={40} className={inputClass} placeholder={ringTop} value={part.back_ring_top || ""} onChange={(e) => set({ back_ring_top: e.target.value })} />
      </div>
      <div>
        <label htmlFor={`${id}-ring-bottom`} className={labelClass}>Around the back, bottom</label>
        <input id={`${id}-ring-bottom`} maxLength={40} className={inputClass} placeholder="The day it was earned" value={part.back_ring_bottom || ""} onChange={(e) => set({ back_ring_bottom: e.target.value })} />
      </div>
    </div>
    <div>
      <div className={labelClass}>In the middle</div>
      <div className={segment}>
        <SegmentedControl value={part.emblem} onChange={(v) => set({ emblem: v })} options={emblems} />
      </div>
      {part.emblem === "logo" && !logoUrl && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">The group has no logo yet, so chips show the circle and triangle. Add one in Group settings.</p>}
      {part.emblem === "relief" && uploadRelief && <ReliefUpload upload={uploadRelief} relief={part.relief} onChange={(relief) => set({ relief })} />}
      {part.emblem === "relief" && part.relief && <ReliefControls r={part} set={set} />}
      {part.emblem === "scene" && (
        <div className="mt-3">
          <SceneControls slug={slug} base={base} templates={templates} onTemplates={onTemplates} fits="round" part={part} onChange={set} />
        </div>
      )}
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      {part.emblem !== "scene" && <div>
        <div className={labelClass}>Finish</div>
        <div className={segment}>
          <SegmentedControl value={part.finish} onChange={(v) => set({ finish: v })}
            options={[{ value: "classic", label: "Classic" }, { value: "plastic", label: "Colored" }, { value: "metal", label: "Metal" }]} />
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Classic: colored chips for the months, metal medallions for the years.</p>
      </div>}
      <div>
        <div className={labelClass}>Years</div>
        <div className={segment}>
          <SegmentedControl value={part.numerals} onChange={(v) => set({ numerals: v })}
            options={[{ value: "roman", label: "Roman (IV)" }, { value: "number", label: "Number (4)" }]} />
        </div>
      </div>
    </div>
    <MilestoneLooks kind="round" part={part} base={base.round} design={base} onChange={set}
      chip={(m) => <RoundChip design={design} milestone={m.look === "year" ? { ...m, label: "1 year" } : m} logoUrl={logoUrl} size={40} />} />
    </>
  );
}
