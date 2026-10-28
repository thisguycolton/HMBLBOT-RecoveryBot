import React, { useState } from "react";
import { BookOpen, CalendarClock, CalendarDays, ExternalLink, FileText, Gavel, Lock, MessagesSquare, Mic, Pin, Scale, Trash2, UserPlus, Users, Video } from "lucide-react";
import Markdown from "../../book/Markdown";
import { tone } from "../../events/lib";
import Avatar from "../Avatar";
import MeetingPasscode from "../MeetingPasscode";
import FeedItem from "../../notes/FeedItem";
import NoteEditor from "../../notes/NoteEditor";
import { api, typeLabel } from "../lib";
import { scheduleLabel, toSeries } from "../MeetingsTab";
import { AgendaList, SuggestForm } from "../conscience/AgendaParts";
import { CATEGORY_INFO, KIND_INFO, countLabel, dateLabel, longDate } from "../conscience/lib";
import { decisionsFor, documentsFor } from "./lib";

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
    case "documents": return <DocumentsBlock {...props} />;
    case "decisions": return <DecisionsBlock {...props} />;
    case "business_meeting": return <BusinessMeetingBlock {...props} />;
    case "members": return <MembersBlock {...props} />;
    case "join": return <JoinBlock {...props} markdown={fill(block.markdown)} />;
    default: return null;
  }
}

// A block's card in its palette color, with its title; profile blocks use it too
// A `bleed` card (a profile's or group's timeline) runs edge to edge on phones, so what's in it has room
export function Card({ block, compact, title, icon: Icon, action, bleed = false, children }) {
  const t = tone(block);
  return (
    <section className={`rounded-2xl ${t.card} ${compact ? "p-4" : "p-5 sm:p-6"} ${bleed ? "max-sm:-mx-4 max-sm:rounded-none max-sm:px-4 max-sm:shadow-none max-sm:ring-0" : ""}`}>
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

export const Empty = ({ children }) => <p className="text-sm italic text-slate-400 dark:text-neutral-500">{children}</p>;

// Weekly meetings are a row per day; the same meeting on several days is one line, showing who
// hosts the soonest of its days
function meetingRows(meetings) {
  const weekly = meetings.filter((m) => m.recurrence === "weekly");
  const rest = meetings.filter((m) => m.recurrence !== "weekly");
  const soonest = (series) => [...series].sort((a, b) => (a.upcoming_start || a.next_start || "").localeCompare(b.upcoming_start || b.next_start || ""))[0];
  return [
    ...toSeries(weekly).map((series) => {
      const next = soonest(series);
      return { ...series[0], id: series.map((m) => m.id).join("-"), label: scheduleLabel(series), hosts: next.hosts, hosts_on: series.length > 1 ? next.hosts_on : null };
    }),
    ...rest.map((m) => ({ ...m, label: m.schedule_label })),
  ];
}

const HOST_ROLE = { host: "Host", co_host: "Co-host" };

// "Host Sam R. · Co-host Alex P.", for the next meeting (and which day, when it meets on several)
function MeetingHosts({ hosts, on, editing }) {
  if (!hosts?.length) return null;
  const local = (d) => d.toLocaleDateString("en-CA");
  const now = new Date();
  const day = on && (on === local(now) ? "Today" : on === local(new Date(now.getTime() + 864e5)) ? "Tomorrow" : new Date(`${on}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }));
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-600 dark:text-neutral-300 [&>span+span]:ml-1.5">
      <Mic className="size-3.5 shrink-0 text-slate-400" aria-hidden />
      {day && <span className="text-slate-500 dark:text-neutral-400">{day}:</span>}
      {hosts.map((h) => (
        <span key={h.role} className="whitespace-nowrap">
          <span className="text-slate-500 dark:text-neutral-400">{HOST_ROLE[h.role]} </span>
          {h.username && !editing
            ? <a href={`/people/${h.username}`} className="font-medium text-slate-800 hover:text-accent hover:underline dark:text-neutral-100">{h.name}</a>
            : <span className="font-medium text-slate-800 dark:text-neutral-100">{h.name}</span>}
        </span>
      ))}
    </p>
  );
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
              <MeetingHosts hosts={m.hosts} on={m.hosts_on} editing={editing} />
              {m.types?.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-1">
                  {m.types.slice(0, compact ? 3 : 6).map((code) => (
                    <span key={code} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t.soft}`}>{typeLabel(code)}</span>
                  ))}
                </p>
              )}
            </div>
            {m.conference_url && (
              <div className={`flex flex-col gap-1 ${compact ? "mt-2 items-start" : "items-end"}`}>
                <a href={m.conference_url} data-meeting-join={editing ? undefined : m.id} target="_blank" rel="noreferrer" onClick={(e) => editing && e.preventDefault()}
                  className={`inline-flex items-center gap-1.5 rounded-xl font-semibold shadow-sm hover:opacity-90 ${t.button} ${compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"}`}>
                  <Video className="size-4" /> Join online
                </a>
                <MeetingPasscode notes={m.conference_url_notes} copy={!editing} className="!text-xs text-slate-500 dark:text-neutral-400" />
              </div>
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
  const [changed, setChanged] = useState({});
  const notes = context.timeline?.filter((n) => !removed.includes(n.id)).map((n) => changed[n.id] || n).slice(0, block.limit || 10);
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
    <Card block={block} compact={compact} title={title} icon={MessagesSquare} bleed={!compact && !editing}
      action={context.viewer?.is_member && !editing && <a href="/people/me" className="shrink-0 text-xs font-medium text-accent hover:underline">Your timeline</a>}>
      <div className="wb">
        {canPost && (
          <div className="mb-4">
            <NoteEditor shareTo={context.group.slug} max={context.note_max} defaultVisibility={context.viewer.default_note_visibility}
              placeholder={`Share something with ${context.group.title}… You can add photos too.`} onSaved={() => context.reload?.()} />
          </div>
        )}
        {!notes ? (
          <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-neutral-400">
            <Lock className="size-4 shrink-0" /> {editing ? "Members' shared notes show here, to members." : "Members share notes with each other here."}
          </p>
        ) : notes.length === 0 ? (
          <Empty>{editing ? "Notes members share to the group show here." : "No notes yet. Share the first one."}</Empty>
        ) : (
          <div className="wb-feed">
            {notes.map((n) => (
              <FeedItem key={n.id} item={n} readOnly={editing} showAuthor compact={compact} max={context.note_max}
                onChange={(note) => setChanged((c) => ({ ...c, [note.id]: { ...n, ...note } }))}
                onRemove={(id) => setRemoved((list) => [...list, id])}
                extraAction={n.can_remove && !n.mine && !editing && (
                  <button type="button" onClick={() => remove(n)} className="grid size-6 shrink-0 place-items-center rounded-md !bg-transparent text-slate-400 hover:text-rose-600" title="Take it off the group's timeline" aria-label="Take it off the group's timeline">
                    <Trash2 className="size-3.5" />
                  </button>
                )} />
            ))}
          </div>
        )}
      </div>
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

// The group's documents this viewer may see: visitors only get the Public ones, which is how
// a group puts its format and guidelines on its page. Record keepers get a hint when empty.
function DocumentsBlock({ block, compact, editing, context, title }) {
  const docs = documentsFor(block, context);
  const slug = context.group?.slug;
  return (
    <Card block={block} compact={compact} title={title} icon={FileText}>
      {docs.length === 0 && (
        <Empty>{editing || context.viewer?.can_keep_records ? "Documents you mark Public show here to everyone; members also see the Members ones." : "No documents yet."}</Empty>
      )}
      <ul className="space-y-1">
        {docs.map((d) => {
          const Icon = KIND_INFO[d.kind]?.icon || FileText;
          return (
            <li key={d.id}>
              <a href={`/groups/${slug}/conscience/documents/${d.id}`} onClick={(e) => (editing || !slug) && e.preventDefault()}
                className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800/60">
                <Icon className="size-4 shrink-0 text-slate-500 dark:text-neutral-400" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                    {d.pinned && <Pin className="size-3 shrink-0 text-amber-600" aria-label="Pinned" />}
                    <span className="truncate">{d.title}</span>
                  </span>
                  {!compact && (d.excerpt || d.file) && <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{d.excerpt || d.file.name}</span>}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// The group's standing decisions this viewer may see. Visitors only get Public ones, so a group
// can say "this meeting is closed" on its page.
function DecisionsBlock({ block, compact, editing, context, title }) {
  const decisions = decisionsFor(block, context);
  const slug = context.group?.slug;
  return (
    <Card block={block} compact={compact} title={title} icon={Scale}>
      {decisions.length === 0 && (
        <Empty>{editing || context.viewer?.can_keep_records ? "The group's standing decisions show here. Public ones show to everyone; members also see the Members ones." : "No decisions yet."}</Empty>
      )}
      <ul className="space-y-1">
        {decisions.map((d) => {
          const Icon = CATEGORY_INFO[d.category]?.icon || Scale;
          return (
            <li key={d.id}>
              <a href={`/groups/${slug}/conscience/decisions?open=${d.id}`} onClick={(e) => (editing || !slug) && e.preventDefault()}
                className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800/60">
                <Icon className="size-4 shrink-0 text-slate-500 dark:text-neutral-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{d.title}</span>
                  {!compact && <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{[d.decided_on && dateLabel(d.decided_on), countLabel(d)].filter(Boolean).join(" · ")}</span>}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// The next business meeting. Everyone sees when it is (when a published event announces it);
// members also see its agenda and can suggest an item.
function BusinessMeetingBlock({ block, compact, editing, context, title }) {
  const m = context.business_meeting;
  const slug = context.group?.slug;
  const [sent, setSent] = useState(false);
  return (
    <Card block={block} compact={compact} title={title} icon={Gavel}>
      {!m ? (
        <Empty>{editing || context.viewer?.can_keep_records ? "When a business meeting is scheduled, its date and agenda show here to members." : "No business meeting is scheduled."}</Empty>
      ) : (
        <div className="space-y-3">
          <p className="font-semibold text-slate-900 dark:text-white">{m.when_label || longDate(m.held_on)}</p>
          {m.event && (
            <a href={m.event.path} onClick={(e) => editing && e.preventDefault()} className="inline-flex items-center gap-1 text-sm text-accent hover:underline">The event <ExternalLink className="size-3.5" /></a>
          )}
          {m.agenda && (
            <>
              <AgendaList items={m.agenda} empty="The agenda isn't set yet." />
              {m.can_suggest && !editing && (
                <div className="border-t border-neutral-200/70 pt-3 dark:border-neutral-700/60">
                  <SuggestForm slug={slug} meetingId={m.id} compact onAdded={() => setSent(true)} />
                </div>
              )}
              {m.id && !editing && <a href={`/groups/${slug}/conscience/meetings/${m.id}`} className="inline-block text-sm font-medium text-accent hover:underline">Open the meeting</a>}
            </>
          )}
        </div>
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
          {members.map((m) => <a key={m.id} href={m.username ? `/people/${m.username}` : undefined} title={m.name} onClick={(e) => editing && e.preventDefault()}><Avatar person={m} size={34} /></a>)}
        </div>
      ) : (
        <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(9rem,1fr))]">
          {members.map((m) => (
            <li key={m.id}>
              <a href={m.username ? `/people/${m.username}` : undefined} onClick={(e) => editing && e.preventDefault()} className="flex items-center gap-2 hover:underline">
              <Avatar person={m} size={36} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{m.name}</span>
                <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{m.role === "admin" ? "Group admin" : "Member"}</span>
              </span>
              </a>
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
