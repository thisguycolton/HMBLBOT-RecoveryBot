// Toasts on every page. Both layouts mount this into #hb-toasts and pass the
// Rails flash ({ notice, alert }) in data-flash, so redirects' messages arrive as toasts.
// A signed-in member with a sobriety date gets their day count too (DayCount), and their clicks
// on a meeting's Join button count toward Meeting Maker chips. A chip someone gives them pops up
// with confetti on whatever page they have open (ChipArrival).
import React from "react";
import { createRoot } from "react-dom/client";
import DayCount from "../components/DayCount";
import ChipArrival from "../components/recovery/ChipArrival";
import Toasts from "../components/Toasts";
import { showToast } from "../lib/toast";

const root = document.getElementById("hb-toasts");
if (root && !root.dataset.mounted) {
  root.dataset.mounted = "true";
  const since = root.dataset.soberSince;
  createRoot(root).render(
    <>
      <Toasts />
      {since && <DayCount since={since} signedIn={root.dataset.dayCountLogin === "true"} />}
      {root.dataset.signedIn === "true" && <ChipArrival />}
    </>,
  );
  // Meeting Maker: a Join button (any that carries data-meeting-join) clicked in the half hour
  // before its meeting counts toward that meeting's chips (Api::MeetingJoinsController)
  if (document.body.dataset.currentUser === "true") {
    document.addEventListener("click", (e) => {
      const link = e.target.closest?.("a[data-meeting-join]");
      if (!link) return;
      const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
      fetch("/api/meeting_joins", {
        method: "POST", keepalive: true, credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-CSRF-Token": token },
        body: JSON.stringify({ meeting_id: link.dataset.meetingJoin }),
      }).then((r) => r.json()).then((d) => {
        if (d.counted) showToast("You're on your way to a Meeting Maker chip. It counts once the meeting starts.", { tone: "success" });
      }).catch(() => {});
    }, true);
  }
  try {
    const flash = JSON.parse(root.dataset.flash || "{}");
    for (const [type, message] of Object.entries(flash)) {
      if (typeof message !== "string" || !message) continue;
      showToast(message, { tone: type === "alert" || type === "error" ? "error" : "success" });
    }
  } catch {
    // no flash
  }
}
