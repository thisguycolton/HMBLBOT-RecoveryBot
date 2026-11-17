import React from "react";
import { NavLink } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { hostTools } from "../../shell/navItems";

// Host tools (the group menu's item for its hosts): everything for running a meeting, as a row of
// pills on top of each page. Host a meeting and Decks are pages here; Give a chip and Court
// verification open their own forms (for the group's hosts only, never linked publicly), so
// they're left out for anyone who can't host.
export default function HostToolsNav({ slug, canHost = true }) {
  const pill = (on) => `inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium ${
    on ? "!bg-accent !text-white" : "bg-white !text-slate-700 ring-1 ring-neutral-200 hover:bg-neutral-50 dark:bg-neutral-900 dark:!text-neutral-200 dark:ring-neutral-700"
  }`;
  return (
    <nav aria-label="Host tools" className="group-chrome space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Host tools</p>
      <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 py-0.5 sm:mx-0 sm:flex-wrap sm:px-0">
        {hostTools(slug).filter((t) => canHost || !t.away).map((t) => (t.away ? (
          <a key={t.key} href={t.href} className={pill(false)}>{t.label} <ArrowUpRight className="size-3.5 opacity-60" /></a>
        ) : (
          <NavLink key={t.key} to={t.href.replace(/^\/groups/, "")} end className={({ isActive }) => pill(isActive)}>{t.label}</NavLink>
        )))}
      </div>
    </nav>
  );
}
