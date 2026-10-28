import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, LockOpen, Move, PaintBucket, Pipette, Redo2, RotateCcw, Undo2 } from "lucide-react";
import SceneArt, { FRAMES, artScale, closed, heightOf, layoutOf, paintOf } from "../recovery/ChipArt";
import { RoundChip, TriangleChip, roundedTriangle } from "../recovery/Chip";
import SegmentedControl from "../ui/SegmentedControl";
import { flood, rasterize, simplify, trace } from "./areaFill";

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
// The art is shown on the chip itself, round or Meeting Maker triangle (`fits`; both can be
// switched between), with the group's words (`look`, over the `base` design).
//
// Enamel has the bucket (click a shape to paint it, even an unfilled closed outline; shift-click
// paints every shape of that color; in a template, "Just this area" or a click on the bare face
// paints only the closed area under it, as a new shape: areaFill.js), the eyedropper and
// swatches. Struck is one metal, so it has layers and heights, no bucket. Arrange (both) moves
// and resizes the whole picture, any layer, and the milestone: drag it, or its corner to size it
// (scene.layout, ChipArt.jsx layoutOf). `value` is { art, scene } (scene: colors, fills, hidden,
// heights, layout, finish, metal) and onChange gets the next { art, scene }. Undo and redo keep
// the last 50 steps.
const ROLES = [
  { value: "enamel", label: "Enamel" },
  { value: "line", label: "Metal line" },
  { value: "metal", label: "Metal" },
  { value: "cutout", label: "Cut out" },
];

const PREVIEW = { key: "year", years: 1, label: "1 year" };
const SIZE = { round: [200, 200], triangle: [200, 176] };

export default function ArtEditor({ value, onChange, mode = "design", base, look, fits = "round" }) {
  const id = useId().replace(/:/g, "");
  const { art, scene } = value;
  const struck = scene.finish === "struck";
  const [tool, setTool] = useState("bucket");
  const [area, setArea] = useState(false); // the bucket paints just the area clicked
  const [color, setColor] = useState("#c62839");
  const [selected, setSelected] = useState(null); // a layer id
  const [pick, setPick] = useState(null); // what Arrange moves: { kind: "art" | "milestone" | "layer", id }
  const [frame, setFrame] = useState(fits === "triangle" ? "triangle" : "round");
  const [note, setNote] = useState(null);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const template = mode === "template";
  const effective = { ...scene, art };
  const stageRef = useRef(null);
  const hitRef = useRef(null);
  const defsRef = useRef(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => { if (fits !== "both") setFrame(fits === "triangle" ? "triangle" : "round"); }, [fits]);

  const change = (next) => {
    setPast((p) => [...p.slice(-49), valueRef.current]);
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
    if (current === "arrange") { setSelected(layer.id); setPick({ kind: "layer", id: layer.id }); return; }
    if (current === "eyedropper") { if (shape.fill || scene.fills?.[shape.id]) { setColor(paintOf(shape, effective)); setTool("bucket"); } return; }
    if (template && area) { fillArea(e, shape, layer); return; }
    if (!shape.fill && !closed(shape)) return; // an open line has no inside
    if (!paintable(layer) && !(template && !shape.fill)) return;
    if (!shape.fill) {
      // An outline with nothing inside: it's filled now (in a template, its layer becomes enamel)
      if (template) {
        change({ art: { ...art, layers: art.layers.map((l) => (l.id === layer.id ? { ...l, role: "enamel", shapes: l.shapes.map((sh) => (sh.id === shape.id ? { ...sh, fill: color } : sh)) } : l)) }, scene });
      } else {
        change({ art, scene: { ...scene, fills: { ...(scene.fills || {}), [shape.id]: color } } });
      }
      return;
    }
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

  // Just the area under the click (in a template): drawn, flood filled, traced into a new shape
  // above the shape it's on, or in a "Painted areas" layer at the bottom when it's the bare face
  const fillArea = async (e, shape, layer) => {
    if (!template || !hitRef.current) return;
    const point = toStage(e);
    const [w, h] = SIZE[frame];
    try {
      const pixels = await rasterize(hitRef.current, defsRef.current, [0, 0, w, h], 600);
      const k = pixels.width / w;
      const { mask, count } = flood(pixels, Math.floor(point.x * k), Math.floor(point.y * k));
      if (count < 4) { setNote("There's no closed area there to fill."); return; }
      const box = FRAMES[frame].box;
      const { k: ak, ox, oy } = artScale(effective, box);
      const artPlace = layoutOf(scene)[frame]?.art;
      const into = shape && layer.role === "enamel" ? layer : null;
      const layerPlace = into && layoutOf(scene).layers?.[into.id];
      const toArt = ([px, py]) => {
        let x = px / k;
        let y = py / k;
        if (artPlace) {
          const [cx, cy] = [box[0] + box[2] / 2, box[1] + box[3] / 2];
          x = cx + (x - (artPlace.x || 0) - cx) / (artPlace.s || 1);
          y = cy + (y - (artPlace.y || 0) - cy) / (artPlace.s || 1);
        }
        x = (x - ox) / ak;
        y = (y - oy) / ak;
        if (layerPlace) {
          x = (layerPlace.cx || 0) + (x - (layerPlace.x || 0) - (layerPlace.cx || 0)) / (layerPlace.s || 1);
          y = (layerPlace.cy || 0) + (y - (layerPlace.y || 0) - (layerPlace.cy || 0)) / (layerPlace.s || 1);
        }
        return `${+x.toFixed(2)} ${+y.toFixed(2)}`;
      };
      const loops = trace(mask, pixels.width, pixels.height).map((l) => simplify(l)).filter((l) => l.length > 2);
      const d = loops.map((l) => `M${l.map(toArt).join(" L")} Z`).join(" ");
      const added = { id: `a${Date.now().toString(36)}`, d, fill: color };
      let layers;
      if (into) {
        layers = art.layers.map((l) => {
          if (l.id !== into.id) return l;
          const at = l.shapes.findIndex((sh) => sh.id === shape.id);
          return { ...l, shapes: [...l.shapes.slice(0, at + 1), added, ...l.shapes.slice(at + 1)] };
        });
      } else {
        const painted = art.layers.find((l) => l.id === "painted");
        layers = painted
          ? art.layers.map((l) => (l === painted ? { ...l, shapes: [...l.shapes, added] } : l))
          : [{ id: "painted", name: "Painted areas", role: "enamel", height: 0.2, locked: false, shapes: [added] }, ...art.layers];
      }
      setNote(null);
      change({ art: { ...art, layers }, scene });
    } catch (err) { setNote(err.message); }
  };

  // Arrange: what's picked, where it is on the stage, and moving or sizing it
  const layout = layoutOf(scene);
  const placeOf = (p) => (p.kind === "layer" ? layout.layers?.[p.id] : layout[frame]?.[p.kind]) || {};
  const writePlace = (p, place, live) => {
    const next = p.kind === "layer"
      ? { ...layout, layers: { ...(layout.layers || {}), [p.id]: place } }
      : { ...layout, [frame]: { ...(layout[frame] || {}), [p.kind]: place } };
    if (!place) {
      if (p.kind === "layer") delete next.layers[p.id];
      else delete next[frame][p.kind];
    }
    const v = valueRef.current;
    (live ? onChange : change)({ art: v.art, scene: { ...v.scene, layout: next } });
  };
  const toStage = (e) => {
    const svg = stageRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  const elementOf = (p) => {
    if (!p) return null;
    if (p.kind === "milestone") return stageRef.current?.querySelector("[data-milestone]");
    if (p.kind === "art") return hitRef.current?.querySelector("[data-art]");
    return hitRef.current?.querySelector(`[data-layer="${p.id}"]`);
  };
  const [box, setBox] = useState(null);
  useLayoutEffect(() => {
    const el = current === "arrange" && elementOf(pick);
    if (!el || !stageRef.current) { if (box) setBox(null); return; }
    const r = el.getBoundingClientRect();
    const m = stageRef.current.getScreenCTM().inverse();
    const a = new DOMPoint(r.left, r.top).matrixTransform(m);
    const b = new DOMPoint(r.right, r.bottom).matrixTransform(m);
    const next = { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
    if (!box || Math.abs(box.x - next.x) + Math.abs(box.y - next.y) + Math.abs(box.w - next.w) + Math.abs(box.h - next.h) > 0.05) setBox(next);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const drag = useRef(null);
  const startDrag = (e, how) => {
    if (!pick || !box) return;
    e.preventDefault();
    e.stopPropagation();
    stageRef.current.setPointerCapture(e.pointerId);
    let place = { ...placeOf(pick) };
    if (pick.kind === "layer" && place.cx === undefined) {
      const bb = elementOf(pick).getBBox(); // the layer in the art's own units
      place = { ...place, cx: +(bb.x + bb.width / 2).toFixed(2), cy: +(bb.y + bb.height / 2).toFixed(2) };
    }
    const unit = pick.kind === "layer" ? 1 / (artScale(effective, FRAMES[frame].box).k * (layout[frame]?.art?.s || 1)) : 1;
    drag.current = { how, start: toStage(e), place, unit, center: { x: box.x + box.w / 2, y: box.y + box.h / 2 }, moved: false };
  };
  const onDrag = (e) => {
    const d = drag.current;
    if (!d) return;
    const p = toStage(e);
    let place;
    if (d.how === "move") {
      place = { ...d.place, x: +((d.place.x || 0) + (p.x - d.start.x) * d.unit).toFixed(2), y: +((d.place.y || 0) + (p.y - d.start.y) * d.unit).toFixed(2) };
    } else {
      const f = Math.hypot(p.x - d.center.x, p.y - d.center.y) / Math.max(Math.hypot(d.start.x - d.center.x, d.start.y - d.center.y), 0.5);
      place = { ...d.place, s: +Math.min(5, Math.max(0.1, (d.place.s || 1) * f)).toFixed(3) };
    }
    writePlace(pick, place, d.moved);
    d.moved = true;
  };
  const endDrag = () => { drag.current = null; };
  const nudge = (dx, dy) => {
    if (!pick) return;
    const place = placeOf(pick);
    const unit = pick.kind === "layer" ? 1 / (artScale(effective, FRAMES[frame].box).k * (layout[frame]?.art?.s || 1)) : 1;
    let next = { ...place, x: +((place.x || 0) + dx * unit).toFixed(2), y: +((place.y || 0) + dy * unit).toFixed(2) };
    if (pick.kind === "layer" && next.cx === undefined) {
      const bb = elementOf(pick)?.getBBox();
      if (bb) next = { ...next, cx: +(bb.x + bb.width / 2).toFixed(2), cy: +(bb.y + bb.height / 2).toFixed(2) };
    }
    writePlace(pick, next);
  };

  const tools = struck
    ? [{ value: "arrange", label: "Arrange", icon: Move }]
    : [
      { value: "bucket", label: "Bucket", icon: PaintBucket },
      { value: "eyedropper", label: "Eyedropper", icon: Pipette },
      { value: "arrange", label: "Arrange", icon: Move },
    ];
  const current = struck ? "arrange" : tool;
  const cursor = current === "bucket" ? "cell" : current === "eyedropper" ? "copy" : "pointer";
  const onBackground = (e) => {
    if (current === "arrange") setPick({ kind: "art" });
    else if (current === "bucket") fillArea(e, null, null);
  };
  const milestoneAt = look?.milestone_at || "badge";
  const hasMilestone = frame === "triangle" || milestoneAt === "badge" || milestoneAt === "cartouche";
  const design = useMemo(() => base && {
    ...base,
    round: { ...base.round, ...(look || {}), emblem: "scene", scene: effective },
    triangle: { ...base.triangle, sides: look?.sides || ["Meeting", "Maker", "Your meeting"], emblem: "scene", scene: effective },
  }, [base, look, value]); // eslint-disable-line react-hooks/exhaustive-deps
  const [vw, vh] = SIZE[frame];
  const pickLabel = !pick ? null : pick.kind === "art" ? "The whole picture" : pick.kind === "milestone" ? (frame === "triangle" ? "The count" : "The milestone") : art.layers.find((l) => l.id === pick.id)?.name;

  useEffect(() => {
    const onKey = (e) => {
      if (current !== "arrange" || !pick || e.target.closest?.("input, textarea, select")) return;
      const step = e.shiftKey ? 5 : 1;
      const by = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!by) return;
      e.preventDefault();
      nudge(...by);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
                    <input id={`${id}-name-${layer.id}`} value={layer.name} onChange={(e) => setLayer(layer.id, { name: e.target.value })} onFocus={() => { setSelected(layer.id); setPick({ kind: "layer", id: layer.id }); }}
                      aria-label="Layer name" className="min-w-0 flex-1 rounded-md border-0 !bg-transparent px-1 py-0.5 text-sm font-medium ring-1 ring-transparent hover:ring-neutral-300 focus:ring-accent dark:hover:ring-neutral-700" />
                  ) : (
                    <button type="button" onClick={() => { setSelected(layer.id); setPick({ kind: "layer", id: layer.id }); }} className={`min-w-0 flex-1 truncate !bg-transparent text-left text-sm font-medium ${hidden ? "text-slate-400" : "text-slate-800 dark:text-neutral-100"}`}>{layer.name}</button>
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

        <div className="order-1 min-w-0 space-y-2 md:order-2">
          {fits === "both" && (
            <div className="mx-auto max-w-[260px] overflow-hidden rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-700">
              <SegmentedControl value={frame} onChange={(v) => { setFrame(v); if (pick?.kind !== "layer") setPick(null); }} options={[{ value: "round", label: "Round" }, { value: "triangle", label: "Meeting Maker" }]} />
            </div>
          )}
          <svg ref={stageRef} viewBox={`0 0 ${vw} ${vh}`} className="mx-auto block w-full max-w-[440px] touch-none select-none" role="img" aria-label="The chip's art"
            onPointerMove={onDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
            <defs ref={defsRef}>
              <clipPath id={`${id}-clip`}>{frame === "round" ? <circle cx="100" cy="100" r="88" /> : <path d={roundedTriangle(24, 10)} />}</clipPath>
            </defs>
            {design ? (
              frame === "round"
                ? <RoundChip design={design} milestone={PREVIEW} size={200} bare />
                : <TriangleChip design={design} kind="meeting" count={10} size={200} bare />
            ) : <circle cx="100" cy="100" r="99" fill="#a8873d" />}
            {/* The art again, unseen, to click on (and to draw for the area fill) */}
            <g ref={hitRef} opacity="0">
              <SceneArt id={`${id}-hit`} scene={effective} {...boxProps(frame)} clip={`${id}-clip`} frame={frame} onShape={onShape} onBackground={onBackground} cursor={cursor} />
            </g>
            {current === "arrange" && hasMilestone && pick?.kind !== "milestone" && (
              <MilestoneTarget stage={stageRef} onPick={() => setPick({ kind: "milestone" })} />
            )}
            {current === "arrange" && box && (
              <g>
                <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="transparent" stroke="#2f80ed" strokeWidth="0.8" strokeDasharray="3 2"
                  style={{ cursor: "move" }} onPointerDown={(e) => startDrag(e, "move")} />
                {[[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]].map(([x, y]) => (
                  <circle key={`${x}-${y}`} cx={x} cy={y} r="3.2" fill="#ffffff" stroke="#2f80ed" strokeWidth="1"
                    style={{ cursor: "nwse-resize" }} onPointerDown={(e) => startDrag(e, "size")} />
                ))}
              </g>
            )}
          </svg>
          {current === "bucket" && template && (
            <div className="mx-auto max-w-[300px] overflow-hidden rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-700">
              <SegmentedControl value={area ? "area" : "shape"} onChange={(v) => setArea(v === "area")} options={[{ value: "shape", label: "Whole shape" }, { value: "area", label: "Just this area" }]} />
            </div>
          )}
          {current === "arrange" && (
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <button type="button" onClick={() => setPick({ kind: "art" })} aria-pressed={pick?.kind === "art"}
                className={`rounded-full px-2.5 py-1 font-semibold ring-1 ${pick?.kind === "art" ? "!bg-accent/10 text-accent ring-accent/40" : "!bg-transparent text-slate-600 ring-neutral-300 dark:text-neutral-300 dark:ring-neutral-700"}`}>Whole picture</button>
              {hasMilestone && (
                <button type="button" onClick={() => setPick({ kind: "milestone" })} aria-pressed={pick?.kind === "milestone"}
                  className={`rounded-full px-2.5 py-1 font-semibold ring-1 ${pick?.kind === "milestone" ? "!bg-accent/10 text-accent ring-accent/40" : "!bg-transparent text-slate-600 ring-neutral-300 dark:text-neutral-300 dark:ring-neutral-700"}`}>{frame === "triangle" ? "Count" : "Milestone"}</button>
              )}
              {pick && Object.keys(placeOf(pick)).some((k) => k !== "cx" && k !== "cy") && (
                <button type="button" onClick={() => writePlace(pick, null)} className="inline-flex items-center gap-1 rounded-full !bg-transparent px-2.5 py-1 font-semibold text-slate-600 ring-1 ring-neutral-300 dark:text-neutral-300 dark:ring-neutral-700">
                  <RotateCcw className="size-3" /> Put {pickLabel?.toLowerCase().startsWith("the ") ? pickLabel.toLowerCase() : pickLabel} back
                </button>
              )}
            </div>
          )}
          <p className="text-center text-xs !font-sans text-slate-500 dark:text-neutral-400">
            {note || (current === "arrange"
              ? (pick ? `${pickLabel}: drag it to move it, drag a corner to size it. Arrow keys nudge it.` : "Click the picture, a layer or the milestone to move or size it.")
              : current === "bucket"
                ? (template ? "Click a shape to paint it, or an outline to fill it. Just this area, or a click on the bare face, paints only the closed area you click. Shift-click paints every shape of that color." : "Click a shape to paint it, or an outline to fill it. Shift-click paints every shape of that color.")
                : "Click a shape to pick up its color.")}
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

const boxProps = (frame) => {
  const [x, y, w, h] = FRAMES[frame].box;
  return { x, y, w, h };
};

// An unseen target over the milestone, so Arrange can pick it (it's drawn under the art's
// click layer)
function MilestoneTarget({ stage, onPick }) {
  const [r, setR] = useState(null);
  useLayoutEffect(() => {
    const el = stage.current?.querySelector("[data-milestone]");
    if (!el) { setR(null); return; }
    const b = el.getBoundingClientRect();
    const m = stage.current.getScreenCTM().inverse();
    const a = new DOMPoint(b.left, b.top).matrixTransform(m);
    const c = new DOMPoint(b.right, b.bottom).matrixTransform(m);
    const next = { x: a.x, y: a.y, w: c.x - a.x, h: c.y - a.y };
    if (!r || Math.abs(r.x - next.x) + Math.abs(r.y - next.y) + Math.abs(r.w - next.w) > 0.1) setR(next);
  });
  if (!r) return null;
  return <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="transparent" style={{ cursor: "pointer" }} onClick={onPick} />;
}
