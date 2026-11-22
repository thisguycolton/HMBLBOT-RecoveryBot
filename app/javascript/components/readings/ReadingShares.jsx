import React, { useEffect, useState } from "react";
import { Check, Flag, MessageCircleHeart, MoreHorizontal, Pencil, Trash2, UserRound, X } from "lucide-react";
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

  useEffect(() => {
    let live = true;
    api(`/readings/${readingId}/shares`)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e));
    return () => { live = false; };
  }, [readingId]);

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

  const shown = shares.length;
  return (
    <section id="shares" className="mt-10 scroll-mt-24 rounded-2xl border border-stone-200 bg-white px-5 py-6 !font-sans dark:border-neutral-700 dark:bg-neutral-800/60 md:px-8">
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
          {shares.map((s) => (
            <Share key={s.id} share={s} myName={myName} onChange={replace} onRemove={() => remove(s.id)} />
          ))}
        </ul>
      )}

      {data.can_share ? (
        <Composer readingId={readingId} myName={myName} grapevine={data.grapevine} canModerate={data.can_moderate} onPosted={add} />
      ) : (
        <p className="mt-5 text-sm text-neutral-500 dark:text-neutral-400">Shares are off for this reading.</p>
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

function Composer({ readingId, myName, grapevine, canModerate, onPosted }) {
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(rememberedAnonymous);
  const [saving, setSaving] = useState(false);

  const pick = (value) => { setAnonymous(value); rememberAnonymous(value); };

  const post = async (e) => {
    e.preventDefault();
    if (!body.trim() || saving) return;
    setSaving(true);
    try {
      const share = await api(`/readings/${readingId}/shares`, { method: "POST", body: { share: { body, anonymous } } });
      setBody("");
      onPosted(share);
      if (share.status === "pending") showToast("Thanks for sharing. It shows to others once the reading's poster approves it.");
    } catch (err) {
      showToast(err.message || "Couldn't post your share.", { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={post} className="mt-6 space-y-3 border-t border-stone-200 pt-5 dark:border-neutral-700">
      <label className="block">
        <span className="sr-only">Your share</span>
        <textarea rows={4} maxLength={MAX} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder={grapevine ? "Share your experience. Please don't copy the story's text." : "Share your experience, strength and hope…"}
          className="w-full rounded-xl border-0 bg-stone-100 px-4 py-3 text-base text-slate-900 ring-1 ring-stone-200 placeholder:text-neutral-400 focus:ring-2 focus:ring-sky-500 dark:bg-neutral-900 dark:text-white dark:ring-neutral-700" />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <IdentityPicker anonymous={anonymous} onChange={pick} myName={myName} />
        <button type="submit" disabled={saving || !body.trim()}
          className="inline-flex items-center gap-2 rounded-xl !bg-sky-600 px-5 py-2.5 font-semibold !text-white hover:!bg-sky-500 disabled:opacity-50">
          <MessageCircleHeart size={18} /> {saving ? "Sharing…" : "Share"}
        </button>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {anonymous
          ? "Your name stays hidden from everyone, moderators included. People who know you may still recognize your story."
          : "Your name and picture show with your share."}
        {canModerate ? "" : " The reading's poster approves shares before others see them."}
      </p>
    </form>
  );
}

function Share({ share: s, myName, onChange, onRemove }) {
  const [editing, setEditing] = useState(false);
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
    if (!window.confirm("Delete this share?")) return;
    try {
      await api(`/reading_shares/${s.id}`, { method: "DELETE" });
      onRemove();
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  };

  const name = s.mine ? `${s.anonymous ? "A member" : s.name} (you)` : s.name;
  const status = s.status === "pending" ? "Waiting for approval" : s.status === "declined" ? "Not approved" : null;

  return (
    <li className={`rounded-xl px-4 py-3 ${s.status === "pending" ? "bg-amber-50/70 ring-1 ring-amber-200 dark:bg-amber-500/5 dark:ring-amber-500/30" : s.status === "declined" ? "bg-stone-50 opacity-80 ring-1 ring-stone-200 dark:bg-neutral-900 dark:ring-neutral-700" : "bg-stone-50 dark:bg-neutral-900/60"}`}>
      <div className="flex items-start gap-3">
        {s.author ? (
          <a href={`/people/${s.author.username}`} className="shrink-0"><Avatar person={s.author} size={36} /></a>
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-500 dark:bg-neutral-700 dark:text-neutral-300" aria-hidden="true">
            <UserRound size={18} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-sm">
            {s.author ? (
              <a href={`/people/${s.author.username}`} className="!font-semibold !text-slate-900 hover:underline dark:!text-white">{name}</a>
            ) : (
              <span className="font-semibold text-slate-900 dark:text-white">{name}</span>
            )}
            <span className="text-neutral-500 dark:text-neutral-400">{roughDay(s.created_at)}{s.edited ? " · edited" : ""}</span>
            {status && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.status === "pending" ? "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200" : "bg-stone-200 text-stone-700 dark:bg-neutral-700 dark:text-neutral-200"}`}>{status}</span>
            )}
            <span className="flex-1" />
            <div className="relative">
              <button type="button" onClick={() => setMenu((m) => !m)} aria-label="Share options" aria-expanded={menu}
                className="rounded-full !bg-transparent p-1 text-neutral-500 hover:!bg-stone-200 dark:hover:!bg-neutral-700">
                <MoreHorizontal size={18} />
              </button>
              {menu && (
                <ShareMenu share={s} onClose={() => setMenu(false)}
                  onEdit={() => { setMenu(false); setEditing(true); }}
                  onToggleName={() => call(`/reading_shares/${s.id}`, { method: "PATCH", body: { share: { anonymous: !s.anonymous } } }, s.anonymous ? "Your name shows on this share now." : "This share says “A member” now.")}
                  onDelete={destroy}
                  onReport={() => { setMenu(false); setReporting(true); }}
                  onDecline={() => { setMenu(false); setDeclining(true); }} />
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
        </div>
      </div>
      {reporting && <ReportDialog subject={{ type: "reading_share", id: s.id }} person={{ name: s.anonymous ? "this share" : s.name, anonymous: s.anonymous }} onClose={() => setReporting(false)} />}
    </li>
  );
}

function ShareMenu({ share: s, onClose, onEdit, onToggleName, onDelete, onReport, onDecline }) {
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
