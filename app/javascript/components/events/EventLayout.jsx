import React from "react";
import { CalendarDays, MapPin, Users } from "lucide-react";
import BlockView, { isCompact } from "./BlockView";
import { SPAN_CLASS } from "./lib";

// The event page's frame, shared by the page and the editor's canvas: the cover and
// title, an aside (RSVP, flyer), then the blocks in the event's layout.

export function EventHero({ event, aside, coverUrl = event.cover_url, groupLink = true, share = null }) {
  const chip = "inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur";
  return (
    <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-stretch">
      <div className={`relative overflow-hidden rounded-3xl ${coverUrl ? "bg-neutral-900" : "bg-gradient-to-br from-accent via-sky-600 to-indigo-700"}`}>
        {coverUrl && <img src={coverUrl} alt="" className="absolute inset-0 size-full object-cover" />}
        {share && <div className="absolute right-4 top-4 z-10">{share}</div>}
        <div className={`relative flex h-full min-h-[16rem] flex-col justify-end p-6 sm:min-h-[20rem] sm:p-10 ${coverUrl ? "bg-gradient-to-t from-black/80 via-black/30 to-transparent" : ""}`}>
          {groupLink ? (
            <a href={`/groups/${event.group.slug}`} className={`${chip} mb-3 w-fit !text-white hover:bg-white/25`}>
              <Users className="size-3.5" /> {event.group.title}
            </a>
          ) : (
            <span className={`${chip} mb-3 w-fit`}><Users className="size-3.5" /> {event.group.title}</span>
          )}
          <h1 className="ev-heading text-3xl font-extrabold tracking-tight text-white sm:text-5xl">{event.title || "Untitled event"}</h1>
          {event.short_description && <p className="mt-2 max-w-2xl text-base text-white/90 sm:text-lg">{event.short_description}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={chip}><CalendarDays className="size-3.5 shrink-0" /> {event.when_label || "Date to be decided"}</span>
            {event.location && (
              /^https?:\/\//.test(event.location)
                ? <a href={event.location} target="_blank" rel="noreferrer" className={`${chip} !text-white hover:bg-white/25`}><MapPin className="size-3.5 shrink-0" /> <span className="truncate">Join online</span></a>
                : <span className={chip}><MapPin className="size-3.5 shrink-0" /> <span className="truncate">{event.location}</span></span>
            )}
          </div>
        </div>
      </div>
      {aside}
    </header>
  );
}

// The two regions in the layout's columns. renderRegion(region) draws one.
export function LayoutColumns({ layout, renderRegion }) {
  if (layout === "centered") {
    return (
      <div className="grid lg:grid-cols-6">
        <div className="space-y-6 lg:col-span-4 lg:col-start-2">
          {renderRegion("main")}
          {renderRegion("side")}
        </div>
      </div>
    );
  }
  const sideFirst = layout === "side_main";
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className={`order-1 min-w-0 lg:col-span-2 ${sideFirst ? "lg:order-2" : ""}`}>{renderRegion("main")}</div>
      <div className={`order-2 min-w-0 ${sideFirst ? "lg:order-1" : ""}`}>{renderRegion("side")}</div>
    </div>
  );
}

export function blockWrapClass(block) {
  return `col-span-12 min-w-0 ${SPAN_CLASS[block.span] || SPAN_CLASS[12]}`;
}

// The page's own (read-only) blocks
export default function EventBlocks({ event }) {
  return <PageBlocks layout={event.layout} blocks={event.blocks} polls={event.polls} />;
}

// Blocks in a layout, read-only: an event's, or a group page's (with its `context`).
// `hidden(block)` leaves out blocks with nothing to show this viewer.
export function PageBlocks({ layout, blocks, polls, context, hidden = () => false }) {
  const renderRegion = (region) => {
    const list = blocks.filter((b) => (b.region || "main") === region && !hidden(b));
    if (!list.length) return null;
    return (
      <div className="grid grid-cols-12 gap-x-3 gap-y-5 sm:gap-x-5 sm:gap-y-6">
        {list.map((block) => (
          <div key={block.id} className={blockWrapClass(block)}>
            <BlockView block={block} compact={isCompact(block, layout)} polls={polls} context={context} />
          </div>
        ))}
      </div>
    );
  };
  return <LayoutColumns layout={layout} renderRegion={renderRegion} />;
}
