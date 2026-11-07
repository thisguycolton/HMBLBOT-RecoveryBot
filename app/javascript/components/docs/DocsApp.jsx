import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, Menu, Search } from "lucide-react";
import Layout from "../Layout";
import Sheet from "../shell/Sheet";
import { api } from "../groups/lib";
import DocsNav from "./DocsNav";

// The Docs app around every docs page: the shell (Layout), the list of sections and pages
// (/api/docs, shared through useDocs), and the docs nav beside the page on a computer or
// behind the docs bar on phones and tablets (DocsBar). The editor takes the whole stage instead.
const DocsContext = createContext(null);
export const useDocs = () => useContext(DocsContext);

export default function DocsApp({ editor }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [browsing, setBrowsing] = useState(false); // false | "nav" | "search"
  const location = useLocation();
  const navigate = useNavigate();
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

  const value = { ...(data || {}), loaded: !!data, error, editor: data ? data.editor : editor, reload };

  return (
    <Layout isAuthenticated={document.body.dataset.currentUser === "true"}>
      <DocsContext.Provider value={value}>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div onClick={onClick} className="!font-sans [&_*]:!font-sans">
          {editing ? (
            <Outlet />
          ) : (
            <>
            <DocsBar sections={data?.sections} pathname={location.pathname} onOpen={setBrowsing} />
            <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:px-10 lg:py-10">
              <aside className="hidden lg:block">
                <div className="sticky top-[calc(var(--nav-h,4rem)+1.5rem)] max-h-[calc(100dvh-var(--nav-h,4rem)-3rem)] overflow-y-auto pb-6 pr-1">
                  <DocsNav />
                </div>
              </aside>
              <div className="min-w-0">
                <Outlet />
              </div>
            </div>
            </>
          )}
          <Sheet open={!!browsing} onClose={() => setBrowsing(false)} side="left" label="Docs" className="!bg-white p-5 dark:!bg-neutral-900">
            <div className="h-full overflow-y-auto pt-8 !font-sans">
              <DocsNav inSheet searchFirst={browsing === "search"} />
            </div>
          </Sheet>
        </div>
      </DocsContext.Provider>
    </Layout>
  );
}

// The docs' own bar on phones and tablets, under the site's top bar and staying there as you
// scroll: the docs menu, where you are (section › page), and search. Computers have the docs
// nav beside the page instead.
function DocsBar({ sections, pathname, onOpen }) {
  const section = sections?.find((s) => pathname === s.path || s.pages.some((p) => pathname === p.path || pathname === p.docs_path));
  const page = section?.pages.find((p) => pathname === p.path || pathname === p.docs_path);
  const button = "grid size-9 shrink-0 place-items-center rounded-full !bg-transparent !p-0 !text-slate-700 hover:!bg-neutral-100 dark:!text-neutral-200 dark:hover:!bg-neutral-800";
  return (
    <div className="sticky top-[var(--nav-h,3.5rem)] z-20 flex items-center gap-1 border-b border-neutral-200 bg-white/95 px-2 py-1.5 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 lg:hidden">
      <button type="button" onClick={() => onOpen("nav")} aria-label="Docs menu" className={button}>
        <Menu size={19} />
      </button>
      <button type="button" onClick={() => onOpen("nav")} className="flex min-w-0 flex-1 items-center gap-1 !bg-transparent !p-0 text-left text-sm leading-5">
        <span className="shrink-0 font-semibold text-slate-900 dark:text-white">Docs</span>
        {section && (
          <>
            <ChevronRight size={14} className="shrink-0 text-slate-400" />
            <span className={`truncate ${page ? "shrink text-slate-500 dark:text-neutral-400" : "font-medium text-slate-900 dark:text-white"}`}>{section.title}</span>
          </>
        )}
        {page && (
          <>
            <ChevronRight size={14} className="shrink-0 text-slate-400" />
            <span className="truncate font-medium text-slate-900 dark:text-white">{page.title}</span>
          </>
        )}
      </button>
      <button type="button" onClick={() => onOpen("search")} aria-label="Search the docs" className={button}>
        <Search size={18} />
      </button>
    </div>
  );
}
