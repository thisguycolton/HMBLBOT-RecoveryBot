import React, { useState } from "react";
import { Ban, CalendarDays, Check, EyeOff, Flag, UserPlus } from "lucide-react";
import ReportDialog from "../groups/chat/ReportDialog";
import PostMenu, { blockPerson, unblockPerson } from "../notes/PostMenu";
import Avatar from "../groups/Avatar";
import { api } from "../groups/lib";
import { heroBleed, heroButton, heroQuietButton } from "../groups/page/GroupHero";
import { showToast } from "../../lib/toast";
import FollowListModal from "./FollowListModal";

// The top of a profile: their cover (or the site's blue), picture, name, @username and
// counts, with Follow (or `actions` on your own) under them. The counts open who's on them.
// On someone else's, a ••• offers Report and Block; once you've blocked them it says so, with
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

  return (
    <header className={`relative overflow-hidden rounded-3xl ${bleed ? heroBleed : ""} ${coverUrl ? "bg-neutral-900" : "bg-gradient-to-br from-accent via-sky-600 to-indigo-700"}`}>
      {coverUrl && <img src={coverUrl} alt="" className="absolute inset-0 size-full object-cover" />}
      <div className={`relative flex min-h-[13rem] flex-col justify-end gap-4 p-6 sm:min-h-[15rem] sm:p-10 ${coverUrl ? "bg-gradient-to-t from-black/80 via-black/35 to-transparent" : ""}`}>
        <div className="flex flex-wrap items-end gap-4 sm:gap-5">
          <Avatar person={person} size={96} className="ring-4 ring-white/80 shadow-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="ev-heading !text-2xl !leading-tight font-extrabold tracking-tight text-white sm:!text-4xl [overflow-wrap:break-word] [word-break:normal]">{person.name}</h1>
            <p className="text-sm font-medium text-white/80">@{person.username}{viewer.follows_you ? " · follows you" : ""}</p>
            <div className="mt-3 flex flex-wrap gap-2">
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
        <div className="flex flex-wrap gap-2">
          {actions}
          {!viewer.is_me && viewer.signed_in && (
            <button type="button" disabled={busy} onClick={toggleFollow} className={viewer.following ? heroQuietButton : heroButton}>
              {viewer.following ? <><Check className="size-4" /> Following</> : <><UserPlus className="size-4" /> Follow</>}
            </button>
          )}
          {!viewer.is_me && viewer.signed_in && (
            <PostMenu label={`More about ${first}`} className="text-white [&>button]:!text-white [&>button]:hover:!bg-white/20"
              items={[
                { label: `Report ${first}`, icon: Flag, onClick: () => setReporting(true) },
                !viewer.blocked && { label: `Block ${first}`, icon: Ban, danger: true, onClick: async () => { if (await blockPerson(person)) onBlockChange?.(true); } },
              ]} />
          )}
        </div>
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
