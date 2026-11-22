import React, { useCallback, useEffect, useRef, useState } from "react";
import { CircleCheck } from "lucide-react";
import { SkeletonGroup, SkeletonHomeNote } from "../ui/Skeleton";

// After this many posts, a quiet line under the feed says they'll keep (no endless scrolling)
export const BREATHER_AT = 80;

// The bottom of a feed of notes (home, profile, #hashtag, a group's Timeline block). Feeds come a
// page at a time (FeedPage on the server, 20 at once) and the next page only comes when someone
// taps "Load more": nothing loads on its own as you scroll. When there's nothing older it says
// so, so there's an end to reach.
//
// `count` is how many posts the feed shows now. `onMore` loads the next page (a promise) and
// FeedMore shows placeholder notes while it does, then moves keyboard focus to the first new
// post without scrolling, so the page stays where it was. Put it inside the same `.wb` box as
// the `.wb-feed` list.
export default function FeedMore({ more, count, onMore, endText = "You're all caught up", moreText = "Load more" }) {
  const box = useRef(null);
  const before = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (loading) return;
    before.current = count;
    setLoading(true);
    setError(null);
    try {
      await onMore();
    } catch (e) {
      before.current = null;
      setError(e.message || "That didn't load. Try again.");
    } finally {
      setLoading(false);
    }
  }, [count, loading, onMore]);

  // The new posts are in: put focus on the first of them (for keyboards and screen readers)
  useEffect(() => {
    if (loading || before.current == null || count <= before.current) return;
    const items = box.current?.closest(".wb")?.querySelectorAll(".wb-feed > .wb-feed-item");
    const first = items?.[before.current];
    before.current = null;
    if (!first) return;
    first.setAttribute("tabindex", "-1");
    first.focus({ preventScroll: true });
  }, [count, loading]);

  if (count === 0) return null;

  return (
    <div ref={box} className="mt-4">
      {loading ? (
        <SkeletonGroup label="Loading more posts" className="wb-feed">
          <SkeletonHomeNote seed={0} />
          <SkeletonHomeNote seed={1} />
        </SkeletonGroup>
      ) : more ? (
        <div className="flex flex-col items-center gap-2 text-center">
          {count >= BREATHER_AT && (
            <p className="!m-0 max-w-sm text-xs text-slate-500 dark:text-neutral-400">
              That's {count} posts. They'll still be here later if you want a break.
            </p>
          )}
          {error && <p role="alert" className="!m-0 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
          <button type="button" className="wb-btn" onClick={load}>{error ? "Try again" : moreText}</button>
        </div>
      ) : (
        <p className="!m-0 flex items-center justify-center gap-1.5 py-2 text-sm text-slate-500 dark:text-neutral-400">
          <CircleCheck className="size-4 text-accent" aria-hidden="true" /> {endText}
        </p>
      )}
    </div>
  );
}
