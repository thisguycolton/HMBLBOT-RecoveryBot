import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Hash } from "lucide-react";
import { api } from "../groups/lib";
import { Card, ErrorNote, Loading } from "../groups/ui";
import FeedItem from "../notes/FeedItem";

// A #hashtag's page (/people/tags/:tag): the notes with it that you can see, newest first,
// from Api::HashtagsController. Tags in notes link here (book/Markdown.jsx).
export default function HashtagPage() {
  const { tag } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setData(null);
    setError(null);
    document.title = `#${tag} | RecoveryBot`;
    api(`/hashtags/${encodeURIComponent(tag)}`).then(setData).catch((e) => setError(e.message));
  }, [tag]);

  if (error) return <ErrorNote error={error} />;
  if (!data) return <Loading />;

  const replace = (item) => setData((d) => ({ ...d, feed: d.feed.map((i) => (i.kind === item.kind && i.id === item.id ? { ...i, ...item } : i)) }));
  const remove = (id) => setData((d) => ({ ...d, count: d.count - 1, feed: d.feed.filter((i) => i.id !== id) }));
  const more = async () => {
    setLoadingMore(true);
    try {
      const last = data.feed[data.feed.length - 1];
      const next = await api(`/hashtags/${encodeURIComponent(tag)}?before=${encodeURIComponent(last.created_at)}`);
      setData((d) => ({ ...d, feed: [...d.feed, ...next.feed], more: next.more }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-accent dark:text-neutral-400">
        <ArrowLeft className="size-4" /> Notes
      </Link>
      <Card className="p-5">
        <h1 className="break-words text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">#{data.name}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
          {data.count.toLocaleString()} {data.count === 1 ? "note" : "notes"} you can see · newest first
        </p>
      </Card>

      {data.feed.length === 0 ? (
        <Card className="p-6 text-center text-sm text-slate-500 dark:text-neutral-400">
          <Hash className="mx-auto mb-2 size-6 text-slate-300" />
          No notes you can see have #{data.name} yet. Put it in a note to start it.
        </Card>
      ) : (
        <div className="wb">
          <div className="wb-feed">
            {data.feed.map((item) => (
              <FeedItem key={`${item.kind}-${item.id}`} item={item} showAuthor groups={data.groups} max={data.note_max} imagesMax={data.images_max}
                onChange={replace} onRemove={remove} />
            ))}
          </div>
          {data.more && (
            <div className="mt-4 text-center">
              <button type="button" className="wb-btn" onClick={more} disabled={loadingMore}>{loadingMore ? "Loading…" : "Show older notes"}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
