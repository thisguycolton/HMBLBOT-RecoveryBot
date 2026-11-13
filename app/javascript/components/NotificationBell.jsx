import React, { useCallback, useEffect, useRef, useState } from "react";
import { Award, Bell, BellRing, CalendarClock, CheckCheck, ClipboardList, FileText, Gavel, Heart, HeartHandshake, MessageCircle, Settings, ShieldCheck, Sparkles, Trash2, UserPlus, Users, Vote, X } from "lucide-react";
import { clearToasts, showToast } from "../lib/toast";
import { setAppBadge } from "../lib/push";
import Sheet from "./shell/Sheet";
import { useMedia } from "./shell/useShell";

const POLL_MS = 60_000;
const SEEN_KEY = "hb-notifications-seen"; // newest notification id already toasted

function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
}

const send = (method, path) =>
  fetch(path, { method, headers: { "X-CSRF-Token": csrfToken() }, credentials: "same-origin" });
const post = (path) => send("POST", path);

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// The round icon beside each notification, by its kind of notification (Notification.push_category)
const LOOKS = {
  follows: [UserPlus, "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"],
  comments: [MessageCircle, "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"],
  mentions: [MessageCircle, "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"],
  profile_notes: [MessageCircle, "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"],
  document_comments: [FileText, "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"],
  reactions: [Heart, "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300"],
  host_reminders: [CalendarClock, "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"],
  host_schedule: [CalendarClock, "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"],
  sub_requests: [CalendarClock, "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"],
  events: [CalendarClock, "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"],
  business: [Gavel, "bg-slate-200 text-slate-700 dark:bg-slate-500/25 dark:text-slate-200"],
  schedule_polls: [Vote, "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"],
  groups: [Users, "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300"],
  chips: [Award, "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300"],
  sponsorship: [HeartHandshake, "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"],
  recovery_reminders: [Sparkles, "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"],
  site_admin: [ShieldCheck, "bg-slate-200 text-slate-700 dark:bg-slate-500/25 dark:text-slate-200"],
  admin_tasks: [ClipboardList, "bg-slate-200 text-slate-700 dark:bg-slate-500/25 dark:text-slate-200"],
};
const DEFAULT_LOOK = [Bell, "bg-blue-100 text-accent dark:bg-blue-500/20 dark:text-blue-300"];

// Today, Yesterday, This week, Earlier (newest first, as the server sends them)
function groupByDay(list) {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const day = 86_400_000;
  const label = (iso) => {
    const t = new Date(iso).getTime();
    if (t >= midnight.getTime()) return "Today";
    if (t >= midnight.getTime() - day) return "Yesterday";
    if (t >= midnight.getTime() - 6 * day) return "This week";
    return "Earlier";
  };
  const out = [];
  list.forEach((n) => {
    const l = label(n.created_at);
    if (out.length && out[out.length - 1][0] === l) out[out.length - 1][1].push(n);
    else out.push([l, [n]]);
  });
  return out;
}

// One notification: a card that opens its page, with an x to remove it
function Item({ n, onOpen, onRemove }) {
  const [Icon, tint] = LOOKS[n.category] || DEFAULT_LOOK;
  const inner = (
    <>
      <span className={`grid size-10 shrink-0 place-items-center rounded-full ${tint}`}><Icon size={18} /></span>
      <span className="min-w-0 flex-1 pr-6">
        <span className={`block text-sm leading-snug ${n.read ? "text-slate-700 dark:text-neutral-300" : "font-semibold text-slate-900 dark:text-white"}`}>{n.title}</span>
        {n.body && <span className="mt-0.5 block text-[13px] leading-snug text-slate-500 line-clamp-2 dark:text-neutral-400">{n.body}</span>}
        <span className={`mt-1 flex items-center gap-1.5 text-xs ${n.read ? "text-slate-400" : "font-medium text-accent"}`}>
          {!n.read && <span className="size-2 rounded-full bg-accent" aria-label="Unread" />}
          {timeAgo(n.created_at)}
        </span>
      </span>
    </>
  );
  const cls = `flex w-full items-start gap-3 rounded-2xl p-3 text-left shadow-sm transition-colors ${n.read ? "bg-white/70 hover:bg-white dark:bg-neutral-900/70 dark:hover:bg-neutral-900" : "bg-white ring-1 ring-accent/25 hover:bg-white dark:bg-neutral-900"}`;
  return (
    <li className="group relative">
      {n.url ? <a href={n.url} className={cls} onClick={() => onOpen(n)}>{inner}</a> : <button type="button" className={cls} onClick={() => onOpen(n)}>{inner}</button>}
      <button type="button" onClick={() => onRemove(n)} aria-label={`Remove “${n.title}”`} title="Remove"
        className="absolute right-2 top-2 grid size-7 place-items-center rounded-full !bg-transparent text-slate-400 hover:!bg-neutral-100 hover:text-slate-700 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 dark:hover:!bg-neutral-800 dark:hover:text-neutral-200">
        <X size={14} />
      </button>
    </li>
  );
}

// The account's notification center: a bell with the unread count and a panel of
// recent notifications. New ones also pop up as toasts, once each. On phones (or with
// `sheet`, as in the menu, where a drop-down would run off the bottom) the panel rises
// from the bottom of the screen instead of dropping down under the bell.
export default function NotificationBell({ align = "right", sheet = false }) {
  const [data, setData] = useState({ unread: 0, notifications: [] });
  const [open, setOpen] = useState(false);
  const phone = useMedia("(max-width: 639px)");
  const asSheet = sheet || phone;
  const ref = useRef(null);
  const [confirming, setConfirming] = useState(false);
  const confirmTimer = useRef(null);
  useEffect(() => { if (!open) setConfirming(false); }, [open]);
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
    if (!open || asSheet) return;
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDoc); window.removeEventListener("keydown", onKey); };
  }, [open, asSheet]);

  async function markRead(n) {
    if (n.read) return;
    setData((d) => ({ unread: Math.max(0, d.unread - 1), notifications: d.notifications.map((x) => (x.id === n.id ? { ...x, read: true } : x)) }));
    await post(`/api/notifications/${n.id}/read`).catch(() => {});
  }

  async function markAllRead() {
    setData((d) => ({ unread: 0, notifications: d.notifications.map((x) => ({ ...x, read: true })) }));
    await post("/api/notifications/read_all").catch(() => {});
  }

  async function remove(n) {
    setData((d) => ({ unread: Math.max(0, d.unread - (n.read ? 0 : 1)), notifications: d.notifications.filter((x) => x.id !== n.id) }));
    await send("DELETE", `/api/notifications/${n.id}`).catch(() => {});
  }

  // Asks once: the first tap turns the button red for a few seconds, a second tap clears
  async function clearAll() {
    if (!confirming) {
      setConfirming(true);
      clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirming(false), 3500);
      return;
    }
    clearTimeout(confirmTimer.current);
    setConfirming(false);
    setData({ unread: 0, notifications: [] });
    await send("DELETE", "/api/notifications/clear").catch(() => {});
  }

  const { unread, notifications } = data;
  const groups = groupByDay(notifications);
  const panel = (
    <>
      <div className="@container flex items-center gap-2 px-4 pb-3 pt-2 sm:pt-3">
        <h2 className="flex min-w-0 flex-1 items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
          Notifications
          {unread > 0 && <span className="shrink-0 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">{unread} new</span>}
        </h2>
        {unread > 0 && (
          <button type="button" onClick={markAllRead} title="Mark all read" aria-label="Mark all read"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full !bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:text-slate-900 dark:!bg-neutral-800 dark:text-neutral-200 dark:hover:text-white">
            <CheckCheck size={15} /> <span className="hidden @[27rem]:inline">Read all</span>
          </button>
        )}
        {notifications.length > 0 && (
          <button type="button" onClick={clearAll} aria-label={confirming ? "Tap again to clear all notifications" : "Clear all notifications"}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold shadow-sm transition-colors ${confirming ? "!bg-rose-600 text-white" : "!bg-white text-slate-700 hover:text-rose-600 dark:!bg-neutral-800 dark:text-neutral-200"}`}>
            <Trash2 size={15} /> {confirming ? "Tap again" : "Clear all"}
          </button>
        )}
      </div>
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center px-6 pb-10 pt-6 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-white text-accent shadow-sm dark:bg-neutral-800"><BellRing size={28} /></span>
          <p className="mt-4 text-base font-semibold text-slate-900 dark:text-white">You're all caught up</p>
          <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-neutral-400">Replies, new followers, group news and host reminders show up here.</p>
        </div>
      ) : (
        <div className={`overflow-y-auto overscroll-contain px-3 pb-3 ${asSheet ? "min-h-0 flex-1" : "max-h-[min(32rem,70vh)]"}`}>
          {groups.map(([day, items]) => (
            <section key={day} className="mb-3 last:mb-0">
              <h3 className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{day}</h3>
              <ul className="space-y-2">
                {items.map((n) => <Item key={n.id} n={n} onOpen={markRead} onRemove={remove} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
      <a href="/users/edit#notifications" onClick={() => setOpen(false)}
        className="flex shrink-0 items-center justify-center gap-1.5 border-t border-black/5 px-4 py-3 text-xs font-medium text-slate-500 hover:text-slate-800 dark:border-white/10 dark:text-neutral-400 dark:hover:text-white">
        <Settings size={14} /> Notification settings
      </a>
    </>
  );

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

      {open && !asSheet && (
        <div
          className={`absolute ${align === "left" ? "left-0" : "right-0"} z-50 mt-2 flex w-96 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-[1.75rem] border border-black/5 bg-[#ececec] !font-sans shadow-2xl dark:border-white/10 dark:bg-neutral-950`}
          role="dialog"
          aria-label="Notifications"
        >
          {panel}
        </div>
      )}
      <Sheet open={open && asSheet} onClose={() => setOpen(false)} side="bottom" label="Notifications" className={`pb-[env(safe-area-inset-bottom)] ${notifications.length ? "h-[85dvh]" : ""}`}>
        <span className="mx-auto mt-2.5 mb-1 block h-1.5 w-10 shrink-0 rounded-full bg-neutral-400/60 dark:bg-neutral-700" aria-hidden="true" />
        {panel}
      </Sheet>
    </div>
  );
}
