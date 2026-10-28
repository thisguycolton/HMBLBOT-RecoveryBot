// Toasts on every page. Both layouts mount this into #hb-toasts and pass the
// Rails flash ({ notice, alert }) in data-flash, so redirects' messages arrive as toasts.
// A signed-in member with a sobriety date gets their day count too (DayCount).
import React from "react";
import { createRoot } from "react-dom/client";
import DayCount from "../components/DayCount";
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
    </>,
  );
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
