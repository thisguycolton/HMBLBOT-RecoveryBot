import React, { useEffect, useId, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, LockOpen, MousePointer2, PaintBucket, Pipette, Redo2, Undo2 } from "lucide-react";
import SceneArt, { heightOf, paintOf } from "../recovery/ChipArt";
import { shade } from "../recovery/Chip";

// The chip art editor: a chip template's art (ChipArt) on a big coin face, its layers beside
// it, and tools to paint it. Used two ways:
//
// - mode "template" (Site Admin > Chip templates, and a group's own imports): the bucket
//   repaints the art itself, and layers can be renamed, reordered, locked, and given a role
//   and a height.
// - mode "design" (a group's Chips designer, on a template it picked): the bucket paints the
//   group's own fills over the template (scene.fills), never a locked layer, and layers can be
//   hidden or, struck, raised and lowered.
//
// Enamel has the bucket (click a shape to paint it; shift-click paints every shape of that
// color), the eyedropper and swatches. Struck is one metal, so it has layers and heights only.
// `value` is { art, scene } (scene: colors, fills, hidden, heights, finish, metal) and
// onChange gets the next { art, scene }. Undo and redo keep the last 50 steps.
const ROLES = [
  { value: "enamel", label: "Enamel" },
  { value: "line", label: "Metal line" },
  { value: "metal", label: "Metal" },
  { value: "cutout", label: "Cut out" },
];

export default function ArtEditor({ value, onChange, mode = "design" }) {
  const id = useId().replace(/:/g, "");
  const { art, scene } = value;
  const struck = scene.finish === "struck";
  const [tool, setTool] = useState("bucket");
  const [color, setColor] = useState("#c62839");
  const [selected, setSelected] = useState(null); // a layer id
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const template = mode === "template";
  const effective = { ...scene, art };

  const change = (next) => {
    setPast((p) => [...p.slice(-49), value]);
    setFuture([]);
    onChange(next);
  };
  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [value, ...f]);
    onChange(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, value]);
    onChange(future[0]);
    setFuture((f) => f.slice(1));
  };

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || e.target.closest?.("input, textarea")) return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // The colors on the art now, most used first: the swatches
  const swatches = useMemo(() => {
    const count = {};
    art.layers.filter((l) => l.role === "enamel").forEach((l) => l.shapes.forEach((sh) => {
      if (!sh.fill) return;
      const c = paintOf(sh, effective);
      count[c] = (count[c] || 0) + 1;
    }));
    return Object.entries(count).sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 18);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const paintable = (layer) => layer.role === "enamel" && (template || !layer.locked);

  const onShape = (shape, layer, e) => {
    if (tool === "select" || struck) { setSelected(layer.id); return; }
    if (tool === "eyedropper") { if (shape.fill) { setColor(paintOf(shape, effective)); setTool("bucket"); } return; }
    if (!shape.fill || !paintable(layer)) return;
    // Shift: every shape painted the same color, in layers that can be painted
    const was = paintOf(shape, effective);
    const targets = e.shiftKey
      ? art.layers.filter(paintable).flatMap((l) => l.shapes.filter((sh) => sh.fill && paintOf(sh, effective) === was))
      : [shape];
    const ids = new Set(targets.map((sh) => sh.id));
    if (template) {
      change({ art: { ...art, layers: art.layers.map((l) => ({ ...l, shapes: l.shapes.map((sh) => (ids.has(sh.id) ? { ...sh, fill: color } : sh)) })) }, scene });
    } else {
      const fills = { ...(scene.fills || {}) };
      targets.forEach((sh) => { fills[sh.id] = color; });
      change({ art, scene: { ...scene, fills } });
    }
  };

  const setLayer = (layerId, patch) => {
    if (!template) return;
    change({ art: { ...art, layers: art.layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)) }, scene });
  };
  const move = (layerId, by) => {
    const i = art.layers.findIndex((l) => l.id === layerId);
    const j = i + by;
    if (j < 0 || j >= art.layers.length) return;
    const layers = [...art.layers];
    [layers[i], layers[j]] = [layers[j], layers[i]];
    change({ art: { ...art, layers }, scene });
  };
  const toggleHidden = (layerId) => {
    const hidden = new Set(scene.hidden || []);
    if (hidden.has(layerId)) hidden.delete(layerId); else hidden.add(layerId);
    change({ art, scene: { ...scene, hidden: [...hidden] } });
  };
  const setHeight = (layer, h) => {
    if (template) setLayer(layer.id, { height: h });
    else change({ art, scene: { ...scene, heights: { ...(scene.heights || {}), [layer.id]: h } } });
  };
  const clearFills = () => change({ art, scene: { ...scene, fills: {} } });

  const tools = struck
    ? [{ value: "select", label: "Select", icon: MousePointer2 }]
    : [
      { value: "bucket", label: "Bucket", icon: PaintBucket },
      { value: "eyedropper", label: "Eyedropper", icon: Pipette },
      { value: "select", label: "Select", icon: MousePointer2 },
    ];
  const current = struck && tool !== "select" ? "select" : tool;
  const cursor = current === "bucket" ? "cell" : current === "eyedropper" ? "copy" : "pointer";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Tools">
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.value} type="button" onClick={() => setTool(t.value)} aria-pressed={current === t.value}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${current === t.value ? "!bg-accent text-white ring-accent" : "!bg-transparent text-slate-700 ring-neutral-300 dark:text-neutral-200 dark:ring-neutral-700"}`}>
              <Icon className="size-4" /> {t.label}
            </button>
          );
        })}
        <span className="flex-1" />
        <button type="button" onClick={undo} disabled={!past.length} aria-label="Undo" title="Undo (Ctrl+Z)" className="rounded-full !bg-transparent p-2 text-slate-600 ring-1 ring-neutral-300 disabled:opacity-40 dark:text-neutral-300 dark:ring-neutral-700"><Undo2 className="size-4" /></button>
        <button type="button" onClick={redo} disabled={!future.length} aria-label="Redo" title="Redo (Ctrl+Shift+Z)" className="rounded-full !bg-transparent p-2 text-slate-600 ring-1 ring-neutral-300 disabled:opacity-40 dark:text-neutral-300 dark:ring-neutral-700"><Redo2 className="size-4" /></button>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_auto]">
        <ol className="order-2 min-w-0 space-y-1 md:order-1" aria-label="Layers, top first">
          {[...art.layers].reverse().map((layer) => {
            const hidden = (scene.hidden || []).includes(layer.id);
            return (
              <li key={layer.id} className={`space-y-1 rounded-xl px-2 py-1.5 ${selected === layer.id ? "bg-accent/10 ring-1 ring-accent/30" : ""}`}>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => toggleHidden(layer.id)} aria-label={hidden ? `Show ${layer.name}` : `Hide ${layer.name}`}
                    className="!bg-transparent p-1 text-slate-500 dark:text-neutral-400">{hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                  {template ? (
                    <input id={`${id}-name-${layer.id}`} value={layer.name} onChange={(e) => setLayer(layer.id, { name: e.target.value })} onFocus={() => setSelected(layer.id)}
                      aria-label="Layer name" className="min-w-0 flex-1 rounded-md border-0 !bg-transparent px-1 py-0.5 text-sm font-medium ring-1 ring-transparent hover:ring-neutral-300 focus:ring-accent dark:hover:ring-neutral-700" />
                  ) : (
                    <button type="button" onClick={() => setSelected(layer.id)} className={`min-w-0 flex-1 truncate !bg-transparent text-left text-sm font-medium ${hidden ? "text-slate-400" : "text-slate-800 dark:text-neutral-100"}`}>{layer.name}</button>
                  )}
                  {template ? (
                    <>
                      <button type="button" onClick={() => setLayer(layer.id, { locked: !layer.locked })} aria-label={layer.locked ? "Let groups repaint it" : "Keep groups from repainting it"}
                        title={layer.locked ? "Locked: groups can't repaint it" : "Groups can repaint it"} className="!bg-transparent p-1 text-slate-500">{layer.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}</button>
                      <button type="button" onClick={() => move(layer.id, 1)} aria-label="Move up" className="!bg-transparent p-1 text-slate-500"><ArrowUp className="size-3.5" /></button>
                      <button type="button" onClick={() => move(layer.id, -1)} aria-label="Move down" className="!bg-transparent p-1 text-slate-500"><ArrowDown className="size-3.5" /></button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-neutral-400">{layer.locked ? <Lock className="inline size-3" aria-label="Locked" /> : ROLES.find((r) => r.value === layer.role)?.label}</span>
                  )}
                </div>
                {(selected === layer.id || struck) && (
                  <div className="flex flex-wrap items-center gap-2 pl-7 text-xs text-slate-600 dark:text-neutral-300">
                    {template && (
                      <select id={`${id}-role-${layer.id}`} value={layer.role} onChange={(e) => setLayer(layer.id, { role: e.target.value })} aria-label="What this layer is"
                        className="rounded-md border-0 bg-neutral-50 py-0.5 pl-2 pr-7 text-xs ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700">
                        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    )}
                    <label className="flex items-center gap-1.5">
                      Height
                      <input id={`${id}-h-${layer.id}`} type="range" min="0" max="1" step="0.05" value={heightOf(layer, scene)} onChange={(e) => setHeight(layer, Number(e.target.value))} className="w-24 accent-[var(--accent,#0f766e)]" />
                    </label>
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <div className="order-1 min-w-0 md:order-2">
          <svg viewBox="0 0 200 200" className="mx-auto block w-full max-w-[380px] select-none" role="img" aria-label="The chip's art">
            <defs><clipPath id={`${id}-clip`}><circle cx="100" cy="100" r="96" /></clipPath></defs>
            <circle cx="100" cy="100" r="99" fill={shade("#c9a24a", -0.2)} />
            <SceneArt id={`${id}-art`} scene={effective} x={4} y={4} w={192} h={192} clip={`${id}-clip`} onShape={onShape} cursor={cursor} />
          </svg>
          <p className="mt-2 text-center text-xs !font-sans text-slate-500 dark:text-neutral-400">
            {struck ? "Struck in one metal: pick a layer and set how high it stands."
              : current === "bucket" ? "Click a shape to paint it. Shift-click paints every shape of that color."
              : current === "eyedropper" ? "Click a shape to pick up its color." : "Click a shape to find its layer."}
          </p>
        </div>

        {!struck && (
          <div className="order-3 flex flex-wrap content-start gap-2 md:w-24 md:flex-col md:items-center" aria-label="Colors">
            <label className="flex items-center gap-2 md:flex-col" title="The bucket's color">
              <input id={`${id}-color`} type="color" value={color} onChange={(e) => { setColor(e.target.value); setTool("bucket"); }} className="size-10 cursor-pointer rounded-full border-0 !bg-transparent p-0" />
              <span className="text-xs text-slate-500">Bucket</span>
            </label>
            <div className="flex flex-wrap gap-1.5 md:justify-center">
              {swatches.map((c) => (
                <button key={c} type="button" onClick={() => { setColor(c); setTool("bucket"); }} aria-label={`Use ${c}`}
                  className={`size-6 rounded-full ring-1 ring-neutral-300 dark:ring-neutral-600 ${c === color ? "outline outline-2 outline-offset-2 outline-accent" : ""}`} style={{ background: c }} />
              ))}
            </div>
            {!template && Object.keys(scene.fills || {}).length > 0 && (
              <button type="button" onClick={clearFills} className="!bg-transparent text-xs font-medium text-accent hover:underline">Back to the palette</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
