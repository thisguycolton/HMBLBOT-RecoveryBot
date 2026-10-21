import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { clearToasts, showToast } from "../lib/toast";
import { setAppBadge } from "../lib/push";

const POLL_MS = 60_000;
const SEEN_KEY = "hb-notifications-seen"; // newest notification id already toasted

function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
}

const post = (path) =>
  fetch(path, { method: "POST", headers: { "X-CSRF-Token": csrfToken() }, credentials: "same-origin" });

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// The account's notification center: a bell with the unread count and a panel of
// recent notifications. New ones also pop up as toasts, once each.
export default function NotificationBell({ align = "right" }) {
  const [data, setData] = useState({ unread: 0, notifications: [] });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => setAppBadge(data.unread), [data.unread]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { headers: { Accept: "application/json" }, credentials: "same-origin" });
      if (!res.ok) return;
      const next = await res.json();
      setData(next);

      let seen = 0;
      try { seen = Number(localStorage.getItem(SEEN_KEY)) || 0; } catch {}
      const fresh = next.notifications.filter((n) => !n.read && n.id > seen);
      fresh.slice(0, 3).reverse().forEach((n) => showToast(n.title, { tone: "info", href: n.url || undefined }));
      const newest = Math.max(seen, ...next.notifications.map((n) => n.id));
      try { localStorage.setItem(SEEN_KEY, String(newest)); } catch {}
    } catch {
      // offline or signed out; try again on the next poll
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => !document.hidden && load(), POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDoc); window.removeEventListener("keydown", onKey); };
  }, [open]);

  async function markRead(n) {
    if (n.read) return;
    setData((d) => ({ unread: Math.max(0, d.unread - 1), notifications: d.notifications.map((x) => (x.id === n.id ? { ...x, read: true } : x)) }));
    await post(`/api/notifications/${n.id}/read`).catch(() => {});
  }

  async function markAllRead() {
    setData((d) => ({ unread: 0, notifications: d.notifications.map((x) => ({ ...x, read: true })) }));
    await post("/api/notifications/read_all").catch(() => {});
  }

  const { unread, notifications } = data;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { clearToasts(); setOpen((v) => !v); }}
        className="relative inline-flex items-center justify-center rounded-md p-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-red-600 text-white text-[0.65rem] font-bold leading-[1.1rem] text-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute ${align === "left" ? "left-0" : "right-0"} z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-neutral-900`}
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">Nothing yet.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.map((n) => {
                const body = (
                  <>
                    <span className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />}
                      <span className={`flex-1 text-sm ${n.read ? "text-slate-600 dark:text-slate-400" : "font-semibold text-slate-900 dark:text-white"}`}>{n.title}</span>
                    </span>
                    {n.body && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{n.body}</span>}
                    <span className="mt-0.5 block text-xs text-slate-400">{timeAgo(n.created_at)}</span>
                  </>
                );
                const cls = "block px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60";
                return (
                  <li key={n.id}>
                    {n.url ? (
                      <a href={n.url} className={cls} onClick={() => markRead(n)}>{body}</a>
                    ) : (
                      <button type="button" className={`${cls} w-full text-left`} onClick={() => markRead(n)}>{body}</button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
