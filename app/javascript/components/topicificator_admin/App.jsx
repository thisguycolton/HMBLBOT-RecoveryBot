import React, { useCallback, useEffect, useState } from "react";
import { BrowserRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { ChevronDown, ListChecks, X } from "lucide-react";
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
      <AdminShell />
    </BrowserRouter>
  );
}

// meta: sets, categories, sharing modes, tags and icons, shared by every page. Pages call
// reloadMeta() after changing any of them so counts and pickers stay current.
function AdminShell() {
  const [meta, setMeta] = useState(null);
  const [flash, setFlash] = useState(null);
  const location = useLocation();

  const reloadMeta = useCallback(async () => {
    try {
      setMeta(await api("/meta"));
    } catch (e) {
      setFlash({ type: "error", text: e.message });
    }
  }, []);

  useEffect(() => { reloadMeta(); }, [reloadMeta]);
  const section = TABS.find((t) => (t.end ? location.pathname === "/" || location.pathname.startsWith("/topics") : location.pathname.startsWith(t.to)))?.label;
  // messages clear when switching tabs, not when opening another topic
  useEffect(() => setFlash(null), [section]);

  const page = { meta, reloadMeta, notify: (text, type = "info") => setFlash({ type, text }) };

  return (
    <>
      <header className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 pt-20 pb-8 w-full mt-6">
        <div className="max-w-7xl mx-auto">
          <nav className="flex items-center text-sm text-slate-500 dark:text-neutral-400 mb-3">
            <a href="/topicificator" className="hover:text-accent transition-colors">Topicificator</a>
            <ChevronDown className="w-4 h-4 mx-2 text-slate-400 -rotate-90" />
            <span className="text-slate-900 dark:text-white font-medium">Admin · {section}</span>
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-accent-tint dark:bg-accent/30 shadow-panel flex items-center justify-center shrink-0">
                <ListChecks className="w-5 h-5 text-accent dark:text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="!text-xl !leading-tight font-semibold text-slate-900 dark:text-white !font-sans">Topicificator admin</h1>
                <p className="text-sm text-slate-600 dark:text-neutral-400 mt-0.5 !font-sans">
                  Topics, sets and categories, and how ACID QUEST offers each topic.
                </p>
              </div>
            </div>
            <nav className="flex items-stretch rounded-panel overflow-hidden shadow-panel bg-white dark:bg-surface-dark divide-x divide-neutral-200 dark:divide-neutral-700">
              {TABS.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    `px-5 py-3 text-sm transition-colors ${
                      isActive || (tab.end && location.pathname.startsWith("/topics"))
                        ? "bg-accent-tint !text-accent-ink font-semibold dark:bg-accent/35 dark:!text-white"
                        : "font-medium !text-slate-900 dark:!text-neutral-300 hover:bg-accent/5 dark:hover:bg-white/5"
                    }`
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <div className="bg-slate-50 dark:bg-neutral-950 px-4 min-[1400px]:px-8 py-6 min-h-[70vh]">
        <div className="max-w-7xl mx-auto space-y-6">
          {flash && <Flash flash={flash} onClose={() => setFlash(null)} />}
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
      </div>
    </>
  );
}

export function Flash({ flash, onClose }) {
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-panel px-4 py-3 text-sm shadow-panel ${
        flash.type === "error"
          ? "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200"
          : "bg-accent-tint text-accent-ink dark:bg-accent/30 dark:text-white"
      }`}
    >
      <span className="flex-1 !font-sans">{flash.text}</span>
      <button type="button" onClick={onClose} className="!bg-transparent opacity-60 hover:opacity-100" aria-label="Dismiss">
        <X className="w-4 h-4" />
      </button>
    </div>
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
