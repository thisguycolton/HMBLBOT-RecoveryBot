import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, BellPlus, BellRing, Check, Search, Sparkles, X } from "lucide-react";
import { api } from "../groups/lib";
import GroupLogo from "../groups/GroupLogo";
import { Card, ErrorNote, Pill, Tray, primaryButton, quietButton } from "../groups/ui";
import { SkeletonGroup, SkeletonRow } from "../ui/Skeleton";
import { inputClass } from "../ui/styles";

// Step 1: "Find your group". With nothing typed, the busiest groups on RecoveryBot; typing
// searches them by name, meeting or Zoom link, then the intergroup listings with no group here
// yet (AA Intergroup and the imported local lists), which they can follow (hear when it comes
// to RecoveryBot) or start (they run it once a site admin approves it). It reuses the Groups
// endpoints, so asking to join notifies the group's admins as it does everywhere else.
export default function GroupStep({ name, myGroups, done, record, unrecord, onNext }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const latest = useRef(0);

  useEffect(() => {
    const id = ++latest.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api(`/welcome/groups?${new URLSearchParams({ q: q.trim() })}`);
        if (id === latest.current) { setResults(data); setError(null); }
      } catch (err) {
        if (id === latest.current) setError(err.message);
      } finally {
        if (id === latest.current) setLoading(false);
      }
    }, q.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [q]);

  const acted = done.joined.length + done.followed.length + done.started.length > 0;
  const inGroups = myGroups.filter((g) => g.status === "active");

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="!text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:!text-3xl">
        Welcome{name ? `, ${name}` : ""}! Let's find your group.
      </h1>
      <p className="mt-2 text-slate-600 dark:text-neutral-300">
        Your home group's page has its meetings, chat and the people in it. Ask to join, and one of its admins lets you in.
      </p>

      {inGroups.length > 0 && (
        <p className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          You're already in {inGroups.map((g) => g.title).join(", ")}.
        </p>
      )}

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input type="text" inputMode="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search"
          aria-label="Search for your group" placeholder="Group or meeting name, or a Zoom link"
          className={`${inputClass} !rounded-2xl py-3 pl-10 pr-10 text-base`} />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Clear the search"
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full !bg-transparent text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="mt-5 flex-1 space-y-5">
        <ErrorNote error={error} />
        {loading && !results ? (
          <ResultsSkeleton />
        ) : results ? (
          <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
            <Tray label={results.suggested ? "Groups on RecoveryBot" : "On RecoveryBot"}>
              {results.groups.length === 0 ? (
                <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">
                  {results.suggested ? "No groups here yet." : `No group here matches “${q.trim()}” yet.`}
                </Card>
              ) : (
                <div className="space-y-1.5">
                  {results.groups.map((g) => <GroupRow key={g.slug} group={g} done={done} record={record} />)}
                </div>
              )}
            </Tray>

            {results.suggested ? (
              <p className="px-1 text-sm text-slate-500 dark:text-neutral-400">
                Don't see yours? Search for it. Meetings listed by AA Intergroup and local intergroups show up too, so you can follow your group or start it here.
              </p>
            ) : (
              <Tray label="Not on RecoveryBot yet">
                {results.listings.length === 0 ? (
                  <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">
                    {results.listings_ready ? "No intergroup listing matches that." : "The intergroup listings are still loading. Try again in a minute."}
                  </Card>
                ) : (
                  <div className="space-y-1.5">
                    {results.listings.map((l) => <ListingRow key={l.slug} listing={l} done={done} record={record} unrecord={unrecord} />)}
                  </div>
                )}
              </Tray>
            )}
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 flex items-center gap-2 border-t border-neutral-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 sm:-mx-6 sm:px-6">
        <p className="flex-1 text-xs text-slate-500 dark:text-neutral-400">{acted ? "You can add more groups later from Groups." : "You can do this later from Groups in the menu."}</p>
        <button type="button" onClick={onNext} className={acted ? `${primaryButton} py-2.5` : `${quietButton} py-2.5`}>
          {acted ? "Continue" : "Skip for now"} <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <SkeletonGroup label="Loading groups">
      <div className="nest-tray rounded-3xl bg-neutral-100 p-1.5 dark:bg-neutral-800/70">
        <div className="space-y-1.5">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="p-3"><SkeletonRow avatar={44} square lines={2} action seed={i} /></Card>
          ))}
        </div>
      </div>
    </SkeletonGroup>
  );
}

function GroupRow({ group, done, record }) {
  const [status, setStatus] = useState(group.membership_status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const asked = status === "requested" || done.joined.some((g) => g.slug === group.slug);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await api(`/groups/${group.slug}/join`, { method: "POST" });
      setStatus(data.membership_status || "requested");
      record("joined", { slug: group.slug, title: group.title });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const meta = [
    group.members_count ? `${group.members_count} ${group.members_count === 1 ? "member" : "members"}` : null,
    group.next_meeting || (group.meetings_count ? null : "No meetings listed"),
  ].filter(Boolean).join(" · ");

  return (
    <Card className="p-3">
      <div className="flex items-center gap-3">
        <GroupLogo group={group} className="size-11 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug text-slate-900 dark:text-white">{group.title}</p>
          {meta && <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">{meta}</p>}
        </div>
        {status === "active" ? (
          <Pill tone="green"><Check className="size-3" /> You're in</Pill>
        ) : asked ? (
          <Pill tone="amber">Request sent</Pill>
        ) : (
          <button type="button" disabled={busy} onClick={join} className={primaryButton}>{busy ? "Asking…" : "Ask to join"}</button>
        )}
      </div>
      {group.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-neutral-400">{group.description}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
    </Card>
  );
}

// A group the intergroup lists that isn't here yet: Follow it, or Start it (asks first)
function ListingRow({ listing, done, record, unrecord }) {
  const [following, setFollowing] = useState(listing.following);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const started = done.started.find((g) => g.slug === listing.slug);
  const path = `/intergroup_pages/${encodeURIComponent(listing.slug)}/follow`;

  const toggleFollow = async () => {
    setBusy("follow");
    setError(null);
    try {
      const data = await api(path, { method: following ? "DELETE" : "POST" });
      setFollowing(data.following);
      if (data.following) record("followed", { slug: listing.slug, name: listing.name });
      else unrecord("followed", listing.slug);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const start = async () => {
    setBusy("start");
    setError(null);
    try {
      const group = await api("/groups/start", { method: "POST", body: { oiaa_slug: listing.slug } });
      record("started", { slug: listing.slug, title: group.title, group: group.slug });
      setConfirming(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-48">
          <p className="font-medium text-slate-900 dark:text-white">{listing.name}</p>
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            {listing.schedules.join(" · ")}{listing.more > 0 ? ` · ${listing.more} more` : ""}
          </p>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-neutral-500">
            Listed by {listing.source}{listing.followers > 0 ? ` · ${listing.followers} following` : ""}
          </p>
        </div>
        {started ? (
          <Pill tone="green"><Sparkles className="size-3" /> Started, waiting for approval</Pill>
        ) : (
          <div className="flex gap-1.5">
            <button type="button" disabled={!!busy} onClick={toggleFollow} aria-pressed={following}
              className={following ? `${quietButton} !text-accent dark:!text-sky-300` : quietButton}>
              {following ? <><BellRing className="size-4" /> Following</> : <><BellPlus className="size-4" /> Follow</>}
            </button>
            {!listing.starting && (
              <button type="button" disabled={!!busy} onClick={() => setConfirming(true)} className={quietButton}>
                <Sparkles className="size-4" /> Start
              </button>
            )}
          </div>
        )}
      </div>
      {listing.starting && !started && (
        <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">Someone has already started this group here. Follow it to hear when it's ready.</p>
      )}
      {confirming && !started && (
        <div className="mt-3 rounded-xl bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
          <p className="text-slate-700 dark:text-neutral-200">
            Start <b>{listing.name}</b> on RecoveryBot? Its meetings come over from the listing, and you'll be its admin once a site admin approves it.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button type="button" disabled={!!busy} onClick={start} className={primaryButton}>{busy === "start" ? "Starting…" : "Start this group"}</button>
            <button type="button" disabled={!!busy} onClick={() => setConfirming(false)} className={quietButton}>Cancel</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
    </Card>
  );
}
