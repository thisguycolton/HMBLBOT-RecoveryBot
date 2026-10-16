import React, { useState } from "react";
import { BookOpen, CalendarClock, CalendarDays, ExternalLink, Lock, MessagesSquare, Trash2, UserPlus, Users, Video } from "lucide-react";
import Markdown from "../../book/Markdown";
import { tone } from "../../events/lib";
import Avatar from "../Avatar";
import NoteComposer from "../NoteComposer";
import { api, typeLabel } from "../lib";
import { scheduleLabel, toSeries } from "../MeetingsTab";
import { timeAgo } from "./lib";

// How a group page's own blocks look (EventBlocks::GROUP_TYPES), filled in from `context`
// (app/services/group_page.rb). Like the event blocks, each has a smaller view for the side
// column (`compact`), and `editing` shows what the block would hold when it's empty.
export default function GroupBlockView({ block, compact, editing, context, fill }) {
  const props = { block, compact, editing, context, title: fill(block.title) };
  switch (block.type) {
    case "meetings": return <MeetingsBlock {...props} />;
    case "events": return <EventsBlock {...props} />;
    case "timeline": return <TimelineBlock {...props} />;
    case "literature": return <LiteratureBlock {...props} />;
    case "readings": return <ReadingsBlock {...props} />;
    case "members": return <MembersBlock {...props} />;
    case "join": return <JoinBlock {...props} markdown={fill(block.markdown)} />;
    default: return null;
  }
}

function Card({ block, compact, title, icon: Icon, action, children }) {
  const t = tone(block);
  return (
    <section className={`rounded-2xl ${t.card} ${compact ? "p-4" : "p-5 sm:p-6"}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center gap-2">
          {Icon && <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${t.soft}`}><Icon className="size-4" /></span>}
          <h3 className={`min-w-0 flex-1 truncate font-semibold text-slate-900 dark:text-white ${compact ? "text-base" : "text-lg"}`}>{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const Empty = ({ children }) => <p className="text-sm italic text-slate-400 dark:text-neutral-500">{children}</p>;

// Weekly meetings are a row per day; the same meeting on several days is one line
function meetingRows(meetings) {
  const weekly = meetings.filter((m) => m.recurrence === "weekly");
  const rest = meetings.filter((m) => m.recurrence !== "weekly");
  return [
    ...toSeries(weekly).map((series) => ({ ...series[0], id: series.map((m) => m.id).join("-"), label: scheduleLabel(series) })),
    ...rest.map((m) => ({ ...m, label: m.schedule_label })),
  ];
}

function MeetingsBlock({ block, compact, editing, context, title }) {
  const rows = meetingRows(context.meetings || []);
  const t = tone(block);
  return (
    <Card block={block} compact={compact} title={title} icon={CalendarClock}>
      {rows.length === 0 && <Empty>{editing ? "The group's meetings show here." : "No meetings listed yet."}</Empty>}
      <ul className={compact ? "space-y-3" : "divide-y divide-neutral-200/70 dark:divide-neutral-700/60"}>
        {rows.map((m) => (
          <li key={m.id} className={compact ? "" : "flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 dark:text-white">{m.name}</p>
              <p className="text-sm text-slate-600 dark:text-neutral-300">{m.label}</p>
              {m.types?.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-1">
                  {m.types.slice(0, compact ? 3 : 6).map((code) => (
                    <span key={code} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t.soft}`}>{typeLabel(code)}</span>
                  ))}
                </p>
              )}
            </div>
            {m.conference_url && (
              <a href={m.conference_url} target="_blank" rel="noreferrer" onClick={(e) => editing && e.preventDefault()}
                className={`inline-flex items-center gap-1.5 rounded-xl font-semibold shadow-sm hover:opacity-90 ${t.button} ${compact ? "mt-2 px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"}`}>
                <Video className="size-4" /> Join online
              </a>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function EventsBlock({ block, compact, editing, context, title }) {
  const events = (context.events || []).slice(0, block.limit || 3);
  return (
    <Card block={block} compact={compact} title={title} icon={CalendarDays}>
      {events.length === 0 && <Empty>{editing ? "The group's published events show here." : "Nothing coming up."}</Empty>}
      <div className={compact ? "space-y-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}>
        {events.map((e) => (
          <a key={e.token} href={`/events/${e.token}`} onClick={(ev) => editing && ev.preventDefault()}
            className={`group flex overflow-hidden rounded-xl bg-white ring-1 ring-neutral-200 hover:ring-accent/50 dark:bg-neutral-900 dark:ring-neutral-700 ${compact ? "items-center gap-3 p-2" : "flex-col"}`}>
            <div className={`${compact ? "size-12 shrink-0 rounded-lg" : "h-24"} overflow-hidden ${e.cover_url ? "" : "bg-gradient-to-br from-accent via-sky-600 to-indigo-700"}`}>
              {e.cover_url && <img src={e.cover_url} alt="" className="size-full object-cover" />}
            </div>
            <div className={`min-w-0 ${compact ? "" : "p-3"}`}>
              <p className="truncate font-semibold text-slate-900 group-hover:text-accent dark:text-white">{e.title}</p>
              <p className="truncate text-xs text-slate-500 dark:text-neutral-400">{e.when_label || "Date to be decided"}</p>
            </div>
          </a>
        ))}
      </div>
    </Card>
  );
}

// Notes members shared to the group. Members post right here (it goes on their own
// timeline too, shared to this group); everyone else sees that it's for members.
function TimelineBlock({ block, compact, editing, context, title }) {
  const [removed, setRemoved] = useState([]);
  const notes = context.timeline?.filter((n) => !removed.includes(n.id)).slice(0, block.limit || 10);
  const canPost = !editing && context.viewer?.is_member && context.group?.slug;
  const remove = async (note) => {
    if (!window.confirm(note.mine ? "Take this note off the group's timeline? It stays on yours." : "Take this note off the group's timeline?")) return;
    try {
      await api(`/groups/${context.group.slug}/page/timeline/${note.id}`, { method: "DELETE" });
      setRemoved((list) => [...list, note.id]);
    } catch (e) {
      window.alert(e.message);
    }
  };

  return (
    <Card block={block} compact={compact} title={title} icon={MessagesSquare}
      action={context.viewer?.is_member && !editing && <a href="/groups/timeline" className="shrink-0 text-xs font-medium text-accent hover:underline">Your timeline</a>}>
      {canPost && <div className="mb-4"><NoteComposer shareTo={context.group.slug} max={context.note_max} compact={compact} onPosted={() => context.reload?.()} /></div>}
      {!notes ? (
        <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-neutral-400">
          <Lock className="size-4 shrink-0" /> {editing ? "Members' shared notes show here, to members." : "Members share notes with each other here."}
        </p>
      ) : notes.length === 0 ? (
        <Empty>{editing ? "Notes members share to the group show here." : "No notes yet. Share the first one."}</Empty>
      ) : (
        <ol className="space-y-4">
          {notes.map((n) => (
            <li key={n.id} className="flex gap-3">
              <Avatar person={n.author} size={compact ? 28 : 36} />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2 text-sm">
                  <span className="truncate font-semibold text-slate-900 dark:text-white">{n.author.name}</span>
                  <span className="shrink-0 text-xs text-slate-400">{timeAgo(n.created_at)}{n.edited ? " · edited" : ""}</span>
                  {n.can_remove && !editing && (
                    <button type="button" onClick={() => remove(n)} className="ml-auto grid size-6 shrink-0 place-items-center rounded-md !bg-transparent text-slate-400 hover:text-rose-600" title="Take it off the group's timeline" aria-label="Take it off the group's timeline">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </p>
                <p className={`whitespace-pre-line text-slate-700 [overflow-wrap:anywhere] dark:text-neutral-200 ${compact ? "text-sm" : ""}`}>{n.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function LiteratureBlock({ block, compact, editing, context, title }) {
  const books = context.literature || [];
  return (
    <Card block={block} compact={compact} title={title} icon={BookOpen}>
      {books.length === 0 && <Empty>{editing ? "Books the group approves show here." : "No literature yet."}</Empty>}
      <ul className={compact ? "space-y-2" : "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(7rem,1fr))]"}>
        {books.map(({ id, book, note }) => (
          <li key={id}>
            <a href={`/library/${book.slug}`} onClick={(e) => editing && e.preventDefault()} className={`group ${compact ? "flex items-center gap-3" : "block"}`}>
              <span className={`block overflow-hidden rounded-lg shadow-sm ${compact ? "h-14 w-10 shrink-0" : "aspect-[2/3] w-full"}`} style={{ background: book.cover_color || "#4c7ba6" }}>
                {book.cover_url && <img src={book.cover_url} alt="" className="size-full object-cover" />}
              </span>
              <span className={`block min-w-0 ${compact ? "" : "mt-2"}`}>
                <span className="block truncate text-sm font-semibold text-slate-900 group-hover:text-accent dark:text-white">{book.title}</span>
                {(note || book.author) && <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{note || book.author}</span>}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ReadingsBlock({ block, compact, editing, context, title }) {
  const readings = context.readings?.slice(0, block.limit || 5);
  return (
    <Card block={block} compact={compact} title={title} icon={BookOpen}>
      {!readings ? (
        <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-neutral-400"><Lock className="size-4" /> Members see the readings they share.</p>
      ) : readings.length === 0 ? (
        <Empty>{editing ? "Readings members tag to the group show here." : "No readings yet."}</Empty>
      ) : (
        <ul className="space-y-2">
          {readings.map((r) => (
            <li key={r.id}>
              <a href={`/readings/${r.id}`} onClick={(e) => editing && e.preventDefault()} className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800/60">
                <Avatar person={r.author} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{r.title || "Untitled reading"}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">
                    {r.author?.name}{r.published_at ? ` · ${new Date(r.published_at).toLocaleDateString([], { month: "short", day: "numeric" })}` : ""}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MembersBlock({ block, compact, editing, context, title }) {
  const members = context.members;
  const count = context.group?.members_count || 0;
  return (
    <Card block={block} compact={compact} title={title} icon={Users}
      action={<span className="shrink-0 text-xs font-medium text-slate-500 dark:text-neutral-400">{count} {count === 1 ? "member" : "members"}</span>}>
      {!members ? (
        <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-neutral-400">
          <Lock className="size-4 shrink-0" /> {editing ? "Members see who's in the group; everyone else sees how many." : "Members see who's in the group."}
        </p>
      ) : compact ? (
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => <span key={m.id} title={m.name}><Avatar person={m} size={34} /></span>)}
        </div>
      ) : (
        <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(9rem,1fr))]">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <Avatar person={m} size={36} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{m.name}</span>
                <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{m.role === "admin" ? "Group admin" : "Member"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// Asking to join; on an AA Intergroup group that isn't here yet, starting it
function JoinBlock({ block, compact, editing, context, title, markdown }) {
  const t = tone(block);
  const v = context.viewer || {};
  const [busy, setBusy] = useState(false);
  const button = `inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold shadow-sm hover:opacity-90 disabled:opacity-60 ${t.button} ${compact ? "" : "sm:w-auto"}`;
  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } catch (e) { window.alert(e.message); } finally { setBusy(false); }
  };

  let action;
  if (editing || context.sample) {
    action = <span className={button}><UserPlus className="size-4" /> Ask to join</span>;
  } else if (context.kind === "intergroup") {
    action = v.can_start ? (
      <button type="button" disabled={busy} className={button} onClick={() => run(context.onStart)}><UserPlus className="size-4" /> Start this group on RecoveryBot</button>
    ) : (
      <a href="/users/sign_up" className={button}><UserPlus className="size-4" /> Make an account</a>
    );
  } else if (v.is_member) {
    action = <p className={`rounded-xl px-3 py-2 text-center text-sm font-semibold ${t.soft}`}>You're {v.role === "admin" ? "a group admin" : "a member"}</p>;
  } else if (v.membership_status === "requested") {
    action = <p className={`rounded-xl px-3 py-2 text-center text-sm font-semibold ${t.soft}`}>Your request is waiting for a group admin</p>;
  } else {
    action = <button type="button" disabled={busy} className={button} onClick={() => run(context.onJoin)}><UserPlus className="size-4" /> Ask to join</button>;
  }

  return (
    <Card block={block} compact={compact} title={title} icon={UserPlus}>
      {markdown?.trim() && <Markdown source={markdown} className={`ev-md mb-4 ${compact ? "text-sm" : ""}`} />}
      {action}
      {context.kind === "intergroup" && context.meetings?.[0]?.oiaa_url && (
        <a href={context.meetings[0].oiaa_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
          See it on AA Intergroup <ExternalLink className="size-3" />
        </a>
      )}
    </Card>
  );
}
