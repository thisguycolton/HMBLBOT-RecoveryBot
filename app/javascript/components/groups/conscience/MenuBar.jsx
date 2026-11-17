import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

// A word processor's menu bar (File, Edit, View...): click a menu to open it, then hover across
// to the others. `menus` are { label, items: [{ label, onClick, shortcut, disabled, checked } | "divider"] }.
export default function MenuBar({ menus }) {
  const [open, setOpen] = useState(null);
  const bar = useRef(null);
  useEffect(() => {
    if (open === null) return undefined;
    const close = (e) => { if (!bar.current?.contains(e.target)) setOpen(null); };
    const esc = (e) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <nav ref={bar} aria-label="Document menu" className="flex shrink-0 items-center">
      {menus.map((menu, i) => (
        <div key={menu.label} className="relative">
          <button type="button" aria-haspopup="menu" aria-expanded={open === i}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen(open === i ? null : i)} onMouseEnter={() => open !== null && setOpen(i)}
            className={`rounded-md px-2.5 py-1 text-sm ${open === i ? "!bg-neutral-200 text-slate-900 dark:!bg-neutral-700 dark:text-white" : "!bg-transparent text-slate-700 hover:!bg-neutral-200/70 dark:text-neutral-200 dark:hover:!bg-neutral-700/60"}`}>
            {menu.label}
          </button>
          {open === i && (
            <div role="menu" className="absolute left-0 z-40 mt-1 min-w-[15rem] rounded-xl border border-neutral-200 bg-white p-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
              {menu.items.filter(Boolean).map((item, j) => item === "divider" ? (
                <div key={`d${j}`} className="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />
              ) : (
                <button key={item.label} type="button" role="menuitem" disabled={item.disabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setOpen(null); item.onClick(); }}
                  className="flex w-full items-center gap-2 rounded-lg !bg-transparent px-2.5 py-1.5 text-left text-sm text-slate-800 hover:!bg-neutral-100 disabled:opacity-40 dark:text-neutral-100 dark:hover:!bg-neutral-800">
                  <span className="grid size-4 shrink-0 place-items-center">{item.checked && <Check className="size-4 text-accent" />}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.shortcut && <span className="text-xs text-slate-400">{item.shortcut}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
