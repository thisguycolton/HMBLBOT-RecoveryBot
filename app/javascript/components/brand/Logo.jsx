import React, { useId } from "react";
import { Skeleton, SkeletonBox } from "skullet/react";

// The mark's shapes, shared by the drawn mark and its skeleton
const HEAD = "M12 36 Q12 27 20 25 Q50 19 80 25 Q88 27 88 36 V69 Q88 78 79 78 H21 Q12 78 12 69 Z";
const EARS = ["M8 43 H5 Q1 43 1 47 V61 Q1 65 5 65 H8 Z", "M92 43 H95 Q99 43 99 47 V61 Q99 65 95 65 H92 Z"];
const ANTENNAE = [
  { x: 48, y: 12, width: 4, height: 10, cx: 50, cy: 9, r: 7.4 },
  { x: 17.2, y: 18, width: 2.8, height: 8, cx: 18.6, cy: 17, r: 5 },
  { x: 80, y: 18, width: 2.8, height: 8, cx: 81.4, cy: 17, r: 5 },
];
// the eye: a ring around a pupil, and the two dots (black is cut out of the head); the mark
// below draws the same circles
const FACE = '<circle cx="50" cy="42" r="10" fill="black"/><circle cx="50" cy="42" r="5.6" fill="white"/><circle cx="30" cy="61" r="5.8" fill="black"/><circle cx="70" cy="61" r="5.8" fill="black"/>';

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

// The whole robot as one shape, eye and dots cut out: the skeleton is a shimmering bar
// clipped to it, the way Skullet's own site turns its skull logo into a skeleton
const SILHOUETTE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><defs><mask id="m"><rect width="100" height="80" fill="white"/>${FACE}</mask></defs>`
  + `<path d="${HEAD}" mask="url(#m)"/>${EARS.map((d) => `<path d="${d}"/>`).join("")}`
  + ANTENNAE.map((a) => `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}"/><circle cx="${a.cx}" cy="${a.cy}" r="${a.r}"/>`).join("")
  + "</svg>",
)}")`;

// The mark as a skeleton: the robot's outline shimmering with the rest of the page. Same box as
// the mark (100:80), so pass the same className (a height, w-auto) and nothing moves when it swaps.
export function RecoveryBotMarkSkeleton({ className = "h-7 w-auto" }) {
  return (
    <SkeletonBox
      className={`aspect-[5/4] ${className}`}
      style={{
        width: undefined, height: undefined, borderRadius: 0,
        maskImage: SILHOUETTE, WebkitMaskImage: SILHOUETTE,
        maskSize: "100% 100%", WebkitMaskSize: "100% 100%",
        maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
      }}
    />
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
          <span className="relative font-extrabold tracking-tight text-transparent">
            RecoveryBot
            <SkeletonBox className="absolute inset-x-0 top-[0.12em] bottom-[0.08em] rounded-full" style={{ width: undefined, height: undefined, borderRadius: undefined }} />
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

// The logo in the shell (sidebar, top bar): the robot outline while the menus are still on their
// way (first page of a visit; after that they come from this tab's cache), then Skullet brings
// the real logo in over it. mark: just the robot, as in the folded sidebar.
export function ShellLogo({ loading = false, mark = false, markClassName = "h-7 w-auto", textClassName = "text-xl" }) {
  return (
    <Skeleton loading={loading} className="inline-block">
      {mark ? <RecoveryBotMark className={markClassName} /> : <RecoveryBotLogo markClassName={markClassName} textClassName={textClassName} />}
    </Skeleton>
  );
}
