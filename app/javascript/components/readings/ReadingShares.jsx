import React, { useEffect, useState } from "react";
import { Check, Flag, HandHeart, Heart, MessageCircleHeart, MoreHorizontal, Pencil, Reply, ThumbsUp, Trash2, UserRound, VolumeX, X } from "lucide-react";
import { api } from "../groups/lib";
import Avatar from "../groups/Avatar";
import ReportDialog from "../groups/chat/ReportDialog";
import { showToast } from "../../lib/toast";

// The Shares section under a reading (ReadingShare, Api::ReadingSharesController): members say
// what the reading brought up for them, under their name or as "A member". Each share waits
// for the reading's poster (or its group's admins) to approve it. Signed-in members only; the
// reading page leaves it out for visitors and on the hosting screen.
//
// Anonymity: an anonymous share comes from the server without its writer, so there is nothing
// here to leak. The writer's own shares say "(you)" from `mine`.

const IDENTITY_KEY = "hb-share-identity";
const MAX = 2000;

function rememberedAnonymous() {
  try {
    return localStorage.getItem(IDENTITY_KEY) !== "name";
  } catch {
    return true;
  }
}

function rememberAnonymous(anonymous) {
  try {
    localStorage.setItem(IDENTITY_KEY, anonymous ? "anonymous" : "name");
  } catch {
    /* private mode: just don't remember */
  }
}

// A rough time ("Today", "Yesterday", "Tuesday", "Nov 3"): an exact minute can point at who
// just left a meeting
export function roughDay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(d)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export default function ReadingShares({ readingId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = () => api(`/readings/${readingId}/shares`).then(setData).catch(setError);
  useEffect(() => {
    let live = true;
    api(`/readings/${readingId}/shares`)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e));
    return () => { live = false; };
  }, [readingId]);

  // Arriving from a notification (#share-12): bring that share into view once it's drawn
  useEffect(() => {
    if (!data) return;
    const id = window.location.hash.match(/^#share-(\d+)$/)?.[1];
    if (id) document.getElementById(`share-${id}`)?.scrollIntoView({ block: "center" });
  }, [!!data]);

  // Not open to them here (a group's reading they aren't in, profiles not open yet): no section
  if (error || !data) return null;

  const shares = data.shares || [];
  const myName = data.my_name;
  const replace = (s) => setData((d) => ({ ...d, shares: d.shares.map((x) => (x.id === s.id ? s : x)), pending: countPending(d.shares.map((x) => (x.id === s.id ? s : x)), d) }));
  const remove = (id) => setData((d) => ({ ...d, shares: d.shares.filter((x) => x.id !== id), pending: countPending(d.shares.filter((x) => x.id !== id), d) }));
  const add = (s) => setData((d) => ({ ...d, shares: [...d.shares, s], pending: countPending([...d.shares, s], d) }));

  const toggleOff = async () => {
    try {
      setData(await api(`/readings/${readingId}/shares/setting`, { method: "PATCH", body: { shares_off: !data.shares_off } }));
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  };

  const unmuteAll = async () => {
    try {
      setData(await api(`/readings/${readingId}/shares/mutes`, { method: "DELETE" }));
      showToast("Everyone's shares show again.");
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  };

  const top = shares.filter((s) => !s.parent_id);
  const repliesTo = (id) => shares.filter((s) => s.parent_id === id);
  const shown = top.length;
  const ctx = { readingId, myName, grapevine: data.grapevine, canModerate: data.can_moderate, canShare: data.can_share, onAdd: add, onMuted: load };
  return (
    <section id="shares" className="mt-10 scroll-mt-24 rounded-2xl border border-stone-200 bg-white px-3 py-5 !font-sans dark:border-neutral-700 dark:bg-neutral-800/60 sm:px-5 sm:py-6 md:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-bold ttSans">
          Shares{shown > 0 && <span className="ml-2 text-lg font-semibold text-neutral-400">{shown}</span>}
        </h2>
        {data.can_moderate && (
          <button type="button" onClick={toggleOff} className="!bg-transparent text-sm font-medium text-sky-700 hover:underline dark:text-sky-300">
            {data.shares_off ? "Turn shares on" : "Turn shares off"}
          </button>
        )}
      </div>
      <p className="mt-1 text-neutral-600 dark:text-neutral-400">
        What came up for you? Shares stay with members{data.group ? ` of ${data.group}` : ""}, never the public.
      </p>
      {data.can_moderate && data.pending > 0 && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          {data.pending === 1 ? "1 share is" : `${data.pending} shares are`} waiting for your approval. You see them as members do: anonymous ones stay anonymous to you too.
        </p>
      )}

      {shown > 0 && (
        <ul className="mt-5 space-y-3">
          {top.map((s) => (
            <Share key={s.id} share={s} ctx={ctx} onChange={replace} onRemove={() => remove(s.id)}
              replies={repliesTo(s.id)} onReplyChange={replace} onReplyRemove={remove} />
          ))}
        </ul>
      )}

      {data.muted > 0 && (
        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
          You've muted {data.muted === 1 ? "someone's shares" : `${data.muted} people's shares`}.{" "}
          <button type="button" onClick={unmuteAll} className="!bg-transparent p-0 font-medium text-sky-700 hover:underline dark:text-sky-300">Unmute all</button>
        </p>
      )}

      {data.can_share ? (
        <div className="mt-6 border-t border-stone-200 pt-5 dark:border-neutral-700">
          <Composer ctx={ctx} />
        </div>
      ) : (
        <p className="mt-5 text-sm text-neutral-500 dark:text-neutral-400">
          {data.suspended ? "You can't share on readings right now. A site admin paused it after a report." : "Shares are off for this reading."}
        </p>
      )}
    </section>
  );
}

function countPending(list, d) {
  return d.can_moderate ? list.filter((s) => s.status === "pending").length : d.pending;
}

// "Share as": A member or their own name
function IdentityPicker({ anonymous, onChange, myName }) {
  const pill = (on) =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition ${on
      ? "!bg-sky-600 !text-white"
      : "!bg-stone-100 text-slate-700 hover:!bg-stone-200 dark:!bg-neutral-700 dark:text-neutral-200 dark:hover:!bg-neutral-600"}`;
  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Share as">
      <span className="text-sm text-neutral-500 dark:text-neutral-400">Share as</span>
      <button type="button" role="radio" aria-checked={anonymous} className={pill(anonymous)} onClick={() => onChange(true)}>
        <UserRound size={14} /> A member
      </button>
      <button type="button" role="radio" aria-checked={!anonymous} className={pill(!anonymous)} onClick={() => onChange(false)}>
        {myName || "My name"}
      </button>
    </div>
  );
}

// Writing a share, or a reply to one (`parentId`): the words, who it's from, and for a share
// under their own name, "Also post to my timeline"
function Composer({ ctx, parentId = null, onCancel = null }) {
  const { readingId, myName, grapevine, canModerate, onAdd } = ctx;
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(rememberedAnonymous);
  const [alsoTimeline, setAlsoTimeline] = useState(false);
  const [saving, setSaving] = useState(false);
  const reply = !!parentId;

  const pick = (value) => { setAnonymous(value); rememberAnonymous(value); };

  const post = async (e) => {
    e.preventDefault();
    if (!body.trim() || saving) return;
    setSaving(true);
    try {
      const share = await api(`/readings/${readingId}/shares`, {
        method: "POST",
        body: { share: { body, anonymous, parent_id: parentId, also_timeline: !reply && !anonymous && alsoTimeline } },
      });
      setBody("");
      onAdd(share);
      if (share.status === "pending") showToast(`Thanks. Your ${reply ? "reply" : "share"} shows to others once the reading's poster approves it.`);
      onCancel?.();
    } catch (err) {
      showToast(err.message || "Couldn't post that.", { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={post} className={`space-y-3 ${reply ? "mt-3" : ""}`}>
      <label className="block">
        <span className="sr-only">{reply ? "Your reply" : "Your share"}</span>
        <textarea rows={reply ? 2 : 4} maxLength={MAX} value={body} onChange={(e) => setBody(e.target.value)} autoFocus={reply}
          placeholder={reply ? "Write a reply…" : grapevine ? "Share your experience. Please don't copy the story's text." : "Share your experience, strength and hope…"}
          className="w-full rounded-xl border-0 bg-stone-100 px-4 py-3 text-base text-slate-900 ring-1 ring-stone-200 placeholder:text-neutral-400 focus:ring-2 focus:ring-sky-500 dark:bg-neutral-900 dark:text-white dark:ring-neutral-700" />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <IdentityPicker anonymous={anonymous} onChange={pick} myName={myName} />
        <div className="ml-auto flex items-center gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-xl !bg-transparent px-3 py-2 text-sm font-semibold text-slate-700 hover:!bg-stone-200 dark:text-neutral-200 dark:hover:!bg-neutral-700">Cancel</button>
          )}
          <button type="submit" disabled={saving || !body.trim()}
            className={`inline-flex items-center gap-2 rounded-xl !bg-sky-600 font-semibold !text-white hover:!bg-sky-500 disabled:opacity-50 ${reply ? "px-4 py-2 text-sm" : "px-5 py-2.5"}`}>
            {reply ? <Reply size={16} /> : <MessageCircleHeart size={18} />} {saving ? "Posting…" : reply ? "Reply" : "Share"}
          </button>
        </div>
      </div>
      {!reply && !anonymous && (
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-200">
          <input type="checkbox" checked={alsoTimeline} onChange={(e) => setAlsoTimeline(e.target.checked)} />
          Also post to my timeline, for the people who see my notes
        </label>
      )}
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {anonymous
          ? "Your name stays hidden from everyone, moderators included. People who know you may still recognize your story."
          : "Your name and picture show with it."}
        {canModerate ? "" : ` The reading's poster approves ${reply ? "replies" : "shares"} before others see them.`}
      </p>
    </form>
  );
}

const REACTIONS = [
  { value: "like", label: "Like", icon: ThumbsUp },
  { value: "love", label: "Love", icon: Heart },
  { value: "hugs", label: "Hugs", icon: HandHeart },
];

// Like, Love or Hugs with how many, never who
function Reactions({ share: s, onChange }) {
  const [busy, setBusy] = useState(false);
  const react = async (kind) => {
    if (busy) return;
    setBusy(true);
    try {
      const mine = s.my_reaction === kind;
      onChange(await api(`/reading_shares/${s.id}/reaction`, mine ? { method: "DELETE" } : { method: "PUT", body: { kind } }));
    } catch (e) {
      showToast(e.message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-1">
      {REACTIONS.map(({ value, label, icon: Icon }) => {
        const count = s.reactions?.[value] || 0;
        const mine = s.my_reaction === value;
        return (
          <button key={value} type="button" onClick={() => react(value)} aria-pressed={mine} title={label} aria-label={`${label}${count ? `, ${count}` : ""}`}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${mine ? "!bg-sky-100 text-sky-800 dark:!bg-sky-500/20 dark:text-sky-200" : "!bg-transparent text-neutral-500 hover:!bg-stone-200 dark:text-neutral-400 dark:hover:!bg-neutral-700"}`}>
            <Icon size={14} fill={mine && value !== "hugs" ? "currentColor" : "none"} aria-hidden="true" />
            {count > 0 && count}
          </button>
        );
      })}
    </div>
  );
}

function Share({ share: s, ctx, onChange, onRemove, replies = null, onReplyChange, onReplyRemove }) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [declining, setDeclining] = useState(false);

  const call = async (path, opts, done) => {
    setMenu(false);
    try {
      const res = await api(path, opts);
      if (res) onChange(res);
      if (done) showToast(done);
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  };

  const destroy = async () => {
    setMenu(false);
    if (!window.confirm(isReply ? "Delete this reply?" : "Delete this share? Its replies go too.")) return;
    try {
      await api(`/reading_shares/${s.id}`, { method: "DELETE" });
      onRemove();
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  };

  const mute = async () => {
    setMenu(false);
    if (!window.confirm(`Mute ${s.anonymous ? "this person" : s.name}? You won't see their shares or replies on any reading, named or anonymous. They aren't told.`)) return;
    try {
      await api(`/reading_shares/${s.id}/mute`, { method: "POST" });
      showToast("Muted. Unmute from the bottom of Shares.");
      ctx.onMuted();
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  };

  const isReply = !!s.parent_id;
  const what = isReply ? "reply" : "share";
  const name = s.mine ? `${s.anonymous ? "A member" : s.name} (you)` : s.name;
  const status = s.status === "pending" ? "Waiting for approval" : s.status === "declined" ? "Not approved" : null;

  return (
    <li id={`share-${s.id}`} className={`scroll-mt-24 rounded-xl ${isReply ? "px-2.5 py-2 sm:px-3" : "px-3 py-3 sm:px-4"} ${s.status === "pending" ? "bg-amber-50/70 ring-1 ring-amber-200 dark:bg-amber-500/5 dark:ring-amber-500/30" : s.status === "declined" ? "bg-stone-50 opacity-80 ring-1 ring-stone-200 dark:bg-neutral-900 dark:ring-neutral-700" : "bg-stone-50 dark:bg-neutral-900/60"}`}>
      <div className="flex items-start gap-2.5 sm:gap-3">
        {s.author ? (
          <a href={`/people/${s.author.username}`} className="shrink-0"><Avatar person={s.author} size={isReply ? 28 : 36} /></a>
        ) : (
          <span className={`flex ${isReply ? "size-7" : "size-9"} shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-500 dark:bg-neutral-700 dark:text-neutral-300`} aria-hidden="true">
            <UserRound size={isReply ? 14 : 18} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2 text-sm">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 pt-1">
            {s.author ? (
              <a href={`/people/${s.author.username}`} className="!font-semibold !text-slate-900 hover:underline dark:!text-white">{name}</a>
            ) : (
              <span className="font-semibold text-slate-900 dark:text-white">{name}</span>
            )}
            <span className="text-neutral-500 dark:text-neutral-400">{roughDay(s.created_at)}{s.edited ? " · edited" : ""}</span>
            {status && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.status === "pending" ? "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200" : "bg-stone-200 text-stone-700 dark:bg-neutral-700 dark:text-neutral-200"}`}>{status}</span>
            )}
            </div>
            <div className="relative shrink-0">
              <button type="button" onClick={() => setMenu((m) => !m)} aria-label="Share options" aria-expanded={menu}
                className="rounded-full !bg-transparent p-1 text-neutral-500 hover:!bg-stone-200 dark:hover:!bg-neutral-700">
                <MoreHorizontal size={18} />
              </button>
              {menu && (
                <ShareMenu share={s} onClose={() => setMenu(false)}
                  onEdit={() => { setMenu(false); setEditing(true); }}
                  onToggleName={() => call(`/reading_shares/${s.id}`, { method: "PATCH", body: { share: { anonymous: !s.anonymous } } }, s.anonymous ? `Your name shows on this ${what} now.` : `This ${what} says “A member” now.`)}
                  onDelete={destroy}
                  onReport={() => { setMenu(false); setReporting(true); }}
                  onDecline={() => { setMenu(false); setDeclining(true); }}
                  onMute={mute} />
              )}
            </div>
          </div>
          {editing ? (
            <EditBox share={s} onSaved={(x) => { onChange(x); setEditing(false); }} onCancel={() => setEditing(false)} />
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words text-base text-slate-800 dark:text-neutral-100">{s.body}</p>
          )}
          {s.status === "declined" && s.decline_reason && (
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Reason: {s.decline_reason}</p>
          )}
          {s.status === "declined" && s.mine && (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Only you see this. Edit it to send it again, or delete it.</p>
          )}
          {s.can_moderate && s.status === "pending" && !s.mine && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => call(`/reading_shares/${s.id}/approve`, { method: "POST" }, "Approved.")}
                className="inline-flex items-center gap-1.5 rounded-lg !bg-sky-600 px-3 py-1.5 text-sm font-semibold !text-white hover:!bg-sky-500">
                <Check size={16} /> Approve
              </button>
              <button type="button" onClick={() => setDeclining(true)}
                className="inline-flex items-center gap-1.5 rounded-lg !bg-stone-200 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:!bg-stone-300 dark:!bg-neutral-700 dark:text-neutral-100">
                <X size={16} /> Decline
              </button>
            </div>
          )}
          {declining && (
            <DeclineBox onCancel={() => setDeclining(false)}
              onSend={(reason) => { setDeclining(false); call(`/reading_shares/${s.id}/decline`, { method: "POST", body: { reason } }, "Declined. Only its writer sees it now."); }} />
          )}
          {/* Others only ever get approved ones, without a status */}
          {(s.status ?? "approved") === "approved" && !editing && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <Reactions share={s} onChange={onChange} />
              {!isReply && ctx.canShare && !replying && (
                <button type="button" onClick={() => setReplying(true)}
                  className="inline-flex items-center gap-1 rounded-full !bg-transparent px-2 py-1 text-xs font-semibold text-neutral-500 hover:!bg-stone-200 dark:text-neutral-400 dark:hover:!bg-neutral-700">
                  <Reply size={14} /> Reply
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Replies and the reply box sit under the share at full width on phones, indented past
          the picture on wider screens */}
      {replies && replies.length > 0 && (
        <ul className="mt-3 space-y-2 border-l-2 border-stone-200 pl-2 dark:border-neutral-700 sm:ml-12 sm:pl-3">
          {replies.map((r) => (
            <Share key={r.id} share={r} ctx={ctx} onChange={onReplyChange} onRemove={() => onReplyRemove(r.id)} />
          ))}
        </ul>
      )}
      {replying && <div className="sm:ml-12"><Composer ctx={ctx} parentId={s.id} onCancel={() => setReplying(false)} /></div>}
      {reporting && <ReportDialog subject={{ type: "reading_share", id: s.id }} person={{ name: s.anonymous ? "this share" : s.name, anonymous: s.anonymous }} onClose={() => setReporting(false)} />}
    </li>
  );
}

function ShareMenu({ share: s, onClose, onEdit, onToggleName, onDelete, onReport, onDecline, onMute }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const item = "flex w-full items-center gap-2 !bg-transparent px-3 py-2 text-left text-sm text-slate-800 hover:!bg-stone-100 dark:text-neutral-100 dark:hover:!bg-neutral-700";
  return (
    <>
      <button type="button" aria-label="Close" className="fixed inset-0 z-10 cursor-default !bg-transparent" onClick={onClose} />
      <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/10 dark:bg-neutral-800 dark:ring-white/10" role="menu">
        {s.mine && <button type="button" role="menuitem" className={item} onClick={onEdit}><Pencil size={15} /> Edit</button>}
        {s.mine && (
          <button type="button" role="menuitem" className={item} onClick={onToggleName}>
            <UserRound size={15} /> {s.anonymous ? "Show my name" : "Hide my name"}
          </button>
        )}
        {s.can_moderate && !s.mine && s.status === "approved" && (
          <button type="button" role="menuitem" className={item} onClick={onDecline}><X size={15} /> Take down</button>
        )}
        {!s.mine && <button type="button" role="menuitem" className={item} onClick={onMute}><VolumeX size={15} /> Mute {s.anonymous ? "this person" : s.name.split(" ")[0]}</button>}
        {!s.mine && <button type="button" role="menuitem" className={item} onClick={onReport}><Flag size={15} /> Report</button>}
        {s.can_remove && <button type="button" role="menuitem" className={`${item} !text-red-600`} onClick={onDelete}><Trash2 size={15} /> Delete</button>}
      </div>
    </>
  );
}

function EditBox({ share, onSaved, onCancel }) {
  const [body, setBody] = useState(share.body);
  const [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (!body.trim() || saving) return;
    setSaving(true);
    try {
      onSaved(await api(`/reading_shares/${share.id}`, { method: "PATCH", body: { share: { body } } }));
    } catch (err) {
      showToast(err.message, { tone: "error" });
      setSaving(false);
    }
  };
  return (
    <form onSubmit={save} className="mt-2 space-y-2">
      <textarea autoFocus rows={4} maxLength={MAX} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Your share"
        className="w-full rounded-xl border-0 bg-white px-3 py-2 text-base text-slate-900 ring-1 ring-stone-300 focus:ring-2 focus:ring-sky-500 dark:bg-neutral-900 dark:text-white dark:ring-neutral-700" />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={saving || !body.trim()} className="rounded-lg !bg-sky-600 px-3 py-1.5 text-sm font-semibold !text-white hover:!bg-sky-500 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        <button type="button" onClick={onCancel} className="rounded-lg !bg-transparent px-3 py-1.5 text-sm font-semibold text-slate-700 hover:!bg-stone-200 dark:text-neutral-200 dark:hover:!bg-neutral-700">Cancel</button>
        {!share.can_moderate && <span className="text-xs text-neutral-500 dark:text-neutral-400">Changes wait for approval again.</span>}
      </div>
    </form>
  );
}

function DeclineBox({ onSend, onCancel }) {
  const [reason, setReason] = useState("");
  return (
    <div className="mt-3 space-y-2">
      <input type="text" autoFocus maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for its writer (optional)"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSend(reason); } if (e.key === "Escape") onCancel(); }}
        className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-stone-300 focus:ring-2 focus:ring-sky-500 dark:bg-neutral-900 dark:text-white dark:ring-neutral-700" />
      <div className="flex gap-2">
        <button type="button" onClick={() => onSend(reason)} className="rounded-lg !bg-stone-800 px-3 py-1.5 text-sm font-semibold !text-white hover:!bg-stone-700 dark:!bg-neutral-600">Decline</button>
        <button type="button" onClick={onCancel} className="rounded-lg !bg-transparent px-3 py-1.5 text-sm font-semibold text-slate-700 hover:!bg-stone-200 dark:text-neutral-200 dark:hover:!bg-neutral-700">Cancel</button>
      </div>
    </div>
  );
}
