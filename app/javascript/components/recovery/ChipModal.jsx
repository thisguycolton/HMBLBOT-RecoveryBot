import React, { useEffect, useRef } from "react";
import { confetti } from "../../lib/confetti";
import { RoundChip, RoundChipBack, TriangleChip, TriangleChipBack, roundLook, triangleLook } from "./Chip";
import Chip3D from "./Chip3D";
import "../../styles/day-count.css";

// A chip in 3D you can spin, both sides drawn in the group's design. `chip` is
// { kind: "round", milestone, on } or { kind: "inventory"|"gratitude", count, on }, `on` the day
// it was earned (it goes on the back).
export function SpinningChip({ chip, design, logoUrl, groupTitle, size = 220, spinIn = true }) {
  if (chip.kind === "round") {
    const { color, metal } = roundLook(design, chip.milestone);
    return (
      <Chip3D shape="round" color={color} metal={metal} size={size} spinIn={spinIn} label={`${chip.milestone.label} chip`}
        front={<RoundChip design={design} milestone={chip.milestone} logoUrl={logoUrl} bare />}
        back={<RoundChipBack design={design} milestone={chip.milestone} groupTitle={groupTitle} earnedOn={chip.on} />} />
    );
  }
  const { color, metal } = triangleLook(design, chip.kind);
  return (
    <Chip3D shape="triangle" color={color} metal={metal} size={size} spinIn={spinIn} label={`${chip.count} chip`}
      front={<TriangleChip design={design} kind={chip.kind} count={chip.count} bare />}
      back={<TriangleChipBack design={design} kind={chip.kind} earnedOn={chip.on} />} />
  );
}

// One chip, big, in the day count's modal (styles/day-count.css): when saving a 10th step or
// a gratitude list earns a triangle chip (with confetti), or when a chip is opened on the
// Chips page
export default function ChipModal({ chip, design, logoUrl, groupTitle, title, text, celebrate = false, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const timer = celebrate ? setTimeout(() => confetti(), 900) : null;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(timer); window.removeEventListener("keydown", onKey); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="hb-daycount" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="hb-chip-title" className="hb-daycount__panel hb-daycount__panel--milestone hb-daycount__panel--chip">
        <button type="button" aria-label="Close" className="hb-daycount__close" onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="hb-daycount__head">
          <div className="hb-daycount__chip"><SpinningChip chip={chip} design={design} logoUrl={logoUrl} groupTitle={groupTitle} /></div>
          <h2 id="hb-chip-title" className="hb-daycount__title">{title}</h2>
          <div className="hb-daycount__hint">Drag to spin it</div>
        </div>
        {text && <div className="hb-daycount__body"><p>{text}</p></div>}
        <div className="hb-daycount__foot">
          <button type="button" className="hb-daycount__button" onClick={() => confetti()}>Celebrate</button>
          <button ref={closeRef} type="button" className="hb-daycount__button hb-daycount__button--primary" onClick={onClose}>Thanks</button>
        </div>
      </div>
    </div>
  );
}
