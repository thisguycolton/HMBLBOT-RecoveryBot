import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { api } from "../groups/lib";
import { showToast } from "../../lib/toast";
import Sheet from "../shell/Sheet";
import { useMedia } from "../shell/useShell";

const PHONE = "(max-width: 639px)";

// The ••• at the top right of a post (a note, a chat message) or a profile: a short list of
// what you can do with it. `items` are { label, icon, onClick, danger }, falsy ones left out.
// On phones the list rises from the bottom of the screen as a sheet (`title` heads it); on
// wider screens it drops down under the •••, drawn over the page so a card or hero with
// hidden overflow can't cut it off. Closes on a tap outside, Escape or a scroll.
export default function PostMenu({ items, label = "More", title, className = "" }) {
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState(null); // where the drop-down sits on the screen
  const phone = useMedia(PHONE);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const shown = items.filter(Boolean);
  const close = () => setOpen(false);

  useLayoutEffect(() => {
    if (!open || phone) return;
    const r = ref.current.getBoundingClientRect();
    const height = shown.length * 40 + 8;
    const below = r.bottom + 4 + height <= window.innerHeight - 8;
    setSpot({ right: Math.max(8, window.innerWidth - r.right), ...(below ? { top: r.bottom + 4 } : { bottom: window.innerHeight - r.top + 4 }) });
  }, [open, phone, shown.length]);

  useEffect(() => {
    if (!open || phone) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target) && !menuRef.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    const moved = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", moved, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", moved, true);
      window.removeEventListener("resize", close);
    };
  }, [open, phone]);

  if (shown.length === 0) return null;
  const pick = (onClick) => { setOpen(false); onClick(); };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="inline-grid size-8 place-items-center rounded-full !bg-transparent text-slate-500 hover:!bg-neutral-100 hover:text-slate-800 dark:text-neutral-400 dark:hover:!bg-neutral-800 dark:hover:text-white">
        <MoreHorizontal className="size-5" />
      </button>
      {open && phone && (
        <Sheet open onClose={close} side="bottom" label={title || label} className="!bg-white px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:!bg-neutral-900">
          <span className="mx-auto mb-2 mt-1 block h-1.5 w-10 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-700" aria-hidden="true" />
          {title && <p className="px-3 pb-2 text-center text-sm font-semibold text-slate-500 dark:text-neutral-400">{title}</p>}
          <div role="menu" className="flex flex-col overflow-y-auto">
            {shown.map(({ label: text, icon: Icon, onClick, danger }) => (
              <button key={text} type="button" role="menuitem" onClick={() => pick(onClick)}
                className={`flex w-full items-center gap-3.5 rounded-2xl !bg-transparent px-4 py-3.5 text-left text-base font-medium active:!bg-neutral-100 dark:active:!bg-neutral-800 ${danger ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-neutral-100"}`}>
                {Icon && <Icon className="size-5 shrink-0" aria-hidden="true" />} {text}
              </button>
            ))}
          </div>
          <button type="button" onClick={close}
            className="mt-2 w-full rounded-2xl !bg-neutral-100 px-4 py-3.5 text-base font-semibold text-slate-800 dark:!bg-neutral-800 dark:text-white">
            Cancel
          </button>
        </Sheet>
      )}
      {open && !phone && spot && createPortal(
        <div ref={menuRef} role="menu" style={{ position: "fixed", ...spot }}
          className="z-[2300] w-56 overflow-hidden rounded-xl bg-white py-1 !font-sans text-sm shadow-lg ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700">
          {shown.map(({ label: text, icon: Icon, onClick, danger }) => (
            <button key={text} type="button" role="menuitem" onClick={() => pick(onClick)}
              className={`flex w-full items-center gap-2.5 !bg-transparent px-3 py-2 text-left hover:!bg-neutral-100 dark:hover:!bg-neutral-800 ${danger ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-neutral-200"}`}>
              {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />} {text}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

const BLOCKED_EVENT = "hb:blocked";

// Blocks `person` for you (UserBlock) after asking, and tells the page so everything of theirs
// on it can hide (useBlocked). Resolves true when they're blocked.
export async function blockPerson(person) {
  const first = person.name.split(" ")[0];
  if (!window.confirm(`Block ${person.name}? You won't see ${first}'s notes, comments or chat messages, and you won't be told about anything ${first} does. ${first} isn't told. Their service for a group you share, like hosting, still shows.`)) return false;
  try {
    await api(`/people/${person.username}/block`, { method: "POST" });
    window.dispatchEvent(new CustomEvent(BLOCKED_EVENT, { detail: { id: person.id, blocked: true } }));
    showToast(`You blocked ${first}. You can unblock ${first} on their page.`);
    return true;
  } catch (e) {
    showToast(e.message, { tone: "error" });
    return false;
  }
}

export async function unblockPerson(person) {
  await api(`/people/${person.username}/block`, { method: "DELETE" });
  window.dispatchEvent(new CustomEvent(BLOCKED_EVENT, { detail: { id: person.id, blocked: false } }));
}

// Calls `onChange(id, blocked)` when someone is blocked or unblocked on this page
export function useBlocked(onChange) {
  const latest = useRef(onChange);
  latest.current = onChange;
  useEffect(() => {
    const heard = (e) => latest.current(e.detail.id, e.detail.blocked);
    window.addEventListener(BLOCKED_EVENT, heard);
    return () => window.removeEventListener(BLOCKED_EVENT, heard);
  }, []);
}
