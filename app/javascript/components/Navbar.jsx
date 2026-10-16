import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Heart, LogIn, LogOut, Menu, Moon, Sun, UserPlus, Users, X } from "lucide-react";

import DonationModal from "./DonationModal";
import NotificationBell from "./NotificationBell";
import { ACCOUNT_ITEMS, ADMIN_ITEMS, NAV_CATEGORIES, currentHref } from "./nav/siteMenu";
import { RecoveryBotLogo } from "./brand/Logo";

// !bg: the reader styles give every <button> a gray fill
const linkTone =
  "!bg-transparent text-slate-700 hover:text-slate-900 hover:!bg-slate-100 dark:text-slate-200 dark:hover:text-white dark:hover:!bg-slate-800";

// The site nav: one dropdown per category of tools (components/nav/siteMenu.js), the
// notification bell and the Account menu. Under md it folds into one panel.
export default function Navbar({
  isAuthenticated = false,
  rootPath = "/",
  loginPath = "/users/sign_in",
  signupPath = "/users/sign_up",
  logoutPath = "/users/sign_out",
  brandSubtitle = "Beta",
}) {
  const [openMenu, setOpenMenu] = useState(null); // a category key, "account", or null
  const [mobileOpen, setMobileOpen] = useState(false);
  const [donationModalOpen, setDonationModalOpen] = useState(false);
  const navRef = useRef(null);
  // set by the reader layout for User#suite_admin?; the admin pages check again server-side
  const isSuiteAdmin = document.body.dataset.suiteAdmin === "true";
  const here = currentHref();

  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("theme") || "system";
    } catch {
      return "system";
    }
  });
  const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && systemDark());

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    try { localStorage.setItem("theme", theme); } catch {}
    const meta =
      document.querySelector('meta[name="theme-color"]') ||
      (() => {
        const m = document.createElement("meta");
        m.name = "theme-color";
        document.head.appendChild(m);
        return m;
      })();
    meta.content = isDark ? "#0a0a0a" : "#ffffff";
  }, [theme, isDark]);

  useEffect(() => {
    const onDoc = (e) => navRef.current && !navRef.current.contains(e.target) && setOpenMenu(null);
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setOpenMenu(null);
      setMobileOpen(false);
    };
    document.addEventListener("click", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const toggle = (key) => setOpenMenu((open) => (open === key ? null : key));
  const visible = (items) => items.filter((item) => !item.auth || isAuthenticated);
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");
  const openDonation = () => {
    setOpenMenu(null);
    setMobileOpen(false);
    setDonationModalOpen(true);
  };

  // an open menu goes above the toasts (z 2000) so a site notice can't cover it
  const menuUp = openMenu !== null || mobileOpen;

  return (
    <nav
      id="site-nav"
      ref={navRef}
      className={`fixed top-0 inset-x-0 ${menuUp ? "z-[2100]" : "z-50"} h-14 bg-white/90 dark:bg-neutral-900/90 backdrop-blur border-b border-slate-300 dark:border-slate-600 !font-sans`}
      role="navigation"
      aria-label="Main"
    >
      <div className="mx-auto max-w-6xl px-3">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <a href={rootPath} className="inline-flex items-center gap-2 !text-slate-900 dark:!text-white" aria-label="RecoveryBot home">
              <RecoveryBotLogo markClassName="h-7 w-auto" textClassName="text-lg" />
              {brandSubtitle && (
                <span className="relative top-[0.15em] hidden sm:inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">{brandSubtitle}</span>
              )}
            </a>

            <div className="ml-2 hidden md:flex items-center">
              {NAV_CATEGORIES.map((category) => {
                const items = visible(category.items);
                return (
                  <Dropdown
                    key={category.key}
                    label={category.label}
                    open={openMenu === category.key}
                    onToggle={() => toggle(category.key)}
                    active={items.some((item) => item.href === here)}
                  >
                    <div className="px-3 pt-1 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {category.blurb}
                    </div>
                    {items.map((item) => (
                      <MenuItem key={item.href} item={item} current={item.href === here} />
                    ))}
                  </Dropdown>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* always in view, phones included */}
            <button
              type="button"
              onClick={openDonation}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold !bg-rose-50 !text-rose-700 ring-1 ring-rose-200 hover:!bg-rose-100 dark:!bg-rose-950/40 dark:!text-rose-300 dark:ring-rose-900 mr-1"
            >
              <Heart size={16} className="fill-current" /> Donate
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className={`hidden md:inline-flex items-center justify-center rounded-md p-2 ${linkTone}`}
              title={isDark ? "Light mode" : "Dark mode"}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {isAuthenticated && <NotificationBell />}
            <div className="hidden md:flex items-center gap-2">
              {isAuthenticated ? (
                <Dropdown label="Account" align="right" open={openMenu === "account"} onToggle={() => toggle("account")}>
                  <AccountLinks isSuiteAdmin={isSuiteAdmin} here={here} />
                  <a
                    href={logoutPath}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm bg-slate-900 !text-white hover:bg-slate-800 dark:bg-slate-100 dark:!text-slate-900 dark:hover:bg-white"
                  >
                    <LogOut size={16} /> Log Out
                  </a>
                </Dropdown>
              ) : (
                <>
                  <a href={loginPath} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${linkTone}`}>
                    <LogIn size={16} /> Log in
                  </a>
                  <a
                    href={signupPath}
                    className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold bg-accent !text-white hover:bg-accent-ink"
                  >
                    <UserPlus size={16} /> Sign up
                  </a>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className={`md:hidden inline-flex items-center justify-center rounded-md p-2 ${linkTone}`}
              aria-expanded={mobileOpen}
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Phones: every category's links in one scrolling panel */}
      <div
        className={`md:hidden border-t border-slate-200 dark:border-slate-800 transition-all duration-150 overflow-y-auto bg-white dark:bg-neutral-900 border-b border-slate-300 dark:border-slate-600 ${
          mobileOpen ? "max-h-[calc(100dvh-3.5rem)] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        }`}
      >
        <div className="mx-auto max-w-6xl px-3 py-3 space-y-3">
          {!isAuthenticated && (
            <div className="grid grid-cols-2 gap-2">
              <a href={loginPath} className="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100">
                <LogIn size={16} /> Log in
              </a>
              <a href={signupPath} className="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold bg-accent !text-white">
                <UserPlus size={16} /> Sign up
              </a>
            </div>
          )}
          {NAV_CATEGORIES.map((category) => (
            <section key={category.key}>
              <SectionLabel>{category.label}</SectionLabel>
              {visible(category.items).map((item) => (
                <MenuItem key={item.href} item={item} current={item.href === here} compact />
              ))}
            </section>
          ))}
          {isAuthenticated && (
            <section>
              <SectionLabel>Account</SectionLabel>
              <AccountLinks isSuiteAdmin={isSuiteAdmin} here={here} compact />
            </section>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex-1 !bg-transparent inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />} {isDark ? "Light mode" : "Dark mode"}
            </button>
            {isAuthenticated && (
              <a
                href={logoutPath}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm bg-slate-900 !text-white dark:bg-slate-100 dark:!text-slate-900"
              >
                <LogOut size={16} /> Log Out
              </a>
            )}
          </div>
        </div>
      </div>
      <DonationModal isOpen={donationModalOpen} onClose={() => setDonationModalOpen(false)} />
    </nav>
  );
}

function Dropdown({ label, open, onToggle, active = false, align = "left", children }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium ${linkTone} ${
          active ? "!text-accent dark:!text-sky-300" : ""
        }`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {label}
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        className={`absolute ${align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"} z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-neutral-900 ${
          open ? "block" : "hidden"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

// One link (or button) in a menu: icon tile, label and a one-line note
function MenuItem({ item, current = false, compact = false, onClick }) {
  const Icon = item.icon;
  const className = `flex w-full items-start gap-3 rounded-lg px-3 ${compact ? "py-2" : "py-2.5"} text-left ${
    current ? "!bg-accent-tint dark:!bg-accent/30" : "!bg-transparent hover:!bg-slate-100 dark:hover:!bg-slate-800"
  }`;
  const body = (
    <>
      {Icon && (
        <span
          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            current ? "bg-accent !text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          }`}
        >
          <Icon size={16} strokeWidth={2.25} />
        </span>
      )}
      <span className="min-w-0 self-center">
        <span className="block text-sm font-medium text-slate-900 dark:text-white">{item.label}</span>
        {item.note && !compact && (
          <span className="block text-xs text-slate-500 dark:text-slate-400 leading-snug">{item.note}</span>
        )}
      </span>
    </>
  );
  if (onClick) {
    return <button type="button" onClick={onClick} className={className}>{body}</button>;
  }
  return (
    <a href={item.href} className={className} aria-current={current ? "page" : undefined}>
      {body}
    </a>
  );
}

// Set by the reader layout: Groups is open to them (or they're in one), and whether to
// nudge them toward a group (User#needs_group?)
const hasGroups = () => document.body.dataset.groups === "true";
const needsGroup = () => document.body.dataset.needsGroup === "true";

function AccountLinks({ isSuiteAdmin, here, compact = false }) {
  return (
    <>
      {needsGroup() && (
        <a
          href="/groups/find"
          className="mb-2 flex items-center gap-2 rounded-md bg-accent/10 px-3 py-2 text-sm text-slate-700 hover:bg-accent/15 dark:text-slate-200"
        >
          <Users size={16} className="shrink-0 text-accent" />
          <span>You're not in a group yet · <span className="font-semibold text-accent">Find your group</span></span>
        </a>
      )}
      {ACCOUNT_ITEMS.filter((item) => !item.groups || hasGroups()).map((item) => (
        <MenuItem key={item.href} item={item} current={item.href === here} compact />
      ))}
      {isSuiteAdmin && (
        <>
          <SectionLabel className={compact ? "" : "border-t border-slate-200 dark:border-slate-700 mt-2 pt-3"}>Admin</SectionLabel>
          {ADMIN_ITEMS.map((item) => (
            <MenuItem key={item.href} item={item} compact />
          ))}
        </>
      )}
    </>
  );
}

function SectionLabel({ children, className = "" }) {
  return (
    <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${className}`}>
      {children}
    </div>
  );
}
