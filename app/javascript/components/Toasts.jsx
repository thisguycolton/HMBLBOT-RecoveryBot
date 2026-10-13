import React from "react";
import { dismissToast, useToasts } from "../lib/toast";
import "../styles/toasts.css";

// A card with a tinted icon, the message and a close button (ported from metr).
const ICONS = {
  success: { path: "M5 13l4 4L19 7", label: "Done" },
  info: { path: "M12 8h.01M11 12h1v5h1", label: "Info" },
  warning: { path: "M12 8v5m0 3h.01", label: "Heads up" },
  error: { path: "M8 8l8 8M16 8l-8 8", label: "Problem" },
};

function ToastCard({ toast }) {
  const icon = ICONS[toast.tone] || ICONS.info;
  return (
    <div role={toast.tone === "error" ? "alert" : "status"} className={`hb-toast hb-toast--${toast.tone}`}>
      <span className="hb-toast__icon">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={icon.path} /></svg>
        <span className="hb-sr-only">{icon.label}</span>
      </span>
      <div className="hb-toast__message">
        {toast.href ? <a href={toast.href} onClick={() => dismissToast(toast.id)}>{toast.message}</a> : toast.message}
      </div>
      <button type="button" aria-label="Close" className="hb-toast__close" onClick={() => dismissToast(toast.id)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}

// Top center on phones (under the nav), top right on wider screens
export default function Toasts() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div aria-live="polite" className="hb-toasts">
      {toasts.map((toast) => <ToastCard key={toast.id} toast={toast} />)}
    </div>
  );
}
