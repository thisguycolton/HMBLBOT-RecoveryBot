import React, { useState } from "react";
import ChipModal, { FlatChip } from "../recovery/ChipModal";
import { dayLabel } from "../recovery/lib";

// What a favorite chip's modal says, about someone else (or you)
function story(chip, name) {
  if (chip.source === "given") return `From ${chip.group.title}, ${dayLabel(chip.on)}.`;
  if (chip.kind === "meeting") return `${chip.label} at ${chip.meeting.name}.`;
  return `${name} reached ${chip.label} on ${dayLabel(chip.on)}.`;
}

// The up to five favorite chips someone shows on their profile (users.show_chips_on_profile,
// chosen on their Chips page). Tap one to spin it.
export default function ProfileChips({ chips, design, person, isMe }) {
  const [open, setOpen] = useState(null);
  if (!chips?.length) return null;
  return (
    <section aria-label="Chips" className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">
      {chips.map((chip) => (
        <button key={chip.id} type="button" title={chip.label} aria-label={`${chip.label} chip`} onClick={() => setOpen(chip)}
          className="rounded-full !bg-transparent p-1 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-accent">
          <FlatChip chip={chip} design={design} size={72} />
        </button>
      ))}
      {open && <ChipModal chip={open} design={design} text={story(open, isMe ? "You" : person.name)} onClose={() => setOpen(null)} />}
    </section>
  );
}
