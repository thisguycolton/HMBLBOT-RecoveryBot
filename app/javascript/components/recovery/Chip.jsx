import React, { useId } from "react";

// Virtual chips, drawn as SVG in a group's design (ChipDesign on the server, set in Group
// dashboard > Chips). Round chips mark sobriety milestones (lib/milestones.js), triangle chips
// how many 10th steps or gratitude lists someone has written (Chips::TRIANGLE_COUNTS).

// A hex color mixed toward white (amount > 0) or black (amount < 0)
export function shade(hex, amount) {
  const n = parseInt((hex || "#888888").slice(1), 16);
  const mix = (c) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// Light chips (silver, gold) get dark lettering
const light = (hex) => {
  const n = parseInt((hex || "#888888").slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 165;
};

const ROMAN = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
export function roman(n) {
  let out = "";
  let left = n;
  ROMAN.forEach(([v, s]) => { while (left >= v) { out += s; left -= v; } });
  return out;
}

// What the middle of a round chip says: ["30", "DAYS"], ["IX", "YEARS"] ...
function roundFace(milestone, numerals) {
  if (milestone.key === "year") {
    const n = milestone.years || 1;
    return [numerals === "number" ? String(n) : roman(n), n === 1 ? "YEAR" : "YEARS"];
  }
  const [, num, unit] = /^(\d+)(h|d|m)$/.exec(milestone.key) || [null, "", ""];
  return [num, { h: "HOURS", d: "DAYS", m: "MONTHS" }[unit] || ""];
}

// A font size that fits uppercase text, letter-spaced, into `room` units of a path
const fit = (text, room, max) => Math.min(max, room / (Math.max(text.length, 1) * 0.86));

const isMetal = (finish, milestone) => finish === "metal" || (finish === "classic" && milestone.key === "year");
const FONT = "'Public Sans', system-ui, sans-serif";

// A chip's colors: its own, whether it's metal, and the color of its lettering
export function roundLook(design, milestone) {
  const color = design.round.colors[milestone.key] || design.round.colors.year;
  const metal = isMetal(design.round.finish, milestone);
  return { color, metal, ink: inkFor(color, metal) };
}
// Streak chips are the color of what they count, always in metal
export function triangleLook(design, kind) {
  const base = kind.replace(/-streak$/, "");
  const colors = design.triangle.colors;
  const color = colors[kind] || colors[base] || colors.meeting || "#3451b2";
  const metal = design.triangle.finish === "metal" || kind.endsWith("-streak");
  return { color, metal, ink: inkFor(color, metal) };
}
const inkFor = (color, metal) => (metal ? shade(color, -0.55) : light(color) ? shade(color, -0.7) : "#ffffff");

const svgClass = (faded, bare, className) => `${faded ? "opacity-35 grayscale" : bare ? "" : "drop-shadow-md"} ${className}`;

// Lines of text that fit a width: the given line breaks, or words wrapped at `width` letters
function wrap(text, width) {
  return text.split(/\n/).flatMap((para) => {
    const lines = [];
    let line = "";
    para.trim().split(/\s+/).filter(Boolean).forEach((word) => {
      if (line && `${line} ${word}`.length > width) { lines.push(line); line = word; } else line = line ? `${line} ${word}` : word;
    });
    return line ? [...lines, line] : lines;
  });
}

// The round chip's rim and face, both sides
function RoundBase({ id, look }) {
  const { color, metal, ink } = look;
  return (
    <>
      <defs>
        <radialGradient id={`${id}-face`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor={shade(color, metal ? 0.45 : 0.18)} />
          <stop offset="55%" stopColor={color} />
          <stop offset="100%" stopColor={shade(color, metal ? -0.35 : -0.15)} />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={shade(color, metal ? 0.3 : 0.05)} />
          <stop offset="100%" stopColor={shade(color, -0.4)} />
        </linearGradient>
        <path id={`${id}-top`} d="M 30,100 A 70,70 0 0 1 170,100" />
        <path id={`${id}-bottom`} d="M 20,100 A 80,80 0 0 0 180,100" />
      </defs>
      <circle cx="100" cy="100" r="97" fill={`url(#${id}-rim)`} />
      <circle cx="100" cy="100" r="90" fill={`url(#${id}-face)`} />
      {metal ? (
        <>
          <circle cx="100" cy="100" r="90" fill="none" stroke={shade(color, -0.3)} strokeWidth="1.5" />
          <circle cx="100" cy="100" r="62" fill="none" stroke={shade(color, -0.3)} strokeWidth="1.5" />
          <circle cx="100" cy="100" r="60" fill="none" stroke={shade(color, 0.35)} strokeWidth="1" />
        </>
      ) : (
        <>
          {/* the edge spots of a poker-style chip */}
          <circle cx="100" cy="100" r="93.5" fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="7" strokeDasharray="14 22.7" />
          <circle cx="100" cy="100" r="62" fill="none" stroke={ink} strokeOpacity="0.55" strokeWidth="1.5" />
        </>
      )}
    </>
  );
}

function ArcText({ id, top, bottom, ink }) {
  return (
    <g fill={ink} fontFamily={FONT} fontWeight="700">
      {[["top", top, 200], ["bottom", bottom, 225]].map(([edge, text, room]) => {
        const fs = fit(text, room, 11.5);
        return <text key={edge} fontSize={fs} letterSpacing={fs * 0.18}><textPath href={`#${id}-${edge}`} startOffset="50%" textAnchor="middle">{text.toUpperCase()}</textPath></text>;
      })}
    </g>
  );
}

// A group's logo raised on the chip (ChipDesign emblem "relief", ChipRelief on the server). Its
// shapes are drawn as a heightmap, gray for how high each stands (white cuts back to the face).
// On a metal chip it's struck into the metal: lit from the top left, standing relief_height high
// and rising from the coin as steeply as relief_sharpness says. On a colored chip it's a slight
// raised print in the chip's ink. relief_size is how wide it is, of the 200 across the chip.
// relief_depth "inset" cuts it into the coin instead: the same, upside down, with the shadow
// inside its top and left edges.
function Relief({ id, round, look, cy = 86 }) {
  const { relief } = round;
  const { color, metal, ink } = look;
  const w = round.relief_size || 64;
  const x = 100 - w / 2;
  const y = cy - w / 2;
  const [bx, by, bw, bh] = relief.view_box;
  const height = round.relief_height || 4;
  const sharp = round.relief_sharpness || 7;
  const soft = 0.12 + (10 - sharp) * 0.2; // how far the slope from the face to the top runs
  const inset = round.relief_depth === "inset";
  const lift = (inset ? -1 : 1) * height * 1.4;
  const light = <feDistantLight azimuth="225" elevation="55" />;
  return (
    <>
      <defs>
        <filter id={`${id}-relief`} filterUnits="userSpaceOnUse" x="0" y="0" width="200" height="200" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="height" />
          <feComponentTransfer in="height" result="mask"><feFuncA type="linear" slope="40" /></feComponentTransfer>
          {metal ? (
            <>
              <feGaussianBlur in="height" stdDeviation={soft} result="slope" />
              <feDiffuseLighting in="slope" surfaceScale={lift} diffuseConstant="1" lightingColor="#ffffff" result="lit">{light}</feDiffuseLighting>
              <feSpecularLighting in="slope" surfaceScale={lift} specularConstant="0.8" specularExponent="40" lightingColor="#ffffff" result="shine">{light}</feSpecularLighting>
              <feFlood floodColor={shade(color, inset ? -0.08 : 0.04)} result="paint" />
              <feComposite in="paint" in2="lit" operator="arithmetic" k1="0.85" k2="0.35" result="shaded" />
              <feComposite in="shine" in2="shaded" operator="arithmetic" k2="0.7" k3="1" result="bright" />
              <feComposite in="bright" in2="mask" operator="in" result="raised" />
              <feGaussianBlur in="mask" stdDeviation={0.3 + soft * 0.4} result="blur" />
              <feOffset in="blur" dx={height * 0.06} dy={height * 0.1} result="drop" />
              <feFlood floodColor="#000000" floodOpacity={Math.min(0.4, 0.06 + height * 0.035)} result="dark" />
            </>
          ) : (
            <>
              <feFlood floodColor={ink} floodOpacity="0.92" />
              <feComposite in2="mask" operator="in" result="raised" />
              <feGaussianBlur in="mask" stdDeviation="0.2" result="blur" />
              <feOffset in="blur" dx="0.35" dy="0.5" result="drop" />
              <feFlood floodColor="#000000" floodOpacity={inset ? 0.35 : 0.22} result="dark" />
            </>
          )}
          {inset ? (
            <>
              {/* inside the cut, along its top and left edges */}
              <feComposite in="mask" in2="drop" operator="out" result="edge" />
              <feComposite in="dark" in2="edge" operator="in" result="shadow" />
              <feMerge><feMergeNode in="raised" /><feMergeNode in="shadow" /></feMerge>
            </>
          ) : (
            <>
              <feComposite in="dark" in2="drop" operator="in" result="shadow" />
              <feMerge><feMergeNode in="shadow" /><feMergeNode in="raised" /></feMerge>
            </>
          )}
        </filter>
      </defs>
      <g filter={`url(#${id}-relief)`}>
        <rect x={x} y={y} width={w} height={w} fill="#000000" />
        <svg x={x} y={y} width={w} height={w} viewBox={`${bx} ${by} ${bw} ${bh}`} preserveAspectRatio="xMidYMid meet">
          {relief.shapes.map((sh, i) => {
            const g = Math.round(sh.h * 255);
            return <path key={i} d={sh.d} transform={sh.t} fill={`rgb(${g},${g},${g})`} />;
          })}
        </svg>
      </g>
    </>
  );
}

// The back's words in lines that fit inside the ring (radius `r`): every line width from 12 to
// 30 letters is tried, and the one that lets the letters be biggest wins
const CHAR = 0.7; // a bold capital's width, letter spacing included, in font sizes
export function fitBack(text, r = 54) {
  let best = { lines: [], fs: 10 };
  for (let width = 10; width <= 30; width += 1) {
    const lines = wrap(text || "", width).slice(0, 12);
    if (!lines.length) return best;
    for (let fs = 11; fs >= 4.5; fs -= 0.25) {
      const gap = fs * 1.3;
      const fits = lines.every((l, i) => {
        const dy = Math.abs((i - (lines.length - 1) / 2) * gap) + fs * 0.45;
        return dy < r && (l.length * fs * CHAR) / 2 <= Math.sqrt(r * r - dy * dy);
      });
      if (fits) { if (fs > best.fs || !best.lines.length) best = { lines, fs }; break; }
    }
  }
  return best;
}

export function RoundChip({ design, milestone, logoUrl, size = 160, faded = false, bare = false, className = "", title }) {
  const id = useId().replace(/:/g, "");
  const d = design.round;
  const look = roundLook(design, milestone);
  const { ink } = look;
  const [big, small] = roundFace(milestone, d.numerals);
  const emblem = (d.emblem === "logo" && !logoUrl) || (d.emblem === "relief" && !d.relief?.shapes?.length) ? "triangle" : d.emblem;
  // relief_badge: a circle over the middle of the raised logo with the milestone in it
  const badge = emblem === "relief" && d.relief_badge;
  const stamped = emblem === "logo" || (emblem === "relief" && !badge);
  const bigSize = big.length > 4 ? 26 : big.length > 2 ? 32 : 40;

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={title || `${milestone.label} chip`} className={svgClass(faded, bare, className)}>
      <RoundBase id={id} look={look} />
      <defs><clipPath id={`${id}-logo`}><circle cx="100" cy="88" r="27" /></clipPath></defs>
      <ArcText id={id} top={d.top_text} bottom={d.bottom_text} ink={ink} />

      {emblem === "triangle" && (
        <g fill="none" stroke={ink} strokeOpacity="0.8" strokeWidth="2.2" strokeLinejoin="round">
          <circle cx="100" cy="100" r="54" />
          <path d="M 100,46 L 146.8,127 L 53.2,127 Z" />
        </g>
      )}
      {emblem === "relief" && <Relief id={id} round={d} look={look} cy={badge ? 100 : 86} />}
      {badge && (
        <g>
          <circle cx="100.6" cy="101" r="23" fill="#000000" opacity="0.18" />
          <circle cx="100" cy="100" r="22.5" fill={`url(#${id}-face)`} stroke={ink} strokeOpacity="0.55" strokeWidth="1.2" />
          <circle cx="100" cy="100" r="19.5" fill="none" stroke={ink} strokeOpacity="0.3" strokeWidth="0.6" />
          <g fill={ink} fontFamily={FONT} textAnchor="middle">
            <text x="100" y="103" fontSize={big.length > 3 ? 11 : big.length > 2 ? 13 : 16} fontWeight="800">{big}</text>
            <text x="100" y="113" fontSize="5.2" fontWeight="700" letterSpacing="0.8">{small}</text>
          </g>
        </g>
      )}
      {emblem === "logo" && (
        <>
          <image href={logoUrl} x="73" y="61" width="54" height="54" clipPath={`url(#${id}-logo)`} preserveAspectRatio="xMidYMid slice" />
          <circle cx="100" cy="88" r="27" fill="none" stroke={ink} strokeOpacity="0.6" strokeWidth="1.5" />
        </>
      )}

      {!badge && <g fill={ink} fontFamily={FONT} textAnchor="middle">
        {stamped ? (
          <text x="100" y="140" fontSize="18" fontWeight="800">{big} <tspan fontSize="10" fontWeight="700" letterSpacing="1.5">{small}</tspan></text>
        ) : (
          <>
            <text x="100" y={emblem === "triangle" ? 106 : 106} fontSize={emblem === "triangle" ? bigSize * 0.72 : bigSize * 1.15} fontWeight="800">{big}</text>
            <text x="100" y={emblem === "triangle" ? 120 : 128} fontSize={emblem === "triangle" ? 8.5 : 11} fontWeight="700" letterSpacing="1.5">{small}</text>
          </>
        )}
      </g>}
    </svg>
  );
}

// The back of a round chip: the group's words (the Serenity Prayer unless it changed them),
// the group's name around the top and the day it was earned around the bottom
export function RoundChipBack({ design, milestone, groupTitle, earnedOn, size = 160 }) {
  const id = useId().replace(/:/g, "");
  const look = roundLook(design, milestone);
  const { lines, fs } = fitBack(design.round.back_text);
  const gap = fs * 1.3;
  const date = earnedOn ? new Date(`${earnedOn}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "";
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="The back of the chip">
      <RoundBase id={id} look={look} />
      <ArcText id={id} top={groupTitle || ""} bottom={date} ink={look.ink} />
      <g fill={look.ink} fontFamily={FONT} fontWeight="700" textAnchor="middle" letterSpacing={fs * 0.06}>
        {lines.map((l, i) => <text key={i} x="100" y={100 - ((lines.length - 1) * gap) / 2 + i * gap + fs * 0.35} fontSize={fs}>{l.toUpperCase()}</text>)}
      </g>
    </svg>
  );
}

// An equilateral triangle: corners top, bottom right, bottom left, `inset` in from the edge
const CENTER = [100, 112];
const INRADIUS = 52;
export const TRIANGLE_CORNERS = [[100, 8], [190, 164], [10, 164]];
function inset(t) {
  const k = (INRADIUS - t) / INRADIUS;
  return TRIANGLE_CORNERS.map(([x, y]) => [CENTER[0] + (x - CENTER[0]) * k, CENTER[1] + (y - CENTER[1]) * k]);
}
// The triangle `t` in from the edge with its corners rounded to radius `radius`, as a path, its
// numbers times `scale` (Chip3D cuts its edge layers to the same outline, in pixels)
const ROUNDING = 24;
export function roundedTriangle(t = 0, radius = ROUNDING - t, scale = 1) {
  const r = Math.max(radius, 1.5);
  const v = inset(t);
  const cut = r * Math.sqrt(3); // from a corner to where its curve meets the sides
  const toward = ([x1, y1], [x2, y2]) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    return [x1 + ((x2 - x1) * cut) / len, y1 + ((y2 - y1) * cut) / len];
  };
  const n = (p) => p.map((c) => +(c * scale).toFixed(2)).join(",");
  let d = "";
  v.forEach((corner, i) => {
    const from = toward(corner, v[(i + 2) % 3]);
    const to = toward(corner, v[(i + 1) % 3]);
    d += `${i ? "L" : "M"} ${n(from)} A ${+(r * scale).toFixed(2)},${+(r * scale).toFixed(2)} 0 0 1 ${n(to)} `;
  });
  return `${d}Z`;
}
const line = ([x1, y1], [x2, y2]) => `M ${x1},${y1} L ${x2},${y2}`;

// What a triangle chip says under its number, for one and for more ("\n" starts a second line)
export const TRIANGLE_WORDS = {
  inventory: ["10TH STEP", "10TH STEPS"],
  gratitude: ["GRATITUDE", "GRATITUDE"],
  "inventory-streak": ["NIGHTS\nIN A ROW", "NIGHTS\nIN A ROW"],
  "gratitude-streak": ["DAYS\nIN A ROW", "DAYS\nIN A ROW"],
  meeting: ["MEETING", "MEETINGS"],
};

// The triangle chip's edge, face and the words along its sides, both sides
function TriangleBase({ id, look, sides }) {
  const { color, metal, ink } = look;
  // Text on the slanted sides grows outward from its line, on the bottom inward
  const sideLine = inset(21);
  const bottomLine = inset(10);
  return (
    <>
      <defs>
        <linearGradient id={`${id}-face`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={shade(color, metal ? 0.45 : 0.15)} />
          <stop offset="60%" stopColor={color} />
          <stop offset="100%" stopColor={shade(color, metal ? -0.35 : -0.15)} />
        </linearGradient>
        <path id={`${id}-l`} d={line(sideLine[2], sideLine[0])} />
        <path id={`${id}-r`} d={line(sideLine[0], sideLine[1])} />
        <path id={`${id}-b`} d={line(bottomLine[2], bottomLine[1])} />
      </defs>
      <path d={roundedTriangle(-5)} fill={shade(color, -0.35)} />
      <path d={roundedTriangle(1)} fill={`url(#${id}-face)`} />
      {metal
        ? <path d={roundedTriangle(7)} fill="none" stroke={shade(color, 0.3)} strokeWidth="1" />
        : <path d={roundedTriangle(-2)} fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="5" strokeDasharray="12 18" />}
      <path d={roundedTriangle(24, 10)} fill="none" stroke={ink} strokeOpacity="0.55" strokeWidth="1.5" />
      <g fill={ink} fontFamily={FONT} fontWeight="700">
        {[["l", sides[0]], ["r", sides[1]], ["b", sides[2]]].map(([edge, text = ""]) => {
          const fs = fit(text, 100, 10);
          return <text key={edge} fontSize={fs} letterSpacing={fs * 0.18}><textPath href={`#${id}-${edge}`} startOffset="50%" textAnchor="middle">{text.toUpperCase()}</textPath></text>;
        })}
      </g>
    </>
  );
}

export function TriangleChip({ design, kind, count, size = 160, faded = false, bare = false, className = "", title }) {
  const id = useId().replace(/:/g, "");
  const look = triangleLook(design, kind);
  const [one, many] = TRIANGLE_WORDS[kind] || ["", ""];
  const num = String(count);
  const words = (count === 1 ? one : many).split("\n");

  return (
    <svg viewBox="0 0 200 176" width={size} height={(size * 176) / 200} role="img" aria-label={title || `${count} ${(count === 1 ? one : many).replace("\n", " ").toLowerCase()} chip`} className={svgClass(faded, bare, className)}>
      <TriangleBase id={id} look={look} sides={design.triangle.sides} />
      <g fill={look.ink} fontFamily={FONT} textAnchor="middle">
        <text x="100" y={words.length > 1 ? 116 : 121} fontSize={num.length > 3 ? 19 : num.length > 2 ? 23 : 28} fontWeight="800">{num}</text>
        {words.map((w, i) => <text key={w} x="100" y={(words.length > 1 ? 126 : 133) + i * 7.5} fontSize={words.length > 1 ? 6.2 : 7} fontWeight="700" letterSpacing="1">{w}</text>)}
      </g>
    </svg>
  );
}

// The back of a triangle chip: "One day at a time" and the day it was earned
export function TriangleChipBack({ design, kind, earnedOn, size = 160 }) {
  const id = useId().replace(/:/g, "");
  const look = triangleLook(design, kind);
  const date = earnedOn ? new Date(`${earnedOn}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "";
  return (
    <svg viewBox="0 0 200 176" width={size} height={(size * 176) / 200} role="img" aria-label="The back of the chip">
      <TriangleBase id={id} look={look} sides={design.triangle.sides} />
      <g fill={look.ink} fontFamily={FONT} fontWeight="700" textAnchor="middle" letterSpacing="0.8">
        <text x="100" y="104" fontSize="7.5">ONE DAY</text>
        <text x="100" y="114" fontSize="7.5">AT A TIME</text>
        {date && <text x="100" y="128" fontSize="6.5" opacity="0.85">{date.toUpperCase()}</text>}
      </g>
    </svg>
  );
}
