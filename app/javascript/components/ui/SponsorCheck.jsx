import React from "react";
import { Check } from "lucide-react";

// The green check that says "I can sponsor", the way people show it in the Zoom rooms: a
// green circle with a white check. `badge` adds the words beside it; `on` puts it on the
// corner of an avatar (wrap the avatar in a relative element).
export default function SponsorCheck({ size = 16, badge = false, on = false, className = "" }) {
  const dot = (
    <span aria-hidden={badge || undefined} title={badge ? undefined : "Available to sponsor"}
      className={`inline-grid shrink-0 place-items-center rounded-full bg-emerald-500 text-white ${on ? "absolute -bottom-0.5 -right-0.5 ring-2 ring-white dark:ring-neutral-900" : ""} ${className}`}
      style={{ width: size, height: size }}>
      <Check strokeWidth={3.5} style={{ width: size * 0.65, height: size * 0.65 }} />
      {!badge && <span className="sr-only">Available to sponsor</span>}
    </span>
  );
  if (!badge) return dot;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 py-0.5 pl-0.5 pr-2 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30">
      {dot} Available to sponsor
    </span>
  );
}
