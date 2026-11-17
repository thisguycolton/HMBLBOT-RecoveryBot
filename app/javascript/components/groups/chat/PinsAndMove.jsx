import React, { useState } from "react";
import { ArrowRightLeft, Hash, Lock, Pin, PinOff, X } from "lucide-react";
import Markdown from "../../book/Markdown";
import Avatar from "../Avatar";
import { api } from "../lib";
import { showToast } from "../../../lib/toast";
import { ErrorNote, primaryButton, quietButton } from "../ui";
import Dialog from "./Dialog";

// A message's start as plain words, for a reply's quote and the reply box
export const excerptOf = (text) => text.replace(/[*_`~>#]+/g, "").replace(/\s+/g, " ").trim();

// The messages pinned in a channel, the newest pin first: over the conversation, from the pin
// in its header. Picking one goes to it; whoever may pin takes pins off here too.
export function PinnedPanel({ channel, pins, me, onJump, onUnpin, onClose }) {
  return (
    <div role="dialog" aria-label={`Pinned in #${channel.name}`}
      className="absolute inset-x-0 top-0 z-[5] flex max-h-full flex-col overflow-hidden border-b border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900 sm:inset-x-auto sm:right-3 sm:top-2 sm:max-h-[70%] sm:w-[26rem] sm:rounded-2xl sm:border-0 sm:ring-1 sm:ring-neutral-200 dark:sm:ring-neutral-700">
      <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-2.5 dark:border-neutral-800">
        <Pin className="size-4 text-slate-500" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900 dark:text-white">Pinned in #{channel.name}</h2>
        <button type="button" onClick={onClose} aria-label="Close pinned messages"
          className="inline-grid size-8 place-items-center rounded-full !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:text-neutral-400 dark:hover:!bg-neutral-800"><X className="size-4" /></button>
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-neutral-100 overflow-y-auto overscroll-contain dark:divide-neutral-800">
        {pins.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500 dark:text-neutral-400">Nothing is pinned here yet.</li>}
        {pins.map((m) => (
          <li key={m.id} className="relative">
            {/* Not a button: what's pinned can hold links */}
            <div role="button" tabIndex={0} aria-label={`Go to ${m.author.name}'s message`}
              onClick={(e) => { if (!e.target.closest("a")) onJump(m.id); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onJump(m.id); } }}
              className="flex w-full cursor-pointer gap-2.5 px-4 py-3 pr-12 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
              <Avatar person={m.author} size={28} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2 text-sm">
                  <span className="truncate font-semibold text-slate-900 dark:text-white">{m.author.name}</span>
                  <time dateTime={m.created_at} className="shrink-0 text-xs text-slate-500 dark:text-neutral-400">{new Date(m.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}</time>
                </span>
                {m.blocked ? (
                  <span className="block text-xs text-slate-400">A message from someone you blocked</span>
                ) : (
                  <span className="chat-body line-clamp-4 block text-sm text-slate-700 dark:text-neutral-200">
                    {m.body ? <Markdown source={m.body} mentions={m.mentions} me={me} mine={m.mentions_me} className="text-sm leading-snug" /> : <span className="text-slate-500">{m.files?.length || 0} {m.files?.length === 1 ? "file" : "files"}</span>}
                  </span>
                )}
                {m.pinned?.by && <span className="mt-0.5 block text-[0.7rem] text-slate-400">Pinned by {m.pinned.by}</span>}
              </span>
            </div>
            {m.can_pin && (
              <button type="button" onClick={() => onUnpin(m)} aria-label="Unpin" title="Unpin"
                className="absolute right-3 top-3 inline-grid size-8 place-items-center rounded-lg !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:text-neutral-400 dark:hover:!bg-neutral-800"><PinOff className="size-4" /></button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// An admin moving a message that went in the wrong channel to the right one, with the replies
// under it (Api::GroupChatMessagesController#move)
export function MoveDialog({ chat, channel, message, slug, onClose, onMoved }) {
  const choices = chat.channels.filter((c) => !c.archived && c.id !== channel.id);
  const [to, setTo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const target = choices.find((c) => c.id === to);

  const move = async () => {
    setSaving(true);
    setError(null);
    try {
      const moved = await api(`/groups/${slug}/chat_messages/${message.id}/move`, { method: "POST", body: { channel_id: to } });
      const replies = moved.moved - 1;
      showToast(`Moved ${replies > 0 ? `it and ${replies} ${replies === 1 ? "reply" : "replies"}` : "it"} to #${target.name}.`,
        { tone: "success", href: `/groups/${slug}/messages/${to}?m=${message.id}` });
      onMoved(moved);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <Dialog title="Move to another channel" onClose={onClose}
      footer={(
        <>
          <span className="flex-1" />
          <button type="button" className={quietButton} onClick={onClose}>Cancel</button>
          <button type="button" className={primaryButton} onClick={move} disabled={saving || !target}>
            <ArrowRightLeft className="size-4" /> {saving ? "Moving…" : target ? `Move to #${target.name}` : "Move"}
          </button>
        </>
      )}>
      <blockquote className="mb-3 rounded-xl bg-neutral-100 px-3 py-2 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">
        <span className="font-semibold text-slate-900 dark:text-white">{message.author.name}:</span> {excerptOf(message.body).slice(0, 200) || (message.files?.length ? `${message.files.length} ${message.files.length === 1 ? "file" : "files"}` : "")}
      </blockquote>
      <p className="mb-3 !font-sans text-slate-600 dark:text-neutral-300">
        Replies to it go along. It shows in the new channel where it falls by time, marked as moved from #{channel.name}; people who aren't in that channel won't see it anymore.
      </p>
      {choices.length === 0 ? (
        <p className="!font-sans text-slate-500">There's no other open channel to move it to.</p>
      ) : (
        <ul className="space-y-1" role="radiogroup" aria-label="Channel">
          {choices.map((c) => (
            <li key={c.id}>
              <label className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 ring-1 ${to === c.id ? "bg-accent/10 font-semibold text-accent ring-accent" : "ring-neutral-200 hover:bg-neutral-50 dark:ring-neutral-700 dark:hover:bg-neutral-800"}`}>
                <input type="radio" name="move-to" className="sr-only" checked={to === c.id} onChange={() => setTo(c.id)} />
                {c.access_roles.includes("members") ? <Hash className="size-4 shrink-0" aria-hidden="true" /> : <Lock className="size-3.5 shrink-0" aria-label="Not everyone" />}
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2"><ErrorNote error={error} /></div>
    </Dialog>
  );
}
