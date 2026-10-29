import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { confetti } from "../../lib/confetti";
import { RoundChip, RoundChipBack, TriangleChip, TriangleChipBack, atMilestone, isScene, meetingLook, roundLook, sceneBody, triangleLook } from "./Chip";
import Chip3D from "./Chip3D";
import "../../styles/day-count.css";

// A chip from the catalog (Chips.catalog on the server: { shape, kind, milestone or count, on,
// design?, group? }) in 3D you can spin, both sides drawn. Chips without a design of their own
// are RecoveryBot's (`design`, ChipDesign::DEFAULT); a given chip carries its group's.
export function SpinningChip({ chip, design, size = 220, spinIn = true }) {
  const { d, milestone } = look(chip, design);
  const mark = chip.edition?.mark;
  if (chip.shape === "round") {
    const { color, metal } = roundLook(d, milestone);
    return (
      <Chip3D shape="round" color={color} metal={metal} size={size} spinIn={spinIn} label={`${chip.label} chip`}
        front={<RoundChip design={d} milestone={milestone} logoUrl={chip.group?.logo_url} bare />}
        back={<RoundChipBack design={d} milestone={milestone} groupTitle={chip.group?.title || chip.meeting?.group_title} earnedOn={chip.on} mark={mark} />} />
    );
  }
  const at = atMilestone(d, { kind: chip.kind, count: chip.count });
  const { color, metal } = isScene(at.triangle) ? sceneBody(at.triangle, chip.kind) : triangleLook(at, chip.kind);
  return (
    <Chip3D shape="triangle" color={color} metal={metal} size={size} spinIn={spinIn} label={`${chip.label} chip`}
      front={<TriangleChip design={d} kind={chip.kind} count={chip.count} bare />}
      back={<TriangleChipBack design={d} kind={chip.kind} count={chip.count} earnedOn={chip.on} mark={mark} />} />
  );
}

// The design a chip is drawn in (its own, else `design`), with a Meeting Maker chip's design
// laid over its shape, and what its face counts
function look(chip, design) {
  const own = chip.design || design;
  const meeting = chip.kind === "meeting";
  return {
    d: meeting ? meetingLook(own) : own,
    milestone: chip.milestone || (meeting ? { key: "count", count: chip.count, label: chip.label } : undefined),
  };
}

// A flat chip from the catalog, for lists
export function FlatChip({ chip, design, size = 128, faded = false, className = "" }) {
  const { d, milestone } = look(chip, design);
  return chip.shape === "round"
    ? <RoundChip design={d} milestone={milestone} logoUrl={chip.group?.logo_url} size={size} faded={faded} className={className} />
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

  return createPortal(
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
    </div>,
    document.body
  );
}
