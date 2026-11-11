import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { roundedTriangle, shade } from "./Chip";
import font600 from "../../../../lib/share_cards/PublicSans_600SemiBold.ttf?url";
import font800 from "../../../../lib/share_cards/PublicSans_800ExtraBold.ttf?url";
import markDark from "../../../../lib/share_cards/recoverybot-mark-dark.png";
import markLight from "../../../../lib/share_cards/recoverybot-mark-light.png";

// Pictures, GIFs and videos of a chip (ChipPictureShare.jsx), drawn and encoded right here in
// the browser, so nothing about the chip goes to our server or anyone else's. The chip is the
// same one Chip3D spins: its two SVG sides (chipFaces) drawn flat, with a thick edge made of
// layers between them, turned about its middle.
//
// The moving one loops: it spins in fast and slows to its front, sways a little, turns over to
// its back, sways, then speeds up and spins out at the same speed it came in, so the end runs
// straight into the start.

export const BACKGROUNDS = [
  { value: "night", label: "Night", from: "#1e293b", to: "#020617" },
  { value: "sunrise", label: "Sunrise", from: "#fb923c", to: "#db2777" },
  { value: "ocean", label: "Ocean", from: "#22d3ee", to: "#1e3a8a" },
  { value: "forest", label: "Forest", from: "#4ade80", to: "#064e3b" },
  { value: "lavender", label: "Lavender", from: "#e9d5ff", to: "#7c3aed" },
  { value: "gold", label: "Gold", from: "#fde68a", to: "#b45309" },
  { value: "paper", label: "Paper", from: "#fdfaf3", to: "#e7dcc4" },
];
export const SIZES = {
  square: { label: "Square", hint: "For a post or a feed", picture: [1080, 1080], gif: [480, 480], video: [1080, 1080] },
  story: { label: "Story", hint: "Tall, for stories", picture: [1080, 1920], gif: [360, 640], video: [1080, 1920] },
  wide: { label: "Wide", hint: "For a computer screen", picture: [1200, 630], gif: [600, 316], video: [1280, 720] },
};
export const SPEEDS = [
  { value: 0.7, label: "Slow" },
  { value: 1, label: "Normal" },
  { value: 1.4, label: "Fast" },
];
const GIF_FPS = 15;
const VIDEO_FPS = 30;
const RASTER = 800; // the sides are drawn this wide once, then scaled

// ---- The timeline (seconds at Normal speed) --------------------------------------------------

// Spinning out ends at the speed spinning in starts (2160°/IN = 1620°/OUT) so the loop has no seam
const IN = 1.6;
const PARTS = [["in", IN], ["front", 2.2], ["flip", 1.1], ["back", 2.2], ["out", IN * 0.75]];
export function loopLength(speed = 1) {
  return PARTS.reduce((sum, [, d]) => sum + d, 0) / speed;
}
const sway = (u) => 7 * Math.sin(2 * Math.PI * u) * Math.sin(Math.PI * u); // starts and ends still
// `still`: no sway while it holds a side (GIFs, which then only store the frames that move)
export function angleAt(t, speed = 1, still = false) {
  const total = loopLength(speed);
  let at = (((t % total) + total) % total) * speed;
  for (const [part, d] of PARTS) {
    if (at <= d) {
      const u = at / d;
      if (part === "in") return -720 * (1 - u) ** 3;
      if (part === "front") return still ? 0 : sway(u);
      if (part === "flip") return 180 * (3 * u * u - 2 * u * u * u);
      if (part === "back") return still ? 180 : 180 - sway(u);
      return 180 + 540 * u ** 3;
    }
    at -= d;
  }
  return 0;
}

// ---- The chip's sides, as pictures -----------------------------------------------------------

let fontCss;
const dataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(blob);
});
// An SVG drawn as a picture can't use the page's fonts, so it carries its own
function fonts() {
  fontCss ||= Promise.all([font600, font800].map((u) => fetch(u).then((r) => r.blob()).then(dataUrl)))
    .then(([semi, bold]) => `@font-face{font-family:'Public Sans';font-weight:400 650;src:url(${semi})}@font-face{font-family:'Public Sans';font-weight:651 900;src:url(${bold})}`)
    .catch(() => "");
  return fontCss;
}
let pageFont;
// The words under the chip use the same font, on the canvas
function canvasFont() {
  pageFont ||= (async () => {
    try {
      const faces = [new FontFace("ChipShareSans", `url(${font600})`, { weight: "600" }), new FontFace("ChipShareSans", `url(${font800})`, { weight: "800" })];
      await Promise.all(faces.map((f) => f.load()));
      faces.forEach((f) => document.fonts.add(f));
    } catch { /* falls back to the system's */ }
  })();
  return pageFont;
}

async function sidePicture(element, width) {
  let svg = renderToStaticMarkup(React.cloneElement(element, { size: width }));
  if (!/^<svg[^>]*xmlns=/.test(svg)) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"');
  // A group's logo comes from our own server: carry it inside, or leave it off
  const hrefs = [...new Set([...svg.matchAll(/<image[^>]*?\shref="([^"]+)"/g)].map((m) => m[1]))];
  for (const href of hrefs) {
    if (href.startsWith("data:")) continue;
    const url = href.replace(/&amp;/g, "&");
    let inline = "";
    try { inline = await fetch(url, { credentials: "same-origin" }).then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? dataUrl(b) : "")); } catch { /* left off */ }
    svg = svg.split(`href="${href}"`).join(`href="${inline}"`);
  }
  svg = svg.replace(/(<svg[^>]*>)/, `$1<style>${await fonts()}</style>`);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round((width * img.naturalHeight) / img.naturalWidth) || width;
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Everything the drawing needs about one chip: { shape, color, metal, front, back } (canvases)
export async function prepareChip(faces) {
  await canvasFont();
  const [front, back, dark, light] = await Promise.all([sidePicture(faces.front, RASTER), sidePicture(faces.back, RASTER), picture(markDark), picture(markLight)]);
  return { shape: faces.shape, color: faces.color, metal: faces.metal, front, back, marks: { dark, light } };
}

async function picture(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

// RecoveryBot at the bottom, the same pill as the highlight pictures' (QuoteCard#badge): the
// mark and the name, white on dark backgrounds and dark on light ones, in the middle, or at
// the right on wide pictures. Sized as QuoteCard draws it on a 1080 (1200 wide) picture.
function badge(ctx, W, H, marks, onLight) {
  const wide = W > H * 1.3;
  const u = W / (wide ? 1200 : 1080);
  const w = 300 * u;
  const h = 64 * u;
  const x = wide ? W - w - 36 * u : (W - w) / 2;
  const y = H - h - (wide ? 32 : 64) * u - (H > W * 1.3 ? 160 * u : 0);
  ctx.fillStyle = onLight ? "#17191c" : "#ffffff";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2); else ctx.rect(x, y, w, h);
  ctx.fill();
  const mark = onLight ? marks.light : marks.dark;
  const mh = 34 * u;
  const mw = (mh * mark.naturalWidth) / mark.naturalHeight;
  ctx.drawImage(mark, x + 24 * u, y + (h - mh) / 2, mw, mh);
  ctx.fillStyle = onLight ? "#ffffff" : "#17191c";
  ctx.font = `800 ${30 * u}px ChipShareSans, "Public Sans", system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("RecoveryBot", x + 84 * u, y + h / 2 + u);
  return y;
}

// ---- Drawing ---------------------------------------------------------------------------------

function fillShape(ctx, shape, w, h, style) {
  ctx.fillStyle = style;
  if (shape === "round") {
    ctx.beginPath();
    ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.translate(-w / 2, -h / 2);
    ctx.fill(new Path2D(roundedTriangle(-5, undefined, w / 200)));
    ctx.translate(w / 2, h / 2);
  }
}
function clipShape(ctx, shape, w, h) {
  if (shape === "round") {
    ctx.beginPath();
    ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
    ctx.clip();
  } else {
    ctx.translate(-w / 2, -h / 2);
    ctx.clip(new Path2D(roundedTriangle(-5, undefined, w / 200)));
    ctx.translate(w / 2, h / 2);
  }
}

// Poker-chip stripes round a plastic chip's edge, like Chip3D's
function edgeStyle(ctx, chip, z, thick, w) {
  const depth = Math.abs(z / (thick / 2));
  const tone = shade(chip.color, chip.metal ? 0.25 - depth * 0.45 : -0.1 - depth * 0.2);
  if (chip.metal || chip.shape === "triangle" || typeof ctx.createConicGradient !== "function") return tone;
  const white = shade("#ffffff", -0.08 - (depth / 2) * 0.2);
  const g = ctx.createConicGradient(0, 0, 0);
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = i / n;
    const b = (i + 14 / 22) / n;
    g.addColorStop(a, tone); g.addColorStop(b, tone);
    g.addColorStop(b, white); g.addColorStop((i + 1) / n - 1e-6, white);
  }
  return g;
}

// The chip turned `angle` degrees about its upright middle, centered at (cx, cy), `w` wide
export function drawChip(ctx, chip, { cx, cy, w, angle, shadow = true }) {
  const h = (w * chip.front.height) / chip.front.width;
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const sx = Math.max(Math.abs(cos), 0.001);
  const thick = w * 0.075;

  if (shadow) {
    const sw = w * 0.7 * (0.35 + 0.65 * Math.abs(cos));
    const sh = w * 0.06;
    const y = cy + h / 2 + w * 0.09;
    ctx.save();
    ctx.translate(cx, y);
    ctx.scale(sw / 2, sh / 2);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, "rgba(0,0,0,0.35)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // The edge: slices through the chip's thickness, each slid sideways as it turns, at most a
  // pixel apart so they make one solid band, drawn far to near
  const spread = thick * Math.abs(sin);
  const n = Math.max(6, Math.ceil(spread / 0.8));
  const slices = Array.from({ length: n }, (_, i) => -thick / 2 + (thick * (i + 0.5)) / n)
    .sort((a, b) => a * cos - b * cos);
  for (const z of slices) {
    ctx.save();
    ctx.translate(cx + z * sin, cy);
    ctx.scale(sx * 0.985, 0.985);
    fillShape(ctx, chip.shape, w, h, edgeStyle(ctx, chip, z, thick, w));
    ctx.restore();
  }

  // The side facing us, with a sheen that slides across as it turns
  const showingFront = cos >= 0;
  const side = showingFront ? chip.front : chip.back;
  ctx.save();
  ctx.translate(cx + (showingFront ? thick / 2 : -thick / 2) * sin, cy);
  ctx.scale(sx, 1);
  ctx.save();
  clipShape(ctx, chip.shape, w, h);
  ctx.drawImage(side, -w / 2, -h / 2, w, h);
  const turn = (((angle % 360) + 360) % 360) / 360;
  const p = (turn * 2) % 1;
  const span = w * 2.5;
  const x0 = -w / 2 - (span - w) * p;
  const dx = Math.cos((20 * Math.PI) / 180);
  const dy = Math.sin((20 * Math.PI) / 180);
  const g = ctx.createLinearGradient(x0, -h / 2 - span * dy * 0.2, x0 + span * dx, -h / 2 + span * dy * 0.8);
  g.addColorStop(0.3, "rgba(255,255,255,0)");
  g.addColorStop(0.45, "rgba(255,255,255,0.5)");
  g.addColorStop(0.55, "rgba(255,255,255,0.08)");
  g.addColorStop(0.7, "rgba(255,255,255,0)");
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = g;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
  ctx.restore();
}

const hexRgb = (hex) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
};
const luminance = (hex) => {
  const [r, g, b] = hexRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};
export const isLight = ({ from, to }) => (luminance(from) + luminance(to)) / 2 > 0.62;

// Where the chip (or the two of them) and the words go on a W × H picture
function layout(W, H, { pair, lines }) {
  const words = lines.length;
  if (pair) {
    if (H > W * 1.3) { // story: one above the other
      const w = Math.min(W * 0.56, H * 0.3);
      return { chips: [{ cx: W / 2, cy: H * (words ? 0.27 : 0.3), w }, { cx: W / 2, cy: H * (words ? 0.63 : 0.68), w }], textY: H * 0.8 };
    }
    const w = Math.min(W * 0.36, H * (words ? 0.52 : 0.62));
    return { chips: [{ cx: W * 0.29, cy: H * (words ? 0.42 : 0.47), w }, { cx: W * 0.71, cy: H * (words ? 0.42 : 0.47), w }], textY: H * (W > H * 1.3 ? 0.8 : 0.77) };
  }
  if (H > W * 1.3) {
    const w = W * 0.7;
    return { chips: [{ cx: W / 2, cy: H * (words ? 0.42 : 0.46), w }], textY: H * 0.7 };
  }
  if (W > H * 1.3) {
    const w = H * (words ? 0.56 : 0.64);
    return { chips: [{ cx: W / 2, cy: H * (words ? 0.42 : 0.46), w }], textY: H * 0.83 };
  }
  const w = W * (words ? 0.52 : 0.58);
  return { chips: [{ cx: W / 2, cy: H * (words ? 0.42 : 0.46), w }], textY: H * 0.77 };
}

// One whole frame: the background, the chip at `angle` (or both sides, `pair`), and the words
export function drawScene(ctx, W, H, chip, { background, angle = 0, pair = false, lines = [] }) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, background.from);
  g.addColorStop(1, background.to);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const spot = layout(W, H, { pair, lines });
  // a soft light behind the chip
  const c = spot.chips.length > 1 && H <= W * 1.3 ? { cx: W / 2, cy: spot.chips[0].cy } : spot.chips[0];
  const glow = ctx.createRadialGradient(c.cx, c.cy, 0, c.cx, c.cy, Math.max(W, H) * 0.55);
  glow.addColorStop(0, "rgba(255,255,255,0.22)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  spot.chips.forEach((s, i) => drawChip(ctx, chip, { ...s, angle: pair ? i * 180 : angle }));

  const light = isLight(background);
  const ink = light ? "rgba(15,23,42,0.9)" : "rgba(255,255,255,0.95)";
  const unit = Math.min(W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  lines.forEach((line, i) => {
    const size = unit * (i === 0 ? 0.06 : 0.04);
    ctx.font = `${i === 0 ? 800 : 600} ${size}px ChipShareSans, "Public Sans", system-ui, sans-serif`;
    ctx.fillStyle = i === 0 ? ink : light ? "rgba(15,23,42,0.7)" : "rgba(255,255,255,0.78)";
    ctx.fillText(line, W / 2, spot.textY + i * unit * 0.065, W > H * 1.3 ? W * 0.5 : W * 0.9);
  });
  if (chip.marks) badge(ctx, W, H, chip.marks, light);
}

// A frame at time `t` of the loop, blurred while it spins fast (several moments laid together),
// so a quick turn reads as a spin and not a flicker
function drawFrame(ctx, W, H, chip, opts, t, frameTime, scratch) {
  const still = opts.format === "gif";
  const angle = (at) => angleAt(at, opts.speed, still);
  const a0 = angle(t - frameTime / 2);
  const a1 = angle(t + frameTime / 2);
  const samples = Math.min(8, Math.max(1, Math.ceil(Math.abs(a1 - a0) / 9)));
  if (samples === 1) {
    drawScene(ctx, W, H, chip, { ...opts, angle: angle(t) });
    return;
  }
  const s = scratch.getContext("2d");
  for (let k = 0; k < samples; k++) {
    const at = t - frameTime / 2 + (frameTime * (k + 0.5)) / samples;
    drawScene(s, W, H, chip, { ...opts, angle: angle(at) });
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1 / (k + 1);
    ctx.drawImage(scratch, 0, 0);
  }
  ctx.globalAlpha = 1;
}

export function canvasOf(W, H) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  return c;
}

// The live preview: draws the loop into `canvas` until stop() is called
export function preview(canvas, chip, opts) {
  const ctx = canvas.getContext("2d");
  const scratch = canvasOf(canvas.width, canvas.height);
  let frame;
  const start = performance.now();
  const still = opts.format === "picture" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const tick = (now) => {
    if (still) {
      drawScene(ctx, canvas.width, canvas.height, chip, { ...opts, angle: 0 });
      return;
    }
    drawFrame(ctx, canvas.width, canvas.height, chip, opts, (now - start) / 1000, 1 / 30, scratch);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

const pause = () => new Promise((r) => setTimeout(r, 0));
const toBlob = (canvas, type) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make that picture."))), type));

// ---- Picture ---------------------------------------------------------------------------------

export async function makePicture(chip, opts) {
  const [W, H] = SIZES[opts.size].picture;
  const canvas = canvasOf(W, H);
  drawScene(canvas.getContext("2d"), W, H, chip, { ...opts, angle: 0 });
  return toBlob(canvas, "image/png");
}

// ---- GIF -------------------------------------------------------------------------------------

// One 256-color palette for the whole loop (so the background doesn't shimmer), a fixed dither
// to hide the gradient's bands, and only the pixels that changed written for each frame
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v / 16 - 0.47) * 14);
function dither(data, W) {
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const x = p % W;
    const y = (p / W) | 0;
    const d = BAYER[(y & 3) * 4 + (x & 3)];
    data[i] = Math.max(0, Math.min(255, data[i] + d));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + d));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + d));
  }
  return data;
}

export async function makeGif(chip, opts, onProgress = () => {}) {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const [W, H] = SIZES[opts.size].gif;
  const canvas = canvasOf(W, H);
  const scratch = canvasOf(W, H);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const total = loopLength(opts.speed);
  const count = Math.round(total * GIF_FPS);
  const dt = total / count;

  // the palette, from a few moments: spinning in, the front, turning, the back
  const samples = [0.06, 0.3, 0.55, 0.7, 0.92].map((f) => {
    drawFrame(ctx, W, H, chip, opts, f * total, dt, scratch);
    return ctx.getImageData(0, 0, W, H).data;
  });
  const all = new Uint8ClampedArray(samples.reduce((n, s) => n + s.length, 0));
  samples.reduce((at, s) => { all.set(s, at); return at + s.length; }, 0);
  const palette = quantize(all, 255);
  const clear = palette.length; // one more color: "same as before"
  palette.push([0, 0, 0]);

  const gif = GIFEncoder();
  let prev = null;
  for (let i = 0; i < count; i++) {
    drawFrame(ctx, W, H, chip, opts, i * dt, dt, scratch);
    const index = applyPalette(dither(ctx.getImageData(0, 0, W, H).data, W), palette);
    const out = index;
    if (prev) {
      const same = index.slice();
      for (let p = 0; p < index.length; p++) if (index[p] === prev[p]) same[p] = clear;
      gif.writeFrame(same, W, H, { delay: dt * 1000, transparent: true, transparentIndex: clear, dispose: 1 });
    } else {
      gif.writeFrame(out, W, H, { palette, delay: dt * 1000, repeat: 0, dispose: 1 });
    }
    prev = index;
    onProgress((i + 1) / count);
    if (i % 2 === 0) await pause();
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}

// ---- Video -----------------------------------------------------------------------------------

// An MP4, encoded frame by frame (WebCodecs) as fast as the device can; H.264 so phones play
// it, or VP9 where H.264 isn't on offer. Browsers without WebCodecs record the canvas as it
// plays instead (one loop, in real time).
const CODECS = [
  { codec: "avc1.640028", muxer: "avc" },
  { codec: "avc1.4d0028", muxer: "avc" },
  { codec: "avc1.42e028", muxer: "avc" },
  { codec: "vp09.00.40.08", muxer: "vp9" },
];

async function pickCodec(W, H) {
  if (typeof window.VideoEncoder !== "function") return null;
  for (const c of CODECS) {
    const config = { codec: c.codec, width: W, height: H, bitrate: Math.round(W * H * 4), framerate: VIDEO_FPS };
    try {
      const { supported } = await window.VideoEncoder.isConfigSupported(config);
      if (supported) return { ...c, config };
    } catch { /* next */ }
  }
  return null;
}

export async function makeVideo(chip, opts, onProgress = () => {}) {
  const [W, H] = SIZES[opts.size].video;
  const picked = await pickCodec(W, H);
  if (!picked) return recordVideo(chip, opts, W, H, onProgress);
  // Mediabunny writes the MP4 around the encoder's packets (it took over from mp4-muxer)
  const { Output, Mp4OutputFormat, BufferTarget, EncodedVideoPacketSource, EncodedPacket } = await import("mediabunny");
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const source = new EncodedVideoPacketSource(picked.muxer);
  output.addVideoTrack(source, { frameRate: VIDEO_FPS });
  await output.start();
  let failure = null;
  let writing = Promise.resolve();
  const encoder = new window.VideoEncoder({
    // packets go in one after another, in the order the encoder hands them over
    output: (chunk, meta) => {
      const packet = EncodedPacket.fromEncodedChunk(chunk);
      writing = writing.then(() => source.add(packet, meta)).catch((e) => { failure ||= e; });
    },
    error: (e) => { failure = e; },
  });
  encoder.configure(picked.config);

  const canvas = canvasOf(W, H);
  const scratch = canvasOf(W, H);
  const ctx = canvas.getContext("2d");
  const total = loopLength(opts.speed);
  const count = Math.round(total * VIDEO_FPS);
  const dt = total / count;
  for (let i = 0; i < count; i++) {
    if (failure) throw failure;
    drawFrame(ctx, W, H, chip, opts, i * dt, dt, scratch);
    const frame = new window.VideoFrame(canvas, { timestamp: Math.round(i * dt * 1e6), duration: Math.round(dt * 1e6) });
    encoder.encode(frame, { keyFrame: i % (VIDEO_FPS * 2) === 0 });
    frame.close();
    while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 5));
    onProgress((i + 1) / count);
    if (i % 3 === 0) await pause();
  }
  await encoder.flush();
  encoder.close();
  await writing;
  if (failure) throw failure;
  source.close();
  await output.finalize();
  return new Blob([output.target.buffer], { type: "video/mp4" });
}

async function recordVideo(chip, opts, W, H, onProgress) {
  if (typeof window.MediaRecorder !== "function") throw new Error("This browser can't make videos. Try a GIF.");
  const type = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((t) => window.MediaRecorder.isTypeSupported?.(t));
  const canvas = canvasOf(W, H);
  const scratch = canvasOf(W, H);
  const ctx = canvas.getContext("2d");
  drawScene(ctx, W, H, chip, { ...opts, angle: angleAt(0, opts.speed) });
  const stream = canvas.captureStream(VIDEO_FPS);
  const recorder = new window.MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: W * H * 4 } : undefined);
  const parts = [];
  recorder.ondataavailable = (e) => e.data.size && parts.push(e.data);
  const done = new Promise((resolve) => { recorder.onstop = resolve; });
  const total = loopLength(opts.speed) * 1000;
  recorder.start();
  const start = performance.now();
  await new Promise((resolve) => {
    const tick = (now) => {
      const t = now - start;
      drawFrame(ctx, W, H, chip, opts, Math.min(t, total) / 1000, 1 / VIDEO_FPS, scratch);
      onProgress(Math.min(1, t / total));
      if (t < total) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
  recorder.stop();
  await done;
  return new Blob(parts, { type: (type || "video/webm").split(";")[0] });
}
