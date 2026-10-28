import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import Avatar from "../groups/Avatar";
import { api } from "../groups/lib";
import { SheetClose } from "../shell/Sheet";

const TABS = [
  { key: "followers", label: "Followers" },
  { key: "following", label: "Following" },
];

// Who follows someone, or who they follow, opened from the counts on their profile
// (ProfileHero). A sheet from the bottom on phones, a box in the middle on wide screens.
export default function FollowListModal({ person, which, onWhich, onClose }) {
  const [lists, setLists] = useState({});
  const [error, setError] = useState(null);
  const people = lists[which];

  useEffect(() => {
    if (!which) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [which, onClose]);

  useEffect(() => {
    if (!which || lists[which]) return;
    setError(null);
    api(`/people/${person.username}/${which}`)
      .then((data) => setLists((l) => ({ ...l, [which]: data.people })))
      .catch((e) => setError(e.message));
  }, [which, person.username]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!which) return null;
  const count = which === "followers" ? person.followers_count : person.following_count;

  return createPortal(
    <div className="fixed inset-0 z-[2200] flex items-end justify-center !font-sans sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`${person.name}: ${which}`}>
      <button type="button" aria-label="Close" className="absolute inset-0 !bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-[#ececec] shadow-2xl dark:bg-neutral-950 sm:max-h-[min(40rem,85dvh)] sm:max-w-md sm:rounded-[28px]">
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
          <h2 className="min-w-0 truncate text-xl font-bold tracking-tight text-slate-900 dark:text-white">{person.name}</h2>
          <SheetClose onClose={onClose} />
        </div>
        <div className="mx-5 mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-neutral-300/50 p-1 dark:bg-neutral-800" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={which === t.key} onClick={() => onWhich(t.key)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${which === t.key ? "!bg-white text-slate-900 shadow-sm dark:!bg-neutral-900 dark:text-white" : "!bg-transparent text-slate-600 dark:text-neutral-300"}`}>
              <span className="tabular-nums">{t.key === "followers" ? person.followers_count : person.following_count}</span> {t.label.toLowerCase()}
            </button>
          ))}
        </div>
        <div className="m-3 mt-0 min-h-[8rem] flex-1 overflow-y-auto rounded-3xl bg-white p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] dark:bg-neutral-900">
          {error ? (
            <p className="px-3 py-8 text-center text-sm text-rose-600">{error}</p>
          ) : !people ? (
            <p className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Loading…</p>
          ) : people.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500 dark:text-neutral-400">
              {which === "followers" ? `Nobody follows ${person.name} yet.` : `${person.name} isn't following anyone yet.`}
            </p>
          ) : (
            <ul>
              {people.map((p) => (
                <li key={p.id}>
                  <a href={`/people/${p.username}`} className="flex items-center gap-3 rounded-2xl px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800/60">
                    <Avatar person={p} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-900 dark:text-white">{p.name}</span>
                      <span className="block truncate text-sm text-slate-500 dark:text-neutral-400">@{p.username}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {people && people.length < count && (
            <p className="px-3 pb-2 pt-3 text-center text-xs text-slate-500">Showing the newest {people.length}.</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
