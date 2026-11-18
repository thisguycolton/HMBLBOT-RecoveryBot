import React, { useState } from "react";
import { Bell, BellOff, BellRing, AtSign, X } from "lucide-react";
import Dialog from "./Dialog";
import { api } from "../lib";
import { showToast } from "../../../lib/toast";

// How much of a group's chat notifies someone (ChatNotificationSetting): every message, only @
// mentions and replies (what everyone starts with), or nothing. For the whole group, and for each
// channel, which wins over the group's.
export const LEVELS = [
  { key: "all", label: "All messages", icon: BellRing, text: "A notification for every new message." },
  { key: "mentions", label: "@ mentions", icon: AtSign, text: "Only when someone @ mentions you or a role you hold, or replies to you." },
  { key: "none", label: "None", icon: BellOff, text: "No notifications, not even for mentions. Unread counts still show here." },
];
const labelOf = (key) => LEVELS.find((l) => l.key === key)?.label;

// The level a channel has for them: its own, or the group's
export const levelIn = (chat, channel) => chat.notify?.channels?.[channel.id] || chat.notify?.group || "mentions";

// A little bell beside a channel whose notifications aren't the usual @ mentions
export function LevelMark({ chat, channel }) {
  const level = levelIn(chat, channel);
  if (level === "all") return <BellRing className="size-3.5 shrink-0 opacity-70" aria-label="Notifies you of every message" />;
  if (level === "none") return <BellOff className="size-3.5 shrink-0 opacity-60" aria-label="Notifications off" />;
  return null;
}

// Picking the level for a channel (`channel`) or the whole group's chat (no channel). A channel can
// also go back to following the group. It saves as soon as one is picked.
export function NotifyDialog({ chat, slug, channel = null, onSaved, onClose, onGroup }) {
  const own = channel ? chat.notify?.channels?.[channel.id] || "" : chat.notify?.group || "mentions";
  const [saving, setSaving] = useState(null);
  const pick = async (level) => {
    if (saving) return;
    setSaving(level);
    try {
      const data = await api(`/groups/${slug}/chat/notifications`, { method: "PATCH", body: { level, channel_id: channel?.id } });
      onSaved(data);
      const now = channel ? levelIn(data, channel) : data.notify.group;
      showToast(`${channel ? `#${channel.name}` : "Group chat"}: ${labelOf(now)}${channel && !level ? " (same as the group)" : ""}.`);
      onClose();
    } catch (e) {
      showToast(e.message, { tone: "error" });
      setSaving(null);
    }
  };
  const option = (key, label, text, Icon) => {
    const checked = own === key;
    return (
      <button key={key || "group"} type="button" role="radio" aria-checked={checked} onClick={() => pick(key)} disabled={!!saving}
        className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left ring-1 transition ${checked ? "!bg-accent/5 ring-2 ring-accent" : "!bg-white ring-neutral-200 hover:ring-neutral-300 dark:!bg-neutral-900 dark:ring-neutral-700 dark:hover:ring-neutral-600"}`}>
        <span className={`mt-0.5 inline-grid size-8 shrink-0 place-items-center rounded-full ${checked ? "bg-accent text-white" : "bg-neutral-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"}`}><Icon className="size-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900 dark:text-white">{label}</span>
          <span className="block text-xs text-slate-500 dark:text-neutral-400">{text}</span>
        </span>
        {saving === key && <span className="mt-1 text-xs text-slate-400">Saving…</span>}
      </button>
    );
  };
  return (
    <Dialog title={channel ? "Channel Notifications" : "Group chat notifications"} onClose={onClose}>
      <p className="mb-3 text-slate-500 dark:text-neutral-400">
        {channel ? <>What notifies you in <strong className="text-slate-800 dark:text-neutral-100">#{channel.name}</strong>, in the bell and on your devices.</>
          : <>What notifies you in every channel of {chat.group.title} you haven't set on its own.</>}
      </p>
      <div role="radiogroup" className="space-y-2">
        {channel && option("", "Same as the group", `Use your group chat setting: ${labelOf(chat.notify?.group || "mentions")}.`, Bell)}
        {LEVELS.map((l) => option(l.key, l.label, l.text, l.icon))}
      </div>
      {channel && onGroup && (
        <button type="button" onClick={onGroup} className="mt-3 !bg-transparent text-xs font-semibold text-accent hover:underline">Change it for the whole group chat instead</button>
      )}
    </Dialog>
  );
}

// Once, in the chat where the newest message would be: chat only notifies on mentions and
// replies, and here's how to change that. Closing it (or opening a setting) puts it away for good.
export function NotifyNudge({ channel, onChannel, onGroup, onDismiss }) {
  return (
    <div role="status" className="mx-2 mb-1 flex items-start gap-3 rounded-2xl bg-accent/[0.07] px-4 py-3 text-sm ring-1 ring-accent/25 sm:mx-4">
      <Bell className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900 dark:text-white">Chat only notifies you when you're @ mentioned or replied to.</p>
        <p className="mt-0.5 text-xs text-slate-600 dark:text-neutral-300">
          Want every message, or none? You can change it any time from the ••• beside a channel.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={onChannel} className="rounded-full !bg-accent px-3 py-1.5 text-xs font-semibold !text-white">Set for #{channel.name}</button>
          <button type="button" onClick={onGroup} className="rounded-full !bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-neutral-200 dark:!bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700">Set for the whole group</button>
        </div>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Got it, hide this"
        className="-mr-1 -mt-1 inline-grid size-8 shrink-0 place-items-center rounded-full !bg-transparent text-slate-500 hover:!bg-black/5 dark:text-neutral-400 dark:hover:!bg-white/10"><X className="size-4" /></button>
    </div>
  );
}
