import World, { SAFE_RADIUS } from "./world";

// /game/world?seed=N: a zoomed-out map of the generated world, for tuning generation.
// One pixel per tile, scaled up; spawn is the red dot in the middle.
const COLORS = {
  house: "#3c5ac8", well: "#ffffff", path: "#d69a4e", gate: "#d69a4e", fence: "#f3d040",
  soil: "#945848", barrel: "#945848", castle: "#b9b5c3",
};
const LEVELS = ["#82aa28", "#aac846", "#d7e178"];

export function renderWorldDebug(root, seed = Math.floor(Math.random() * 2 ** 31), size = 240) {
  const world = new World(seed);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  Object.assign(canvas.style, { width: "min(96vw, 96vh)", imageRendering: "pixelated", display: "block", margin: "2vh auto" });
  const ctx = canvas.getContext("2d");

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = px - size / 2, y = py - size / 2;
      const c = world.cell(x, y);
      ctx.fillStyle =
        x === 0 && y === 0 ? "#ff0000" :
        c.part ? COLORS[c.part.part] :
        c.water ? "#22636b" :
        c.face ? "#5c3841" :
        Math.hypot(x, y) <= SAFE_RADIUS && (x + y) % 2 ? "#9cc040" :
        LEVELS[c.level];
      ctx.fillRect(px, py, 1, 1);
    }
  }

  const label = document.createElement("p");
  label.textContent = `seed ${seed} · add ?seed=${seed} to the URL to keep it`;
  Object.assign(label.style, { color: "#fff", textAlign: "center", font: "14px monospace" });
  root.replaceChildren(canvas, label);
  root.style.overflow = "auto";
}
