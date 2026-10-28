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
// `onShape(shape, layer, event)` makes shapes clickable (the editor's bucket and eyedropper).
export default function SceneArt({ id, scene, x = 10, y = 10, w = 180, h = 180, clip, onShape, cursor }) {
  if (!scene?.art) return null;
  return scene.finish === "struck"
    ? <Struck id={id} scene={scene} box={[x, y, w, h]} clip={clip} onShape={onShape} cursor={cursor} />
    : <Enamel id={id} scene={scene} box={[x, y, w, h]} clip={clip} onShape={onShape} cursor={cursor} />;
}

function ArtBox({ scene, box: [x, y, w, h], children }) {
  const [bx, by, bw, bh] = scene.art.view_box;
  return <svg x={x} y={y} width={w} height={h} viewBox={`${bx} ${by} ${bw} ${bh}`} preserveAspectRatio="xMidYMid slice">{children}</svg>;
}

function Enamel({ id, scene, box, clip, onShape, cursor }) {
  const metal = `url(#${id}-metal)`;
  return (
    <g clipPath={clip ? `url(#${clip})` : undefined}>
      <defs><MetalGradient id={`${id}-metal`} color={metalOf(scene)} /></defs>
      <rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} fill={scene.metal === "black_gold" ? BLACK : shade(metalOf(scene), -0.1)} />
      <ArtBox scene={scene} box={box}>
        {shown(scene).filter((l) => l.role !== "cutout").map((layer) => (
          <g key={layer.id}>
            {layer.shapes.map((sh) => {
              const enamel = layer.role === "enamel";
              return (
                <path key={sh.id} d={sh.d} transform={sh.t} strokeLinecap="round" strokeLinejoin="round"
                  fill={sh.fill ? (enamel ? paintOf(sh, scene) : metal) : "none"}
                  stroke={sh.stroke ? metal : "none"} strokeWidth={sh.sw}
                  style={onShape ? { cursor } : undefined}
                  onClick={onShape ? (e) => onShape(sh, layer, e) : undefined} />
              );
            })}
          </g>
        ))}
      </ArtBox>
    </g>
  );
}

function Struck({ id, scene, box, clip, onShape, cursor }) {
  const color = metalOf(scene);
  const blackGold = scene.metal === "black_gold";
  return (
    <g clipPath={clip ? `url(#${clip})` : undefined}>
      <defs><LiftFilter id={`${id}-struck`} metal color={color} height={5} sharpness={8} /></defs>
      <rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} fill={blackGold ? BLACK : shade(color, -0.12)} />
      <g filter={`url(#${id}-struck)`}>
        <rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} fill="#000000" />
        <ArtBox scene={scene} box={box}>
          {shown(scene).filter((l) => l.role !== "cutout").map((layer) => {
            const g = Math.round(heightOf(layer, scene) * 255);
            const gray = `rgb(${g},${g},${g})`;
            return (
              <g key={layer.id}>
                {layer.shapes.map((sh) => (
                  <path key={sh.id} d={sh.d} transform={sh.t} fill={sh.fill ? gray : "none"} stroke={sh.stroke ? gray : "none"} strokeWidth={sh.sw}
                    strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </g>
            );
          })}
        </ArtBox>
      </g>
      {/* The filter can't be clicked through, so the editor gets the shapes again, unseen */}
      {onShape && (
        <ArtBox scene={scene} box={box}>
          {shown(scene).filter((l) => l.role !== "cutout").map((layer) => layer.shapes.map((sh) => (
            <path key={sh.id} d={sh.d} transform={sh.t} fill={sh.fill ? "#000" : "none"} stroke={sh.stroke ? "#000" : "none"} strokeWidth={sh.sw}
              opacity="0" style={{ cursor }} onClick={(e) => onShape(sh, layer, e)} />
          )))}
        </ArtBox>
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
