// app/javascript/components/MiddleTruncate.jsx
import { useLayoutEffect, useRef, useState } from "react";

// build a canvas context once
const getCtx = (() => {
  let ctx = null;
  return () => {
    if (!ctx) {
      const c = document.createElement("canvas");
      ctx = c.getContext("2d");
    }
    return ctx;
  };
})();

function cssFontFromComputedStyle(cs) {
  // Build a font string that canvas understands, e.g. "italic 400 14px Inter"
  const style  = cs.fontStyle || "normal";
  const weight = cs.fontWeight || "400";
  const size   = cs.fontSize || "16px";
  const family = cs.fontFamily || "sans-serif";
  const stretch = cs.fontStretch && cs.fontStretch !== "normal" ? cs.fontStretch : "";
  return [style, stretch, weight, size, family].filter(Boolean).join(" ");
}

function measure(text, font) {
  const ctx = getCtx();
  ctx.font = font;
  return ctx.measureText(text).width;
}

function truncateToWidth(text, maxWidth, font) {
  if (!text) return "";
  if (measure(text, font) <= maxWidth) return text;

  const ellipsis = "…";
  const ellW = measure(ellipsis, font);

  // Quick guard: if even 1 char each side doesn't fit, just ellipsis
  if (ellW > maxWidth) return ellipsis;

  // Binary search on how many total visible chars we can keep
  let lo = 2;                         // minimum chars to keep (1 front + 1 back)
  let hi = Math.max(2, text.length);  // upper bound

  const fits = (keep) => {
    const front = Math.ceil((keep - 1) / 2);
    const back  = Math.floor((keep - 1) / 2);
    const candidate = text.slice(0, front) + ellipsis + text.slice(text.length - back);
    return measure(candidate, font) <= maxWidth;
  };

  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }

  const front = Math.ceil((lo - 1) / 2);
  const back  = Math.floor((lo - 1) / 2);
  return text.slice(0, front) + ellipsis + text.slice(text.length - back);
}

/**
 * Props:
 *  - text: string to display (will middle-truncate)
 *  - className: styling for the visible span (use "block min-w-0 w-full" etc.)
 *  - paddingPx: optional extra pixels to subtract (e.g. icons, gaps) from width
 */
export default function MiddleTruncate({ text, className = "", paddingPx = 0 }) {
  const spanRef = useRef(null);
  const [display, setDisplay] = useState(text);

  // Recompute when text or container width changes
  useLayoutEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    const compute = () => {
      // Use the *container* width the text can occupy (content-box)
      const container = el.parentElement || el;
      const cs = getComputedStyle(el);
      const font = cssFontFromComputedStyle(cs);

      let maxWidth = container.clientWidth - paddingPx;
      if (maxWidth < 0) maxWidth = 0;

      setDisplay(truncateToWidth(text, maxWidth, font));
    };

    compute();

    // ResizeObserver for responsive recalculation
    const ro = new ResizeObserver(compute);
    ro.observe(el.parentElement || el);
    window.addEventListener("resize", compute);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [text, paddingPx]);

  return (
    <span ref={spanRef} className={className} title={text}>
      {display}
    </span>
  );
}