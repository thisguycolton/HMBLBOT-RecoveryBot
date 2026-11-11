import React, { useEffect, useRef, useState } from "react";
import { swipeToDismiss } from "../lib/swipe";
import { dismissToast, useToasts } from "../lib/toast";
import { NoticeCard, NoticeModal, useSiteNotices } from "./SiteNotices";
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

// On phones a toast or notice can be swiped away, sideways or up, the way a phone's own
// notifications are; the drag carries it along and lets go of it past a third of its width
function SwipeAway({ onDismiss, children }) {
  const ref = useRef(null);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => swipeToDismiss(ref.current, {
    directions: ["left", "right", "up"],
    targets: () => [ref.current],
    flyOut: true,
    fade: true,
    onDismiss: () => dismiss.current(),
  }), []);
  return <div ref={ref} className="hb-toast-swipe">{children}</div>;
}

// Top center on phones (under the nav), top right on wider screens. Admins' site
// notices sit on top and stay until dismissed.
export default function Toasts() {
  const toasts = useToasts();
  const [notices, dismissNotice] = useSiteNotices();
  const [reading, setReading] = useState(null); // the notice whose write-up is open
  if (toasts.length === 0 && notices.length === 0 && !reading) return null;
  return (
    <>
      <div aria-live="polite" className="hb-toasts">
        {notices.map((notice) => (
          <SwipeAway key={`n${notice.id}`} onDismiss={() => dismissNotice(notice)}>
            <NoticeCard notice={notice} onDismiss={dismissNotice} onOpen={setReading} />
          </SwipeAway>
        ))}
        {toasts.map((toast) => (
          <SwipeAway key={toast.id} onDismiss={() => dismissToast(toast.id)}>
            <ToastCard toast={toast} />
          </SwipeAway>
        ))}
      </div>
      {reading && <NoticeModal notice={reading} onClose={() => setReading(null)} onDismiss={dismissNotice} />}
    </>
  );
}
