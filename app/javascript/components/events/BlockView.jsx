import React, { useState } from "react";
import { BarChart3, CalendarClock, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import Markdown from "../book/Markdown";
import GroupBlockView from "../groups/page/GroupBlocks";
import Lightbox from "./Lightbox";
import { tone } from "./lib";

// Whether a block shows its smaller view: size "auto" follows its column (the side column
// is small, except in the centered layout where everything is in the middle).
export const isCompact = (block, layout) =>
  block.size === "compact" || (block.size !== "full" && block.region === "side" && layout !== "centered");

// How each HMBLBOT Editor block looks on the event page (and, live, in the editor). Every
// block has a smaller view for the side column (`compact`) and a larger one for the main
// column. `editing` turns off the shadow box so clicks select the block instead. `polls`
// are the event's schedule polls, for Poll blocks. On a group page, `context` is the group
// (app/services/group_page.rb): what its own blocks list, and its name for {{group}}.
export default function BlockView({ block, compact = false, editing = false, polls = [], context = null }) {
  const props = { block, compact, editing };
  const fill = (text) => fillGroup(text, context);
  switch (block.type) {
    case "heading": return <HeadingView {...props} text={fill(block.text)} />;
    case "notes": return <MarkdownCard block={block} compact={compact} markdown={fill(block.markdown)} placeholder={editing ? "Write some notes…" : null} badge={block.update ? "Update" : null} />;
    case "guidelines": return <MarkdownCard block={block} compact={compact} markdown={fill(block.markdown)} placeholder={editing ? "Add the guidelines…" : null} />;
    case "agenda": return <AgendaView {...props} />;
    case "photo": return <PhotoView {...props} />;
    case "gallery": return <GalleryView {...props} />;
    case "poll": return <PollView {...props} poll={polls.find((p) => p.token === block.poll_token)} />;
    default: return context ? <GroupBlockView {...props} context={context} fill={fill} /> : null;
  }
}

// {{group}} is the group's name on a group page (the default page uses it)
export const fillGroup = (text, context) => (context?.group?.title && text ? text.replace(/\{\{\s*group\s*\}\}/g, context.group.title) : text);

// A colored frame around photos, once the block has a color
const Frame = ({ block, compact, children }) => {
  const frame = tone(block).frame;
  return frame ? <div className={`rounded-3xl ${frame} ${compact ? "p-2" : "p-3"}`}>{children}</div> : children;
};

const HEADING_SIZE = { 1: "text-4xl sm:text-5xl font-extrabold", 2: "text-2xl sm:text-3xl font-bold", 3: "text-xl font-semibold" };
const COMPACT_HEADING_SIZE = { 1: "text-2xl font-extrabold", 2: "text-xl font-bold", 3: "text-base font-semibold" };
const ALIGN = { left: "text-left", center: "text-center", right: "text-right" };

export function HeadingView({ block, compact, text = block.text }) {
  const Tag = `h${Math.min(Math.max(block.level || 2, 1), 3) + 1}`;
  const sizes = compact ? COMPACT_HEADING_SIZE : HEADING_SIZE;
  return (
    <Tag className={`ev-heading tracking-tight ${tone(block).text} ${sizes[block.level] || sizes[2]} ${ALIGN[block.align] || ""}`}>
      {text || "\u00a0"}
    </Tag>
  );
}

export function MarkdownCard({ block, markdown, placeholder, badge, compact }) {
  const empty = !markdown?.trim();
  if (empty && !placeholder) return null;
  const t = tone(block);
  return (
    <div className={`rounded-2xl ${compact ? "p-4 text-sm" : "p-5 sm:p-6 text-base"} ${t.card}`}>
      {badge && <span className={`mb-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${t.soft}`}>{badge}</span>}
      {empty ? <p className="text-sm italic text-slate-400">{placeholder}</p> : <Markdown source={markdown} className="ev-md" />}
    </div>
  );
}

function AgendaView({ block, editing, compact }) {
  const activities = block.activities || [];
  const [open, setOpen] = useState(null);
  const photos = activities.filter((a) => a.image_url).map((a) => ({ url: a.image_url, caption: a.title }));
  const show = (a) => !editing && a.image_url && setOpen(photos.findIndex((p) => p.url === a.image_url));

  const t = tone(block);

  return (
    <section className={`rounded-2xl ${t.card} ${compact ? "p-4" : "p-5 sm:p-6"}`}>
      {block.title && <h3 className={`mb-3 font-semibold text-slate-900 dark:text-white ${compact ? "text-base" : "text-lg"}`}>{block.title}</h3>}
      {activities.length === 0 && <p className="text-sm italic text-slate-400">{editing ? "Add activities in the panel on the right." : "Nothing on the agenda yet."}</p>}
      {compact ? (
        // The side column's view: a tight numbered timeline
        <ol className="relative space-y-3 before:absolute before:inset-y-1 before:left-3 before:w-px before:bg-neutral-200 dark:before:bg-neutral-700">
          {activities.map((a) => (
            <li key={a.id} className="relative flex items-start gap-3">
              <span className={`relative grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${t.strong}`}>{a.queue_number}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-6 text-slate-900 dark:text-white">{a.title}</p>
                {a.description && <p className="line-clamp-2 text-xs text-slate-600 dark:text-neutral-400">{a.description}</p>}
              </div>
              {a.image_url && (
                <button type="button" onClick={() => show(a)} className="shrink-0 !bg-transparent !p-0">
                  <img src={a.image_url} alt="" className="size-10 rounded-lg object-cover" />
                </button>
              )}
            </li>
          ))}
        </ol>
      ) : block.view === "grid" ? (
        <ol className="grid gap-3 grid-cols-2 sm:[grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))]">
          {activities.map((a) => (
            <li key={a.id} className="overflow-hidden rounded-xl bg-neutral-50 ring-1 ring-neutral-200 dark:bg-neutral-800/60 dark:ring-neutral-700">
              {a.image_url ? (
                <button type="button" onClick={() => show(a)} className="block w-full !bg-transparent !p-0">
                  <img src={a.image_url} alt="" className="aspect-[4/3] w-full object-cover" />
                </button>
              ) : (
                <div className={`grid aspect-[4/3] place-items-center text-3xl font-bold ${t.soft}`}>{a.queue_number}</div>
              )}
              <div className="p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">#{a.queue_number}</p>
                <p className="font-semibold text-slate-900 dark:text-white">{a.title}</p>
                {a.description && <p className="mt-0.5 text-sm text-slate-600 dark:text-neutral-300">{a.description}</p>}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="space-y-2">
          {activities.map((a) => (
            <li key={a.id} className="flex items-start gap-3 rounded-xl p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
              <span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${t.strong}`}>{a.queue_number}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 dark:text-white">{a.title}</p>
                {a.description && <p className="text-sm text-slate-600 dark:text-neutral-300">{a.description}</p>}
              </div>
              {a.image_url && (
                <button type="button" onClick={() => show(a)} className="shrink-0 !bg-transparent !p-0">
                  <img src={a.image_url} alt="" className="size-20 rounded-xl object-cover" />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      {open != null && open >= 0 && <Lightbox photos={photos} index={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function EmptyPhotos({ editing, label }) {
  if (!editing) return null;
  return (
    <div className="grid aspect-[16/9] place-items-center rounded-2xl border-2 border-dashed border-neutral-300 text-slate-400 dark:border-neutral-700">
      <span className="flex items-center gap-2 text-sm"><ImageIcon className="size-5" /> {label}</span>
    </div>
  );
}

// One picture, or a carousel once there's more than one. Click for the shadow box.
function PhotoView({ block, editing, compact }) {
  const photos = block.photos || [];
  const [at, setAt] = useState(0);
  const [open, setOpen] = useState(null);
  if (!photos.length) return <EmptyPhotos editing={editing} label="Add photos in the panel on the right" />;

  const i = Math.min(at, photos.length - 1);
  const photo = photos[i];
  const many = photos.length > 1;
  const arrow = `absolute top-1/2 -translate-y-1/2 grid ${compact ? "size-7" : "size-10"} place-items-center rounded-full !bg-black/45 text-white hover:!bg-black/65`;

  return (
    <Frame block={block} compact={compact}>
    <figure className="relative">
      <div className="relative overflow-hidden rounded-2xl bg-neutral-200 dark:bg-neutral-800">
        <button type="button" onClick={() => !editing && setOpen(i)} className="block w-full !bg-transparent !p-0" aria-label="Open the photo">
          <img src={photo.url} alt={photo.caption || ""} className={`w-full object-cover ${compact ? "aspect-square" : "aspect-[16/9]"}`} />
        </button>
        {many && (
          <>
            <button type="button" className={`${arrow} left-2`} onClick={() => setAt((i - 1 + photos.length) % photos.length)} aria-label="Previous photo"><ChevronLeft className="size-5" /></button>
            <button type="button" className={`${arrow} right-2`} onClick={() => setAt((i + 1) % photos.length)} aria-label="Next photo"><ChevronRight className="size-5" /></button>
            <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
              {photos.map((p, n) => (
                <button key={p.id || n} type="button" onClick={() => setAt(n)} aria-label={`Photo ${n + 1}`}
                  className={`size-2 rounded-full !p-0 ${n === i ? "!bg-white" : "!bg-white/50"}`} />
              ))}
            </div>
          </>
        )}
      </div>
      {photo.caption && <figcaption className={`mt-2 text-slate-600 dark:text-neutral-400 ${compact ? "text-xs" : "text-sm"}`}>{photo.caption}</figcaption>}
      {open != null && <Lightbox photos={photos} index={open} onClose={() => setOpen(null)} />}
    </figure>
    </Frame>
  );
}

// A grid of pictures; the side column shows the first few with a "+N" tile
function GalleryView({ block, editing, compact }) {
  const photos = block.photos || [];
  const [open, setOpen] = useState(null);
  const limit = compact ? 6 : photos.length;
  const shown = photos.slice(0, limit);
  const more = photos.length - shown.length;
  return (
    <Frame block={block} compact={compact}>
    <section>
      {block.title && <h3 className={`mb-3 font-semibold text-slate-900 dark:text-white ${compact ? "text-base" : "text-lg"}`}>{block.title}</h3>}
      {photos.length === 0 ? (
        <EmptyPhotos editing={editing} label="Add pictures to the gallery in the panel on the right" />
      ) : (
        <div className={`grid ${compact ? "grid-cols-3 gap-1.5" : "gap-2 [grid-template-columns:repeat(auto-fill,minmax(9rem,1fr))]"}`}>
          {shown.map((p, n) => (
            <button key={p.id || n} type="button" onClick={() => !editing && setOpen(n)} className="group relative block overflow-hidden rounded-xl !bg-neutral-200 !p-0 dark:!bg-neutral-800" aria-label={p.caption || `Photo ${n + 1}`}>
              <img src={p.url} alt={p.caption || ""} className="aspect-square w-full object-cover transition-transform group-hover:scale-105" />
              {more > 0 && n === shown.length - 1 && (
                <span className="absolute inset-0 grid place-items-center bg-black/55 text-lg font-semibold text-white">+{more}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {open != null && <Lightbox photos={photos} index={open} onClose={() => setOpen(null)} />}
    </section>
    </Frame>
  );
}

const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });

// One of the event's schedule polls, with a way to vote
function PollView({ block, poll, compact, editing }) {
  if (!poll) {
    if (!editing) return null;
    return (
      <div className="grid place-items-center rounded-2xl border-2 border-dashed border-neutral-300 p-6 text-center text-sm text-slate-400 dark:border-neutral-700">
        <span className="flex items-center gap-2"><BarChart3 className="size-5" /> Pick a poll in the panel on the right</span>
      </div>
    );
  }
  const closes = new Date(poll.closes_at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const t = tone(block);
  const colored = block.color && block.color !== "default";
  const button = `inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold shadow-panel hover:opacity-90 ${t.button} ${compact ? "w-full px-3 py-2 text-sm" : "px-4 py-2.5"}`;
  return (
    <section className={`rounded-2xl ${colored ? t.card : "bg-white shadow-panel ring-1 ring-accent/20 dark:bg-neutral-800/70"} ${compact ? "p-4" : "p-5 sm:p-6"}`}>
      <div className={compact ? "space-y-3" : "flex flex-wrap items-center gap-5"}>
        <span className={`grid shrink-0 place-items-center rounded-2xl ${t.soft} ${compact ? "size-10" : "size-14"}`}>
          <CalendarClock className={compact ? "size-5" : "size-7"} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Help pick a time</p>
          <h3 className={`font-semibold text-slate-900 dark:text-white ${compact ? "text-base" : "text-xl"}`}>{poll.title}</h3>
          {!compact && poll.description && <p className="mt-1 text-sm text-slate-600 dark:text-neutral-300">{poll.description}</p>}
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
            {shortDate(poll.starts_on)}–{shortDate(poll.ends_on)} · {poll.duration_minutes} min · {poll.ballots_count} vote{poll.ballots_count === 1 ? "" : "s"}
            {" · "}{poll.closed ? "Voting closed" : `Closes ${closes}`}
          </p>
        </div>
        <a href={poll.path} className={button} onClick={(e) => editing && e.preventDefault()}>
          {poll.closed ? "See the results" : "Vote"}
        </a>
      </div>
    </section>
  );
}
