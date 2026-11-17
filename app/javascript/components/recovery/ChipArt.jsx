import React from "react";
import { LiftFilter, shade } from "./Chip";

// The picture on an illustrated chip (ChipDesign emblem "scene", ChipArt on the server): a chip
// template's layers of outlines, drawn in a 200 × 200 box like the rest of a chip.
//
// Enamel paints each shape: the group's bucket fill for it, else the palette's color for its
// own, else its own, with its outline as a raised metal line. Line and metal layers are bare
// metal; cutouts aren't drawn. Struck draws every layer at its height, one metal, lit like the
// raised logo (LiftFilter); black and gold leaves the low parts black.

export const METALS = { brass: "#c9a24a", silver: "#c4cad3", bronze: "#a86b3c", black_gold: "#d4af37" };
export const METAL_LABELS = { brass: "Brass", silver: "Silver", bronze: "Bronze", black_gold: "Black and gold" };
export const metalOf = (scene) => METALS[scene?.metal] || METALS.brass;
// The dark of a black and gold coin's face
export const BLACK = "#17130c";

// What color a shape is painted
export const paintOf = (shape, scene) => scene?.fills?.[shape.id] || scene?.colors?.[shape.fill] || shape.fill;
export const heightOf = (layer, scene) => scene?.heights?.[layer.id] ?? layer.height;
export const shown = (scene) => {
  const hidden = new Set(scene?.hidden || []);
  return (scene?.art?.layers || []).filter((l) => !hidden.has(l.id));
};

// Where the parts sit (scene.layout, else its template's): the whole picture and the milestone
// on each chip shape ({ round: { art, milestone }, triangle: { ... } }, in chip units, around
// their usual centers), and each layer of the art ({ layers: { id: { x, y, s, cx, cy } } }, in
// the art's own units, scaled around cx, cy). s is the size: 1 as drawn.
export const layoutOf = (scene) => scene?.layout || scene?.template_layout || {};
export const FRAMES = { round: { box: [10, 10, 180, 180], badge: [100, 146], cartouche: [100, 162] }, triangle: { box: [48, 52, 104, 92], badge: [100, 122.5] } };
// The SVG transform for a placement around a center
export function placeTransform(place, cx, cy) {
  if (!place) return undefined;
  const { x = 0, y = 0, s = 1 } = place;
  if (!x && !y && s === 1) return undefined;
  return `translate(${x} ${y}) translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`;
}
const layerTransform = (scene, layer) => {
  const place = layoutOf(scene).layers?.[layer.id];
  return place && placeTransform(place, place.cx || 0, place.cy || 0);
};
// How the art's units map onto a box: its scale and where its corner lands (preserveAspectRatio slice)
export function artScale(scene, [x, y, w, h]) {
  const [bx, by, bw, bh] = scene.art.view_box;
  const k = Math.max(w / bw, h / bh);
  return { k, ox: x + (w - bw * k) / 2 - bx * k, oy: y + (h - bh * k) / 2 - by * k };
}
// A closed outline (its interior can be filled even when it isn't)
export const closed = (shape) => /z\s*$/i.test(shape.d.trim());

// The metal's shine, for lines and bare metal
export function MetalGradient({ id, color }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor={shade(color, 0.45)} />
      <stop offset="50%" stopColor={color} />
      <stop offset="100%" stopColor={shade(color, -0.35)} />
    </linearGradient>
  );
}

// The art across a box (the coin's face: x, y, w, h), clipped by `clip` (a clipPath id).
// `frame` (round or triangle) says which placement of the picture to use (layoutOf).
// `onShape(shape, layer, event)` makes shapes clickable (the editor's tools), and
// `onBackground(event)` the face around them.
export default function SceneArt({ id, scene, x = 10, y = 10, w = 180, h = 180, clip, frame = "round", onShape, onBackground, cursor }) {
  if (!scene?.art) return null;
  const props = { id, scene, box: [x, y, w, h], clip, frame, onShape, onBackground, cursor };
  return scene.finish === "struck" ? <Struck {...props} /> : <Enamel {...props} />;
}

// The art in its box, where the layout puts it. Each layer's group has data-layer (the editor
// measures them).
function ArtBox({ scene, box: [x, y, w, h], frame, children }) {
  const [bx, by, bw, bh] = scene.art.view_box;
  return (
    <g transform={placeTransform(layoutOf(scene)[frame]?.art, x + w / 2, y + h / 2)} data-art="">
      <svg x={x} y={y} width={w} height={h} viewBox={`${bx} ${by} ${bw} ${bh}`} preserveAspectRatio="xMidYMid slice" overflow="visible">{children}</svg>
    </g>
  );
}

function Layer({ scene, layer, children }) {
  return <g transform={layerTransform(scene, layer)}><g data-layer={layer.id}>{children}</g></g>;
}

function Enamel({ id, scene, box, clip, frame, onShape, onBackground, cursor }) {
  const metal = `url(#${id}-metal)`;
  return (
    <g clipPath={clip ? `url(#${clip})` : undefined}>
      <defs><MetalGradient id={`${id}-metal`} color={metalOf(scene)} /></defs>
      <rect x={box[0] - 60} y={box[1] - 60} width={box[2] + 120} height={box[3] + 120} fill={scene.metal === "black_gold" ? BLACK : shade(metalOf(scene), -0.1)}
        style={onBackground ? { cursor } : undefined} onClick={onBackground} data-face="" />
      <ArtBox scene={scene} box={box} frame={frame}>
        {shown(scene).filter((l) => l.role !== "cutout").map((layer) => (
          <Layer key={layer.id} scene={scene} layer={layer}>
            {layer.shapes.map((sh) => {
              const enamel = layer.role === "enamel";
              const painted = enamel && scene.fills?.[sh.id]; // a group's bucket, even on an outline
              return (
                <path key={sh.id} d={sh.d} transform={sh.t} strokeLinecap="round" strokeLinejoin="round"
                  fill={sh.fill || painted ? (enamel ? paintOf(sh, scene) : metal) : "none"}
                  stroke={sh.stroke ? metal : "none"} strokeWidth={sh.sw}
                  // An unfilled outline is clickable inside, so the bucket can fill it
                  style={onShape ? { cursor, pointerEvents: !sh.fill && closed(sh) ? "visible" : undefined } : undefined} data-shape={sh.id}
                  onClick={onShape ? (e) => onShape(sh, layer, e) : undefined} />
              );
            })}
          </Layer>
        ))}
      </ArtBox>
    </g>
  );
}

function Struck({ id, scene, box, clip, frame, onShape, onBackground, cursor }) {
  const color = metalOf(scene);
  const blackGold = scene.metal === "black_gold";
  return (
    <g clipPath={clip ? `url(#${clip})` : undefined}>
      <defs><LiftFilter id={`${id}-struck`} metal color={color} height={5} sharpness={8} /></defs>
      <rect x={box[0] - 60} y={box[1] - 60} width={box[2] + 120} height={box[3] + 120} fill={blackGold ? BLACK : shade(color, -0.12)}
        style={onBackground ? { cursor } : undefined} onClick={onBackground} />
      <g filter={`url(#${id}-struck)`} pointerEvents="none">
        <rect x={box[0] - 60} y={box[1] - 60} width={box[2] + 120} height={box[3] + 120} fill="#000000" />
        <ArtBox scene={scene} box={box} frame={frame}>
          {shown(scene).filter((l) => l.role !== "cutout").map((layer) => {
            const g = Math.round(heightOf(layer, scene) * 255);
            const gray = `rgb(${g},${g},${g})`;
            return (
              <Layer key={layer.id} scene={scene} layer={layer}>
                {layer.shapes.map((sh) => (
                  <path key={sh.id} d={sh.d} transform={sh.t} fill={sh.fill ? gray : "none"} stroke={sh.stroke ? gray : "none"} strokeWidth={sh.sw}
                    strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </Layer>
            );
          })}
        </ArtBox>
      </g>
      {/* The filter can't be clicked through, so the editor gets the shapes again, unseen */}
      {onShape && (
        <g opacity="0">
          <ArtBox scene={scene} box={box} frame={frame}>
            {shown(scene).filter((l) => l.role !== "cutout").map((layer) => (
              <Layer key={layer.id} scene={scene} layer={layer}>
                {layer.shapes.map((sh) => (
                  <path key={sh.id} d={sh.d} transform={sh.t} fill={sh.fill ? "#000" : "none"} stroke={sh.stroke ? "#000" : "none"} strokeWidth={sh.sw}
                    style={{ cursor }} onClick={(e) => onShape(sh, layer, e)} />
                ))}
              </Layer>
            ))}
          </ArtBox>
        </g>
      )}
    </g>
  );
}

// The rim's edge: reeded (fine ridges), rope, or beads
export function Edge({ edge, color }) {
  if (!edge || edge === "plain") return null;
  const dark = shade(color, -0.45);
  if (edge === "rope") {
    return <circle cx="100" cy="100" r="93.5" fill="none" stroke={dark} strokeOpacity="0.75" strokeWidth="4.5" strokeDasharray="2.3 2.3" />;
  }
  if (edge === "reeded") {
    return (
      <g stroke={dark} strokeOpacity="0.6" strokeWidth="0.9">
        {Array.from({ length: 120 }, (_, i) => {
          const a = (i * Math.PI * 2) / 120;
          return <line key={i} x1={100 + Math.cos(a) * 91.5} y1={100 + Math.sin(a) * 91.5} x2={100 + Math.cos(a) * 96.5} y2={100 + Math.sin(a) * 96.5} />;
        })}
      </g>
    );
  }
  return (
    <g fill={shade(color, 0.35)} stroke={dark} strokeWidth="0.4">
      {Array.from({ length: 60 }, (_, i) => {
        const a = (i * Math.PI * 2) / 60;
        return <circle key={i} cx={100 + Math.cos(a) * 93.8} cy={100 + Math.sin(a) * 93.8} r="1.6" />;
      })}
    </g>
  );
}
