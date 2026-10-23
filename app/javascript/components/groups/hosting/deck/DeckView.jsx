import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, LayoutGrid, MessageSquare, Minus, Moon, Plus, ScrollText, Settings, Sun, UserCheck, Users } from "lucide-react";
import GroupLogo from "../../GroupLogo";
import { ErrorNote, Loading, Message } from "../../ui";
import KitEditor from "../KitEditor";
import { AWAY_MS, SIZES, iconButton, timeOf } from "../parts";
import { BLOCKS } from "./blocks";
import "../hosting.css";

// The columns each layout has, and their widths on a big screen
const GRID = {
  both: "lg:grid-cols-[17rem_minmax(0,1fr)_22rem]",
  left: "lg:grid-cols-[17rem_minmax(0,1fr)]",
  right: "lg:grid-cols-[minmax(0,1fr)_22rem]",
  focus: "",
};
const TAB_ICONS = { script: ScrollText, chat: MessageSquare, readings: BookOpen, people: Users };

// The blocks in a region that have something to show
const present = (list, deck) => (list || []).filter((b) => BLOCKS[b.type] && !BLOCKS[b.type].empty?.(deck));
const tabOf = (b) => BLOCKS[b.type].tab;
// On a phone, a block shows under its own tab; "all" is every tab, null none (big screens only)
const onPhone = (b, panel) => tabOf(b) === "all" || tabOf(b) === panel;

function Block({ block, size, deck }) {
  const Component = BLOCKS[block.type].component;
  return <Component block={block} size={size} deck={deck} />;
}

// A sidebar's blocks, one under the other
function Sidebar({ side, list, deck }) {
  const shownOnPhone = list.some((b) => onPhone(b, deck.panel));
  return (
    <aside className={`min-h-0 overflow-y-auto border-neutral-200 p-4 lg:block ${side === "left" ? "lg:border-r" : "lg:border-l"} dark:border-neutral-800 ${shownOnPhone ? "block" : "hidden"}`}>
      <div>
        {list.map((b, i) => {
          const gap = i === list.length - 1 ? "" : list[i + 1].tight ? "mb-5" : "mb-6";
          return (
            <div key={b.id} className={`${gap} ${onPhone(b, deck.panel) ? "" : "hidden lg:block"} ${BLOCKS[b.type].collapse ? "empty:hidden" : ""}`}>
              <Block block={b} size="side" deck={deck} />
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// A meeting's HostDeck (/groups/:slug/host/:meetingId), laid out by `template` (templates.js):
// the header, the phone tabs, the strip of reminders, the columns, and the bar along the bottom.
// The header is the same on every deck.
export default function DeckView({ deck, template }) {
  const { slug, center, live, error, panel, setPanel } = deck;
  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 px-4 dark:bg-neutral-950">
        <Message title={error.status === 403 ? "This is for the group's hosts" : "That meeting isn't here"} text={error.message}>
          <Link to={`/${slug}/hosts`} className="mt-4 inline-block text-sm text-accent hover:underline">Back to the group</Link>
        </Message>
      </div>
    );
  }
  if (!center || !live) return <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950"><Loading /></div>;

  const { dark, size } = deck;
  const others = live.presences.filter((p) => !p.me && deck.now - new Date(p.last_seen_at).getTime() < AWAY_MS);
  const hosts = [center.hosts.host && `Host: ${center.hosts.host}`, center.hosts.co_host && `Co-host: ${center.hosts.co_host}`].filter(Boolean).join(" · ");
  const layout = GRID[template.layout] != null ? template.layout : "both";
  const left = layout === "both" || layout === "left" ? present(template.left, deck) : [];
  const right = layout === "both" || layout === "right" ? present(template.right, deck) : [];
  const main = present(template.main, deck);
  const bar = present(template.bar, deck);
  const tabs = template.tabs.filter(([key]) => [...left, ...main, ...right].some((b) => tabOf(b) === key));
  const mainOnPhone = main.some((b) => onPhone(b, panel));

  return (
    <div className={`hc-root flex h-dvh flex-col bg-neutral-50 !font-sans text-slate-900 dark:bg-neutral-950 dark:text-white ${dark ? "doc-dark" : ""}`}>
      <header className="flex shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2 sm:gap-3 sm:px-4 dark:border-neutral-800 dark:bg-neutral-900">
        <Link to={`/${slug}/hosts`} className={iconButton} aria-label="Back to the group's hosts" title="Back to the group"><ArrowLeft className="size-5" /></Link>
        <GroupLogo group={center.group} className="hidden size-8 text-xs sm:grid" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold sm:text-base">Hosting Command Center</p>
          <p className="truncate text-xs text-slate-500 dark:text-neutral-400">
            {center.meeting.name} · {new Date(`${center.on}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
            {center.starts_at && ` at ${timeOf(center.starts_at, center.meeting.time_zone)}`}
          </p>
        </div>
        <span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${others.length ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-neutral-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"}`}
          title={others.length ? `${others.map((p) => p.name).join(", ")} here too` : "Nobody else has this open"}>
          <span className={`size-2 rounded-full ${others.length ? "animate-pulse bg-emerald-500" : "bg-slate-400"}`} /> {others.length ? "Live" : "Only you"}
        </span>
        {hosts && <span className="hidden max-w-xs truncate text-sm text-slate-600 lg:inline dark:text-neutral-300"><UserCheck className="mr-1 inline size-4" />{hosts}</span>}
        <div className="flex items-center">
          <button type="button" className={iconButton} onClick={() => deck.changeSize(-1)} disabled={size === SIZES[0]} aria-label="Smaller script text" title="Smaller text"><Minus className="size-4" /></button>
          <button type="button" className={iconButton} onClick={() => deck.changeSize(1)} disabled={size === SIZES[SIZES.length - 1]} aria-label="Bigger script text" title="Bigger text"><Plus className="size-4" /></button>
          <button type="button" className={iconButton} onClick={deck.toggleDark} aria-label={dark ? "Light mode" : "Dark mode"} title={dark ? "Light mode" : "Dark mode"}>{dark ? <Sun className="size-5" /> : <Moon className="size-5" />}</button>
          {center.can_edit && <button type="button" className={iconButton} onClick={() => deck.setSetup(true)} aria-label="Set up the kit" title="Set up the script, postings and readings"><Settings className="size-5" /></button>}
        </div>
      </header>

      {/* On a phone, one column at a time */}
      <nav className="flex shrink-0 gap-1 border-b border-neutral-200 bg-white px-2 lg:hidden dark:border-neutral-800 dark:bg-neutral-900" aria-label="Command Center sections">
        {tabs.map(([key, text]) => {
          const Icon = TAB_ICONS[key] || LayoutGrid;
          return (
            <button key={key} type="button" onClick={() => setPanel(key)} aria-pressed={panel === key}
              className={`-mb-px inline-flex flex-1 items-center justify-center gap-1.5 border-b-2 !bg-transparent px-2 py-2.5 text-sm font-medium ${panel === key ? "border-accent text-accent" : "border-transparent text-slate-600 dark:text-neutral-400"}`}>
              <Icon className="size-4" /> {text}{key === "people" && others.length > 0 && <span className="size-1.5 rounded-full bg-emerald-500" />}
            </button>
          );
        })}
      </nav>

      {deck.actionError && <div className="px-4 pt-2"><ErrorNote error={deck.actionError} /></div>}
      {present(template.strip, deck).map((b) => <Block key={b.id} block={b} size="bar" deck={deck} />)}

      <div className={`grid min-h-0 flex-1 ${GRID[layout]}`}>
        {left.length > 0 && <Sidebar side="left" list={left} deck={deck} />}

        <main className={`min-h-0 overflow-y-auto lg:block ${mainOnPhone ? "block" : "hidden"}`}>
          {main.map((b) => <Block key={b.id} block={b} size="main" deck={deck} />)}
        </main>

        {right.length > 0 && <Sidebar side="right" list={right} deck={deck} />}
      </div>

      {bar.length > 0 && (
        <footer className="flex shrink-0 items-center gap-2 border-t border-neutral-200 bg-white px-3 py-2 sm:gap-3 sm:px-4 sm:py-3 dark:border-neutral-800 dark:bg-neutral-900">
          {bar.map((b) => (b.grow
            ? <div key={b.id} className="min-w-0 flex-1"><Block block={b} size="bar" deck={deck} /></div>
            : <Block key={b.id} block={b} size="bar" deck={deck} />))}
        </footer>
      )}

      {deck.setup && <KitEditor center={center} onClose={() => deck.setSetup(false)} onSaved={(c) => { deck.setCenter(c); deck.applyLive(c.live); }} />}
    </div>
  );
}
