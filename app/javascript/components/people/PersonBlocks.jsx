import React, { useEffect, useState } from "react";
import { CalendarHeart, Lock, MessagesSquare, UserRound, Users, UsersRound } from "lucide-react";
import Avatar from "../groups/Avatar";
import { api } from "../groups/lib";
import { Card, Empty } from "../groups/page/GroupBlocks";
import FeedItem from "../notes/FeedItem";
import NoteEditor from "../notes/NoteEditor";
import { soberFor } from "./lib";

// How a profile's own blocks look (EventBlocks::PROFILE_TYPES), filled in from `context`
// (app/services/profile_page.rb). `editing` shows what a block holds when it's empty.
export default function PersonBlockView({ block, compact, editing, context }) {
  const props = { block, compact, editing, context, title: block.title };
  switch (block.type) {
    case "about": return <AboutBlock {...props} />;
    case "feed": return <FeedBlock {...props} />;
    case "groups": return <GroupsBlock {...props} />;
    case "people": return <PeopleBlock {...props} />;
    default: return null;
  }
}

function AboutBlock({ block, compact, editing, context, title }) {
  const p = context.person;
  const sober = soberFor(p.sobriety_date);
  return (
    <Card block={block} compact={compact} title={title} icon={UserRound}>
      {p.bio ? <p className="whitespace-pre-line text-slate-700 [overflow-wrap:anywhere] dark:text-neutral-200">{p.bio}</p>
        : <Empty>{context.viewer?.is_me ? "Add a short blurb in your settings." : "Nothing here yet."}</Empty>}
      {sober && (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-neutral-100">
          <CalendarHeart className="size-4 text-accent" /> Sober {sober}
          <span className="font-normal text-slate-500 dark:text-neutral-400">since {new Date(`${p.sobriety_date}T00:00:00`).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</span>
        </p>
      )}
      {context.viewer?.is_me && !editing && (
        <a href="/users/edit" className="mt-3 inline-block text-xs font-medium text-accent hover:underline">Change these in your settings</a>
      )}
    </Card>
  );
}

const SHOW = { all: null, notes: "note", highlights: "highlight" };

// Their notes and highlights, newest first, as far as the viewer may see them. On your
// own profile you write notes right here.
function FeedBlock({ block, compact, editing, context, title }) {
  const [items, setItems] = useState(context.feed || []);
  const [more, setMore] = useState((context.feed || []).length >= 40);
  const [limit, setLimit] = useState(block.limit || 10);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setItems(context.feed || []); }, [context.feed]);
  useEffect(() => { setLimit(block.limit || 10); }, [block.limit]);

  const kind = SHOW[block.show];
  const shown = items.filter((i) => !kind || i.kind === kind || (kind === "note" && i.kind === "repost"));
  const me = context.viewer?.is_me;
  const replace = (item) => setItems((list) => list.map((i) => (i.kind === item.kind && i.id === item.id ? { ...i, ...item } : i)));
  const remove = (kindOf) => (id) => setItems((list) => list.filter((i) => !(i.kind === kindOf && i.id === id)));

  const showMore = async () => {
    if (shown.length > limit) { setLimit((l) => l + (block.limit || 10)); return; }
    if (!more || loading) return;
    setLoading(true);
    try {
      const { feed } = await api(`/people/${context.person.username}/feed?before=${encodeURIComponent(items[items.length - 1].created_at)}`);
      setItems((list) => [...list, ...feed]);
      setMore(feed.length >= 40);
      setLimit((l) => l + (block.limit || 10));
    } finally {
      setLoading(false);
    }
  };

  const nothing = me
    ? (kind === "highlight" ? "Highlights you make in the library show here. Only you see them unless you say otherwise." : "Your notes and highlights show here. Only you see them unless you say otherwise.")
    : "Nothing shared here yet.";

  return (
    <Card block={block} compact={compact} title={title} icon={MessagesSquare}>
      <div className="wb">
        {me && !editing && kind !== "highlight" && (
          <div className="mb-4">
            <NoteEditor groups={context.viewer.groups} defaultVisibility={context.viewer.default_note_visibility} max={context.note_max} imagesMax={context.images_max}
              placeholder="What's on your mind today? Select words to format them, and add photos if you like."
              onSaved={(note) => setItems((list) => [note, ...list])} />
          </div>
        )}
        {shown.length === 0 ? (
          <Empty>{nothing}</Empty>
        ) : (
          <div className="wb-feed">
            {shown.slice(0, limit).map((item) => (
              <FeedItem key={`${item.kind}-${item.id}`} item={item} readOnly={editing} compact={compact} groups={me ? context.viewer.groups : null}
                max={context.note_max} imagesMax={context.images_max} onChange={replace} onRemove={remove(item.kind)} />
            ))}
          </div>
        )}
        {(shown.length > limit || (more && shown.length >= limit)) && !editing && (
          <button type="button" className="wb-btn mt-3 w-full" onClick={showMore} disabled={loading}>{loading ? "Loading…" : "Show more"}</button>
        )}
        {!me && !editing && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400">
            <Lock className="size-3" /> {context.viewer?.following ? "You see what they share with followers and members." : "You see what they share with members. Follow them to see what they share with followers."}
          </p>
        )}
      </div>
    </Card>
  );
}

function GroupsBlock({ block, compact, editing, context, title }) {
  const groups = context.groups || [];
  return (
    <Card block={block} compact={compact} title={title} icon={UsersRound}>
      {groups.length === 0 && <Empty>{context.viewer?.is_me ? "Groups you join show here. Others only see the ones they're in too." : "No groups in common."}</Empty>}
      <ul className="space-y-1">
        {groups.map((g) => (
          <li key={g.slug}>
            <a href={`/groups/${g.slug}`} onClick={(e) => editing && e.preventDefault()} className="block rounded-xl p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800/60">
              <span className="block truncate font-semibold text-slate-900 dark:text-white">{g.title}</span>
              {g.description && !compact && <span className="block truncate text-sm text-slate-500 dark:text-neutral-400">{g.description}</span>}
            </a>
          </li>
        ))}
      </ul>
      {context.viewer?.is_me && groups.length > 0 && <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">Others only see the groups they're in too.</p>}
    </Card>
  );
}

function PeopleBlock({ block, compact, editing, context, title }) {
  const followers = block.which === "followers";
  const people = (followers ? context.followers : context.following) || [];
  const count = followers ? context.person.followers_count : context.person.following_count;
  return (
    <Card block={block} compact={compact} title={title} icon={Users}
      action={<span className="shrink-0 text-xs font-medium text-slate-500 dark:text-neutral-400">{count}</span>}>
      {people.length === 0 && <Empty>{followers ? "Nobody yet." : context.viewer?.is_me ? "People you follow show here." : "Nobody yet."}</Empty>}
      {compact ? (
        <div className="flex flex-wrap gap-1.5">
          {people.map((p) => (
            <a key={p.id} href={`/people/${p.username}`} title={p.name} onClick={(e) => editing && e.preventDefault()}><Avatar person={p} size={36} /></a>
          ))}
        </div>
      ) : (
        <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(9rem,1fr))]">
          {people.map((p) => (
            <li key={p.id}>
              <a href={`/people/${p.username}`} onClick={(e) => editing && e.preventDefault()} className="flex items-center gap-2 hover:underline">
                <Avatar person={p} size={36} />
                <span className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-white">{p.name}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
