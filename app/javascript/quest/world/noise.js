// Seeded, deterministic noise. Everything in the world is a pure function of (seed, x, y),
// so the map never needs saving and looks the same on every device.

// Integer hash -> [0, 1)
export function hash(seed, x, y, salt = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((seed + salt * 7919) | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// Smooth value noise in [0, 1)
export function value(seed, x, y, salt = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const tx = smooth(x - xi), ty = smooth(y - yi);
  const a = hash(seed, xi, yi, salt), b = hash(seed, xi + 1, yi, salt);
  const c = hash(seed, xi, yi + 1, salt), d = hash(seed, xi + 1, yi + 1, salt);
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}

// Fractal value noise in [0, 1)
export function fbm(seed, x, y, salt = 0, octaves = 4) {
  let sum = 0, amp = 0.5, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += value(seed, x * f, y * f, salt + o * 31) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

// Ridged noise: peaks along thin winding lines, which is what gives cliffs and rivers their strands
export function ridged(seed, x, y, salt = 0, octaves = 3) {
  return 1 - Math.abs(fbm(seed, x, y, salt, octaves) * 2 - 1);
}

// Offset (x, y) by low-frequency noise so straight-ish features bend
export function warp(seed, x, y, salt, scale, strength) {
  return [
    x + (fbm(seed, x * scale, y * scale, salt, 3) - 0.5) * strength,
    y + (fbm(seed, x * scale, y * scale, salt + 97, 3) - 0.5) * strength,
  ];
}

export function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
