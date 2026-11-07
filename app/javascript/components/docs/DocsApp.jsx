import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, Menu, Search } from "lucide-react";
import Sheet from "../shell/Sheet";
import { useTheme } from "../shell/useShell";
import { api } from "../groups/lib";
import { RecoveryBotMark } from "../brand/Logo";
import DocsNav from "./DocsNav";

// The Docs app: a frame of its own, apart from the rest of the site (no site sidebar or top
// bar). On a computer the docs sidebar runs down the left: the RecoveryBot Docs mark, search,
// every section and page, and Return to RecoveryBot at the bottom. On phones and tablets a
// docs bar sits at the top (DocsBar) and the same sidebar opens as a sheet. The list of
// sections and pages comes from /api/docs and is shared through useDocs.
const DocsContext = createContext(null);
export const useDocs = () => useContext(DocsContext);

export default function DocsApp({ editor }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [browsing, setBrowsing] = useState(false); // false | "nav" | "search"
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const editing = location.pathname.endsWith("/edit");

  const reload = useCallback(() => api("/docs").then(setData).catch(setError), []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { setBrowsing(false); window.scrollTo(0, 0); }, [location.pathname]);

  // Links inside the app (a page's own links to other docs pages) move without a load
  const onClick = (e) => {
    const a = e.target.closest?.("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
    const href = a.getAttribute("href");
    if (/^\/(docs(\/|$|\?|#)|about$|history$)/.test(href)) {
      e.preventDefault();
      navigate(href);
    }
  };

  const value = { ...(data || {}), loaded: !!data, error, editor: data ? data.editor : editor, reload, theme };

  return (
    <DocsContext.Provider value={value}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div onClick={onClick} className="min-h-dvh bg-white text-slate-900 !font-sans dark:bg-neutral-950 dark:text-white [&_*]:!font-sans">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 lg:block">
          <DocsNav />
        </aside>

        <div className="lg:pl-72">
          {!editing && <DocsBar sections={data?.sections} pathname={location.pathname} onOpen={setBrowsing} />}
          {editing ? (
            <Outlet />
          ) : (
            <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-12 lg:py-12">
              <Outlet />
            </main>
          )}
        </div>

        <Sheet open={!!browsing} onClose={() => setBrowsing(false)} side="left" label="Docs" className="!bg-neutral-50 dark:!bg-neutral-900">
          <DocsNav inSheet searchFirst={browsing === "search"} />
        </Sheet>
      </div>
    </DocsContext.Provider>
  );
}

// The RecoveryBot Docs mark: the robot and "RecoveryBot", with a Docs tag
export function DocsMark({ small = false }) {
  return (
    <Link to="/docs" className="inline-flex min-w-0 items-center gap-2 !text-slate-900 !no-underline dark:!text-white" aria-label="RecoveryBot Docs home">
      <RecoveryBotMark className={small ? "h-6 w-auto shrink-0" : "h-7 w-auto shrink-0"} />
      <span className={`font-extrabold leading-none tracking-tight ${small ? "text-base" : "text-lg"}`}>
        Recovery<span className="text-brand dark:text-brand-light">Bot</span>
      </span>
      <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold uppercase leading-none tracking-wide text-white">Docs</span>
    </Link>
  );
}

// The docs' own bar on phones and tablets, at the top and staying there as you scroll: the docs
// menu, the mark, where you are (section › page), and search. Computers have the sidebar.
function DocsBar({ sections, pathname, onOpen }) {
  const section = sections?.find((s) => pathname === s.path || s.pages.some((p) => pathname === p.path || pathname === p.docs_path));
  const page = section?.pages.find((p) => pathname === p.path || pathname === p.docs_path);
  const button = "grid size-9 shrink-0 place-items-center rounded-full !bg-transparent !p-0 !text-slate-700 hover:!bg-neutral-100 dark:!text-neutral-200 dark:hover:!bg-neutral-800";
  return (
    <div className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 lg:hidden">
      <div className="flex items-center gap-1 px-2 py-2">
        <button type="button" onClick={() => onOpen("nav")} aria-label="Docs menu" className={button}>
          <Menu size={19} />
        </button>
        <DocsMark small />
        <span className="flex-1" />
        <button type="button" onClick={() => onOpen("search")} aria-label="Search the docs" className={button}>
          <Search size={18} />
        </button>
      </div>
      {section && (
        <button type="button" onClick={() => onOpen("nav")} className="flex w-full min-w-0 items-center gap-1 border-t border-neutral-100 !bg-transparent px-4 py-1.5 text-left text-xs leading-5 dark:border-neutral-900">
          <span className={`truncate ${page ? "shrink text-slate-500 dark:text-neutral-400" : "font-medium text-slate-900 dark:text-white"}`}>{section.title}</span>
          {page && (
            <>
              <ChevronRight size={13} className="shrink-0 text-slate-400" />
              <span className="truncate font-medium text-slate-900 dark:text-white">{page.title}</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
