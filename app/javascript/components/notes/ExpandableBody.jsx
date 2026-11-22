import React, { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ChevronDown } from "lucide-react";

// A long note's text, cut to about eight lines with a fade and a "Show more" button that slides
// the rest open (and "Show less" to fold it back). Short notes are left alone: the button only
// shows when the text is clearly taller than the cut (a line or two over isn't worth hiding).
// The height animates from the cut to the text's real height, then lets go (`none`) so edits,
// fonts and window resizes never leave it stuck. Reduced motion just snaps open or shut.
const COLLAPSED_EM = 14; // about 8 lines at the feed's line height
const SLACK = 1.3; // only cut when the text is at least this much taller than the cut
const CUT = `${COLLAPSED_EM}em`;

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function ExpandableBody({ children }) {
  const box = useRef(null);
  const inner = useRef(null);
  const [long, setLong] = useState(false);
  const [open, setOpen] = useState(false);
  // The box's max-height: the cut, "none" when open, or a pixel height while it slides
  const [height, setHeight] = useState(CUT);

  const cutPx = () => COLLAPSED_EM * (parseFloat(getComputedStyle(box.current).fontSize) || 16);

  // Measure the text (and again whenever it changes size) to decide whether it needs the cut
  useLayoutEffect(() => {
    const measure = () => {
      if (inner.current && box.current) setLong(inner.current.scrollHeight > cutPx() * SLACK);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(inner.current);
    return () => ro.disconnect();
  }, []);

  const toggle = () => {
    const next = !open;
    const full = inner.current.scrollHeight;
    if (reducedMotion()) {
      setOpen(next);
      setHeight(next ? "none" : CUT);
    } else {
      // Commit the start height and make the browser take it, then set the end so it transitions
      flushSync(() => { setOpen(next); setHeight(`${next ? cutPx() : full}px`); });
      void box.current.offsetHeight;
      setHeight(`${next ? full : cutPx()}px`);
    }
    if (!next) keepInView(box.current);
  };

  const done = (e) => {
    if (e.target !== box.current || e.propertyName !== "max-height") return;
    setHeight(open ? "none" : CUT);
  };

  // One shape whether it's cut or not, so the measured element never changes under the observer
  const clipped = long && height !== "none";
  return (
    <>
      <div
        ref={box}
        onTransitionEnd={done}
        className={long ? `wb-expandable${clipped ? " is-clipped" : ""}` : undefined}
        style={long ? { maxHeight: height } : undefined}
      >
        <div ref={inner} className="wb-expandable__inner">{children}</div>
      </div>
      {long && (
        <button type="button" className="wb-expandable__toggle" onClick={toggle} aria-expanded={open}>
          {open ? "Show less" : "Show more"}
          <ChevronDown size={16} aria-hidden="true" className={`wb-expandable__chevron${open ? " is-open" : ""}`} />
        </button>
      )}
    </>
  );
}

// Folding a long note back up can leave you looking at what came after it; bring its top back
function keepInView(el) {
  if (el.getBoundingClientRect().top < 60) el.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
}
