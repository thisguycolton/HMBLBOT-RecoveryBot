import React, { useState } from "react";
import { ChevronRight, Heart, MapPinned, Moon, NotebookPen, Search, Sparkles, Sun, Library } from "lucide-react";
import DonationModal from "../DonationModal";
import HostCourtModal from "../nav/HostCourtModal";
import NotificationBell from "../NotificationBell";
import Avatar from "../groups/Avatar";
import SearchBox from "./SearchBox";
import Sheet, { SheetClose } from "./Sheet";
import Sidebar from "./Sidebar";
import TodayPanel from "./TodayPanel";
import { AccountLinks } from "./TopBar";

// The sheets and windows the shell opens (Layout.jsx, and the bare Navbar of the full-window
// tools): the phone menu, Today, quick actions, search on phones, Donate and court verification.
export function useChrome() {
  const [open, setOpen] = useState(null); // "menu" | "today" | "actions" | "search" | "donate" | "court"
  return { open, show: (which) => setOpen(which), close: () => setOpen(null) };
}

// Inside the shell (Layout.jsx) the menu and Today lie under the stage, which slides aside:
// `pushed` is the one showing, kept while the stage slides back. Elsewhere they slide over.
export function ChromeSheets({ chrome, nav, isAuthenticated, theme, path, pushed }) {
  const { open, close, show } = chrome;
  const push = pushed !== undefined;
  const showing = (which) => (push ? pushed === which : open === which);
  return (
    <>
      <Sheet open={showing("menu")} onClose={close} side="left" label="Menu" push={push} className="shell-side">
        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
          {isAuthenticated && <AccountRow nav={nav} />}
          <SearchBox className="my-4" onDone={close} />
          <Sidebar nav={nav} isAuthenticated={isAuthenticated} onNavigate={close} path={path} />
          {isAuthenticated && (
            <details className="mt-6 border-t border-neutral-300/70 pt-4 dark:border-neutral-800">
              <summary className="cursor-pointer px-2 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-slate-500">Account</summary>
              <div className="mt-2"><AccountLinks onCourt={() => show("court")} /></div>
            </details>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-neutral-300/70 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-neutral-800">
          <button type="button" onClick={() => show("donate")} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl !bg-white px-3 py-2.5 font-medium text-slate-800 ring-1 ring-neutral-300/80 dark:!bg-neutral-900 dark:text-white dark:ring-neutral-700">
            <Heart className="size-5" /> Donate
          </button>
          <button type="button" onClick={theme.toggle} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl !bg-white px-3 py-2.5 font-medium text-slate-800 ring-1 ring-neutral-300/80 dark:!bg-neutral-900 dark:text-white dark:ring-neutral-700">
            {theme.isDark ? <Moon className="size-5" /> : <Sun className="size-5" />} Theme
          </button>
          {isAuthenticated && <div className="grid h-11 place-items-center rounded-2xl bg-white px-1 ring-1 ring-neutral-300/80 dark:bg-neutral-900 dark:ring-neutral-700"><NotificationBell align="left" /></div>}
        </div>
      </Sheet>

      <Sheet open={showing("today")} onClose={close} side="right" label="Today" push={push}>
        <div className="flex items-center justify-between px-5 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Today</h2>
          <SheetClose onClose={close} />
        </div>
        <div className="m-3 mt-2 flex-1 overflow-y-auto rounded-3xl bg-white p-5 dark:bg-neutral-900">
          {isAuthenticated ? <TodayPanel today={nav?.today} /> : <p className="text-sm text-slate-600 dark:text-neutral-300">Sign in to see your groups' meetings, birthdays and events. <a href="/groups/meetings" className="font-semibold text-accent">Find a meeting</a></p>}
        </div>
      </Sheet>

      <Sheet open={open === "actions"} onClose={close} side="bottom" label="Quick actions">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">What do you need?</h2>
          <SheetClose onClose={close} />
        </div>
        <div className="grid grid-cols-2 gap-3 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {isAuthenticated && document.body.dataset.groups === "true" && <Action href="/people#write" icon={NotebookPen} label="Write a note" />}
          <Action href="/topicificator" icon={Sparkles} label="Draw a topic" />
          <Action href="/groups/meetings" icon={MapPinned} label="Find a meeting" />
          <Action href="/library" icon={Library} label="Read the literature" />
          <button type="button" onClick={() => show("search")} className="flex flex-col items-start gap-3 rounded-3xl !bg-white p-4 text-left font-semibold text-slate-900 dark:!bg-neutral-900 dark:text-white">
            <Search className="size-6 text-accent" /> Search
          </button>
        </div>
      </Sheet>

      {open === "search" && (
        <div className="fixed inset-0 z-[2200] bg-black/30 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden" onClick={(e) => e.target === e.currentTarget && close()}>
          <SearchBox autoFocus onDone={close} />
        </div>
      )}

      <DonationModal isOpen={open === "donate"} onClose={close} />
      <HostCourtModal open={open === "court"} onClose={close} />
    </>
  );
}

function AccountRow({ nav }) {
  const me = nav?.me || { name: document.body.dataset.userName, avatar_url: document.body.dataset.avatarUrl };
  return (
    <a href="/users/edit" className="flex items-center gap-3 rounded-2xl bg-neutral-300/50 p-3 dark:bg-neutral-800">
      <Avatar person={me} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-semibold text-slate-900 dark:text-white">{me.name}</span>
        <span className="block truncate text-sm text-slate-500 dark:text-neutral-400">Account and settings</span>
      </span>
      <ChevronRight className="size-5 text-slate-500" />
    </a>
  );
}

function Action({ href, icon: Icon, label }) {
  return (
    <a href={href} className="flex flex-col items-start gap-3 rounded-3xl bg-white p-4 font-semibold !text-slate-900 dark:bg-neutral-900 dark:!text-white">
      <Icon className="size-6 text-accent" /> {label}
    </a>
  );
}
