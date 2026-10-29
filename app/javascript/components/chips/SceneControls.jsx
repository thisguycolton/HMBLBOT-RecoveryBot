import React, { useRef, useState } from "react";
import { Paintbrush, RefreshCw, Trash2, Upload } from "lucide-react";
import SegmentedControl from "../ui/SegmentedControl";
import { labelClass } from "../ui/styles";
import { RoundChip } from "../recovery/Chip";
import { METAL_LABELS } from "../recovery/ChipArt";
import { api } from "../groups/lib";
import { quietButton } from "../groups/ui";
import ArtEditor from "./ArtEditor";
import { ColorField } from "./MeetingPartForm";
import { applyDefaults, readText, sceneFrom, storedScene, templateDesign } from "./lib";

const segment = "overflow-hidden rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-700";
const THUMB = { key: "year", years: 1, label: "1 year" };
export const MILESTONE_AT = [{ value: "badge", label: "Badge" }, { value: "cartouche", label: "Cartouche" }, { value: "rim", label: "On the rim" }, { value: "none", label: "None" }];
export const EDGES = [{ value: "plain", label: "Plain" }, { value: "reeded", label: "Reeded" }, { value: "rope", label: "Rope" }, { value: "beads", label: "Beads" }];

// What the art editor shows around the art: a Meeting Maker part's words go around a round chip
export const editorLook = (part, fits) => (part.sides && fits === "round"
  ? { top_text: [part.sides[0], part.sides[1]].filter(Boolean).join(" "), bottom_text: part.sides[2] || "Your meeting", milestone_at: part.milestone_at, edge: part.edge, numerals: "number" }
  : part);

// Picking and setting up a chip template's art on a design part (round chips, or Meeting
// Maker chips: `fits` "round" or "triangle"): the templates as chips to pick from (the site's
// and the group's own, which it can import here), then the palette, enamel or struck, the metal,
// where the milestone sits, the edge, and the art editor for the group's own touches.
// `part` is the design part; onChange gets what to change in it.
export default function SceneControls({ slug, base, templates, fits, part, onChange, onTemplates, words = true }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const list = templates.filter((t) => t.fits === "both" || t.fits === fits);
  const scene = part.scene;
  const current = scene && templates.find((t) => t.id === scene.template_id);

  const pick = (t) => {
    const d = t.defaults || {};
    const patch = { emblem: "scene", scene: sceneFrom(t, {}) };
    if (d.milestone_at) patch.milestone_at = d.milestone_at;
    if (d.edge) patch.edge = d.edge;
    onChange(words ? applyDefaults(patch, d) : patch);
    setEditing(false);
  };
  const setScene = (patch) => onChange({ scene: { ...scene, ...patch } });
  const importSvg = async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const t = await api(`/groups/${slug}/chips/templates`, { method: "POST", body: { svg: await readText(file), title: file.name.replace(/\.svg$/i, "") } });
      onTemplates([...templates, t]);
      pick(t);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      fileRef.current.value = "";
    }
  };
  const removeOwn = async (t) => {
    if (!window.confirm(`Take "${t.title}" off your list? Chips already given in it keep it.`)) return;
    try {
      await api(`/groups/${slug}/chips/templates/${t.id}`, { method: "DELETE" });
      onTemplates(templates.filter((x) => x.id !== t.id));
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-4 rounded-2xl bg-neutral-50 p-3 dark:bg-neutral-900/60">
      <div>
        <div className={labelClass}>Art</div>
        <div className="flex flex-wrap gap-3">
          {list.map((t) => (
            <div key={t.id} className="relative">
              <button type="button" onClick={() => pick(t)} aria-pressed={current?.id === t.id} title={t.title}
                className={`flex w-[5.5rem] flex-col items-center gap-1 rounded-xl !bg-transparent p-1 ${current?.id === t.id ? "ring-2 ring-accent" : "hover:ring-1 hover:ring-neutral-300"}`}>
                <RoundChip design={templateDesign(base, t)} milestone={THUMB} size={64} />
                <span className="line-clamp-2 text-center text-[0.7rem] leading-tight text-slate-600 dark:text-neutral-300">{t.title}</span>
              </button>
              {t.own && (
                <button type="button" onClick={() => removeOwn(t)} aria-label={`Remove ${t.title}`}
                  className="absolute -right-1 -top-1 rounded-full !bg-white p-1 text-slate-500 shadow ring-1 ring-neutral-200 hover:text-red-600 dark:!bg-neutral-800 dark:ring-neutral-700"><Trash2 className="size-3" /></button>
              )}
            </div>
          ))}
          <input ref={fileRef} id={`scene-import-${fits}`} type="file" accept=".svg,image/svg+xml" className="hidden" onChange={(e) => importSvg(e.target.files[0])} />
          <button type="button" disabled={busy} onClick={() => fileRef.current.click()}
            className="flex w-[5.5rem] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-neutral-300 !bg-transparent p-1 text-slate-500 hover:border-accent hover:text-accent dark:border-neutral-700">
            <Upload className="size-5" />
            <span className="text-center text-[0.7rem] leading-tight">{busy ? "Importing…" : "Import your own SVG"}</span>
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Your own art is only for your group's chips. Import only art you made or have the rights to.</p>
        {error && <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>}
      </div>

      {scene && current && (
        <>
          {scene.version < current.version && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
              <span className="flex-1">There's a newer version of {current.title}. Chips already out keep the one they have.</span>
              <button type="button" className={quietButton} onClick={() => onChange({ scene: sceneFrom(current, { ...storedScene(scene), version: current.version }) })}>
                <RefreshCw className="size-4" /> Update to latest
              </button>
            </div>
          )}
          {Object.keys(current.palettes || {}).length > 1 && (
            <div>
              <div className={labelClass}>Palette</div>
              <div className={segment}>
                <SegmentedControl value={scene.palette} onChange={(v) => setScene({ palette: v, colors: current.palettes[v] || {} })}
                  options={Object.keys(current.palettes).map((p) => ({ value: p, label: p }))} />
              </div>
            </div>
          )}
          <div className="grid gap-3">
            <div>
              <div className={labelClass}>Finish</div>
              <div className={segment}>
                <SegmentedControl value={scene.finish || "enamel"} onChange={(v) => setScene({ finish: v })} options={[{ value: "enamel", label: "Enamel" }, { value: "struck", label: "Struck" }]} />
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">{scene.finish === "struck" ? "One metal, raised by layer." : "Colors with metal lines between them."}</p>
            </div>
            <div>
              <div className={labelClass}>Chip</div>
              <div className={segment}>
                <SegmentedControl value={scene.body || "metal"} onChange={(v) => setScene({ body: v === "colored" ? "colored" : undefined })} options={[{ value: "metal", label: "Metal" }, { value: "colored", label: "Colored (plastic)" }]} />
              </div>
              {scene.body === "colored" && (part.sides
                ? <div className="mt-2 w-44"><ColorField label="Color" value={part.color} fallback={base.meeting.color} onChange={(v) => onChange({ color: v })} /></div>
                : <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Each milestone's color is set below.</p>)}
            </div>
            <div>
              <div className={labelClass}>Metal</div>
              <div className={segment}>
                <SegmentedControl value={scene.metal || "brass"} onChange={(v) => setScene({ metal: v })} options={Object.entries(METAL_LABELS).map(([value, label]) => ({ value, label }))} />
              </div>
            </div>
          </div>
          <div className="grid gap-3">
            <div>
              <div className={labelClass}>{fits === "triangle" ? "Count" : "Milestone"}</div>
              <div className={segment}><SegmentedControl value={part.milestone_at || "badge"} onChange={(v) => onChange({ milestone_at: v })} options={MILESTONE_AT} /></div>
            </div>
            <div>
              <div className={labelClass}>Edge</div>
              <div className={segment}><SegmentedControl value={part.edge || "plain"} onChange={(v) => onChange({ edge: v })} options={EDGES} /></div>
            </div>
          </div>
          <div>
            <button type="button" className={quietButton} onClick={() => setEditing((x) => !x)}>
              <Paintbrush className="size-4" /> {editing ? "Done editing the art" : scene.finish === "struck" ? "Edit layers" : "Paint and edit layers"}
            </button>
            {editing && (
              <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-neutral-200 dark:bg-neutral-950 dark:ring-neutral-800">
                <ArtEditor mode="design" value={{ art: scene.art, scene }} base={base} look={editorLook(part, fits)} fits={fits} onChange={(next) => onChange({ scene: next.scene })} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
