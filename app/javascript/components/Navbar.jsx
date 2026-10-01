import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Menu,
  X,
  LogIn,
  LogOut,
  Plus,
  Bookmark,
  NotebookPen,
  Settings,
  ScrollText,
  Gauge,
  Moon,
  Sun,
} from "lucide-react";

import DonationModal from "./DonationModal";

export default function Navbar({
  isAuthenticated = false,
  rootPath = "/",
  topicificatorPath = "/topicificator",
  scratchpaperPath = "/host_helper/scratchpaper",
  gameServerGuidePath = "/game_server/getting_started",
  meetingReadingsPath = "/readings",
  myReadingsPath = "/readings/mine",
  serviceReadingsPath = "/service_readings",
  newReadingPath = "/readings/new",
  accountSettingsPath = "/users/edit",
  adminPath = "/admin_panel",
  loginPath = "/users/sign_in",
  logoutPath = "/users/sign_out",
  brand = "HumbleBot",
  brandSubtitle = "Beta v0.5",
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false);
  // set by the reader layout for User#suite_admin?; the admin suite checks again server-side
  const isSuiteAdmin = document.body.dataset.suiteAdmin === "true";

  const extrasRef = useRef(null);
  const accountRef = useRef(null);

  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("theme") || "system";
    } catch {
      return "system";
    }
  });
  const [donationModalOpen, setDonationModalOpen] = useState(false);
  useLayoutEffect(() => {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && systemDark);

  root.classList.toggle("dark", isDark);
  localStorage.setItem("theme", theme);

  const meta =
    document.querySelector('meta[name="theme-color"]') ||
    (() => {
      const m = document.createElement("meta");
      m.name = "theme-color";
      document.head.appendChild(m);
      return m;
    })();

  meta.content = isDark ? "#0a0a0a" : "#ffffff";
}, [theme]);

  useEffect(() => {
    const onDoc = (e) => {
      if (extrasRef.current && !extrasRef.current.contains(e.target)) {
        setExtrasOpen(false);
      }

      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountOpen(false);
      }
    };

    const onKey = (e) => {
      if (e.key === "Escape") {
        setExtrasOpen(false);
        setAccountOpen(false);
        setMobileOpen(false);
      }
    };

    document.addEventListener("click", onDoc);
    window.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("click", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function csrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.content : "";
  }

function LogoutButton({ className = "" }) {
  return (
    <a
      href={logoutPath}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white ${className}`}
      title="Sign out"
    >
      <LogOut size={16} />
      <span>Log Out</span>
    </a>
  );
}

  function AccountMenu() {
    return (
      <div className="relative" ref={accountRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setAccountOpen((v) => !v);
          }}
          className="group inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800"
          aria-expanded={accountOpen}
        >
          Account
          <ChevronDown
            size={16}
            className={`transition-transform ${accountOpen ? "rotate-180" : ""}`}
          />
        </button>

        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-b-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-neutral-900 ${
            accountOpen ? "opacity-100 scale-100" : "pointer-events-none hidden scale-95"
          } transition-all duration-150`}
        >
          <a
            href={newReadingPath}
            className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Plus className="inline pr-2"/> New Reading
          </a>
          <a
            href={myReadingsPath}
            className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <NotebookPen className="inline pr-2"/> My Readings
          </a>
          <a
            href={meetingReadingsPath}
            className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Bookmark className="inline pr-2"/> Reading Archive
          </a>

          <a
            href={scratchpaperPath}
            className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ScrollText className="inline pr-2"/> Scratchpaper
          </a>
          <button
  type="button"
  onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
  className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
>
  {theme === "dark" ? (
    <>
      <Sun className="inline pr-2" />
      Light Mode
    </>
  ) : (
    <>
      <Moon className="inline pr-2" />
      Dark Mode
    </>
  )}
</button>
          {isSuiteAdmin && (
            <a
              href={adminPath}
              className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Gauge className="inline pr-2"/> Admin
            </a>
          )}
          <a
            href={accountSettingsPath}
            className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Settings className="inline pr-2"/> Account Settings
          </a>

          <div className="mt-2">
            <LogoutButton className="!w-full" />
          </div>
        </div>
      </div>
    );
  }

  const NavLink = ({ href, children }) => (
    <a
      href={href}
      className="px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800"
    >
      {children}
    </a>
  );

  return (
    <nav
      id="site-nav"
      className="fixed top-0 inset-x-0 z-50 h-14 bg-white/90 dark:bg-neutral-900/90 backdrop-blur border-b border-slate-300 dark:border-slate-600"
      role="navigation"
      aria-label="Main"
    >
      <div className="mx-auto max-w-6xl px-3">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href={rootPath}
              className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
            >
              <span>{brand}</span>
              {brandSubtitle && (
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ps-2">
                  {brandSubtitle}
                </span>
              )}
            </a>

            <div className="ml-2 hidden md:flex items-center">
              <NavLink href={topicificatorPath}>Topicificator 9002</NavLink>
              <NavLink href={serviceReadingsPath}>Service Readings</NavLink>
              <button
                type="button"
                onClick={() => setDonationModalOpen(true)}
                className="px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800"
              >
                Donate
              </button>
              <div className="relative" ref={extrasRef}>
                <button
                  type="button"
                  onClick={() => setExtrasOpen((v) => !v)}
                  className="group inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800"
                  aria-expanded={extrasOpen}
                >
                  Extras
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${extrasOpen ? "rotate-180" : ""}`}
                  />
                </button>

                <div
                  className={`absolute left-0 mt-2 w-64 origin-top-left rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-neutral-900 ${
                    extrasOpen ? "opacity-100 scale-100" : "pointer-events-none hidden scale-95"
                  } transition-all duration-150`}
                >
                  <a
                    href={scratchpaperPath}
                    className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Scratchpaper
                  </a>
                  <a
                    href={gameServerGuidePath}
                    className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Game Server — Getting Started
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              {isAuthenticated ? (
                <AccountMenu />
              ) : (
                <a
                  href={loginPath}
                  className="inline-flex items-center gap-2 rounded-md px-3 py-2 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  title="Sign in"
                >
                  <LogIn size={16} />
                  <span className="hidden sm:inline">Login</span>
                </a>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-expanded={mobileOpen}
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`md:hidden border-t border-slate-200 dark:border-slate-800 transition-all duration-150 overflow-hidden bg-white/95 dark:bg-neutral-900/95 backdrop-blur border-b border-slate-300 dark:border-slate-600 ${
          mobileOpen ? "max-h-screen opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="mx-auto max-w-6xl px-3 py-3 space-y-1">
          <div className="rounded-md grid">
            <NavLink href={rootPath}>Home</NavLink>
            <NavLink href={topicificatorPath}>Topicificator</NavLink>
            <NavLink href={serviceReadingsPath}>Service Readings</NavLink>
            <button
            type="button"
            onClick={() => {
              setDonationModalOpen(true);
              setMobileOpen(false);
            }}
            className="text-start px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800"
          >
            Donate
          </button>
          </div>

          <div className="rounded-md">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Extras
            </div>
            <a
              href={scratchpaperPath}
              className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Scratchpaper
            </a>
            <a
              href={gameServerGuidePath}
              className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Game Server — Getting Started
            </a>
          </div>

          <div className="pt-2 grid">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Account
            </div>
            {isAuthenticated ? (
  <div className="rounded-md">
    <button
      type="button"
      onClick={() => setMobileAccountOpen((v) => !v)}
      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      aria-expanded={mobileAccountOpen}
    >
      <span>Account</span>
      <ChevronDown
        size={16}
        className={`transition-transform ${mobileAccountOpen ? "rotate-180" : ""}`}
      />
    </button>

    <div
      className={`overflow-hidden transition-all duration-200 ${
        mobileAccountOpen ? "max-h-[500px] opacity-100 mt-1" : "max-h-0 opacity-0"
      }`}
    >
      <a
        href={newReadingPath}
        className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Plus className="inline pr-2" />
        New Reading
      </a>

      <a
        href={myReadingsPath}
        className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <NotebookPen className="inline pr-2" />
        My Readings
      </a>

      <a
        href={meetingReadingsPath}
        className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Bookmark className="inline pr-2" />
        Reading Archive
      </a>

      <a
        href={scratchpaperPath}
        className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <ScrollText className="inline pr-2" />
        Scratchpaper
      </a>

      <button
        type="button"
        onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {theme === "dark" ? (
          <>
            <Sun className="inline pr-2" />
            Light Mode
          </>
        ) : (
          <>
            <Moon className="inline pr-2" />
            Dark Mode
          </>
        )}
      </button>

      {isSuiteAdmin && (
        <a
          href={adminPath}
          className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Gauge className="inline pr-2" />
          Admin
        </a>
      )}
      <a
        href={accountSettingsPath}
        className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Settings className="inline pr-2" />
        Account Settings
      </a>

      <div className="mt-2">
        <LogoutButton className="w-full" />
      </div>
    </div>
  </div>
) : (
  <a
    href={loginPath}
    className="inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
  >
    <LogIn size={16} />
    Login
  </a>
)}
          </div>
        </div>
      </div>
      <DonationModal
  isOpen={donationModalOpen}
  onClose={() => setDonationModalOpen(false)}
/>
    </nav>
  );
}