import React, { useEffect, useId, useRef, useState } from "react";

// The mark's shapes, shared by the drawn mark and its skeleton
const HEAD = "M12 36 Q12 27 20 25 Q50 19 80 25 Q88 27 88 36 V69 Q88 78 79 78 H21 Q12 78 12 69 Z";
const EARS = ["M8 43 H5 Q1 43 1 47 V61 Q1 65 5 65 H8 Z", "M92 43 H95 Q99 43 99 47 V61 Q99 65 95 65 H92 Z"];
const ANTENNAE = [
  { x: 48, y: 12, width: 4, height: 10, cx: 50, cy: 9, r: 7.4 },
  { x: 17.2, y: 18, width: 2.8, height: 8, cx: 18.6, cy: 17, r: 5 },
  { x: 80, y: 18, width: 2.8, height: 8, cx: 81.4, cy: 17, r: 5 },
];

// The RecoveryBot mark: a robot head with three antennae, ears, one ringed eye and two
// dots. Drawn in currentColor with the face cut out, so it reads on any background
// (dark on light, white on dark or on the brand blue).
export function RecoveryBotMark({ className = "h-7 w-auto", title = "RecoveryBot" }) {
  const mask = useId();
  return (
    <svg viewBox="0 0 100 80" className={className} role="img" aria-label={title} fill="currentColor">
      <defs>
        <mask id={mask}>
          <rect width="100" height="80" fill="white" />
          <circle cx="50" cy="42" r="10" fill="black" />
          <circle cx="50" cy="42" r="5.6" fill="white" />
          <circle cx="30" cy="61" r="5.8" fill="black" />
          <circle cx="70" cy="61" r="5.8" fill="black" />
        </mask>
      </defs>
      <g mask={`url(#${mask})`}>
        {/* head, its top edge bowed up a little */}
        <path d={HEAD} />
      </g>
      {EARS.map((d) => <path key={d} d={d} />)}
      {ANTENNAE.map((a) => (
        <React.Fragment key={a.cx}>
          <rect x={a.x} y={a.y} width={a.width} height={a.height} />
          <circle cx={a.cx} cy={a.cy} r={a.r} />
        </React.Fragment>
      ))}
    </svg>
  );
}

// The robot's shapes, for the outline below (the eye and dots cut out with the mask given)
function MarkShapes({ mask }) {
  return (
    <>
      <path d={HEAD} mask={`url(#${mask})`} />
      {EARS.map((d) => <path key={d} d={d} />)}
      {ANTENNAE.map((a) => (
        <React.Fragment key={a.cx}>
          <rect x={a.x} y={a.y} width={a.width} height={a.height} />
          <circle cx={a.cx} cy={a.cy} r={a.r} />
        </React.Fragment>
      ))}
    </>
  );
}

// The mark as a skeleton: the robot's outline in the skeleton gray, with a highlight sweeping
// across it. Drawn as a plain SVG of the mark's own box (100:80), so pass the same className (a
// height, w-auto) and nothing moves when it swaps. It used to be a Skullet bar cut to the robot
// with a CSS mask and sized by aspect-ratio, which some Android WebViews drew as a squashed blue
// smear beside the word; an SVG sizes and paints the same everywhere. The sweep is SMIL, and
// .logo-outline-sweep hides it for reduced motion (tailwind.css).
export function RecoveryBotMarkSkeleton({ className = "h-7 w-auto" }) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 80" className={`logo-outline ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <mask id={`${id}m`}>
          <rect width="100" height="80" fill="white" />
          <circle cx="50" cy="42" r="10" fill="black" />
          <circle cx="50" cy="42" r="5.6" fill="white" />
          <circle cx="30" cy="61" r="5.8" fill="black" />
          <circle cx="70" cy="61" r="5.8" fill="black" />
        </mask>
        <linearGradient id={`${id}g`} gradientUnits="userSpaceOnUse" x1="-90" y1="0" x2="-10" y2="30">
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset="0.5" style={{ stopColor: "var(--skullet-highlight, white)" }} />
          <stop offset="1" stopColor="white" stopOpacity="0" />
          <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="200 0" dur="1.6s" repeatCount="indefinite" />
        </linearGradient>
      </defs>
      <g style={{ fill: "var(--skullet-base, #d4d4d4)" }}><MarkShapes mask={`${id}m`} /></g>
      <g className="logo-outline-sweep" fill={`url(#${id}g)`}><MarkShapes mask={`${id}m`} /></g>
    </svg>
  );
}
// Inside a skullet <Skeleton>, the mark draws as its robot outline rather than one block
RecoveryBotMark.Skeleton = RecoveryBotMarkSkeleton;

// Mark + "RecoveryBot" with "Bot" in the brand blue. loading: the robot outline and a bar
// where the word goes, e.g. in the shell while the menus are still on their way.
export function RecoveryBotLogo({ className = "", markClassName = "h-7 w-auto", textClassName = "text-lg", botClassName = "text-brand dark:text-brand-light", loading = false }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {loading ? <RecoveryBotMarkSkeleton className={markClassName} /> : <RecoveryBotMark className={markClassName} />}
      {/* the antennae make the head sit low in the mark's box, so drop the word to the head's middle */}
      {loading ? (
        <span className={`relative top-[0.15em] inline-flex items-center leading-none ${textClassName}`} aria-hidden="true">
          {/* the word's width, held by invisible text, so the bar is exactly as long */}
          <span className="relative font-extrabold tracking-tight" style={{ color: "transparent" }}>
            RecoveryBot
            <span className="logo-outline-bar" />
          </span>
        </span>
      ) : (
        <span className={`relative top-[0.15em] font-extrabold tracking-tight leading-none ${textClassName}`}>
          Recovery<span className={botClassName}>Bot</span>
        </span>
      )}
    </span>
  );
}
RecoveryBotLogo.Skeleton = (props) => <RecoveryBotLogo {...props} loading />;

// How long the robot outline stays up at least, once it has shown. The menus usually come back
// in well under that, and Skullet waits a moment before drawing a skeleton, so without it the
// outline was a flicker nobody could read. Only the logo waits: the menus and the page draw as
// soon as they are here.
export const SHELL_LOGO_MIN_MS = 900;
// One clock for the page, so the sidebar's logo and the top bar's swap at the same moment
let outlineSince = null;

// loading, held on until the outline has been up SHELL_LOGO_MIN_MS. Only when it starts out
// loading (the first page of a visit): later pages read the menus from this tab's cache and
// draw the real logo straight away.
export function useShellLogoLoading(loading) {
  const [holding, setHolding] = useState(() => {
    if (loading && outlineSince == null) outlineSince = performance.now();
    return loading;
  });
  useEffect(() => {
    if (loading) { setHolding(true); return undefined; }
    const left = outlineSince == null ? 0 : SHELL_LOGO_MIN_MS - (performance.now() - outlineSince);
    if (left <= 0) { setHolding(false); return undefined; }
    const timer = setTimeout(() => setHolding(false), left);
    return () => clearTimeout(timer);
  }, [loading]);
  return loading || holding;
}

// The logo in the shell (sidebar, top bar): the robot outline while the menus are still on their
// way (first page of a visit; after that they come from this tab's cache), then the real logo
// fades in over it. mark: just the robot, as in the folded sidebar. This draws the outline
// itself rather than through a Skullet <Skeleton>: Skullet's ghost and its fade-out copy lean on
// newer CSS (@scope, aspect-ratio boxes, masks), and on some Android WebViews the header logo
// came out as the word next to a squashed blue robot. .shell-logo-skeleton sets the outline's
// grays (tailwind.css).
export function ShellLogo({ loading = false, mark = false, markClassName = "h-7 w-auto", textClassName = "text-xl" }) {
  const showing = useShellLogoLoading(loading);
  // fade the real logo in only if the outline was up first, not on pages that draw it straight away
  const outlined = useRef(showing);
  if (showing) outlined.current = true;
  if (showing) {
    return (
      <span className="shell-logo-skeleton inline-block">
        {mark ? <RecoveryBotMarkSkeleton className={markClassName} /> : <RecoveryBotLogo loading markClassName={markClassName} textClassName={textClassName} />}
      </span>
    );
  }
  return (
    <span className={`inline-block ${outlined.current ? "shell-logo-in" : ""}`}>
      {mark ? <RecoveryBotMark className={markClassName} /> : <RecoveryBotLogo markClassName={markClassName} textClassName={textClassName} />}
    </span>
  );
}
