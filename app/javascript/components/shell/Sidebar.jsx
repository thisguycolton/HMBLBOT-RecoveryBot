import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, LogIn, MapPinned, UserPlus } from "lucide-react";
import GroupLogo from "../groups/GroupLogo";
import { followLink } from "./useShell";
import { EXPLORE_ITEMS, EXTRA_ITEMS, YOU_ITEMS, activeHref, groupItems } from "./navItems";

const OPEN_KEY = "hb-nav-open-groups";
const hasGroups = () => document.body.dataset.groups === "true";

function remembered() {
  try { return JSON.parse(localStorage.getItem(OPEN_KEY) || "[]"); } catch { return []; }
}

// The shell's navigation, in the left column on wide screens and the menu sheet on phones:
// You (your own pages), Your groups (each one folds open to its pages, the ones a role adds
// among them) and Explore (the site's tools). `rail`: the wide-screen column folded down to its
// icons (Layout.jsx, useRail), each one naming itself in a tip beside it on hover or focus.
export default function Sidebar({ nav, isAuthenticated, onNavigate, path = window.location.pathname, rail = false }) {
  const groups = nav?.groups || [];
  const groupHrefs = groups.flatMap((g) => groupItems(g.slug, g).map((i) => ({ href: i.href, exact: i.exact })));
  const you = YOU_ITEMS.filter((i) => (!i.groups || hasGroups()) && (!i.host || nav?.hosting?.host || nav?.hosting?.open_requests > 0));
  const all = [...you, ...EXPLORE_ITEMS, ...EXTRA_ITEMS].map((i) => ({ href: i.href, exact: i.exact })).concat(groupHrefs);
  const here = activeHref(all, path);
  // The group this page belongs to starts open, and any the member opened stay open
  // (Give a chip and Court verification name their group in the address)
  const giving = ["/recovery/give", "/court_verifications/new"].includes(path) && new URLSearchParams(window.location.search).get("group");
  const current = groups.find((g) => path === `/groups/${g.slug}` || path.startsWith(`/groups/${g.slug}/`) || g.slug === giving)?.slug;
  const [open, setOpen] = useState(() => new Set([...remembered(), current].filter(Boolean)));
  useEffect(() => { if (current) setOpen((was) => (was.has(current) ? was : new Set([...was, current]))); }, [current]);
  const toggle = (slug) => setOpen((was) => {
    const next = new Set(was);
    next.has(slug) ? next.delete(slug) : next.add(slug);
    try { localStorage.setItem(OPEN_KEY, JSON.stringify([...next])); } catch {}
    return next;
  });

  const tips = useRailTips(rail);

  return (
    <nav aria-label="Site" className={`${rail ? "space-y-3" : "space-y-6"} !font-sans`} {...tips.handlers}
      onClick={(e) => { if (e.target.closest("a")) { followLink(e); onNavigate?.(); } }}>
      {isAuthenticated ? (
        <Section title="You" rail={rail}>
          {you.map((item) => (
            <Item key={item.key} item={item} active={item.href === here} rail={rail}
              badge={item.key === "hosting" ? nav?.hosting?.open_requests : 0} />
          ))}
        </Section>
      ) : rail ? (
        <Section title="Account" rail={rail}>
          <Item item={{ label: "Log in", href: "/users/sign_in", icon: LogIn }} rail />
          <Item item={{ label: "Sign up", href: "/users/sign_up", icon: UserPlus }} rail />
        </Section>
      ) : (
        <div className="space-y-2 rounded-2xl bg-white/70 p-3 text-sm text-slate-600 dark:bg-neutral-900 dark:text-neutral-300">
          <p className="!font-sans">Sign in to see your groups, notes and readings here.</p>
          <div className="grid grid-cols-2 gap-2">
            <a href="/users/sign_in" className="inline-flex items-center justify-center gap-1.5 rounded-xl !bg-white px-3 py-2 font-semibold !text-slate-800 ring-1 ring-neutral-200 dark:!bg-neutral-800 dark:!text-white dark:ring-neutral-700"><LogIn className="size-4" /> Log in</a>
            <a href="/users/sign_up" className="inline-flex items-center justify-center gap-1.5 rounded-xl !bg-accent px-3 py-2 font-semibold !text-white"><UserPlus className="size-4" /> Sign up</a>
          </div>
        </div>
      )}

      {isAuthenticated && (groups.length > 0 || hasGroups()) && (
        <Section title="Your groups" rail={rail} divided={rail}>
          {groups.length === 0 && (rail ? <Item item={{ label: "Find your group", href: "/groups/find", icon: MapPinned }} rail /> : (
            <a href="/groups/find" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm !text-slate-600 hover:bg-white/60 dark:!text-neutral-300 dark:hover:bg-neutral-800/60">
              <MapPinned className="size-5 opacity-70" /> Find your group
            </a>
          ))}
          {groups.map((g) => (
            <GroupFolder key={g.slug} group={g} open={open.has(g.slug)} onToggle={() => toggle(g.slug)} here={here} current={g.slug === current} rail={rail} />
          ))}
        </Section>
      )}

      <Section title="Explore" divided={isAuthenticated} rail={rail}>
        {EXPLORE_ITEMS.map((item) => <Item key={item.key} item={item} active={item.href === here} rail={rail} />)}
        <Extras here={here} rail={rail} />
      </Section>
      {tips.tip}
    </nav>
  );
}

// The rail's tips: an item's name beside it, on the screen itself (the column scrolls, which
// would clip anything poking out of it). Anything in the rail with a data-tip gets one. It's
// put on <body>: inside the column it shares the column's z-40 layer, and the stage's rounded
// corner (also z-40, later in the page) would paint over it.
function useRailTips(rail) {
  const [tip, setTip] = useState(null); // { label, top }
  const timer = useRef(null);
  useEffect(() => { if (!rail) setTip(null); }, [rail]);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!rail) return { handlers: {}, tip: null };
  const show = (e) => {
    const el = e.target.closest?.("[data-tip]");
    if (!el) return;
    clearTimeout(timer.current);
    const box = el.getBoundingClientRect();
    setTip({ label: el.dataset.tip, top: box.top + box.height / 2 });
  };
  const hide = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setTip(null), 60); };
  return {
    handlers: { onMouseOver: show, onFocus: show, onMouseLeave: hide, onBlur: hide, onScroll: hide },
    tip: tip && createPortal(
      <span role="tooltip" style={{ top: tip.top }}
        className="pointer-events-none fixed left-[calc(var(--side-w)-0.25rem)] z-[2400] -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-sm font-medium text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900">
        {tip.label}
      </span>,
      document.body,
    ),
  };
}

function Section({ title, divided = false, rail = false, children }) {
  return (
    <section aria-label={rail ? title : undefined}
      className={divided ? `border-t border-neutral-300/70 dark:border-neutral-800 ${rail ? "pt-3" : "pt-5"}` : ""}>
      {!rail && <h2 className="mb-1.5 px-2 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-neutral-500">{title}</h2>}
      <ul className="space-y-0.5">{React.Children.map(children, (c) => c && <li>{c}</li>)}</ul>
    </section>
  );
}

function Item({ item, active, badge = 0, href = item.href, nested = false, rail = false, tip = item.label }) {
  const Icon = item.icon;
  if (rail) {
    return (
      <a href={href} aria-current={active ? "page" : undefined} aria-label={badge > 0 ? `${tip} (${badge})` : tip} data-tip={tip}
        className={`relative mx-auto grid size-11 place-items-center rounded-xl transition-colors ${
          active
            ? "bg-white !text-accent shadow-sm dark:bg-neutral-800 dark:!text-sky-300"
            : "!text-slate-700 hover:bg-white/60 dark:!text-neutral-300 dark:hover:bg-neutral-800/60"
        }`}>
        {Icon && <Icon className={`size-5 ${active ? "" : "opacity-75"}`} strokeWidth={1.9} />}
        {badge > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-accent px-1 text-center text-[0.68rem] font-semibold leading-5 !text-white">{badge > 99 ? "99+" : badge}</span>}
      </a>
    );
  }
  return (
    <a href={href} aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 ${nested ? "py-1.5 text-[0.94rem]" : "py-2 text-[0.98rem]"} transition-colors ${
        active
          ? "bg-white font-semibold !text-accent shadow-sm dark:bg-neutral-800 dark:!text-sky-300"
          : "font-normal !text-slate-700 hover:bg-white/60 dark:!text-neutral-300 dark:hover:bg-neutral-800/60"
      }`}>
      {Icon && <Icon className={`size-[1.15rem] shrink-0 ${active ? "" : "opacity-75"}`} strokeWidth={1.9} />}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {badge > 0 && <span className="min-w-6 rounded-full bg-accent px-1.5 text-center text-xs font-semibold leading-5 !text-white">{badge}</span>}
    </a>
  );
}

// One of your groups: its logo and name, folding open to its pages. In the rail, the logo
// alone, its pages' icons in a tray under it while it's open.
function GroupFolder({ group, open, onToggle, here, current, rail = false }) {
  const items = groupItems(group.slug, group);
  if (rail) {
    const waiting = items.reduce((n, i) => n + (i.count ? group[i.count] || 0 : 0), 0);
    return (
      <div className={`mx-auto w-12 rounded-2xl ${open ? "bg-neutral-300/50 pb-1 dark:bg-neutral-800" : ""}`}>
        <button type="button" onClick={onToggle} aria-expanded={open} aria-label={group.title} data-tip={group.title}
          className={`relative mx-auto grid size-12 place-items-center rounded-2xl !bg-transparent ${open ? "" : "hover:!bg-white/60 dark:hover:!bg-neutral-800/60"}`}>
          <GroupLogo group={group} className={`size-8 text-[0.6rem] ${current && !open ? "ring-2 ring-accent ring-offset-2 ring-offset-[#ececec] dark:ring-offset-neutral-950" : ""}`} />
          {!open && waiting > 0 && <span className="absolute right-0 top-0.5 size-2.5 rounded-full bg-accent ring-2 ring-[#ececec] dark:ring-neutral-950" />}
        </button>
        {open && (
          <div className="space-y-0.5">
            {items.map((item) => <Item key={item.key} item={item} active={item.href === here} rail tip={`${group.title} · ${item.label}`} badge={item.count ? group[item.count] : 0} />)}
          </div>
        )}
      </div>
    );
  }
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-[0.98rem] ${
          open || current ? "!bg-neutral-300/50 font-semibold text-slate-900 dark:!bg-neutral-800 dark:text-white" : "!bg-transparent text-slate-800 hover:!bg-white/60 dark:text-neutral-200 dark:hover:!bg-neutral-800/60"
        }`}>
        <GroupLogo group={group} className="size-8 text-[0.6rem]" />
        <span className="min-w-0 flex-1 truncate">{group.title}</span>
        {open ? <ChevronDown className="size-4 shrink-0 opacity-60" /> : <ChevronRight className="size-4 shrink-0 opacity-60" />}
      </button>
      {open && (
        <div className="mb-2 ml-5 mt-1 space-y-0.5 border-l border-neutral-300 pl-2 dark:border-neutral-700">
          {items.map((item) => <Item key={item.key} item={item} active={item.href === here} nested badge={item.count ? group[item.count] : 0} />)}
        </div>
      )}
    </div>
  );
}

// The just-for-fun tools, folded away unless you're on one
function Extras({ here, rail = false }) {
  const onOne = EXTRA_ITEMS.some((i) => i.href === here);
  const [open, setOpen] = useState(onOne);
  if (rail) {
    return (
      <>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Extras" data-tip="Extras"
          className="mx-auto grid size-11 place-items-center rounded-xl !bg-transparent text-slate-500 hover:!bg-white/60 dark:text-neutral-400 dark:hover:!bg-neutral-800/60">
          <ChevronRight className={`size-5 transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
        {open && EXTRA_ITEMS.map((item) => <Item key={item.key} item={item} active={item.href === here} rail />)}
      </>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl !bg-transparent px-3 py-2 text-left text-[0.98rem] text-slate-500 hover:!bg-white/60 dark:text-neutral-400 dark:hover:!bg-neutral-800/60">
        <ChevronRight className={`size-[1.15rem] transition-transform ${open ? "rotate-90" : ""}`} /> Extras
      </button>
      {open && EXTRA_ITEMS.map((item) => <Item key={item.key} item={item} active={item.href === here} nested />)}
    </>
  );
}
