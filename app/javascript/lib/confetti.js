// Confetti for milestones, drawn on a canvas over the page that takes itself away when the
// last piece has fallen. Our own few lines, so nothing is loaded from anywhere else. Skipped
// for people who ask their system for less motion.
const COLORS = ["#0b6ede", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#facc15"];

export function confetti({ pieces = 180, duration = 4200 } = {}) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "2400" });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const size = () => {
    canvas.width = window.innerWidth * ratio;
    canvas.height = window.innerHeight * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  size();
  window.addEventListener("resize", size);

  // Two bursts from the bottom corners, up and in toward the middle
  const w = window.innerWidth;
  const h = window.innerHeight;
  const bits = Array.from({ length: pieces }, (_, i) => {
    const left = i % 2 === 0;
    const angle = (left ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.9;
    const speed = (0.9 + Math.random() * 0.8) * Math.min(h, 900) * 0.022;
    return {
      x: left ? -10 : w + 10,
      y: h * (0.75 + Math.random() * 0.2),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      spin: Math.random() * Math.PI,
      spinSpeed: (Math.random() - 0.5) * 0.3,
      tilt: Math.random() * Math.PI,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 250,
    };
  });

  const began = performance.now();
  let last = began;
  const frame = (now) => {
    const step = Math.min((now - last) / 16.7, 3);
    last = now;
    const age = now - began;
    ctx.clearRect(0, 0, w * 2, h * 2);
    ctx.globalAlpha = age > duration - 800 ? Math.max(0, (duration - age) / 800) : 1;
    for (const b of bits) {
      if (age < b.delay) continue;
      b.vy += 0.32 * step; // gravity
      b.vx *= 0.99 ** step; // air
      b.vy = Math.min(b.vy, 5.5);
      b.x += b.vx * step + Math.sin(b.tilt) * 0.6;
      b.y += b.vy * step;
      b.tilt += 0.05 * step;
      b.spin += b.spinSpeed * step;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.spin);
      ctx.scale(1, Math.cos(b.tilt * 2)); // the flutter: a piece turning over
      ctx.fillStyle = b.color;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
    if (age < duration) requestAnimationFrame(frame);
    else {
      window.removeEventListener("resize", size);
      canvas.remove();
    }
  };
  requestAnimationFrame(frame);
}
