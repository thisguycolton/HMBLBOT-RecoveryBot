import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import Footer from "./Footer";
import { RecoveryBotLogo } from "./brand/Logo";
import BottomBar from "./shell/BottomBar";
import { ChromeSheets, useChrome } from "./shell/Chrome";
import Sidebar from "./shell/Sidebar";
import TopBar from "./shell/TopBar";
import { ShellContext, usePath, useNav, useTheme } from "./shell/useShell";
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
  const [asideTarget, setAsideTarget] = useState(null);
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

  return (
    <ShellContext.Provider value={context}>
      <div className="shell min-h-dvh w-full self-stretch bg-[#ececec] text-slate-900 dark:bg-neutral-950 dark:text-neutral-100 [&_.shell-side_p]:!font-sans [&_.shell-side_p]:!text-left">
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

        <div className="pt-[var(--nav-h)] lg:pl-72 print:!p-0">
          <div className="stage flex min-h-[calc(100dvh-var(--nav-h))] bg-white dark:bg-neutral-900 lg:overflow-clip lg:rounded-tl-[32px] print:!rounded-none">
            <main className="flex min-w-0 flex-1 flex-col pb-32 lg:pb-0">
              <div className="flex-1">{children}</div>
              {showFooter && <div className="mt-10"><Footer /></div>}
            </main>

            {/* The page's side panel: a column on wide screens, a sheet below that */}
            {asideOpen && <button type="button" aria-label="Close" className="fixed inset-0 z-[2150] !bg-black/40 xl:hidden" onClick={() => setAsideOpen(false)} />}
            <aside aria-label={aside?.title || "Side panel"}
              className={`${aside ? "xl:block" : "xl:hidden"} ${asideOpen ? "fixed inset-y-0 right-0 z-[2200] flex w-[min(24rem,92vw)] flex-col rounded-l-[28px] bg-[#ececec] shadow-2xl dark:bg-neutral-950" : "hidden"} xl:static xl:z-auto xl:w-[24rem] xl:shrink-0 xl:rounded-none xl:bg-transparent xl:shadow-none print:!hidden`}>
              <div className="flex items-center justify-between px-5 pb-2 pt-5 xl:hidden">
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{aside?.title}</h2>
                <button type="button" onClick={() => setAsideOpen(false)} aria-label="Close" className="inline-grid size-9 place-items-center rounded-full !bg-white/80 dark:!bg-neutral-800"><X className="size-4" /></button>
              </div>
              <div ref={setAsideTarget}
                className="m-3 mt-2 flex-1 overflow-y-auto rounded-3xl bg-white p-5 dark:bg-neutral-900 xl:sticky xl:top-[var(--nav-h)] xl:m-0 xl:max-h-[calc(100dvh-var(--nav-h))] xl:rounded-none xl:bg-transparent xl:py-12 xl:pl-2 xl:pr-8" />
            </aside>
          </div>
        </div>

        <BottomBar nav={nav} isAuthenticated={isAuthenticated} homeActive={homeActive}
          onMenu={() => chrome.show("menu")} onActions={() => chrome.show("actions")} onToday={() => chrome.show("today")}
          onAside={aside ? openAside : null} asideLabel={aside?.title} />
        <ChromeSheets chrome={chrome} nav={nav} isAuthenticated={isAuthenticated} theme={theme} path={path} />
      </div>
    </ShellContext.Provider>
  );
}
