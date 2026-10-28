import React, { useEffect, useRef } from "react";
import { shade } from "./Chip";
import "../../styles/chip3d.css";

// A chip you can pick up: the front and back faces (SVG, from Chip.jsx) with a thick edge
// between them, in CSS 3D. Drag or swipe to spin it, or use the arrow keys; it keeps spinning
// with the flick and settles face on, front or back. It spins in when it first shows (not for
// people who ask their system for less motion), and a sheen slides across as it turns.
// Plain CSS (styles/chip3d.css), since the day count modal shows it on Bootstrap pages too.

// The outline as a CSS clip-path, matching the SVGs' shapes (Chip.jsx: TRIANGLE_CORNERS on a
// 200 x 176 box, with the rounded edge a little outside them)
const TRIANGLE_CLIP = "polygon(50% 0.5%, 98.5% 97%, 1.5% 97%)";

const SPIN_IN = 1700; // ms
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function Chip3D({ front, back, shape = "round", color, metal, size = 220, spinIn = true, label = "Chip" }) {
  const height = shape === "triangle" ? (size * 176) / 200 : size;
  const thick = Math.round(size * 0.075);
  const layers = Math.max(8, thick);
  const coinRef = useRef(null);
  const sheenRefs = useRef([]);
  const shadowRef = useRef(null);
  const s = useRef({ angle: 0, vel: 0, tilt: 0, tiltVel: 0, dragging: false, lastX: 0, lastY: 0, lastT: 0, startY: 0, spinFrom: null, frame: null, prev: 0 });

  useEffect(() => {
    const st = s.current;
    const draw = () => {
      const a = st.angle;
      if (coinRef.current) coinRef.current.style.transform = `rotateX(${st.tilt}deg) rotateY(${a}deg)`;
      const turn = (((a % 360) + 360) % 360) / 360; // 0..1
      sheenRefs.current.forEach((el) => { if (el) el.style.backgroundPosition = `${(turn * 2 % 1) * 100}% 0`; });
      if (shadowRef.current) shadowRef.current.style.transform = `scaleX(${0.35 + 0.65 * Math.abs(Math.cos((a * Math.PI) / 180))})`;
    };
    const tick = (now) => {
      const dt = Math.min(0.05, (now - (st.prev || now)) / 1000);
      st.prev = now;
      let moving = true;
      if (st.spinFrom != null) {
        const x = Math.min(1, (now - st.spinFrom) / SPIN_IN);
        st.angle = -720 * (1 - x) ** 3;
        if (x >= 1) { st.spinFrom = null; st.angle = 0; }
      } else if (!st.dragging) {
        if (Math.abs(st.vel) > 140) {
          st.angle += st.vel * dt;
          st.vel *= Math.exp(-1.6 * dt);
        } else {
          const target = Math.round(st.angle / 180) * 180;
          st.vel += (55 * (target - st.angle) - 9 * st.vel) * dt;
          st.angle += st.vel * dt;
          if (Math.abs(target - st.angle) < 0.05 && Math.abs(st.vel) < 0.5) { st.angle = target % 360; st.vel = 0; }
        }
        st.tiltVel += (-80 * st.tilt - 12 * st.tiltVel) * dt;
        st.tilt += st.tiltVel * dt;
        moving = st.vel !== 0 || Math.abs(st.tilt) > 0.05 || Math.abs(st.tiltVel) > 0.05;
      }
      draw();
      st.frame = moving || st.dragging ? requestAnimationFrame(tick) : null;
    };
    st.wake = () => { if (!st.frame) { st.prev = 0; st.frame = requestAnimationFrame(tick); } };
    if (spinIn && !reducedMotion()) { st.spinFrom = performance.now(); st.wake(); } else draw();
    return () => cancelAnimationFrame(st.frame);
  }, [spinIn]);

  const down = (e) => {
    const st = s.current;
    st.spinFrom = null;
    st.dragging = true;
    st.vel = 0;
    st.lastX = e.clientX;
    st.lastY = e.clientY;
    st.startY = e.clientY;
    st.lastT = performance.now();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    st.wake();
  };
  const move = (e) => {
    const st = s.current;
    if (!st.dragging) return;
    const now = performance.now();
    const dx = e.clientX - st.lastX;
    const dt = Math.max(0.008, (now - st.lastT) / 1000);
    st.angle += dx * 0.7;
    st.vel = 0.6 * st.vel + 0.4 * ((dx * 0.7) / dt);
    st.tilt = Math.max(-25, Math.min(25, -(e.clientY - st.startY) * 0.25));
    st.lastX = e.clientX;
    st.lastT = now;
  };
  const up = () => {
    const st = s.current;
    if (!st.dragging) return;
    st.dragging = false;
    if (performance.now() - st.lastT > 80) st.vel = 0; // held still before letting go
    st.wake();
  };
  const key = (e) => {
    const st = s.current;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    st.spinFrom = null;
    st.vel += e.key === "ArrowRight" ? 500 : -500;
    st.wake();
  };

  const clip = shape === "triangle" ? { clipPath: TRIANGLE_CLIP } : { borderRadius: "50%" };
  const edge = (i) => {
    // the middle of the edge catches the light, like a rounded rim
    const z = -thick / 2 + (thick * (i + 0.5)) / layers;
    const lightness = metal ? 0.25 - Math.abs(z / (thick / 2)) * 0.45 : -0.1 - Math.abs(z / (thick / 2)) * 0.2;
    const tone = shade(color, lightness);
    const background = metal || shape === "triangle"
      ? tone
      : `repeating-conic-gradient(${tone} 0deg 14deg, ${shade("#ffffff", -0.08 - Math.abs(z / thick) * 0.2)} 14deg 22deg)`;
    return <div key={i} className="hb-chip3d__layer" style={{ ...clip, background, transform: `translateZ(${z}px) scale(0.985)` }} />;
  };

  return (
    <div className="hb-chip3d" style={{ width: size, height: height + size * 0.12 }}
      role="img" aria-label={`${label}. Drag to spin it, or use the arrow keys.`} tabIndex={0}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}>
      <div className="hb-chip3d__stage" style={{ width: size, height }}>
        <div ref={coinRef} className="hb-chip3d__coin">
          {Array.from({ length: layers }, (_, i) => edge(i))}
          {[front, back].map((face, i) => (
            <div key={i} className="hb-chip3d__face" style={{ transform: `${i ? "rotateY(180deg) " : ""}translateZ(${thick / 2}px)` }}>
              {face}
              <div ref={(el) => { sheenRefs.current[i] = el; }} className="hb-chip3d__sheen" style={clip} />
            </div>
          ))}
        </div>
      </div>
      <div ref={shadowRef} className="hb-chip3d__shadow" style={{ width: size * 0.7, height: size * 0.06 }} />
    </div>
  );
}
