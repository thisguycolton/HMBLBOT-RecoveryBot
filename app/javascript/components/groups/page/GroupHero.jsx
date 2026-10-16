import React from "react";
import { Clock, ExternalLink, Users } from "lucide-react";
import { zoneLabel } from "../lib";

// The top of a group's page, like an event's: its cover (or the site's blue), name,
// description and a few facts, with `actions` (join, edit) under them. `badge` sits by the
// name, `note` replaces the facts (the default page's editor says what it is there).
export default function GroupHero({ group, coverUrl, actions, badge, note }) {
  const chip = "inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur";
  const count = group.members_count || 0;
  return (
    <header className={`relative overflow-hidden rounded-3xl ${coverUrl ? "bg-neutral-900" : "bg-gradient-to-br from-accent via-sky-600 to-indigo-700"}`}>
      {coverUrl && <img src={coverUrl} alt="" className="absolute inset-0 size-full object-cover" />}
      <div className={`relative flex min-h-[13rem] flex-col justify-end gap-4 p-6 sm:min-h-[16rem] sm:p-10 ${coverUrl ? "bg-gradient-to-t from-black/80 via-black/35 to-transparent" : ""}`}>
        <div className="min-w-0">
          <h1 className="ev-heading flex flex-wrap items-center gap-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            {group.title}
            {badge}
          </h1>
          {group.description && <p className="mt-2 max-w-2xl text-base text-white/90 sm:text-lg">{group.description}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {note ? <span className={chip}>{note}</span> : (
              <>
                {group.time_zone && <span className={chip}><Clock className="size-3.5 shrink-0" /> {zoneLabel(group.time_zone)} time</span>}
                {count > 0 && <span className={chip}><Users className="size-3.5 shrink-0" /> {count} {count === 1 ? "member" : "members"}</span>}
                {group.website && (
                  <a href={group.website} target="_blank" rel="noreferrer" className={`${chip} !text-white hover:bg-white/25`}>
                    Website <ExternalLink className="size-3" />
                  </a>
                )}
              </>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

// Buttons on the hero: white glass, so they read on any cover
export const heroButton =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl !bg-white/90 px-3.5 py-2 text-sm font-semibold !text-slate-900 shadow-panel hover:!bg-white disabled:opacity-60";
export const heroQuietButton =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl !bg-white/15 px-3 py-2 text-sm font-medium !text-white ring-1 ring-white/30 backdrop-blur hover:!bg-white/25 disabled:opacity-60";
