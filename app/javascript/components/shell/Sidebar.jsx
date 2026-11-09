import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ChevronRight, LogIn, MapPinned, UserPlus } from "lucide-react";
import Avatar from "../groups/Avatar";
import GroupLogo from "../groups/GroupLogo";
import { followLink, useMedia } from "./useShell";
import { BOTTOM_CATEGORIES, CATEGORIES, activeHref, groupItems, shows } from "./navItems";

const hasGroups = () => document.body.dataset.groups === "true";
const PANEL_ID = "side-submenu";
const EXIT_MS = 220;

// The shell's navigation: a short list of categories (navItems.js CATEGORIES), your groups and a
// few things at the bottom. Most of them open a sub menu of their pages.
// `mode`:
// - "column": the left column on wide screens (Layout.jsx). Opening a sub menu folds the list
//   down to its icons (the words fade, the column narrows) and the sub menu slides in beside it,
//   into `panelTarget`; `onSubmenu` tells the shell whether one is open. The sub menu of the page
//   you're on starts open.
// - "rail": the column collapsed to icons (useRail). A sub menu floats over the page beside it.
// - "sheet": the phone menu. A sub menu slides in over the list, with a back arrow.
export default function Sidebar({ nav, isAuthenticated, onNavigate, path = window.location.pathname, mode = "sheet", panelTarget = null, onSubmenu }) {
  const groups = nav?.groups || [];
  const who = { auth: isAuthenticated, groups: hasGroups(), host: !!(nav?.hosting?.host || nav?.hosting?.open_requests > 0) };
  const hosting = nav?.hosting?.open_requests || 0;
  const keep = (list) => list.filter((c) => shows(c, who)).map((c) => (c.items ? { ...c, items: c.items.filter((i) => shows(i, who)) } : c));
  const top = keep(CATEGORIES);
  const bottom = keep(BOTTOM_CATEGORIES);
  if (isAuthenticated && who.groups) bottom.push({ key: "me", label: "My page", href: "/people/me", person: nav?.me || { name: document.body.dataset.userName, avatar_url: document.body.dataset.avatarUrl } });
  if (!isAuthenticated && mode !== "sheet") {
    bottom.push({ key: "login", label: "Log in", href: "/users/sign_in", icon: LogIn }, { key: "signup", label: "Sign up", href: "/users/sign_up", icon: UserPlus });
  }

  // Every sub menu by key: the categories with items, then each group (`g:slug`)
  const menus = {};
  [...top, ...bottom].forEach((c) => {
    if (c.items) menus[c.key] = { key: c.key, label: c.label, items: c.items.map((i) => (i.key === "hosting" ? { ...i, badge: hosting } : i)) };
  });
  groups.forEach((g) => {
    menus[`g:${g.slug}`] = { key: `g:${g.slug}`, label: g.title, group: g, items: groupItems(g.slug, g).map((i) => ({ ...i, badge: i.count ? g[i.count] : 0 })) };
  });

  const links = [...Object.values(menus).flatMap((m) => m.items), ...[...top, ...bottom].filter((c) => c.href)];
  const here = activeHref(links.map((i) => ({ href: i.href, exact: i.exact })), path);
  // The sub menu this page is in (Give a chip and Court verification name their group in the address)
  const giving = ["/recovery/give", "/court_verifications/new"].includes(path) && new URLSearchParams(window.location.search).get("group");
  const currentGroup = groups.find((g) => path === `/groups/${g.slug}` || path.startsWith(`/groups/${g.slug}/`) || g.slug === giving)?.slug;
  const currentKey = currentGroup ? `g:${currentGroup}` : Object.values(menus).find((m) => m.items.some((i) => i.href === here))?.key || null;

  const [open, setOpen] = useState(() => (mode === "column" ? currentKey : null));
  const [cameBack, setCameBack] = useState(false); // the phone menu came back from a sub menu (slides the other way)
  const focusPanel = useRef(false);
  const navRef = useRef(null);

  // Going to another page: the column opens the sub menu that page is in (or none), the floating one closes
  useEffect(() => { if (mode === "column") setOpen(currentKey); }, [currentKey, mode]);
  useEffect(() => { if (mode === "rail") setOpen(null); }, [path, mode]);
  useLayoutEffect(() => { onSubmenu?.(mode === "column" && !!open); }, [open, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = (refocus = true) => {
    const key = open;
    setOpen(null);
    setCameBack(true);
    if (refocus && key) requestAnimationFrame(() => navRef.current?.querySelector(`[data-menu="${CSS.escape(key)}"]`)?.focus());
  };
  const toggle = (key) => {
    focusPanel.current = true;
    setCameBack(false);
    setOpen((was) => (was === key ? null : key));
  };

  // Esc closes the sub menu (the phone sheet closes itself instead)
  useEffect(() => {
    if (!open || mode === "sheet") return undefined;
    // Only while you're in the menu (or nowhere), so Esc in a page's own window doesn't close it
    const onKey = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const at = document.activeElement;
      const inMenu = navRef.current?.contains(at) || document.getElementById(PANEL_ID)?.contains(at);
      if (inMenu || !at || at === document.body) close(inMenu);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // Opened by a click or a key: focus goes to its first page
  useEffect(() => {
    if (!open || !focusPanel.current) return;
    focusPanel.current = false;
    requestAnimationFrame(() => document.getElementById(PANEL_ID)?.querySelector("a")?.focus({ preventScroll: true }));
  }, [open]);

  const compact = mode === "rail" || (mode === "column" && !!open);
  const tips = useRailTips(compact, mode === "rail" ? "calc(var(--side-w) - 0.25rem)" : "4.5rem");
  const shown = useShown(mode === "sheet" ? null : open);
  const menu = (key) => menus[key];

  const panel = shown.key && menu(shown.key) && (
    <SubMenu menu={menu(shown.key)} here={here} onBack={() => close()}
      className={mode === "rail"
        ? `fixed left-[calc(var(--side-w)+0.5rem)] top-16 z-[2300] max-h-[calc(100dvh-5rem)] w-64 overflow-y-auto rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10 ${slide(shown.visible)}`
        : `absolute inset-y-0 left-0 w-[13.25rem] overflow-y-auto pb-4 pl-2 pr-3 pt-2 ${slide(shown.visible)}`} />
  );

  // The phone menu: the sub menu instead of the list, sliding in from the right
  if (mode === "sheet" && open && menu(open)) {
    return (
      <nav aria-label="Site" className="!font-sans" onClick={(e) => { if (e.target.closest("a")) { followLink(e); onNavigate?.(); } }}>
        <SubMenu menu={menu(open)} here={here} onBack={() => close()} className="motion-safe:animate-[side-from-right_240ms_cubic-bezier(0.32,0.72,0,1)]" />
      </nav>
    );
  }

  const rowProps = (key) => ({ expanded: open === key, compact, onClick: () => toggle(key) });

  return (
    <>
      <nav ref={navRef} aria-label="Site" {...tips.handlers}
        className={`space-y-4 !font-sans ${mode === "sheet" && cameBack ? "motion-safe:animate-[side-from-left_240ms_cubic-bezier(0.32,0.72,0,1)]" : ""}`}
        onClick={(e) => { if (e.target.closest("a")) { followLink(e); onNavigate?.(); } }}>
        {!isAuthenticated && mode === "sheet" && <SignInCard />}
        <List>
          {top.map((c) => (
            <Row key={c.key} cat={c} active={c.href ? c.href === here : c.items.some((i) => i.href === here)} {...rowProps(c.key)}
              badge={c.key === "meetings" ? hosting : 0} />
          ))}
        </List>

        {isAuthenticated && (groups.length > 0 || hasGroups()) && (
          <section aria-label="Your groups" className="border-t border-neutral-300/70 pt-4 dark:border-neutral-800">
            <h2 className={`mb-1 h-5 overflow-hidden whitespace-nowrap px-3 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-slate-500 transition-opacity duration-150 dark:text-neutral-500`} style={{ opacity: compact ? 0 : 1 }} aria-hidden="true">Your groups</h2>
            <List>
              {groups.length === 0 && <Row cat={{ key: "findgroup", label: "Find your group", href: "/groups/find", icon: MapPinned }} active={false} compact={compact} />}
              {groups.map((g) => (
                <GroupRow key={g.slug} group={g} current={g.slug === currentGroup} {...rowProps(`g:${g.slug}`)}
                  waiting={menus[`g:${g.slug}`].items.reduce((n, i) => n + (i.badge || 0), 0)} />
              ))}
            </List>
          </section>
        )}

        <section className="border-t border-neutral-300/70 pt-4 dark:border-neutral-800">
          <List>
            {bottom.map((c) => (
              <Row key={c.key} cat={c} active={c.href ? c.href === here : c.items.some((i) => i.href === here)} {...rowProps(c.key)} />
            ))}
          </List>
        </section>
        {tips.tip}
      </nav>
      {panel && (mode === "rail" ? createPortal(<FloatingCloser onClose={() => close(false)}>{panel}</FloatingCloser>, document.body) : panelTarget && createPortal(
        <>
          {/* A lighter backdrop behind the sub menu, fading in (it doesn't slide); Layout.jsx draws the stage's corner beside it in the same color */}
          <div aria-hidden="true" className={`absolute inset-0 rounded-tl-2xl bg-[#f6f6f6] transition-opacity ease-out dark:bg-[#151515] ${shown.visible ? "opacity-100 duration-200" : "opacity-0 duration-150"}`} />
          {panel}
        </>,
        panelTarget,
      ))}
    </>
  );
}

// The sub menu's slide: in from a little to the left as it fades in (just a fade with reduced motion)
const slide = (visible) => `transition-[opacity,transform] ease-out motion-reduce:!translate-x-0 motion-reduce:duration-75 ${
  visible ? "opacity-100 translate-x-0 duration-200 delay-[60ms]" : "pointer-events-none opacity-0 -translate-x-3 duration-150"
}`;

// Which sub menu to draw and whether it's in: it stays a moment after closing so it can fade out
function useShown(open) {
  const [state, setState] = useState({ key: open, visible: !!open });
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  useLayoutEffect(() => {
    if (open) {
      setState((s) => ({ key: open, visible: s.visible && !!s.key }));
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => setState({ key: open, visible: true })));
      return () => cancelAnimationFrame(frame);
    }
    setState((s) => ({ ...s, visible: false }));
    const timer = setTimeout(() => setState({ key: null, visible: false }), reduced ? 80 : EXIT_MS);
    return () => clearTimeout(timer);
  }, [open, reduced]);
  return state;
}

// The floating sub menu (collapsed column) closes on a click anywhere else
function FloatingCloser({ onClose, children }) {
  useEffect(() => {
    const onDown = (e) => {
      if (e.target.closest?.(`#${PANEL_ID}, [data-menu]`)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onClose]);
  return children;
}

function List({ children }) {
  return <ul className="space-y-1.5">{React.Children.map(children, (c) => c && <li>{c}</li>)}</ul>;
}

const rowClass = (active, open) => `relative flex w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-[0.98rem] transition-colors ${
  active
    ? "!bg-white font-semibold !text-accent shadow-sm dark:!bg-neutral-800 dark:!text-sky-300"
    : open
      ? "!bg-neutral-300/60 font-normal !text-slate-900 dark:!bg-neutral-800/70 dark:!text-white"
      : "!bg-transparent font-normal !text-slate-700 hover:!bg-white/60 dark:!text-neutral-300 dark:hover:!bg-neutral-800/60"
}`;

const fade = (compact) => `min-w-0 flex-1 truncate transition-opacity duration-150 ${compact ? "opacity-0" : "delay-75"}`;

// A category: a link, or a button opening its sub menu. Compact: its icon alone, the words faded
// out (still read out), its name in a tip on hover
function Row({ cat, active, expanded = false, compact, onClick, badge = 0 }) {
  const Icon = cat.icon;
  const inner = (
    <>
      {cat.person ? <Avatar person={cat.person} size={20} className={active ? "ring-2 ring-accent" : ""} />
        : <Icon className={`size-5 shrink-0 ${active ? "" : "opacity-75"}`} strokeWidth={1.9} />}
      <span className={fade(compact)}>{cat.label}</span>
      {badge > 0 && (compact
        ? <span className="absolute left-7 top-1.5 size-2.5 rounded-full bg-accent ring-2 ring-[#ececec] dark:ring-neutral-950" />
        : <span className="min-w-6 rounded-full bg-accent px-1.5 text-center text-xs font-semibold leading-5 !text-white">{badge}</span>)}
      {cat.items && <ChevronRight className={`size-4 shrink-0 opacity-50 transition-opacity duration-150 ${compact ? "opacity-0" : ""}`} />}
    </>
  );
  if (cat.href) {
    return <a href={cat.href} aria-current={active ? "page" : undefined} data-tip={compact ? cat.label : undefined} className={rowClass(active, false)}>{inner}</a>;
  }
  return (
    <button type="button" onClick={onClick} aria-expanded={expanded} aria-controls={expanded ? PANEL_ID : undefined} data-menu={cat.key}
      data-tip={compact ? cat.label : undefined} className={rowClass(active, expanded)}>
      {inner}
    </button>
  );
}

function GroupRow({ group, current, expanded, compact, onClick, waiting }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={expanded} aria-controls={expanded ? PANEL_ID : undefined} data-menu={`g:${group.slug}`}
      data-tip={compact ? group.title : undefined}
      className={`${rowClass(false, expanded)} !px-1.5 !py-1.5`}>
      <GroupLogo group={group} className={`size-8 shrink-0 text-[0.6rem] ${current && !expanded ? "ring-2 ring-accent ring-offset-2 ring-offset-[#ececec] dark:ring-offset-neutral-950" : ""}`} />
      {waiting > 0 && <span className="absolute left-8 top-1 size-2.5 rounded-full bg-accent ring-2 ring-[#ececec] dark:ring-neutral-950" />}
      <span className={`${fade(compact)} ${current ? "font-semibold" : ""}`}>{group.title}</span>
      <ChevronRight className={`size-4 shrink-0 opacity-50 transition-opacity duration-150 ${compact ? "opacity-0" : ""}`} />
    </button>
  );
}

// A sub menu: back arrow and its name, then its pages. A new one fades its pages in
function SubMenu({ menu, here, onBack, className = "" }) {
  return (
    <nav id={PANEL_ID} aria-label={menu.label} className={`!font-sans ${className}`}
      onClick={(e) => { if (e.target.closest("a")) followLink(e); }}>
      <button type="button" onClick={onBack} aria-label={`Back from ${menu.label}`}
        className="mb-2 flex w-full items-center gap-2 rounded-xl !bg-transparent px-2 py-2 text-left text-[0.98rem] font-semibold text-slate-900 hover:!bg-white/60 dark:text-white dark:hover:!bg-neutral-800/60">
        <ArrowLeft className="size-[1.15rem] shrink-0 opacity-70" />
        {menu.group && <GroupLogo group={menu.group} className="size-6 shrink-0 text-[0.5rem]" />}
        <span className="min-w-0 flex-1 truncate">{menu.label}</span>
      </button>
      <ul key={menu.key} className="space-y-0.5 motion-safe:animate-[side-fade_160ms_ease-out]">
        {menu.items.map((item) => <li key={item.key}><Item item={item} active={item.href === here} badge={item.badge || 0} /></li>)}
      </ul>
    </nav>
  );
}

function Item({ item, active, badge = 0 }) {
  const Icon = item.icon;
  return (
    <a href={item.href} aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[0.96rem] transition-colors ${
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

function SignInCard() {
  return (
    <div className="space-y-2 rounded-2xl bg-white/70 p-3 text-sm text-slate-600 dark:bg-neutral-900 dark:text-neutral-300">
      <p className="!font-sans">Sign in to see your groups, notes and readings here.</p>
      <div className="grid grid-cols-2 gap-2">
        <a href="/users/sign_in" className="inline-flex items-center justify-center gap-1.5 rounded-xl !bg-white px-3 py-2 font-semibold !text-slate-800 ring-1 ring-neutral-200 dark:!bg-neutral-800 dark:!text-white dark:ring-neutral-700"><LogIn className="size-4" /> Log in</a>
        <a href="/users/sign_up" className="inline-flex items-center justify-center gap-1.5 rounded-xl !bg-accent px-3 py-2 font-semibold !text-white"><UserPlus className="size-4" /> Sign up</a>
      </div>
    </div>
  );
}

// The tips naming each icon while the words are hidden: on the screen itself (the column
// scrolls, which would clip anything poking out of it), put on <body> so the stage's rounded
// corner (z-40, later in the page) doesn't paint over it. Anything in the list with a data-tip gets one.
function useRailTips(on, left) {
  const [tip, setTip] = useState(null); // { label, top }
  const timer = useRef(null);
  useEffect(() => { if (!on) setTip(null); }, [on]);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!on) return { handlers: {}, tip: null };
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
      <span role="tooltip" style={{ top: tip.top, left }}
        className="pointer-events-none fixed z-[2400] -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-sm font-medium text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900">
        {tip.label}
      </span>,
      document.body,
    ),
  };
}
