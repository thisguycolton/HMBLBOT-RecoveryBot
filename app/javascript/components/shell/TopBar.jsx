import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, FileCheck2, Heart, LogIn, LogOut, Info, Menu, Moon, Plus, Search, Settings, Smartphone, Sun, UserPlus, UserRound } from "lucide-react";
import NotificationBell from "../NotificationBell";
import Avatar from "../groups/Avatar";
import { RecoveryBotLogo } from "../brand/Logo";
import SearchBox from "./SearchBox";
import { ADMIN_ITEMS } from "../nav/siteMenu";

export const iconButton = "relative size-10 place-items-center rounded-full !bg-transparent text-slate-700 hover:!bg-white/70 dark:text-neutral-200 dark:hover:!bg-neutral-800";

// The bar along the top: on wide screens the search box, Donate, the theme, the bell and the
// account menu (the logo sits above the sidebar); on phones the menu button, the logo, a
// search button and the bell. `alwaysMenu` keeps the menu button on wide screens too, for the
// full-window tools that have no sidebar.
export default function TopBar({ nav, isAuthenticated, theme, onMenu, onDonate, onCourt, onSearch, onAside, asideLabel, alwaysMenu = false, withLogo = false }) {
  return (
    <header id="site-nav" role="navigation" aria-label="Main"
      className="shell-top flex h-full items-center gap-2 px-3 !font-sans sm:px-4 lg:gap-3 lg:px-6">
      <button type="button" onClick={onMenu} className={`${iconButton} inline-grid ${alwaysMenu ? "" : "lg:hidden"}`} aria-label="Open the menu"><Menu className="size-5" /></button>
      <a href="/" className={`${withLogo ? "" : "lg:hidden"} inline-flex items-center !text-slate-900 dark:!text-white`} aria-label="RecoveryBot home">
        <RecoveryBotLogo markClassName="h-7 w-auto" textClassName="text-xl" />
      </a>

      <SearchBox className={`hidden max-w-[44rem] flex-1 ${withLogo ? "lg:ml-6 lg:block" : "lg:block"}`} />

      <div className="ml-auto flex items-center gap-1 lg:gap-3">
        <button type="button" onClick={onSearch} className={`${iconButton} inline-grid lg:hidden`} aria-label="Search"><Search className="size-5" /></button>
        {onAside && (
          <button type="button" onClick={onAside} className={`${iconButton} hidden lg:inline-grid xl:hidden`} aria-label={asideLabel || "Side panel"} title={asideLabel}>
            <Info className="size-5" />
          </button>
        )}
        <button type="button" onClick={onDonate}
          className="hidden items-center gap-2 rounded-2xl border border-neutral-300/80 !bg-white px-4 py-2 font-medium text-slate-800 hover:!bg-rose-50 hover:text-rose-700 dark:border-neutral-700 dark:!bg-neutral-900 dark:text-neutral-100 lg:inline-flex">
          <Heart className="size-5" /> Donate
        </button>
        <button type="button" onClick={theme.toggle} className={`${iconButton} hidden lg:inline-grid`} aria-label={theme.isDark ? "Switch to light mode" : "Switch to dark mode"} title={theme.isDark ? "Light mode" : "Dark mode"}>
          {theme.isDark ? <Moon className="size-5" /> : <Sun className="size-5" />}
        </button>
        {isAuthenticated && <NotificationBell />}
        {isAuthenticated ? (
          <AccountMenu nav={nav} onCourt={onCourt} />
        ) : (
          <div className="hidden items-center gap-2 lg:flex">
            <a href="/users/sign_in" className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 font-medium !text-slate-700 hover:bg-white/70 dark:!text-neutral-200 dark:hover:bg-neutral-800"><LogIn className="size-4" /> Log in</a>
            <a href="/users/sign_up" className="inline-flex items-center gap-2 rounded-2xl !bg-accent px-4 py-2 font-semibold !text-white hover:opacity-90"><UserPlus className="size-4" /> Sign up</a>
          </div>
        )}
      </div>
    </header>
  );
}

// Set by the reader layout for User#host? and User#suite_admin?
const isHost = () => document.body.dataset.host === "true";
const isSuiteAdmin = () => document.body.dataset.suiteAdmin === "true";

export const ACCOUNT_LINKS = [
  { label: "Your profile", href: "/people/me", icon: UserRound, groups: true },
  { label: "New reading", href: "/readings/new", icon: Plus },
  { label: "Profile & account", href: "/users/edit", icon: Settings },
  { label: "Get the app", href: "/install", icon: Smartphone },
];

function AccountMenu({ nav, onCourt }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const me = nav?.me || { name: document.body.dataset.userName, avatar_url: document.body.dataset.avatarUrl };
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDoc); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const short = (me.name || "You").replace(/^(\S+)\s+(\S).*$/, "$1 $2.");
  return (
    <div ref={ref} className="relative hidden lg:block">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="true"
        className="inline-flex items-center gap-2.5 rounded-2xl border border-neutral-300/80 !bg-white py-1.5 pl-1.5 pr-3 font-medium text-slate-900 hover:border-neutral-400 dark:border-neutral-700 dark:!bg-neutral-900 dark:text-white">
        <Avatar person={me} size={32} />
        <span className="max-w-40 truncate">{short}</span>
        <ChevronDown className={`ml-2 size-4 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-[2300] mt-2 w-72 rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
          <AccountLinks onCourt={() => { setOpen(false); onCourt(); }} />
        </div>
      )}
    </div>
  );
}

// The account's own links, in the menu on wide screens and at the foot of the phone menu
export function AccountLinks({ onCourt }) {
  const groups = document.body.dataset.groups === "true";
  const row = "flex w-full items-center gap-3 rounded-xl !bg-transparent px-3 py-2 text-left text-sm !text-slate-800 hover:!bg-neutral-100 dark:!text-neutral-100 dark:hover:!bg-neutral-800";
  return (
    <>
      {ACCOUNT_LINKS.filter((i) => !i.groups || groups).map(({ label, href, icon: Icon }) => (
        <a key={href} href={href} className={row}><Icon className="size-4 opacity-70" /> {label}</a>
      ))}
      {isHost() && <button type="button" onClick={onCourt} className={row}><FileCheck2 className="size-4 opacity-70" /> Court verification</button>}
      {isSuiteAdmin() && (
        <>
          <div className="mt-2 border-t border-neutral-200 px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-neutral-700">Admin</div>
          {ADMIN_ITEMS.map(({ label, href, icon: Icon }) => <a key={href} href={href} className={row}><Icon className="size-4 opacity-70" /> {label}</a>)}
        </>
      )}
      <a href="/users/sign_out" className={`${row} mt-1 border-t border-neutral-200 !rounded-none !rounded-b-xl pt-3 dark:border-neutral-700`}><LogOut className="size-4 opacity-70" /> Log out</a>
    </>
  );
}
