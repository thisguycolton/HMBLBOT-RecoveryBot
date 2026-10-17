// Toasts on every page. Both layouts mount this into #hb-toasts and pass the
// Rails flash ({ notice, alert }) in data-flash, so redirects' messages arrive as toasts.
import React from "react";
import { createRoot } from "react-dom/client";
import Toasts from "../components/Toasts";
import { showToast } from "../lib/toast";

const root = document.getElementById("hb-toasts");
if (root && !root.dataset.mounted) {
  root.dataset.mounted = "true";
  createRoot(root).render(<Toasts />);
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
