import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";
import Layout from "../Layout";
import Sheet from "../shell/Sheet";
import { api } from "../groups/lib";
import DocsNav from "./DocsNav";

// The Docs app around every docs page: the shell (Layout), the list of sections and pages
// (/api/docs, shared through useDocs), and the docs nav beside the page on a computer or
// behind "Browse docs" on a phone. The editor takes the whole stage instead.
const DocsContext = createContext(null);
export const useDocs = () => useContext(DocsContext);

export default function DocsApp({ editor }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [browsing, setBrowsing] = useState(false);
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
            <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:px-10 lg:py-10">
              <aside className="hidden lg:block">
                <div className="sticky top-[calc(var(--nav-h,4rem)+1.5rem)] max-h-[calc(100dvh-var(--nav-h,4rem)-3rem)] overflow-y-auto pb-6 pr-1">
                  <DocsNav />
                </div>
              </aside>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => setBrowsing(true)}
                  className="mb-5 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold !bg-neutral-100 !text-slate-700 hover:!bg-neutral-200 dark:!bg-neutral-800 dark:!text-neutral-200 lg:hidden"
                >
                  <BookOpen size={16} /> Browse docs
                </button>
                <Outlet />
              </div>
            </div>
          )}
          <Sheet open={browsing} onClose={() => setBrowsing(false)} side="left" label="Docs" className="!bg-white p-5 dark:!bg-neutral-900">
            <div className="h-full overflow-y-auto pt-8 !font-sans">
              <DocsNav />
            </div>
          </Sheet>
        </div>
      </DocsContext.Provider>
    </Layout>
  );
}
