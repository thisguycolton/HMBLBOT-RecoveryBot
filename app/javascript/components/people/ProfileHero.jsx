import React, { useState } from "react";
import { Ban, CalendarDays, Check, EyeOff, Flag, UserCheck, UserPlus } from "lucide-react";
import ReportDialog from "../groups/chat/ReportDialog";
import PostMenu, { blockPerson, unblockPerson } from "../notes/PostMenu";
import Avatar from "../groups/Avatar";
import { api } from "../groups/lib";
import { heroBleed, heroButton, heroQuietButton } from "../groups/page/GroupHero";
import { showToast } from "../../lib/toast";
import FollowListModal from "./FollowListModal";
import { useMedia } from "../shell/useShell";

// The top of a profile: their cover (or the site's blue), picture, name, @username and
// counts, with Follow (or `actions` on your own) under them. The counts open who's on them;
// on phones they sit in one glass bar under the name. On someone else's, a ••• offers Report
// and Block (a sheet from the bottom on phones); once you've blocked them it says so, with
// Unblock (`onBlockChange` hears either).
export default function ProfileHero({ person, viewer, coverUrl, actions, onFollowChange, onBlockChange, bleed = false }) {
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const first = person.name.split(" ")[0];
  const unblock = async () => {
    try {
      await unblockPerson(person);
      showToast(`You unblocked ${first}.`);
      onBlockChange?.(false);
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  };
  const [list, setList] = useState(null); // "followers" | "following" while the list is open
  const chip = "inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur";
  const toggleFollow = async () => {
    setBusy(true);
    try {
      const data = await api(`/people/${person.username}/follow`, { method: viewer.following ? "DELETE" : "POST" });
      onFollowChange?.(data);
    } catch (e) {
      showToast(e.message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  };
  const joined = person.joined && new Date(`${person.joined}T00:00:00`).toLocaleDateString([], { month: "long", year: "numeric" });

  const shortJoined = person.joined && new Date(`${person.joined}T00:00:00`).toLocaleDateString([], { month: "short", year: "numeric" });
  const phone = useMedia("(max-width: 639px)");
  const others = !viewer.is_me && viewer.signed_in;
  const stat = "flex flex-1 flex-col items-center justify-center gap-0.5 !bg-transparent px-2 py-2 text-white hover:!bg-white/10";

  return (
    <header className={`relative overflow-hidden rounded-3xl ${bleed ? heroBleed : ""} ${coverUrl ? "bg-neutral-900" : "cover-default"}`}>
      {coverUrl && <img src={coverUrl} alt="" className="absolute inset-0 size-full object-cover" />}
      <div className={`relative flex min-h-[13rem] flex-col justify-end gap-4 p-5 sm:min-h-[15rem] sm:p-10 ${coverUrl ? "bg-gradient-to-t from-black/80 via-black/35 to-transparent" : ""}`}>
        <div className="flex items-center gap-4 sm:flex-wrap sm:items-end sm:gap-5">
          <Avatar person={person} size={phone ? 76 : 96} className="ring-4 ring-white/80 shadow-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="ev-heading !text-2xl !leading-tight font-extrabold tracking-tight text-white sm:!text-4xl [overflow-wrap:break-word] [word-break:normal]">{person.name}</h1>
            <p className="text-sm font-medium text-white/80">@{person.username}{viewer.follows_you && <span className="hidden sm:inline"> · follows you</span>}</p>
            {viewer.follows_you && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[0.7rem] font-semibold text-white sm:hidden">
                <UserCheck className="size-3" aria-hidden="true" /> Follows you
              </span>
            )}
            <div className="mt-3 hidden flex-wrap gap-2 sm:flex">
              <button type="button" onClick={() => setList("followers")} className={`${chip} !bg-white/15 hover:!bg-white/25`}>
                <strong>{person.followers_count}</strong> {person.followers_count === 1 ? "follower" : "followers"}
              </button>
              <button type="button" onClick={() => setList("following")} className={`${chip} !bg-white/15 hover:!bg-white/25`}>
                <strong>{person.following_count}</strong> following
              </button>
              {joined && <span className={chip}><CalendarDays className="size-3.5" /> Joined {joined}</span>}
            </div>
          </div>
        </div>

        {/* Phones: the counts and when they joined as one glass bar */}
        <div className="flex divide-x divide-white/20 overflow-hidden rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur sm:hidden">
          <button type="button" onClick={() => setList("followers")} className={stat} aria-label={`${person.followers_count} ${person.followers_count === 1 ? "follower" : "followers"}`}>
            <strong className="text-lg leading-none">{person.followers_count}</strong>
            <span className="text-[0.7rem] font-medium text-white/80">{person.followers_count === 1 ? "follower" : "followers"}</span>
          </button>
          <button type="button" onClick={() => setList("following")} className={stat} aria-label={`${person.following_count} following`}>
            <strong className="text-lg leading-none">{person.following_count}</strong>
            <span className="text-[0.7rem] font-medium text-white/80">following</span>
          </button>
          {shortJoined && (
            <span className={`${stat} hover:!bg-transparent`} title={`Joined ${joined}`} aria-label={`Joined ${joined}`}>
              <CalendarDays className="size-[1.125rem]" aria-hidden="true" />
              <span className="text-[0.7rem] font-medium text-white/80">{shortJoined}</span>
            </span>
          )}
        </div>

        {(actions || others) && (
          <div className="flex items-center gap-2 sm:flex-wrap">
            {actions}
            {others && (
              <button type="button" disabled={busy} onClick={toggleFollow} className={`${viewer.following ? heroQuietButton : heroButton} max-sm:flex-1 max-sm:py-2.5`}>
                {viewer.following ? <><Check className="size-4" /> Following</> : <><UserPlus className="size-4" /> Follow</>}
              </button>
            )}
            {others && (
              <PostMenu label={`More about ${first}`} title={person.name}
                className="[&>button]:!size-10 [&>button]:!rounded-xl [&>button]:!bg-white/15 [&>button]:!text-white [&>button]:ring-1 [&>button]:ring-white/30 [&>button]:backdrop-blur [&>button]:hover:!bg-white/25 dark:[&>button]:hover:!bg-white/25 sm:[&>button]:!size-9"
                items={[
                  { label: `Report ${first}`, icon: Flag, onClick: () => setReporting(true) },
                  !viewer.blocked && { label: `Block ${first}`, icon: Ban, danger: true, onClick: async () => { if (await blockPerson(person)) onBlockChange?.(true); } },
                ]} />
            )}
          </div>
        )}
        {viewer.blocked && (
          <p className="flex items-start gap-2 self-start rounded-2xl bg-black/40 px-4 py-2 text-sm text-white backdrop-blur">
            <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              You blocked {first}. Their notes and comments are hidden from you.{" "}
              <button type="button" onClick={unblock} className="inline font-semibold !bg-transparent p-0 text-white underline">Unblock</button>
            </span>
          </p>
        )}
      </div>
      {reporting && <ReportDialog person={person} onClose={() => setReporting(false)} />}
      <FollowListModal key={`${person.username}-${person.followers_count}`} person={person} which={list} onWhich={setList} onClose={() => setList(null)} />
    </header>
  );
}
