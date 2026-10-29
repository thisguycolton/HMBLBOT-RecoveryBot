import React, { useState } from "react";
import { Paintbrush, Plus, RotateCcw } from "lucide-react";
import { labelClass, selectClass } from "../ui/styles";
import { milestoneKeys, partAt } from "../recovery/Chip";
import { METAL_LABELS } from "../recovery/ChipArt";
import { quietButton } from "../groups/ui";
import ArtEditor from "./ArtEditor";

// Round chips' milestones (ChipDesign::ROUND_KEYS; "year" is every year) and Meeting Maker counts
export const ROUND_MILESTONES = [
  { key: "24h", label: "24 hours" },
  { key: "30d", label: "30 days" },
  { key: "60d", label: "60 days" },
  { key: "90d", label: "90 days" },
  { key: "6m", label: "6 months" },
  { key: "9m", label: "9 months" },
  { key: "18m", label: "18 months" },
  { key: "year", years: 1, look: "year", label: "Every year" },
];
export const MEETING_MILESTONES = [
  ...[1, 5, 10, 25, 50, 100].map((n) => ({ key: "count", count: n, look: `n${n}`, label: `${n} meeting${n === 1 ? "" : "s"}` })),
  { key: "count", count: 200, look: "n+", label: "Every 100 after" },
];
const yearMilestone = (n) => ({ key: "year", years: n, look: `${n}y`, label: `${n} year${n === 1 ? "" : "s"}` });
const lookKey = (m) => m.look || m.key;
const oneYear = (key) => /^\d+y$/.test(key);
const FINISHES = [{ value: "plastic", label: "Colored" }, { value: "metal", label: "Metal" }];

const small = `${selectClass} !py-1.5 !pl-2.5 !text-xs`;
const SAME = "";

// "By milestone": each milestone's own look on a part's chips (ChipDesign `milestones`). Without
// art, its color and whether it's colored or metal; with a template's art (part.scene), its
// palette, enamel or struck, metal, and the group's own painting. `kind` is "round" or
// "meeting"; `chip(milestone, design part)` draws one for the row; `base` is RecoveryBot's part,
// for the usual colors. `template` sets only the art's (a chip template's defaults). Painting
// opens the art editor (fits `paintFits`, around `look`, on RecoveryBot's whole design `design`).
export default function MilestoneLooks({ kind, part, base, design, onChange, chip, template = false, paintFits = "round", look: editorLook = part }) {
  const [painting, setPainting] = useState(null);
  const [newYear, setNewYear] = useState("");
  const looks = part.milestones || {};
  const scene = part.emblem === "scene" || template ? part.scene : null;
  const palettes = Object.keys(scene?.palettes || {});
  const years = Object.keys(looks).filter(oneYear).map((k) => parseInt(k, 10)).sort((a, b) => a - b);
  const rows = kind === "meeting" ? MEETING_MILESTONES : [...ROUND_MILESTONES, ...years.map(yearMilestone)];

  const setLook = (key, patch) => {
    const next = Object.fromEntries(Object.entries({ ...looks[key], ...patch }).filter(([, v]) => v !== SAME && v !== undefined));
    const all = { ...looks, [key]: next };
    if (!Object.keys(next).length && !oneYear(key)) delete all[key];
    onChange({ milestones: all });
  };
  const clear = (m) => {
    const { [lookKey(m)]: _gone, ...rest } = looks;
    const patch = { milestones: rest };
    if (!scene && kind === "round" && !oneYear(lookKey(m)) && part.colors?.[m.key] !== base.colors?.[m.key]) patch.colors = { ...part.colors, [m.key]: base.colors[m.key] };
    onChange(patch);
  };
  const addYear = () => {
    const n = parseInt(newYear, 10);
    if (!n || n < 1 || n > 99) return;
    if (!looks[`${n}y`]) onChange({ milestones: { ...looks, [`${n}y`]: {} } });
    setNewYear("");
  };

  // Its color: round chips keep the usual milestones' in colors, one year's in its look
  const colorOf = (m) => {
    const own = looks[lookKey(m)]?.color;
    if (kind === "meeting") return own || part.color;
    if (oneYear(lookKey(m))) return own || part.colors.year;
    return part.colors[m.key];
  };
  const setColor = (m, v) => {
    if (kind === "round" && !oneYear(lookKey(m))) onChange({ colors: { ...part.colors, [m.key]: v } });
    else setLook(lookKey(m), { color: v });
  };
  const changed = (m) => Object.keys(looks[lookKey(m)] || {}).length > 0 || oneYear(lookKey(m))
    || (!scene && kind === "round" && part.colors[m.key] !== base.colors?.[m.key]);
  const usualFinish = kind === "meeting" ? (part.finish === "metal" ? "Metal" : "Colored") : { classic: "Classic", plastic: "Colored", metal: "Metal" }[part.finish];

  // The art as one milestone draws it, and the group's painting kept per milestone
  const sceneAt = (m) => partAt(part, milestoneKeys(kind === "meeting" ? null : m, kind === "meeting" ? m.count : undefined)).scene;
  const paint = (m) => (next) => {
    const key = lookKey(m);
    const own = Object.fromEntries(Object.entries(next.scene.fills || {}).filter(([k, v]) => (scene.fills || {})[k] !== v));
    const { fills: _f, palette: _p, colors: _c, finish: _fi, metal: _me, ...rest } = next.scene;
    onChange({ scene: { ...scene, hidden: rest.hidden, heights: rest.heights, layout: rest.layout }, milestones: { ...looks, [key]: { ...looks[key], fills: Object.keys(own).length ? own : undefined } } });
  };

  return (
    <div className="space-y-2">
      {!template && <div>
        <div className={labelClass}>By milestone</div>
        <p className="text-xs text-slate-500 !font-sans dark:text-neutral-400">
          {scene
            ? "Give any milestone a metal or colored chip, its own palette, finish or metal, or paint it differently. Left as Chip, Palette, Finish or Metal, it stays as set above."
            : `Give any milestone its own color, and make it colored or metal. The rest are ${usualFinish?.toLowerCase()}.`}
        </p>
      </div>}
      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200 dark:divide-neutral-800 dark:ring-neutral-800">
        {rows.map((m) => {
          const key = lookKey(m);
          const look = looks[key] || {};
          const open = painting === key;
          return (
            <li key={key} className="space-y-2 bg-white p-2 dark:bg-neutral-950">
              <div className="flex flex-wrap items-center gap-2">
                <div className={`flex ${kind === "meeting" ? "w-40" : "w-32"} shrink-0 items-center gap-2`}>
                  <span className="shrink-0">{chip(m)}</span>
                  <span className="text-sm font-medium text-slate-700 !font-sans dark:text-neutral-200">{m.label}</span>
                </div>
                {scene ? (
                  <>
                    {(
                      <select aria-label={`${m.label}: chip`} className={`${small} !w-28`} value={look.body || SAME} onChange={(e) => setLook(key, { body: e.target.value })}>
                        <option value={SAME}>Chip</option>
                        <option value="metal">Metal</option>
                        <option value="colored">Colored</option>
                      </select>
                    )}
                    {!template && (look.body || scene.body) === "colored" && (
                      <input type="color" aria-label={`${m.label}: color`} value={colorOf(m)} onChange={(e) => setColor(m, e.target.value)}
                        className="size-8 shrink-0 cursor-pointer rounded-md border-0 !bg-transparent p-0" />
                    )}
                    {palettes.length > 1 && (
                      <select aria-label={`${m.label}: palette`} className={`${small} !w-28`} value={look.palette || SAME} onChange={(e) => setLook(key, { palette: e.target.value })}>
                        <option value={SAME}>Palette</option>
                        {palettes.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    )}
                    <select aria-label={`${m.label}: finish`} className={`${small} !w-28`} value={look.art_finish || SAME} onChange={(e) => setLook(key, { art_finish: e.target.value })}>
                      <option value={SAME}>Finish</option>
                      <option value="enamel">Enamel</option>
                      <option value="struck">Struck</option>
                    </select>
                    <select aria-label={`${m.label}: metal`} className={`${small} !w-32`} value={look.metal || SAME} onChange={(e) => setLook(key, { metal: e.target.value })}>
                      <option value={SAME}>Metal</option>
                      {Object.entries(METAL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    {!template && (
                      <button type="button" className={`${quietButton} !px-2 !py-1 !text-xs`} aria-pressed={open} onClick={() => setPainting(open ? null : key)}>
                        <Paintbrush className="size-3.5" /> {open ? "Done" : look.fills ? "Repaint" : "Paint"}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <input type="color" aria-label={`${m.label}: color`} value={colorOf(m)} onChange={(e) => setColor(m, e.target.value)}
                      className="size-8 shrink-0 cursor-pointer rounded-md border-0 !bg-transparent p-0" />
                    <select aria-label={`${m.label}: finish`} className={`${small} !w-36`} value={look.finish || SAME} onChange={(e) => setLook(key, { finish: e.target.value })}>
                      <option value={SAME}>Same ({usualFinish})</option>
                      {FINISHES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </>
                )}
                {changed(m) && (
                  <button type="button" onClick={() => clear(m)} title="Like the rest" aria-label={`${m.label}: like the rest`}
                    className="ml-auto !bg-transparent p-1 text-slate-400 hover:text-slate-700 dark:hover:text-neutral-200"><RotateCcw className="size-3.5" /></button>
                )}
              </div>
              {open && (
                <div className="rounded-xl bg-neutral-50 p-2 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
                  <p className="mb-2 text-xs text-slate-500 dark:text-neutral-400">Painting {m.label.toLowerCase()} only. Layers and arranging change every milestone.</p>
                  <ArtEditor key={key} mode="design" value={{ art: scene.art, scene: sceneAt(m) }} base={design} look={editorLook} fits={paintFits}
                    milestone={kind === "meeting" ? undefined : m} count={kind === "meeting" ? m.count : undefined} onChange={paint(m)} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {kind === "round" && (
        <div className="flex items-center gap-2">
          <input type="number" min="1" max="99" value={newYear} onChange={(e) => setNewYear(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addYear(); } }}
            aria-label="A year to give its own look" placeholder="Year" className={`${small} !w-24`} />
          <button type="button" className={`${quietButton} !text-xs`} onClick={addYear}><Plus className="size-3.5" /> One year its own look</button>
        </div>
      )}
    </div>
  );
}
