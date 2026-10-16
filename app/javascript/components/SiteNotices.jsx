import React, { useEffect, useRef, useState } from "react";
import Markdown from "./book/Markdown";

// Site-wide notices from admins (SiteNotice, /api/site_notices). Toasts.jsx shows them
// above the ordinary toasts. They don't time out: closing one hides it in this browser
// for a day, and editing a notice brings it back (the dismissal is tied to its version).
// A notice with a write-up opens it in a modal (NoticeModal). Plain CSS (toasts.css), since
// this also mounts on the older Bootstrap pages that don't load Tailwind.
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
    let alive = true;
    fetch("/api/site_notices", { headers: { Accept: "application/json" }, credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => {
        if (!alive || !Array.isArray(rows)) return;
        const dismissed = readDismissed();
        setNotices(rows.filter((n) => !isDismissed(n, dismissed)));
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

const isExternal = (url) => /^https?:/i.test(url || "");
const linkProps = (url) => (isExternal(url) ? { target: "_blank", rel: "noopener noreferrer" } : {});
const toneClass = (tone) => (tone === "success" || tone === "warning" ? tone : "info");

// onOpen(notice) shows the write-up; without one the toast links straight to the admin's link
export function NoticeCard({ notice, onDismiss, onOpen }) {
  return (
    <div role="status" className={`hb-toast hb-toast--notice hb-toast--${toneClass(notice.tone)}`}>
      <span className="hb-toast__icon">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[notice.tone] || ICONS.info} /></svg>
        <span className="hb-sr-only">Notice</span>
      </span>
      <div className="hb-toast__message">
        <p className="hb-notice__title">{notice.title}</p>
        {notice.summary && <p className="hb-notice__summary">{notice.summary}</p>}
        {notice.body ? (
          <button type="button" className="hb-notice__link" onClick={() => onOpen?.(notice)}>
            Read more →
          </button>
        ) : notice.link_url ? (
          <a className="hb-notice__link" href={notice.link_url} {...linkProps(notice.link_url)}>
            {notice.link_label || "Open"} →
          </a>
        ) : null}
      </div>
      <button type="button" aria-label="Dismiss for today" title="Hide for a day" className="hb-toast__close" onClick={() => onDismiss(notice)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}

// The write-up: headline band in the notice's tone, the Markdown body, the admin's link as
// a button, and "Got it" to close it and hide the toast for a day
export function NoticeModal({ notice, onClose, onDismiss }) {
  const closeRef = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  const published = notice.published_at
    ? new Date(notice.published_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="hb-notice-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={`hb-notice-${notice.id}`} className={`hb-notice-modal__panel hb-notice-modal--${toneClass(notice.tone)}`}>
        <header className="hb-notice-modal__head">
          <div className="hb-notice-modal__meta">Notice{published && ` · ${published}`}</div>
          <h2 id={`hb-notice-${notice.id}`} className="hb-notice-modal__title">{notice.title}</h2>
          {notice.summary && <div className="hb-notice-modal__summary">{notice.summary}</div>}
          <button ref={closeRef} type="button" aria-label="Close" className="hb-notice-modal__close" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <div className="hb-notice-modal__body">
          <Markdown source={notice.body || ""} />
        </div>
        <footer className="hb-notice-modal__foot">
          {notice.link_url && (
            <a className="hb-notice-modal__button hb-notice-modal__button--primary" href={notice.link_url} {...linkProps(notice.link_url)}>
              {notice.link_label || "Open"} →
            </a>
          )}
          {onDismiss && (
            <button type="button" className="hb-notice-modal__button" onClick={() => { onDismiss(notice); onClose(); }}>
              Got it
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
