import React, { useId } from "react";

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
          {/* the eye: a ring around a pupil, and the two dots */}
          <circle cx="50" cy="42" r="10" fill="black" />
          <circle cx="50" cy="42" r="5.6" fill="white" />
          <circle cx="30" cy="61" r="5.8" fill="black" />
          <circle cx="70" cy="61" r="5.8" fill="black" />
        </mask>
      </defs>
      <g mask={`url(#${mask})`}>
        {/* head, its top edge bowed up a little */}
        <path d="M12 36 Q12 27 20 25 Q50 19 80 25 Q88 27 88 36 V69 Q88 78 79 78 H21 Q12 78 12 69 Z" />
      </g>
      {/* ears */}
      <path d="M8 43 H5 Q1 43 1 47 V61 Q1 65 5 65 H8 Z" />
      <path d="M92 43 H95 Q99 43 99 47 V61 Q99 65 95 65 H92 Z" />
      {/* antennae */}
      <rect x="48" y="12" width="4" height="10" />
      <circle cx="50" cy="9" r="7.4" />
      <rect x="17.2" y="18" width="2.8" height="8" />
      <circle cx="18.6" cy="17" r="5" />
      <rect x="80" y="18" width="2.8" height="8" />
      <circle cx="81.4" cy="17" r="5" />
    </svg>
  );
}

// Mark + "RecoveryBot" with "Bot" in the brand blue
export function RecoveryBotLogo({ className = "", markClassName = "h-7 w-auto", textClassName = "text-lg" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <RecoveryBotMark className={markClassName} />
      <span className={`font-extrabold tracking-tight leading-none ${textClassName}`}>
        Recovery<span className="text-brand dark:text-brand-light">Bot</span>
      </span>
    </span>
  );
}
