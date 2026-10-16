import { useEffect, useState } from "react";

// Site-wide notices from admins (SiteNotice, /api/site_notices). Toasts.jsx shows them
// above the ordinary toasts. They don't time out: closing one hides it in this browser
// for a day, and editing a notice brings it back (the dismissal is tied to its version).
const KEY = "hb-site-notices-dismissed"; // { [id]: { at: ms, version } }
const HIDE_MS = 24 * 60 * 60 * 1000;

function readDismissed() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function isDismissed(notice, dismissed) {
  const entry = dismissed[notice.id];
  return Boolean(entry && entry.version === notice.version && Date.now() - entry.at < HIDE_MS);
}

export function dismissNotice(notice) {
  const dismissed = readDismissed();
  // forget dismissals that have run their day out
  for (const [id, entry] of Object.entries(dismissed)) {
    if (!entry || Date.now() - entry.at >= HIDE_MS) delete dismissed[id];
  }
  dismissed[notice.id] = { at: Date.now(), version: notice.version };
  try {
    localStorage.setItem(KEY, JSON.stringify(dismissed));
  } catch {
    // private mode: it'll show again on the next page
  }
}

export function useSiteNotices() {
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    // the write-up page doesn't need its own toast on top of it
    const here = window.location.pathname;
    let alive = true;
    fetch("/api/site_notices", { headers: { Accept: "application/json" }, credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => {
        if (!alive || !Array.isArray(rows)) return;
        const dismissed = readDismissed();
        setNotices(rows.filter((n) => !isDismissed(n, dismissed) && n.url !== here));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const dismiss = (notice) => {
    dismissNotice(notice);
    setNotices((list) => list.filter((n) => n.id !== notice.id));
  };

  return [notices, dismiss];
}

const ICONS = {
  info: "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zm13-3a5 5 0 0 1 0 8",
  success: "M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z",
  warning: "M12 9v4m0 4h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
};

export function NoticeCard({ notice, onDismiss }) {
  const external = notice.url && /^https?:/i.test(notice.url);
  return (
    <div role="status" className={`hb-toast hb-toast--notice hb-toast--${notice.tone === "success" ? "success" : notice.tone === "warning" ? "warning" : "info"}`}>
      <span className="hb-toast__icon">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[notice.tone] || ICONS.info} /></svg>
        <span className="hb-sr-only">Notice</span>
      </span>
      <div className="hb-toast__message">
        <p className="hb-notice__title">{notice.title}</p>
        {notice.summary && <p className="hb-notice__summary">{notice.summary}</p>}
        {notice.url && (
          <a
            className="hb-notice__link"
            href={notice.url}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {notice.link_label} →
          </a>
        )}
      </div>
      <button type="button" aria-label="Dismiss for today" title="Hide for a day" className="hb-toast__close" onClick={() => onDismiss(notice)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}
