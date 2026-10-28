import React, { useCallback, useEffect, useRef, useState } from "react";
import { createConsumer } from "@rails/actioncable";
import { api } from "../groups/lib";
import ChipModal from "./ChipModal";

// A chip someone gave the member, in a popup with confetti on whatever page they have open,
// the moment it's theirs (ChipsChannel says one came, no refresh needed), or on the next page
// they open if they weren't here. Each shows once (Api::ChipArrivalsController#seen), oldest first.
export default function ChipArrival() {
  const [queue, setQueue] = useState([]);
  const [ready, setReady] = useState(false);
  const shown = useRef(new Set());

  const load = useCallback(() => {
    api("/chip_arrivals").then(({ chips }) => {
      // The Chips page opened from its notification already shows this one, with confetti
      const opening = new URLSearchParams(window.location.search).get("chip");
      const fresh = chips.filter((c) => !shown.current.has(c.id));
      fresh.forEach((c) => shown.current.add(c.id));
      fresh.filter((c) => c.id === opening).forEach(seen);
      setQueue((q) => [...q, ...fresh.filter((c) => c.id !== opening)]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const consumer = createConsumer();
    // connected runs on every (re)connect, so chips given while offline come too
    const sub = consumer.subscriptions.create({ channel: "ChipsChannel" }, { connected: load, received: load });
    return () => { sub.unsubscribe(); consumer.disconnect(); };
  }, [load]);

  // Wait for the day count's modal (it opens on sign-in) to close first
  useEffect(() => {
    if (!queue.length || ready) return undefined;
    const check = () => !document.querySelector(".hb-daycount") && setReady(true);
    check();
    const timer = setInterval(check, 1000);
    return () => clearInterval(timer);
  }, [queue.length, ready]);

  const chip = ready && queue[0];
  if (!chip) return null;
  const close = () => {
    seen(chip);
    setReady(false);
    setQueue((q) => q.slice(1));
  };
  return (
    <ChipModal key={chip.id} chip={chip} title={chip.title} celebrate onClose={close}
      text={chip.note ? `“${chip.note}”` : `From ${chip.group.title}. Congratulations!`}>
      <p><a className="hb-daycount__link" href={`/recovery?chip=${encodeURIComponent(chip.id)}`}>See it with all my chips</a></p>
    </ChipModal>
  );
}

function seen(chip) {
  api(`/chip_arrivals/${chip.id.replace("award:", "")}/seen`, { method: "POST" }).catch(() => {});
}
