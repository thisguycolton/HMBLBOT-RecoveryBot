// The bucket's "just this area": the art is drawn to a canvas with every shape's fill and
// outline in a color of its own (and the bare face in another), with no smoothing, so the area
// the click is in is exactly what can be seen there. It's flood filled and its edge traced back
// into an outline, so any closed area can be painted even where no shape is (between a tree's
// branches, inside a ring).

const codeColor = (n) => `#${n.toString(16).padStart(6, "0")}`;

// The art in `node` (the editor's SceneArt, with the `defs` it refers to) drawn `width` pixels
// wide, each part in its own color: its RGBA pixels
export async function rasterize(node, defs, viewBox, width) {
  const [, , vw, vh] = viewBox;
  const height = Math.round((width * vh) / vw);
  const clone = node.cloneNode(true);
  clone.removeAttribute("opacity");
  clone.setAttribute("shape-rendering", "crispEdges");
  let n = 1;
  clone.querySelectorAll("[data-shape]").forEach((el) => {
    ["fill", "stroke"].forEach((attr) => {
      const v = el.getAttribute(attr);
      if (v && v !== "none") el.setAttribute(attr, codeColor(n += 7));
    });
  });
  clone.querySelectorAll("[data-face]").forEach((el) => el.setAttribute("fill", "#fffffe"));
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${viewBox.join(" ")}" width="${width}" height="${height}">${defs ? defs.outerHTML : ""}${clone.outerHTML}</svg>`;
  const img = new Image();
  img.decoding = "sync";
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error("Couldn't read the art to fill that area."));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, width, height);
  return { data: ctx.getImageData(0, 0, width, height).data, width, height };
}

// The pixels of about one color joined to (x, y): a mask, and how many there are
export function flood({ data, width, height }, x, y, tolerance = 0) {
  const mask = new Uint8Array(width * height);
  const start = (y * width + x) * 4;
  if (x < 0 || y < 0 || x >= width || y >= height || data[start + 3] < 128) return { mask, count: 0 };
  const [r, g, b] = [data[start], data[start + 1], data[start + 2]];
  const same = (i) => {
    const p = i * 4;
    return data[p + 3] >= 128 && Math.abs(data[p] - r) + Math.abs(data[p + 1] - g) + Math.abs(data[p + 2] - b) <= tolerance;
  };
  const stack = [y * width + x];
  mask[stack[0]] = 1;
  let count = 0;
  while (stack.length) {
    const i = stack.pop();
    count += 1;
    const px = i % width;
    const near = [px > 0 ? i - 1 : -1, px < width - 1 ? i + 1 : -1, i - width, i + width];
    near.forEach((j) => {
      if (j >= 0 && j < mask.length && !mask[j] && same(j)) { mask[j] = 1; stack.push(j); }
    });
  }
  return { mask, count };
}

// The edges of a mask as closed loops of pixel corners. Each edge keeps the area on the same
// side, so outer edges and holes run opposite ways and a plain fill leaves the holes open.
export function trace(mask, width, height) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;
  const edges = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!inside(x, y)) continue;
      if (!inside(x, y - 1)) edges.push([x + 1, y, x, y]);
      if (!inside(x - 1, y)) edges.push([x, y, x, y + 1]);
      if (!inside(x, y + 1)) edges.push([x, y + 1, x + 1, y + 1]);
      if (!inside(x + 1, y)) edges.push([x + 1, y + 1, x + 1, y]);
    }
  }
  const key = (x, y) => y * (width + 1) + x;
  const from = new Map();
  edges.forEach((e, i) => {
    const k = key(e[0], e[1]);
    if (!from.has(k)) from.set(k, []);
    from.get(k).push(i);
  });
  const used = new Uint8Array(edges.length);
  const loops = [];
  for (let i = 0; i < edges.length; i += 1) {
    if (used[i]) continue;
    const loop = [];
    let e = i;
    while (e !== undefined && !used[e]) {
      used[e] = 1;
      const [x0, y0, x1, y1] = edges[e];
      loop.push([x0, y0]);
      const next = (from.get(key(x1, y1)) || []).filter((j) => !used[j]);
      if (next.length > 1) {
        // Where two corners touch, turn the same way each time so each loop stays whole
        const [dx, dy] = [x1 - x0, y1 - y0];
        next.sort((a, b) => turn(dx, dy, edges[a]) - turn(dx, dy, edges[b]));
      }
      e = next[0];
    }
    if (loop.length > 3) loops.push(loop);
  }
  return loops;
}

const turn = (dx, dy, [x0, y0, x1, y1]) => {
  const cross = dx * (y1 - y0) - dy * (x1 - x0);
  return cross > 0 ? 0 : cross === 0 ? 1 : 2;
};

// Fewer points along the same outline (Douglas–Peucker), for a loop
export function simplify(loop, tolerance = 0.9) {
  if (loop.length < 4) return loop;
  let far = 0;
  let best = -1;
  loop.forEach(([x, y], i) => {
    const d = (x - loop[0][0]) ** 2 + (y - loop[0][1]) ** 2;
    if (d > best) { best = d; far = i; }
  });
  const a = line(loop.slice(0, far + 1), tolerance);
  const b = line([...loop.slice(far), loop[0]], tolerance);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

function line(points, tolerance) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const len = Math.hypot(bx - ax, by - ay) || 1;
  let worst = 0;
  let at = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [px, py] = points[i];
    const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
    if (d > worst) { worst = d; at = i; }
  }
  if (worst <= tolerance) return [points[0], points[points.length - 1]];
  return [...line(points.slice(0, at + 1), tolerance).slice(0, -1), ...line(points.slice(at), tolerance)];
}
