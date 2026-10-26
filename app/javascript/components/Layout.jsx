import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import Footer from "./Footer";
import { RecoveryBotLogo } from "./brand/Logo";
import BottomBar from "./shell/BottomBar";
import { ChromeSheets, useChrome } from "./shell/Chrome";
import { PUSH_WIDTH } from "./shell/Sheet";
import Sidebar from "./shell/Sidebar";
import TopBar from "./shell/TopBar";
import { ShellContext, useMedia, usePath, useNav, useTheme } from "./shell/useShell";
import { forgetPushIfSignedOut, registerServiceWorker } from "../lib/push";

// The site's shell, around every page: the sidebar on the left (You, Your groups, Explore),
// the bar along the top (search, Donate, theme, notifications, account), and the stage, the
// rounded panel the page itself sits in. A page can hand the shell a side panel (PageAside):
// the column beside the stage on wide screens, a sheet from the bottom bar on phones.
export default function Layout({ children, isAuthenticated, showFooter = true }) {
  const nav = useNav();
  const theme = useTheme();
  const path = usePath();
  const chrome = useChrome();
  const [wideAside, setWideAside] = useState(null);
  const [phoneAside, setPhoneAside] = useState(null);
  const wide = useMedia("(min-width: 1280px)");
  const asideTarget = wide ? wideAside : phoneAside;
  const [aside, setAside] = useState(null); // { title } while a page shows a side panel
  const [asideOpen, setAsideOpen] = useState(false);

  // The service worker shows push notifications (lib/push.js); signed out, this browser stops getting them
  useEffect(() => { registerServiceWorker().then(() => forgetPushIfSignedOut()); }, []);
  useEffect(() => { chrome.close(); setAsideOpen(false); }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!asideOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setAsideOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asideOpen]);

  const context = useMemo(() => ({ asideTarget, setAside }), [asideTarget]);
  const openAside = useCallback(() => setAsideOpen(true), []);
  const homeActive = path === "/people" || path === "/";
  const push = usePush(asideOpen && !wide ? "aside" : chrome.open === "menu" || chrome.open === "today" ? chrome.open : null);
  const closePush = () => (push?.which === "aside" ? setAsideOpen(false) : chrome.close());

  return (
    <ShellContext.Provider value={context}>
      <div className="shell min-h-dvh w-full self-stretch bg-[#ececec] text-slate-900 dark:bg-neutral-950 dark:text-neutral-100 [&_.shell-side_p]:!font-sans [&_.shell-side_p]:!text-left">
        {/* The page layer: everything but the sheets. A side sheet lies under it, and it slides
            aside as one rounded card to show it (usePush) */}
        <div className="shell-page bg-[#ececec] dark:bg-neutral-950" style={pushStyle(push)}>
        {push?.open && <button type="button" aria-label="Close" onClick={closePush} className="absolute inset-0 z-[3000] cursor-default !bg-transparent" />}
        <aside className="shell-side fixed inset-y-0 left-0 z-40 hidden w-72 flex-col lg:flex print:!hidden">
          <a href={isAuthenticated ? "/people" : "/"} className="flex h-16 shrink-0 items-center px-7 !text-slate-900 dark:!text-white" aria-label="RecoveryBot home">
            <RecoveryBotLogo markClassName="h-7 w-auto" textClassName="text-xl" />
          </a>
          <div className="flex-1 overflow-y-auto px-4 pb-8 pt-2">
            <Sidebar nav={nav} isAuthenticated={isAuthenticated} path={path} />
          </div>
        </aside>

        <div className={`fixed inset-x-0 top-0 z-50 h-[var(--nav-h)] bg-[#ececec]/90 backdrop-blur lg:left-72 lg:bg-[#ececec] dark:bg-neutral-950/90 lg:dark:bg-neutral-950 print:!hidden ${chrome.open ? "z-[2100]" : ""}`}>
          <TopBar nav={nav} isAuthenticated={isAuthenticated} theme={theme}
            onMenu={() => chrome.show("menu")} onSearch={() => chrome.show("search")} onDonate={() => chrome.show("donate")} onCourt={() => chrome.show("court")}
            onAside={aside ? openAside : null} asideLabel={aside?.title} />
        </div>

        {/* The window scrolls, so the stage's rounded corner would scroll away under the top bar:
            this stays put over that corner, drawn in the shell's color (the bar is solid on wide screens) */}
        <div aria-hidden="true"
          className="pointer-events-none fixed left-72 top-[var(--nav-h)] z-40 hidden size-8 bg-[radial-gradient(circle_at_100%_100%,transparent_31.5px,#ececec_32px)] dark:bg-[radial-gradient(circle_at_100%_100%,transparent_31.5px,var(--color-neutral-950)_32px)] lg:block print:!hidden" />

        <div className="pt-[var(--nav-h)] lg:pl-72 print:!p-0" style={push ? { marginTop: -push.y } : undefined}>
          <div className="stage flex min-h-[calc(100dvh-var(--nav-h))] bg-white dark:bg-neutral-900 lg:overflow-clip lg:rounded-tl-[32px] print:!rounded-none">
            <main className="flex min-w-0 flex-1 flex-col pb-32 lg:pb-0">
              <div className="flex-1">{children}</div>
              {showFooter && <div className="mt-10"><Footer /></div>}
            </main>

            {/* The page's side panel on wide screens: the column beside the stage */}
            <aside aria-label={aside?.title || "Side panel"} className={`${aside ? "xl:block" : ""} hidden xl:w-[24rem] xl:shrink-0 print:!hidden`}>
              <div ref={setWideAside} className="sticky top-[var(--nav-h)] max-h-[calc(100dvh-var(--nav-h))] overflow-y-auto py-12 pl-2 pr-8" />
            </aside>
          </div>
        </div>

        <BottomBar nav={nav} isAuthenticated={isAuthenticated} homeActive={homeActive}
          onMenu={() => chrome.show("menu")} onActions={() => chrome.show("actions")} onToday={() => chrome.show("today")}
          onAside={aside ? openAside : null} asideLabel={aside?.title} />
        </div>

        {/* The page's side panel below that: under the page layer, shown as it slides aside */}
        <aside aria-label={aside?.title || "Side panel"} style={{ width: PUSH_WIDTH.right }}
          className={`${push?.which === "aside" ? "flex" : "hidden"} fixed inset-y-0 right-0 z-[2100] flex-col bg-[#ececec] dark:bg-neutral-950 xl:hidden print:!hidden`}>
          <div className="flex items-center justify-between px-5 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))]">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{aside?.title}</h2>
            <button type="button" onClick={() => setAsideOpen(false)} aria-label="Close" className="inline-grid size-9 place-items-center rounded-full !bg-white/80 dark:!bg-neutral-800"><X className="size-4" /></button>
          </div>
          <div ref={setPhoneAside} className={`m-3 mt-2 flex-1 overflow-y-auto ${aside?.plain ? "pb-6" : "rounded-3xl bg-white p-5 dark:bg-neutral-900"}`} />
        </aside>

        <ChromeSheets chrome={chrome} nav={nav} isAuthenticated={isAuthenticated} theme={theme} path={path} pushed={push?.which ?? null} />
      </div>
    </ShellContext.Provider>
  );
}

const SLIDE_MS = 420;
const PUSH_SIDE = { menu: "left", today: "right", aside: "right" };

// The stage slides aside for a side sheet. The window scrolls the page, so while it's aside the
// page layer is pinned to the screen (shifted up by how far it was scrolled) and the scroll is
// put back once it has slid home. `which` is the sheet asked for; the answer keeps the last one
// while the stage slides back, so the sheet stays under it until it's covered.
function usePush(which) {
  const [push, setPush] = useState(null); // { which, side, y, open }
  const reduced = useMedia("(prefers-reduced-motion: reduce)");

  useLayoutEffect(() => {
    if (which) {
      setPush((p) => (p ? { ...p, which, side: PUSH_SIDE[which] } : { which, side: PUSH_SIDE[which], y: window.scrollY, path: window.location.pathname, open: false }));
      let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setPush((p) => p && { ...p, open: true })); });
      return () => cancelAnimationFrame(frame);
    }
    setPush((p) => p && { ...p, open: false });
    const timer = setTimeout(() => setPush(null), reduced ? 0 : SLIDE_MS);
    return () => clearTimeout(timer);
  }, [which, reduced]);

  // Back where you were, unless a link in the sheet went to another page
  const last = useRef(null);
  useLayoutEffect(() => {
    if (push) last.current = push;
    else if (last.current) {
      window.scrollTo(0, last.current.path === window.location.pathname ? last.current.y : 0);
      last.current = null;
    }
  }, [push]);
  return push;
}

function pushStyle(push) {
  if (!push) return undefined;
  const shift = push.side === "left" ? PUSH_WIDTH.left : `calc(-1 * ${PUSH_WIDTH.right})`;
  return {
    position: "fixed",
    inset: 0,
    zIndex: 2150,
    overflow: "hidden",
    transform: `translateX(${push.open ? shift : "0px"})`,
    borderRadius: push.open ? 32 : 0,
    boxShadow: push.open ? "0 0 48px rgb(0 0 0 / 0.28)" : "none",
    transition: `transform ${SLIDE_MS}ms cubic-bezier(0.32, 0.72, 0, 1), border-radius ${SLIDE_MS}ms, box-shadow ${SLIDE_MS}ms`,
  };
}
