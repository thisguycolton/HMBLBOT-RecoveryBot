import React, { useEffect, useRef } from "react";
import { CalendarClock, House, Info, Menu, Settings, Video } from "lucide-react";
import { RecoveryBotMark } from "../brand/Logo";
import { isOnNow } from "./useShell";

const slot = "relative inline-grid size-11 place-items-center rounded-full !bg-transparent text-slate-800 dark:text-neutral-100";

// The slim floating bar along the bottom on phones: the menu, Home, the robot (quick actions),
// Today (a green dot when one of your meetings is on) and, on pages that have one, the page's
// side panel. On the home feed (whose side panel is Today again) that last one is a gear to your
// settings instead. Above it, while a meeting of yours is on, a bar to join it. It's kept short
// (44pt buttons, the robot inside the bar rather than raised out of it) and tucks down into the
// home-bar strip on iPhones, so it covers as little of the page as it can.
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
  useKeepOnBottom(ref);
  return (
    <div ref={ref} className="shell-bottom pointer-events-none fixed inset-x-0 bottom-0 z-[60] px-5 pb-[max(0.5rem,calc(env(safe-area-inset-bottom)-0.75rem))] !font-sans lg:hidden print:!hidden">
      {onNow && (
        <div className="pointer-events-auto mx-auto mb-2 flex max-w-md items-center gap-3 rounded-full bg-neutral-900 py-2 pl-5 pr-2 text-white shadow-xl dark:bg-neutral-800">
          <span className="size-2.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-medium">On now · {onNow.group.title}</span>
          <a href={onNow.conference_url} data-meeting-join={onNow.id} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-full !bg-accent px-4 py-2 font-semibold !text-white">
            <Video className="size-4" /> Join
          </a>
        </div>
      )}
      <nav aria-label="Quick" className="pointer-events-auto mx-auto flex max-w-md items-center justify-between rounded-full bg-white px-1.5 py-1 shadow-[0_6px_22px_rgb(0_0_0/0.16)] ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
        <button type="button" className={slot} onClick={onMenu} aria-label="Menu"><Menu className="size-[22px]" /></button>
        <a href={isAuthenticated ? "/people" : "/"} className={`${slot} ${homeActive ? "!bg-accent/10 !text-accent" : ""}`} aria-label="Home"><House className="size-[22px]" /></a>
        <button type="button" onClick={onActions} aria-label="Quick actions"
          className="inline-grid h-11 w-14 place-items-center rounded-full !bg-accent text-white">
          <RecoveryBotMark className="h-[22px] w-auto text-white" title="Quick actions" />
        </button>
        <button type="button" className={slot} onClick={onToday} aria-label={onNow ? "Today: a meeting is on now" : "Today"}>
          <CalendarClock className="size-[22px]" />
          {onNow && <span className="absolute right-2 top-2 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-900" />}
        </button>
        {homeActive && isAuthenticated ? (
          <a href="/users/edit" className={slot} aria-label="Settings"><Settings className="size-[22px]" /></a>
        ) : onAside ? (
          <button type="button" className={slot} onClick={onAside} aria-label={asideLabel || "Info"}><Info className="size-[22px]" /></button>
        ) : (
          <span className={`${slot} opacity-30`} aria-hidden="true"><Info className="size-[22px]" /></span>
        )}
      </nav>
    </div>
  );
}

const TYPED = /^(INPUT|TEXTAREA|SELECT)$/;
const NOT_TYPED = /^(checkbox|radio|button|submit|reset|range|color|file|image)$/;
const typing = () => {
  const el = document.activeElement;
  return !!el && (el.isContentEditable || (TYPED.test(el.tagName) && !NOT_TYPED.test(el.type)));
};

// Keeps the bar on the bottom of what's showing. On iPhones, a page with a lot of typing (a step
// worksheet) can leave a `bottom: 0` bar floating mid-screen: while the keyboard is up, and for a
// while after it closes, iOS lays fixed bars out against a viewport that has moved. So: while
// they're typing on a touch screen the bar steps aside (it would cover what they're writing), and
// whenever the visible part of the page (visualViewport) ends above the layout's bottom, the bar
// is moved up to meet it.
function useKeepOnBottom(ref) {
  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return undefined;
    const touch = window.matchMedia?.("(pointer: coarse)").matches;
    let frame = 0;
    let wasAway = false;
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const away = touch && typing();
        // Not while zoomed in: then the visible part is meant to be smaller than the page. And
        // not for the bounce past the top of the page (pulling down, or pull to refresh): iOS
        // reports that as the viewport moving above the page, which isn't a keyboard gap, and
        // following it threw the bar up into the middle of the screen
        const top = Math.max(0, vv.offsetTop);
        const gap = vv.scale > 1.01 ? 0 : document.documentElement.clientHeight - (top + vv.height);
        // Slides away and back; following the viewport is immediate
        el.style.transition = away !== wasAway ? "transform 200ms ease, opacity 200ms ease" : "none";
        wasAway = away;
        el.style.transform = away ? "translateY(calc(100% + 2rem))" : gap > 1 ? `translateY(${-gap}px)` : "";
        el.style.opacity = away ? "0" : "";
        el.inert = away;
      });
    };
    // After the keyboard closes, iOS can take a moment to settle; check again once it has
    const later = () => { place(); setTimeout(place, 350); };
    vv.addEventListener("resize", place);
    vv.addEventListener("scroll", place);
    window.addEventListener("scroll", place, { passive: true });
    document.addEventListener("focusin", place);
    document.addEventListener("focusout", later);
    place();
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", place);
      vv.removeEventListener("scroll", place);
      window.removeEventListener("scroll", place);
      document.removeEventListener("focusin", place);
      document.removeEventListener("focusout", later);
      el.style.transform = "";
      el.style.transition = "";
      el.style.opacity = "";
      el.inert = false;
    };
  }, [ref]);
}
