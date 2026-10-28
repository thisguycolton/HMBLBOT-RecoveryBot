import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, LogIn, MapPinned, UserPlus } from "lucide-react";
import GroupLogo from "../groups/GroupLogo";
import { followLink } from "./useShell";
import { EXPLORE_ITEMS, EXTRA_ITEMS, YOU_ITEMS, activeHref, groupItems, roleHref, roleSections } from "./navItems";

const OPEN_KEY = "hb-nav-open-groups";
const hasGroups = () => document.body.dataset.groups === "true";

function remembered() {
  try { return JSON.parse(localStorage.getItem(OPEN_KEY) || "[]"); } catch { return []; }
}

// The shell's navigation, in the left column on wide screens and the menu sheet on phones:
// You (your own pages), Your groups (each one folds open to its pages, with a section for
// every role you hold there) and Explore (the site's tools).
export default function Sidebar({ nav, isAuthenticated, onNavigate, path = window.location.pathname }) {
  const groups = nav?.groups || [];
  const groupHrefs = groups.flatMap((g) => [
    ...groupItems(g.slug).map((i) => ({ href: i.href, exact: i.exact })),
    ...roleSections(g.roles).flatMap((s) => s.items.map((i) => ({ href: roleHref(g.slug, i) }))),
  ]);
  const you = YOU_ITEMS.filter((i) => (!i.groups || hasGroups()) && (!i.host || nav?.hosting?.host || nav?.hosting?.open_requests > 0));
  const all = [...you, ...EXPLORE_ITEMS, ...EXTRA_ITEMS].map((i) => ({ href: i.href, exact: i.exact })).concat(groupHrefs);
  const here = activeHref(all, path);
  // The group this page belongs to starts open, and any the member opened stay open
  const current = groups.find((g) => path === `/groups/${g.slug}` || path.startsWith(`/groups/${g.slug}/`))?.slug;
  const [open, setOpen] = useState(() => new Set([...remembered(), current].filter(Boolean)));
  useEffect(() => { if (current) setOpen((was) => (was.has(current) ? was : new Set([...was, current]))); }, [current]);
  const toggle = (slug) => setOpen((was) => {
    const next = new Set(was);
    next.has(slug) ? next.delete(slug) : next.add(slug);
    try { localStorage.setItem(OPEN_KEY, JSON.stringify([...next])); } catch {}
    return next;
  });

  return (
    <nav aria-label="Site" className="space-y-6 !font-sans" onClick={(e) => { if (e.target.closest("a")) { followLink(e); onNavigate?.(); } }}>
      {isAuthenticated ? (
        <Section title="You">
          {you.map((item) => (
            <Item key={item.key} item={item} active={item.href === here}
              badge={item.key === "hosting" ? nav?.hosting?.open_requests : 0} />
          ))}
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
        <Section title="Your groups">
          {groups.length === 0 && (
            <a href="/groups/find" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm !text-slate-600 hover:bg-white/60 dark:!text-neutral-300 dark:hover:bg-neutral-800/60">
              <MapPinned className="size-5 opacity-70" /> Find your group
            </a>
          )}
          {groups.map((g) => (
            <GroupFolder key={g.slug} group={g} open={open.has(g.slug)} onToggle={() => toggle(g.slug)} here={here} current={g.slug === current} />
          ))}
        </Section>
      )}

      <Section title="Explore" divided={isAuthenticated}>
        {EXPLORE_ITEMS.map((item) => <Item key={item.key} item={item} active={item.href === here} />)}
        <Extras here={here} />
      </Section>
    </nav>
  );
}

function Section({ title, divided = false, children }) {
  return (
    <section className={divided ? "border-t border-neutral-300/70 pt-5 dark:border-neutral-800" : ""}>
      <h2 className="mb-1.5 px-2 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-neutral-500">{title}</h2>
      <ul className="space-y-0.5">{React.Children.map(children, (c) => c && <li>{c}</li>)}</ul>
    </section>
  );
}

function Item({ item, active, badge = 0, href = item.href, nested = false }) {
  const Icon = item.icon;
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

// One of your groups: its logo and name, folding open to its pages
function GroupFolder({ group, open, onToggle, here, current }) {
  const sections = roleSections(group.roles);
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
          {groupItems(group.slug).map((item) => <Item key={item.key} item={item} active={item.href === here} nested />)}
          {sections.map((s) => (
            <div key={s.key} className="pt-2">
              <div className="px-3 pb-1 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-neutral-500">{s.title}</div>
              {s.items.map((item) => {
                const href = roleHref(group.slug, item);
                return <Item key={item.key} item={item} href={href} active={href === here} nested badge={item.count ? group[item.count] : 0} />;
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The just-for-fun tools, folded away unless you're on one
function Extras({ here }) {
  const onOne = EXTRA_ITEMS.some((i) => i.href === here);
  const [open, setOpen] = useState(onOne);
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
