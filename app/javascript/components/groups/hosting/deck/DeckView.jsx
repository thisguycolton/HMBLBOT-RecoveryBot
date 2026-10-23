import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, LayoutDashboard, LayoutGrid, MessageSquare, Minus, Moon, Plus, RefreshCw, RotateCcw, ScrollText, Settings, Sun, UserCheck, Users } from "lucide-react";
import GroupLogo from "../../GroupLogo";
import { ErrorNote, Loading, Message, quietButton } from "../../ui";
import KitEditor from "../KitEditor";
import { meetingsPath } from "../../conscience/lib";
import { AWAY_MS, SIZES, iconButton, timeOf } from "../parts";
import { BLOCKS } from "./blocks";
import { EditBlock, EditDnd, EditRegion } from "./LayoutEditor";
import { LAYOUT_SIDES } from "./templates";
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
// On a phone, a block in a column shows under its own tab (a bar block's "all": the script's), null
// under none (big screens only)
const onPhone = (b, panel) => (tabOf(b) === "all" ? panel === "script" : tabOf(b) === panel);
// A block in the middle other than the script, as wide as the script's text
const mainFrame = (first) => `mx-auto max-w-3xl px-4 pb-6 sm:px-8 ${first ? "pt-5 sm:pt-8" : ""}`;
const STRIP_FRAME = "shrink-0 border-b border-neutral-200 bg-white px-4 py-2 dark:border-neutral-800 dark:bg-neutral-900";

function Block({ block, size, deck }) {
  const Component = BLOCKS[block.type].component;
  return <Component block={block} size={size} deck={deck} />;
}

// A sidebar's blocks, one under the other
function Sidebar({ side, list, deck, editor }) {
  const shownOnPhone = list.some((b) => onPhone(b, deck.panel));
  const frame = `min-h-0 overflow-y-auto border-neutral-200 p-4 lg:block ${side === "left" ? "lg:border-r" : "lg:border-l"} dark:border-neutral-800`;
  if (editor) {
    return (
      <aside className={`${frame} hidden`}>
        <EditRegion region={side} ids={list.map((b) => b.id)} className="space-y-3">
          {list.map((b) => <Editable key={b.id} block={b} region={side} size="side" deck={deck} editor={editor} />)}
        </EditRegion>
      </aside>
    );
  }
  return (
    <aside className={`${frame} ${shownOnPhone ? "block" : "hidden"}`}>
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

// A block in the layout editor, with what it says when it has nothing to show yet
function Editable({ block, region, size, deck, editor, className }) {
  const info = BLOCKS[block.type];
  const placeholder = info.empty?.(deck) || info.placeholder?.(deck, size) ? info.note : null;
  // A meeting's kit part (its postings, readings...) is set up from its block, for host coordinators;
  // a deck's script from the deck's settings
  const kit = deck.center.can_edit && info.kit && (deck.center.deck ? info.kit === "script" : true);
  return (
    <EditBlock block={block} region={region} setDraft={editor.setDraft} placeholder={placeholder} className={className}
      onKit={kit ? () => deck.setSetup(deck.center.deck ? true : info.kit) : null}>
      <Block block={block} size={size} deck={deck} />
    </EditBlock>
  );
}

// A meeting's HostDeck (/groups/:slug/host/:meetingId), laid out by `template` (templates.js):
// the header, the phone tabs, the strip of reminders, the columns, and the bar along the bottom.
// The header is the same on every deck.
// While the layout is being edited (`editor`: { draft, setDraft, toolbar }), the template is
// the draft, every region takes dropped blocks, and the blocks can't be clicked.
// `renderSetup()`: what the gear opens (a meeting's kit, else a deck's settings).
export default function DeckView({ deck, template: saved, editor = null, canArrange = false, onEdit, renderSetup = null }) {
  const template = editor ? editor.draft : saved;
  const { slug, center, live, error, panel, setPanel } = deck;
  // A deck of its own goes back to the group's HostDeck list (a business meeting's to the group's
  // business meetings, where every member finds it); a meeting's to its hosts
  const back = center?.deck ? (center.deck.purpose === "business_meeting" ? meetingsPath(slug) : `/${slug}/host`) : `/${slug}/hosts`;
  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 px-4 dark:bg-neutral-950">
        <Message title={error.status === 403 ? "This is for the group's hosts" : "That meeting isn't here"} text={error.message}>
          <Link to={back} className="mt-4 inline-block text-sm text-accent hover:underline">Back to the group</Link>
        </Message>
      </div>
    );
  }
  if (!center || !live) return <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950"><Loading /></div>;

  const { dark, size } = deck;
  const others = live.presences.filter((p) => !p.me && deck.now - new Date(p.last_seen_at).getTime() < AWAY_MS);
  const hosts = [center.hosts.host && `Host: ${center.hosts.host}`, center.hosts.co_host && `Co-host: ${center.hosts.co_host}`].filter(Boolean).join(" · ");
  const layout = GRID[template.layout] != null ? template.layout : "both";
  // While editing, every block shows, even one with nothing in it yet
  const pick = editor ? (list) => (list || []).filter((b) => BLOCKS[b.type]) : (list) => present(list, deck);
  const sides = LAYOUT_SIDES[layout];
  const left = sides.includes("left") ? pick(template.left) : [];
  const right = sides.includes("right") ? pick(template.right) : [];
  const main = pick(template.main);
  const bar = pick(template.bar);
  const strip = pick(template.strip);
  // The columns there are: a sidebar with no blocks isn't one (unless it's being edited)
  const hasLeft = left.length > 0 || (!!editor && sides.includes("left"));
  const hasRight = right.length > 0 || (!!editor && sides.includes("right"));
  const columns = hasLeft && hasRight ? "both" : hasLeft ? "left" : hasRight ? "right" : "focus";
  const tabs = template.tabs.filter(([key]) => [...left, ...main, ...right].some((b) => tabOf(b) === key));
  const mainOnPhone = main.some((b) => onPhone(b, panel));

  const page = (
    <div className={`hc-root flex h-dvh flex-col bg-neutral-50 !font-sans text-slate-900 dark:bg-neutral-950 dark:text-white ${dark ? "doc-dark" : ""}`}>
      <header className="flex shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2 sm:gap-3 sm:px-4 dark:border-neutral-800 dark:bg-neutral-900">
        <Link to={back} className={iconButton} aria-label={center.deck ? "Back to HostDeck" : "Back to the group's hosts"} title="Back to the group"><ArrowLeft className="size-5" /></Link>
        <GroupLogo group={center.group} className="hidden size-8 text-xs sm:grid" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold sm:text-base">HostDeck</p>
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
          {!editor && <button type="button" className={iconButton} onClick={deck.reset} disabled={!deck.sections.length} aria-label="Reset the deck" title="Reset: back to the first section, nothing ticked off"><RotateCcw className="size-5" /></button>}
          <button type="button" className={iconButton} onClick={deck.toggleDark} aria-label={dark ? "Light mode" : "Dark mode"} title={dark ? "Light mode" : "Dark mode"}>{dark ? <Sun className="size-5" /> : <Moon className="size-5" />}</button>
          {canArrange && !editor && <button type="button" className={`${iconButton} !hidden lg:!inline-grid`} onClick={onEdit} aria-label="Edit the layout" title="Edit the layout: move blocks, pick sidebars"><LayoutDashboard className="size-5" /></button>}
          {center.can_edit && <button type="button" className={iconButton} onClick={() => deck.setSetup(true)} aria-label={center.deck ? "Deck settings" : "Set up the kit"} title={center.deck ? "The deck's name and document" : "Set up the script, postings and readings"}><Settings className="size-5" /></button>}
        </div>
      </header>

      {/* On a phone, one column at a time */}
      <nav className="flex shrink-0 gap-1 border-b border-neutral-200 bg-white px-2 lg:hidden dark:border-neutral-800 dark:bg-neutral-900" aria-label="HostDeck sections">
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
      {editor?.toolbar}
      {deck.layoutChanged && !editor && (
        <div role="status" className="flex shrink-0 items-center gap-2 border-b border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100">
          <LayoutDashboard className="size-4 shrink-0" /><p className="min-w-0 flex-1">This deck's layout was changed. Reload when you're ready to see it.</p>
          <button type="button" className={`${quietButton} !px-3 !py-1`} onClick={deck.reload}><RefreshCw className="size-4" /> Reload</button>
        </div>
      )}
      {editor ? (
        <EditRegion region="strip" ids={strip.map((b) => b.id)} className="m-2 flex shrink-0 gap-2">
          {strip.map((b) => <Editable key={b.id} block={b} region="strip" size="bar" deck={deck} editor={editor} className="flex-1" />)}
        </EditRegion>
      ) : strip.map((b) => (b.type === "reminders" ? <Block key={b.id} block={b} size="bar" deck={deck} />
        : <div key={b.id} className={STRIP_FRAME}><Block block={b} size="bar" deck={deck} /></div>))}

      {/* on a phone, the columns with something under the tab stack up and scroll together */}
      <div className={`grid min-h-0 flex-1 max-lg:content-start max-lg:overflow-y-auto ${GRID[columns]}`}>
        {hasLeft && <Sidebar side="left" list={left} deck={deck} editor={editor} />}

        <main className={`min-h-0 overflow-y-auto lg:block ${mainOnPhone || editor ? "block" : "hidden"} ${editor ? "p-2" : ""}`}>
          {editor
            ? <EditRegion region="main" ids={main.map((b) => b.id)} className="space-y-3">{main.map((b) => <Editable key={b.id} block={b} region="main" size="main" deck={deck} editor={editor} />)}</EditRegion>
            : main.map((b, i) => (b.type === "stage"
              ? <div key={b.id} className={onPhone(b, panel) ? "" : "hidden lg:block"}><Block block={b} size="main" deck={deck} /></div>
              : <div key={b.id} className={`${mainFrame(i === 0)} ${onPhone(b, panel) ? "" : "hidden lg:block"} ${BLOCKS[b.type].collapse ? "empty:hidden" : ""}`}><Block block={b} size="main" deck={deck} /></div>))}
        </main>

        {hasRight && <Sidebar side="right" list={right} deck={deck} editor={editor} />}
      </div>

      {(bar.length > 0 || editor) && (
        <footer className="flex shrink-0 items-center gap-2 border-t border-neutral-200 bg-white px-3 py-2 sm:gap-3 sm:px-4 sm:py-3 dark:border-neutral-800 dark:bg-neutral-900">
          {editor ? (
            <EditRegion region="bar" ids={bar.map((b) => b.id)} className="flex min-w-0 flex-1 items-stretch gap-2">
              {bar.map((b) => <Editable key={b.id} block={b} region="bar" size="bar" deck={deck} editor={editor} className={b.grow ? "flex-1" : "w-40 shrink-0"} />)}
            </EditRegion>
          ) : bar.map((b, i) => (b.grow
            ? <div key={b.id} className="min-w-0 flex-1"><Block block={b} size="bar" deck={deck} /></div>
            : (
              <React.Fragment key={b.id}>
                {/* nothing stretches: the last block (Next) still goes to the right */}
                {i === bar.length - 1 && i > 0 && !bar.some((x) => x.grow) && <span className="flex-1" />}
                <Block block={b} size="bar" deck={deck} />
              </React.Fragment>
            )))}
        </footer>
      )}

      {deck.setup && renderSetup && renderSetup()}
      {deck.setup && !renderSetup && <KitEditor center={center} only={typeof deck.setup === "string" ? deck.setup : null} onClose={() => deck.setSetup(false)} onSaved={(c) => { deck.setCenter(c); deck.applyLive(c.live); }} />}
    </div>
  );
  return editor ? <EditDnd draft={editor.draft} setDraft={editor.setDraft}>{page}</EditDnd> : page;
}
