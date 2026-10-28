import React, { useEffect, useRef } from "react";
import { CalendarClock, House, Info, Menu, Video } from "lucide-react";
import { RecoveryBotMark } from "../brand/Logo";
import { isOnNow } from "./useShell";

const slot = "relative inline-grid size-14 place-items-center rounded-full !bg-transparent text-slate-800 dark:text-neutral-100";

// The floating bar along the bottom on phones: the menu, Home, the robot (quick actions),
// Today (a green dot when one of your meetings is on) and, on pages that have one, the page's
// side panel. Above it, while a meeting of yours is on, a bar to join it.
export default function BottomBar({ nav, isAuthenticated, onMenu, onActions, onToday, onAside, asideLabel, homeActive }) {
  const onNow = nav?.today?.meetings?.find((m) => isOnNow(m) && m.conference_url);
  // How much of the bottom it covers (--shell-bottom), so a page's own floating buttons sit above it
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const root = document.documentElement.style;
    const observer = new ResizeObserver(() => root.setProperty("--shell-bottom", `${el.offsetHeight}px`));
    observer.observe(el);
    return () => { observer.disconnect(); root.removeProperty("--shell-bottom"); };
  }, []);
  return (
    <div ref={ref} className="shell-bottom pointer-events-none fixed inset-x-0 bottom-0 z-[60] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] !font-sans lg:hidden print:!hidden">
      {onNow && (
        <div className="pointer-events-auto mx-auto mb-3 flex max-w-md items-center gap-3 rounded-full bg-neutral-900 py-2 pl-5 pr-2 text-white shadow-xl dark:bg-neutral-800">
          <span className="size-2.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-medium">On now · {onNow.group.title}</span>
          <a href={onNow.conference_url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-full !bg-accent px-4 py-2 font-semibold !text-white">
            <Video className="size-4" /> Join
          </a>
        </div>
      )}
      <nav aria-label="Quick" className="pointer-events-auto mx-auto flex max-w-md items-center justify-between rounded-full bg-white px-2 py-1.5 shadow-[0_8px_30px_rgb(0_0_0/0.18)] ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
        <button type="button" className={slot} onClick={onMenu} aria-label="Menu"><Menu className="size-6" /></button>
        <a href={isAuthenticated ? "/people" : "/"} className={`${slot} ${homeActive ? "!bg-accent/10 !text-accent" : ""}`} aria-label="Home"><House className="size-6" /></a>
        <button type="button" onClick={onActions} aria-label="Quick actions"
          className="-my-4 inline-grid size-[4.5rem] place-items-center rounded-full !bg-accent text-white shadow-lg ring-4 ring-white dark:ring-neutral-900">
          <RecoveryBotMark className="h-8 w-auto text-white" title="Quick actions" />
        </button>
        <button type="button" className={slot} onClick={onToday} aria-label={onNow ? "Today: a meeting is on now" : "Today"}>
          <CalendarClock className="size-6" />
          {onNow && <span className="absolute right-3 top-3 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-900" />}
        </button>
        {onAside ? (
          <button type="button" className={slot} onClick={onAside} aria-label={asideLabel || "Info"}><Info className="size-6" /></button>
        ) : (
          <span className={`${slot} opacity-30`} aria-hidden="true"><Info className="size-6" /></span>
        )}
      </nav>
    </div>
  );
}
