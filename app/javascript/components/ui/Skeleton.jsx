import React from "react";
import { SkeletonBox } from "skullet/react";

// Skeleton placeholders: gray shapes in the layout of what's coming, shown while it loads,
// in place of "Loading…" text or a spinner. Drawn with Skullet (skullet.lochie.me):
//
//   - Where the real content can be rendered from sample data, wrap it in Skullet's own
//     <Skeleton data={…} sample={…}> (import { Skeleton } from "skullet/react"). Skullet lays the
//     content out unseen and draws a bar for each line and a block for each picture, exactly the
//     space it will take, then brings the content in over it. See GroupsIndex and PollsIndex.
//   - Everywhere else, the hand-drawn shapes below. Each shape is a Skullet SkeletonBox, so it
//     joins the page's one shimmer, in step with every other skeleton however late it mounts,
//     takes the colors set in tailwind.css (--skullet-base / --skullet-highlight, light and dark),
//     and holds still under "reduce motion". Screen readers hear "Loading…" once, from the group.
//
//   <Skeleton variant="feed" />            a whole placeholder, by the kind of page
//   <SkeletonGroup><Bone className="h-4 w-1/2" /></SkeletonGroup>   one of your own

// The bar's color, for shapes on something other than the page's white
const TONES = {
  default: null,
  // on a card that sits in a gray tray, or on the gray tray itself
  soft: "var(--skeleton-soft)",
  // on the accent-blue bands
  onAccent: "rgb(255 255 255 / 0.3)",
};

// SkeletonBox sets its size inline; ours comes from the Tailwind classes instead
const SIZED_BY_CLASS = { width: undefined, height: undefined, borderRadius: undefined };

// One shape. A span, so it can sit inside a <p>, a <button> or a heading.
export function Bone({ className = "", tone = "default", rounded = "rounded-full", style }) {
  const base = TONES[tone];
  return (
    <SkeletonBox
      className={`${rounded} ${className}`}
      style={{ ...SIZED_BY_CLASS, ...(base ? { "--skullet-base": base } : null), ...style }}
    />
  );
}

// The announced wrapper. inline: a span for a line of text (a subtitle, a count).
export function SkeletonGroup({ label = "Loading", inline = false, className = "", children }) {
  const Tag = inline ? "span" : "div";
  return (
    <Tag role="status" aria-live="polite" aria-busy="true" className={`${inline ? "inline-block align-middle" : "block"} ${className}`}>
      <span className="sr-only">{label}…</span>
      <Tag aria-hidden="true" className="contents">{children}</Tag>
    </Tag>
  );
}

// A word-sized placeholder in a line of text, e.g. a subtitle that waits on a count
export function InlineSkeleton({ className = "w-32", tone = "default", label }) {
  return (
    <SkeletonGroup inline label={label}>
      <Bone tone={tone} className={`h-[0.8em] ${className}`} />
    </SkeletonGroup>
  );
}

// Lines of text, the last one shorter, like a paragraph's ragged end
const WIDTHS = ["w-full", "w-11/12", "w-full", "w-10/12", "w-full", "w-9/12"];
export function SkeletonText({ lines = 3, className = "", lineClass = "h-3", tone, last = "w-3/5" }) {
  return (
    <span className={`block space-y-2.5 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Bone key={i} tone={tone} className={`${lineClass} ${i === lines - 1 && lines > 1 ? last : WIDTHS[i % WIDTHS.length]}`} />
      ))}
    </span>
  );
}

export function SkeletonAvatar({ size = 40, tone, className = "" }) {
  return <Bone tone={tone} className={`shrink-0 ${className}`} style={{ width: size, height: size }} />;
}

// The same frame as groups/ui Card (rounded-2xl = the 1.75rem card corner)
export function SkeletonCard({ className = "", children }) {
  return <div className={`rounded-2xl bg-white shadow-panel ring-1 ring-neutral-200/80 dark:bg-neutral-900 dark:ring-neutral-800 ${className}`}>{children}</div>;
}

// A list row: picture, a name and a line under it, and maybe a button at the end
export function SkeletonRow({ avatar = 36, square = false, lines = 2, action = false, className = "", seed = 0 }) {
  const names = ["w-2/5", "w-1/3", "w-1/2", "w-1/4"];
  const subs = ["w-3/5", "w-1/2", "w-2/3", "w-2/5"];
  return (
    <div className={`flex items-center gap-3 p-3 ${className}`}>
      {avatar ? <SkeletonAvatar size={avatar} className={square ? "!rounded-xl" : ""} /> : null}
      <span className="min-w-0 flex-1 space-y-2">
        <Bone className={`h-3.5 ${names[seed % names.length]}`} />
        {lines > 1 && <Bone className={`h-2.5 ${subs[seed % subs.length]}`} />}
      </span>
      {action && <Bone rounded="rounded-xl" className="h-8 w-20 shrink-0" />}
    </div>
  );
}

// A card of rows with hairlines between, the look of most lists here
export function SkeletonList({ rows = 4, avatar = 36, square = false, action = false, className = "" }) {
  return (
    <SkeletonCard className={`divide-y divide-neutral-200/70 dark:divide-neutral-700/60 ${className}`}>
      {Array.from({ length: rows }, (_, i) => <SkeletonRow key={i} seed={i} avatar={avatar} square={square} action={action} />)}
    </SkeletonCard>
  );
}

// The gray Writebook-style tray holding cards (groups/ui Tray)
function SkeletonTray({ label = true, children }) {
  return (
    <section>
      {label && <Bone className="mb-3 h-2.5 w-24" />}
      <div className="rounded-3xl bg-neutral-100 p-1.5 dark:bg-neutral-800/70">{children}</div>
    </section>
  );
}

// A page title, and the line under it
export function SkeletonHeader({ subtitle = true, action = false, className = "" }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="min-w-0 flex-1 space-y-2.5">
        <Bone rounded="rounded-xl" className="h-8 w-48 max-w-[60%]" />
        {subtitle && <Bone className="h-3 w-72 max-w-[80%]" />}
      </span>
      {action && <Bone rounded="rounded-xl" className="h-9 w-28 shrink-0" />}
    </div>
  );
}

// A note or highlight in the feed (notes/FeedItem)
export function SkeletonFeedItem({ seed = 0, picture = false }) {
  return (
    <SkeletonCard className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <SkeletonAvatar size={40} />
        <span className="flex-1 space-y-2">
          <Bone className={`h-3.5 ${["w-32", "w-40", "w-28"][seed % 3]}`} />
          <Bone className="h-2.5 w-20" />
        </span>
      </div>
      <SkeletonText className="mt-4" lines={[3, 2, 4][seed % 3]} />
      {picture && <Bone rounded="rounded-xl" className="mt-4 h-44 w-full" />}
      <div className="mt-4 flex gap-4">
        <Bone className="h-6 w-14" />
        <Bone className="h-6 w-14" />
        <Bone className="h-6 w-14" />
      </div>
    </SkeletonCard>
  );
}

export function SkeletonFeed({ items = 3, composer = false }) {
  return (
    <div className="space-y-4">
      {composer && (
        <SkeletonCard className="p-4">
          <Bone rounded="rounded-xl" className="h-20 w-full" />
          <div className="mt-3 flex justify-between"><Bone className="h-7 w-28" /><Bone rounded="rounded-xl" className="h-9 w-20" /></div>
        </SkeletonCard>
      )}
      {Array.from({ length: items }, (_, i) => <SkeletonFeedItem key={i} seed={i} picture={i === 1} />)}
    </div>
  );
}

// The home feed (people/PeopleIndex), drawn in the real page's own frames so nothing moves
// when it arrives: the Notes title and Your profile button, the name search, the composer card
// (the same wb-note-editor--card box) and notes in wb-feed-item boxes. PeopleIndex puts it in
// the page's own column and SkeletonToday in the Today side panel.
function SkeletonHomeNote({ seed = 0 }) {
  const lines = [["w-1/4", "w-3/5", "w-4/5", "w-2/3"], ["w-11/12"], ["w-2/3", "w-1/2"]][seed % 3];
  return (
    <div className="wb-feed-item">
      <div className="wb-feed-item__head">
        <SkeletonAvatar size={32} />
        <Bone className={`h-4 ${["w-14", "w-20", "w-16"][seed % 3]}`} />
        <Bone className="h-3 w-28" />
        <span className="flex-1" />
        <Bone className="h-6 w-28" />
        <Bone className="h-1.5 w-5" />
      </div>
      <div className="space-y-3 py-1.5">
        {lines.map((w, i) => <Bone key={i} className={`h-3.5 ${w}`} />)}
      </div>
      <div className="wb-note-actions">
        {[0, 1, 2].map((i) => <Bone key={i} className="my-1.5 mr-3 h-4 w-12 max-[30rem]:w-6" />)}
        <span className="flex-1" />
        <Bone className="my-1.5 h-4 w-20 max-[30rem]:w-6" />
      </div>
    </div>
  );
}

export function SkeletonHome({ notes = 3 }) {
  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-14 flex-1 items-center"><Bone rounded="rounded-xl" className="h-9 w-36" /></span>
        <Bone rounded="rounded-xl" className="h-10 w-[8.3rem]" />
      </div>
      <Bone rounded="rounded-xl" className="block h-11 w-full" />
      <div className="wb space-y-4">
        <div className="wb-hl-note wb-hl-note--editing wb-note-editor wb-note-editor--card">
          <div className="wb-hl-note__input wb-md-input__text !min-h-0 h-[5.7rem] max-[30rem]:h-[5.325rem]">
            <Bone className="h-3.5 w-3/4" />
          </div>
          <div className="wb-hl-note__actions">
            {/* On phones the buttons drop their words (wb-note-editor__label), so they're narrower */}
            <Bone className="h-8 w-[5.5rem] max-[30rem]:w-10" />
            <Bone className="h-6 w-28 max-[30rem]:w-14" />
            <span className="flex-1" />
            <Bone className="h-8 w-20 max-[30rem]:w-11" />
          </div>
        </div>
        <div className="wb-feed">
          {Array.from({ length: notes }, (_, i) => <SkeletonHomeNote key={i} seed={i} />)}
        </div>
      </div>
    </div>
  );
}

// The home feed's Today panel (shell/TodayPanel): the greeting, the day count line, then a note
export function SkeletonToday() {
  return (
    <div className="space-y-8 !font-sans">
      <section>
        <span className="flex h-8 items-center"><Bone rounded="rounded-lg" className="h-6 w-56" /></span>
        <Bone className="mt-4 h-3 w-11/12" />
      </section>
      <div className="space-y-2.5">
        <Bone className="h-3 w-full" />
        <Bone className="h-3 w-3/5" />
        <Bone className="mt-5 h-3 w-24" />
      </div>
    </div>
  );
}

// Chat messages: a picture and a name, then lines of different lengths
export function SkeletonMessages({ count = 7 }) {
  const shapes = [["w-3/5"], ["w-2/5", "w-1/4"], ["w-4/5", "w-3/5"], ["w-1/3"], ["w-2/3", "w-1/2", "w-1/3"], ["w-1/2"], ["w-3/4"]];
  return (
    <div className="space-y-5 px-3 py-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex gap-3">
          <SkeletonAvatar size={36} />
          <span className="min-w-0 flex-1 space-y-2 pt-0.5">
            <span className="flex items-center gap-2"><Bone className={`h-3 ${["w-24", "w-20", "w-28"][i % 3]}`} /><Bone className="h-2.5 w-10" /></span>
            {shapes[i % shapes.length].map((w, j) => <Bone key={j} className={`h-3 ${w}`} />)}
          </span>
        </div>
      ))}
    </div>
  );
}

// Group chat before the channel list arrives: channels on the left (wide screens), messages, the box
function SkeletonChat() {
  return (
    <div className="flex h-[calc(100dvh-var(--nav-h)-var(--shell-bottom,0px))] min-h-[22rem] lg:h-[calc(100dvh-var(--nav-h))]">
      <div className="hidden w-64 shrink-0 space-y-3 border-r border-neutral-200/70 p-4 md:block dark:border-neutral-800">
        <Bone rounded="rounded-xl" className="mb-5 h-6 w-36" />
        {["w-28", "w-36", "w-24", "w-32", "w-20"].map((w, i) => (
          <span key={i} className="flex items-center gap-2"><Bone rounded="rounded-md" className="size-4" /><Bone className={`h-3.5 ${w}`} /></span>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-neutral-200/70 p-4 dark:border-neutral-800"><Bone className="h-5 w-32" /><Bone className="h-3 w-48 max-w-[40%]" /></div>
        <div className="flex-1 overflow-hidden"><SkeletonMessages /></div>
        <div className="p-3"><Bone rounded="rounded-2xl" className="h-12 w-full" /></div>
      </div>
    </div>
  );
}

// Group cards in a grid (groups index, chips)
export function SkeletonCardGrid({ count = 6, picture = "cover", className = "sm:grid-cols-2 lg:grid-cols-3" }) {
  return (
    <div className={`grid gap-4 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} className="overflow-hidden">
          {picture === "cover" && <Bone rounded="rounded-none" className="h-28 w-full" />}
          <div className="p-4">
            {picture === "round" && <SkeletonAvatar size={88} className="mx-auto mb-4" />}
            <Bone className={`h-4 ${["w-2/3", "w-1/2", "w-3/5"][i % 3]} ${picture === "round" ? "mx-auto" : ""}`} />
            <Bone className={`mt-2.5 h-3 ${["w-1/2", "w-2/5", "w-1/3"][i % 3]} ${picture === "round" ? "mx-auto" : ""}`} />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

// A group's page header: the cover band with the name and buttons, then the tabs
function SkeletonHero() {
  return (
    <div className="space-y-5">
      <div className="rounded-4xl bg-neutral-100 p-6 sm:p-8 dark:bg-neutral-800/70">
        <div className="flex items-center gap-4">
          <Bone rounded="rounded-2xl" className="size-16 shrink-0" tone="soft" />
          <span className="flex-1 space-y-3">
            <Bone rounded="rounded-xl" tone="soft" className="h-7 w-64 max-w-[70%]" />
            <Bone tone="soft" className="h-3 w-48 max-w-[50%]" />
          </span>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Bone rounded="rounded-xl" tone="soft" className="h-9 w-28" />
          <Bone rounded="rounded-xl" tone="soft" className="h-9 w-24" />
          <Bone rounded="rounded-xl" tone="soft" className="h-9 w-20" />
        </div>
      </div>
      <div className="flex gap-2 overflow-hidden">
        {["w-16", "w-20", "w-24", "w-16", "w-20"].map((w, i) => <Bone key={i} className={`h-8 ${w} shrink-0`} />)}
      </div>
    </div>
  );
}

// Someone's profile: the cover, the round picture, the name, counts, then their notes
function SkeletonProfile() {
  return (
    <div className="space-y-5">
      <SkeletonCard className="overflow-hidden">
        <Bone rounded="rounded-none" className="h-32 w-full sm:h-40" />
        <div className="px-5 pb-5">
          <SkeletonAvatar size={88} className="-mt-11 ring-4 ring-white dark:ring-neutral-900" />
          <Bone rounded="rounded-xl" className="mt-4 h-6 w-48" />
          <Bone className="mt-2.5 h-3 w-28" />
          <SkeletonText className="mt-4" lines={2} />
          <div className="mt-4 flex gap-5"><Bone className="h-3.5 w-20" /><Bone className="h-3.5 w-20" /><Bone className="h-3.5 w-16" /></div>
        </div>
      </SkeletonCard>
      <SkeletonFeed items={2} />
    </div>
  );
}

// Reading a document: a title, a byline, paragraphs
function SkeletonDocument() {
  return (
    <SkeletonCard className="p-6 sm:p-8">
      <Bone rounded="rounded-xl" className="h-8 w-2/3" />
      <div className="mt-3 flex items-center gap-2"><SkeletonAvatar size={24} /><Bone className="h-3 w-40" /></div>
      <SkeletonText className="mt-8" lines={4} />
      <Bone rounded="rounded-xl" className="mt-8 h-5 w-1/3" />
      <SkeletonText className="mt-4" lines={5} />
      <SkeletonText className="mt-6" lines={3} />
    </SkeletonCard>
  );
}

// A form or an editor: labels over fields, the save button at the end
function SkeletonForm({ fields = 4 }) {
  return (
    <SkeletonCard className="space-y-5 p-5 sm:p-6">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          <Bone className={`h-3 ${["w-24", "w-32", "w-20", "w-28"][i % 4]}`} />
          <Bone rounded="rounded-xl" className={`${i === 2 ? "h-24" : "h-10"} w-full`} />
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-1"><Bone rounded="rounded-xl" className="h-9 w-20" /><Bone rounded="rounded-xl" className="h-9 w-24" /></div>
    </SkeletonCard>
  );
}

// Days of the week, each with a meeting or two (a group's week, the meeting finder)
function SkeletonSchedule({ days = 3 }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: days }, (_, d) => (
        <SkeletonTray key={d}>
          <div className="space-y-1.5">
            {Array.from({ length: d === 1 ? 1 : 2 }, (_, i) => (
              <SkeletonCard key={i} className="flex items-center gap-4 p-4 shadow-none">
                <span className="w-14 shrink-0 space-y-2"><Bone className="h-4 w-12" /><Bone className="h-2.5 w-8" /></span>
                <span className="flex-1 space-y-2"><Bone className={`h-3.5 ${["w-1/2", "w-2/5"][i % 2]}`} /><Bone className="h-2.5 w-1/3" /></span>
                <Bone rounded="rounded-xl" className="hidden h-8 w-20 sm:block" />
              </SkeletonCard>
            ))}
          </div>
        </SkeletonTray>
      ))}
    </div>
  );
}

// Sections of cards in gray trays: the dashboards (Steps, Service, Overview…)
function SkeletonTrays({ sections = 2 }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: sections }, (_, s) => (
        <SkeletonTray key={s}>
          <div className="space-y-1.5">
            {Array.from({ length: s === 0 ? 2 : 3 }, (_, i) => (
              <SkeletonCard key={i} className="p-4 shadow-none">
                <Bone className={`h-4 ${["w-1/3", "w-1/2", "w-2/5"][i % 3]}`} />
                <SkeletonText className="mt-3" lines={2} />
              </SkeletonCard>
            ))}
          </div>
        </SkeletonTray>
      ))}
    </div>
  );
}

// Stat tiles over a list (admin overview, analytics)
function SkeletonStats() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} className="p-4"><Bone className="h-2.5 w-16" /><Bone rounded="rounded-lg" className="mt-3 h-7 w-12" /></SkeletonCard>
        ))}
      </div>
      <SkeletonList rows={4} avatar={0} />
    </div>
  );
}

// Upcoming items in the side panel (shell/TodayPanel)
function SkeletonAside() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2.5">
          <Bone className="h-2.5 w-20" />
          <div className="flex items-center gap-3"><Bone rounded="rounded-xl" className="size-10 shrink-0" /><span className="flex-1 space-y-2"><Bone className="h-3 w-3/4" /><Bone className="h-2.5 w-1/2" /></span></div>
        </div>
      ))}
    </div>
  );
}

// variant: what kind of page is coming, so the shapes look like it.
//   page      a title over a few cards (the default)
//   feed      the home feed, composer on top    notes   notes without the composer
//   chat      group chat                  messages  chat messages only
//   list      rows with pictures          rows      rows only, no title (in a dialog or a card)
//   cards     a grid of cards             chips     a grid of round chips
//   group     a group's header and tabs   profile   a person's page
//   document  a document to read          form      a form or an editor
//   schedule  days with meetings          trays     sections of cards in gray trays
//   stats     number tiles over a list    text      a few lines (inside something else)
//   aside     the side panel's upcoming list
export function Skeleton({ variant = "page", label, className = "", rows, header = true }) {
  const titled = (body, opts = {}) => (
    <div className="space-y-5">
      {header && <SkeletonHeader action={opts.action} />}
      {body}
    </div>
  );
  let body;
  switch (variant) {
    case "feed": body = titled(<SkeletonFeed items={rows || 3} composer />); break;
    case "notes": body = titled(<SkeletonFeed items={rows || 3} />); break;
    case "chat": body = <SkeletonChat />; break;
    case "messages": body = <SkeletonMessages count={rows || 7} />; break;
    case "list": body = titled(<SkeletonList rows={rows || 5} />, { action: true }); break;
    case "rows": body = <div className="divide-y divide-neutral-200/70 dark:divide-neutral-700/60">{Array.from({ length: rows || 3 }, (_, i) => <SkeletonRow key={i} seed={i} />)}</div>; break;
    case "cards": body = titled(<SkeletonCardGrid count={rows || 6} />, { action: true }); break;
    case "chips": body = titled(<SkeletonCardGrid count={rows || 6} picture="round" className="grid-cols-2 sm:grid-cols-3" />, { action: true }); break;
    case "group": body = <div className="space-y-5"><SkeletonHero /><SkeletonTrays sections={1} /></div>; break;
    case "profile": body = <SkeletonProfile />; break;
    case "document": body = <SkeletonDocument />; break;
    case "form": body = titled(<SkeletonForm fields={rows || 4} />); break;
    case "schedule": body = titled(<SkeletonSchedule days={rows || 3} />); break;
    case "trays": body = titled(<SkeletonTrays sections={rows || 2} />, { action: true }); break;
    case "stats": body = titled(<SkeletonStats />); break;
    case "aside": body = <SkeletonAside />; break;
    case "text": body = <SkeletonText lines={rows || 3} />; break;
    default: body = titled(
      <div className="space-y-3">
        {Array.from({ length: rows || 3 }, (_, i) => (
          <SkeletonCard key={i} className="p-5"><Bone className={`h-4 ${["w-1/3", "w-2/5", "w-1/4"][i % 3]}`} /><SkeletonText className="mt-3" lines={2} /></SkeletonCard>
        ))}
      </div>,
    );
  }
  return <SkeletonGroup label={label} className={`!font-sans ${className}`}>{body}</SkeletonGroup>;
}

export default Skeleton;
