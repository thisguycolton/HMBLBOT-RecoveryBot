import React, { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { api } from "../groups/lib";
import { showToast } from "../../lib/toast";

// The ••• at the top right of a post (a note, a chat message): a short list of what you can
// do with it. `items` are { label, icon, onClick, danger }, falsy ones left out. Closes on a
// tap outside or Escape.
export default function PostMenu({ items, label = "More", className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const shown = items.filter(Boolean);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (shown.length === 0) return null;
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="inline-grid size-8 place-items-center rounded-full !bg-transparent text-slate-500 hover:!bg-neutral-100 hover:text-slate-800 dark:text-neutral-400 dark:hover:!bg-neutral-800 dark:hover:text-white">
        <MoreHorizontal className="size-5" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl bg-white py-1 text-sm shadow-lg ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700">
          {shown.map(({ label: text, icon: Icon, onClick, danger }) => (
            <button key={text} type="button" role="menuitem" onClick={() => { setOpen(false); onClick(); }}
              className={`flex w-full items-center gap-2.5 !bg-transparent px-3 py-2 text-left hover:!bg-neutral-100 dark:hover:!bg-neutral-800 ${danger ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-neutral-200"}`}>
              {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />} {text}
            </button>
          ))}
        </div>
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
