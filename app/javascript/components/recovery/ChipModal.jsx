import React, { useEffect, useRef } from "react";
import { confetti } from "../../lib/confetti";
import { RoundChip, RoundChipBack, TriangleChip, TriangleChipBack, roundLook, triangleLook } from "./Chip";
import Chip3D from "./Chip3D";
import "../../styles/day-count.css";

// A chip from the catalog (Chips.catalog on the server: { shape, kind, milestone or count, on,
// design?, group? }) in 3D you can spin, both sides drawn. Chips without a design of their own
// are RecoveryBot's (`design`, ChipDesign::DEFAULT); a given chip carries its group's.
export function SpinningChip({ chip, design, size = 220, spinIn = true }) {
  const d = chip.design || design;
  if (chip.shape === "round") {
    const { color, metal } = roundLook(d, chip.milestone);
    return (
      <Chip3D shape="round" color={color} metal={metal} size={size} spinIn={spinIn} label={`${chip.label} chip`}
        front={<RoundChip design={d} milestone={chip.milestone} logoUrl={chip.group?.logo_url} bare />}
        back={<RoundChipBack design={d} milestone={chip.milestone} groupTitle={chip.group?.title} earnedOn={chip.on} />} />
    );
  }
  const { color, metal } = triangleLook(d, chip.kind);
  return (
    <Chip3D shape="triangle" color={color} metal={metal} size={size} spinIn={spinIn} label={`${chip.label} chip`}
      front={<TriangleChip design={d} kind={chip.kind} count={chip.count} bare />}
      back={<TriangleChipBack design={d} kind={chip.kind} earnedOn={chip.on} />} />
  );
}

// A flat chip from the catalog, for lists
export function FlatChip({ chip, design, size = 128, faded = false, className = "" }) {
  const d = chip.design || design;
  return chip.shape === "round"
    ? <RoundChip design={d} milestone={chip.milestone} logoUrl={chip.group?.logo_url} size={size} faded={faded} className={className} />
    : <TriangleChip design={d} kind={chip.kind} count={chip.count} size={size * 1.06} faded={faded} className={className} />;
}

// One chip, big, in the day count's modal (styles/day-count.css): opened on the Chips page, or
// when saving a 10th step or a gratitude list earns one (with confetti). `children` go under
// the words (the Chips page's favorite and on-top choices).
export default function ChipModal({ chip, design, title, text, celebrate = false, onClose, children }) {
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
          <div className="hb-daycount__chip"><SpinningChip key={chip.id} chip={chip} design={design} /></div>
          <h2 id="hb-chip-title" className="hb-daycount__title">{title || chip.label}</h2>
          <div className="hb-daycount__hint">Drag to spin it</div>
        </div>
        {(text || children) && (
          <div className="hb-daycount__body">
            {text && <p>{text}</p>}
            {children}
          </div>
        )}
        <div className="hb-daycount__foot">
          <button type="button" className="hb-daycount__button" onClick={() => confetti()}>Celebrate</button>
          <button ref={closeRef} type="button" className="hb-daycount__button hb-daycount__button--primary" onClick={onClose}>Thanks</button>
        </div>
      </div>
    </div>
  );
}
