import React, { useCallback, useEffect, useState } from "react";
import { showToast } from "../../lib/toast";
import { BrowserRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { ShellStyle } from "../ui/Shell";
import AdminChrome, { BASE as SUITE_BASE } from "../admin_suite/AdminChrome";
import { api } from "./api";
import TopicsPage from "./TopicsPage";
import SetsPage from "./SetsPage";
import CategoriesPage from "./CategoriesPage";

export const BASE = "/admin_panel/topicificator";

const TABS = [
  { to: "/", label: "Topics", end: true },
  { to: "/sets", label: "Topic sets" },
  { to: "/categories", label: "Categories" },
];

export default function TopicificatorAdmin() {
  return (
    <BrowserRouter basename={BASE}>
      <ShellStyle.Provider value="card">
        <AdminShell />
      </ShellStyle.Provider>
    </BrowserRouter>
  );
}

// meta: sets, categories, sharing modes, tags and icons, shared by every page. Pages call
// reloadMeta() after changing any of them so counts and pickers stay current.
function AdminShell() {
  const [meta, setMeta] = useState(null);
  const location = useLocation();

  const reloadMeta = useCallback(async () => {
    try {
      setMeta(await api("/meta"));
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  }, []);

  useEffect(() => { reloadMeta(); }, [reloadMeta]);
  const section = TABS.find((t) => (t.end ? location.pathname === "/" || location.pathname.startsWith("/topics") : location.pathname.startsWith(t.to)))?.label;
  // Pages report results as toasts: notify("Saved.") or notify(message, "error")
  const notify = (text, type = "info") => showToast(text, { tone: type === "error" ? "error" : "success" });
  const page = { meta, reloadMeta, notify };

  return (
    <AdminChrome>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="!text-2xl font-bold !font-sans text-slate-900 dark:text-white">Topicificator admin</h1>
          <p className="!text-left text-sm text-slate-500 dark:text-neutral-400 !font-sans">Topics, sets and categories, and how ACID QUEST offers each topic.</p>
        </div>
        <div className="order-first w-full text-sm text-slate-500 dark:text-neutral-400 sm:order-none sm:w-auto">
          <a href={SUITE_BASE} className="hover:underline !text-slate-500 dark:!text-neutral-400">Admin</a>
          {" / "}
          <a href="/topicificator" className="hover:underline !text-slate-500 dark:!text-neutral-400">Topicificator</a> / {section}
        </div>
      </div>
      <nav className="mb-6 inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Topicificator admin">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `rounded-lg px-4 py-2 text-sm transition-colors ${
                isActive || (tab.end && location.pathname.startsWith("/topics"))
                  ? "bg-accent/15 font-semibold !text-accent-ink dark:!text-sky-300"
                  : "font-medium !text-slate-700 hover:bg-slate-100 dark:!text-neutral-300 dark:hover:bg-neutral-800"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-6">
        {!meta ? (
          <p className="py-16 text-center text-slate-500 dark:text-neutral-400 !font-sans">Loading…</p>
        ) : (
          <Routes>
            <Route path="/" element={<TopicsPage {...page} />} />
            <Route path="/topics/:topicId" element={<TopicsPage {...page} />} />
            <Route path="/sets" element={<SetsPage {...page} />} />
            <Route path="/categories" element={<CategoriesPage {...page} />} />
          </Routes>
        )}
      </div>
    </AdminChrome>
  );
}

// Buttons in the house style. The ! variants beat the reader styles' unlayered
// button { background-color } rule, which otherwise wins over Tailwind utilities.
export const buttonClass = {
  primary: "inline-flex items-center justify-center gap-2 rounded-xl !bg-accent px-4 py-2 text-sm font-semibold text-white shadow-panel hover:opacity-90 disabled:opacity-50",
  secondary: "inline-flex items-center justify-center gap-2 rounded-xl !bg-white dark:!bg-neutral-800 px-4 py-2 text-sm font-medium text-slate-900 dark:text-neutral-200 shadow-panel hover:!bg-neutral-50 dark:hover:!bg-neutral-700 disabled:opacity-50",
  danger: "inline-flex items-center justify-center gap-2 rounded-xl !bg-transparent px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 hover:!bg-red-50 dark:hover:!bg-red-900/20 disabled:opacity-50",
  // bare buttons (list rows, toggles, chip removers)
  bare: "!bg-transparent",
};

export const selectClass =
  "w-full px-3 py-2 text-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent";
