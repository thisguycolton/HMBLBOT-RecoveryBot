import React, { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Flame, Gift, HandHeart, Layers, Lock, MoonStar, Sparkles, Star, Users } from "lucide-react";
import { api } from "../groups/lib";
import { Card, ErrorNote, Loading, Pill, linkButton, primaryButton, quietButton } from "../groups/ui";
import Toggle from "../ui/Toggle";
import ChipModal, { FlatChip } from "./ChipModal";
import ChipShare from "./ChipShare";
import { dayLabel, localDate, meetingPlace } from "./lib";

const short = (iso) => dayLabel(iso, { month: "short", day: "numeric", year: "numeric" });

// What a chip's modal says about it
function story(chip) {
  if (chip.source === "edition" && chip.kind === "meeting") return `${chip.group.title}'s ${chip.edition.name}: ${chip.label}, reached ${dayLabel(chip.on)}.`;
  if (chip.source === "edition") return `${chip.group.title}'s ${chip.edition.name}, for ${chip.label} on ${dayLabel(chip.on)}.`;
  if (chip.source === "given") return `From ${chip.group.title}${chip.given_by ? `, given by ${chip.given_by}` : ""}, ${dayLabel(chip.on)}.`;
  if (chip.kind === "round") return `You reached ${chip.label} on ${dayLabel(chip.on)}.`;
  if (chip.kind === "meeting") return `${chip.label}${meetingPlace(chip.meeting, " at ")}, reached ${dayLabel(chip.on)}.`;
  return `${chip.label}, reached ${dayLabel(chip.on)}.`;
}

// Chips (/recovery): every chip the member has earned or been given (Chips.catalog on the
// server), a section for each series with the next one faded, their 10th step and gratitude
// streaks, and their choices: which chip goes on top when two mark the same milestone, and up
// to five favorites to show on their profile. Only they see this page.
export default function ChipsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [celebrate, setCelebrate] = useState(false);
  const [sharing, setSharing] = useState(false); // ?share=1 opens Share to timeline (the day count's Share it)
  const [params, setParams] = useSearchParams();
  const load = useCallback(() => api(`/recovery?today=${localDate()}`).then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { document.title = "Chips | RecoveryBot"; load(); }, [load]);
  // A chip someone gave them opens from its notification (?chip=award:12), with confetti
  useEffect(() => {
    const id = params.get("chip");
    if (!id || !data) return;
    if (data.chips.some((c) => c.id === id)) { setOpenId(id); setCelebrate(true); setSharing(params.get("share") === "1"); }
    setParams({}, { replace: true });
  }, [params, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (body) => {
    setError(null);
    try { setData(await api("/recovery", { method: "PATCH", body: { ...body, today: localDate() } })); } catch (e) { setError(e.message); }
  };

  if (!data) return error ? <ErrorNote error={error} /> : <Loading />;
  const { design, chips, upcoming } = data;
  const tops = chips.filter((c) => c.top);
  const open = openId && chips.find((c) => c.id === openId);
  const show = (kinds) => ({
    chips: tops.filter((c) => kinds.includes(c.kind)).sort((a, b) => (a.on < b.on ? 1 : -1)),
    next: upcoming.filter((c) => kinds.includes(c.kind)),
  });
  const editions = chips.filter((c) => c.edition).sort((a, b) => (a.on < b.on ? 1 : -1));
  const meetings = Object.values(tops.concat(upcoming).filter((c) => c.kind === "meeting" && c.source !== "edition").reduce((by, c) => {
    (by[c.series] ||= { meeting: c.meeting, chips: [], next: [] })[c.upcoming ? "next" : "chips"].push(c);
    return by;
  }, {}));
  const favorite = (id) => data.favorites.includes(id);
  const toggleFavorite = (id) => save({ favorites: favorite(id) ? data.favorites.filter((f) => f !== id) : [...data.favorites, id] });
  const openChip = (c) => { setCelebrate(false); setSharing(false); setOpenId(c.id); };
  const claim = async (a) => {
    setError(null);
    try {
      const { chip } = await api("/recovery/claim", { method: "POST", body: { edition_id: a.edition_id, slot: a.slot, today: localDate() } });
      await load();
      setSharing(false);
      setCelebrate(true);
      setOpenId(chip.id);
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Chips</h1>
          <p className="mt-1 flex items-center gap-1.5 text-slate-500 dark:text-neutral-400"><Lock className="size-4" /> Only you can see your chips, unless you put favorites on your profile.</p>
        </div>
        {data.can_give && <Link to="/give" className={quietButton}><Gift className="size-4" /> Give a chip</Link>}
      </header>
      <ErrorNote error={error} />

      {data.available?.length > 0 && <Claims list={data.available} onClaim={claim} />}

      <Section title="Sobriety">
        {!data.sobriety_date ? (
          <Card className="p-5 text-sm text-slate-600 dark:text-neutral-300">
            Add your sobriety date to <a href="/users/edit" className="font-medium text-accent hover:underline">your profile</a> and your chips show up here, from your 24 hours on.
            It stays private unless you choose to show it.
          </Card>
        ) : (
          <Grid {...show(["round"])} design={design} favorite={favorite} onOpen={openChip}
            empty="Today is day one. Your 24 hour chip is waiting for you tomorrow." />
        )}
      </Section>

      <Section title="10th step" icon={MoonStar} action={!data.today.inventory && <Link to="/inventory" className={quietButton}>Write tonight's inventory</Link>}>
        <Streak streak={data.streaks.inventory} total={data.totals.inventory} unit={["night", "nights"]} done={data.today.inventory} />
        <Grid {...show(["inventory", "inventory-streak"])} design={design} favorite={favorite} onOpen={openChip} />
      </Section>

      <Section title="Gratitude" icon={HandHeart} action={!data.today.gratitude && <Link to="/gratitude" className={quietButton}>Write today's list</Link>}>
        <Streak streak={data.streaks.gratitude} total={data.totals.gratitude} unit={["day", "days"]} done={data.today.gratitude} />
        <Grid {...show(["gratitude", "gratitude-streak"])} design={design} favorite={favorite} onOpen={openChip} />
      </Section>

      <Section title="Meeting Maker" icon={Users}>
        {meetings.length === 0 ? (
          <Card className="p-5 text-sm text-slate-600 dark:text-neutral-300">
            Click a meeting's Join button in the half hour before it starts, and once it starts you're a Meeting Maker there. Each meeting has its own chips, and so do all of a group's meetings together and every meeting you go to, and you unlock more the more often you come.
          </Card>
        ) : meetings.map((m) => (
          <div key={m.meeting.id} className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-neutral-200">
              {m.meeting.name}{m.meeting.group_title && m.meeting.group_title !== m.meeting.name && <span className="font-normal text-slate-500"> · {m.meeting.group_title}</span>}
            </h3>
            <Grid chips={m.chips.sort((a, b) => b.count - a.count)} next={m.next} design={design} favorite={favorite} onOpen={openChip} />
          </div>
        ))}
      </Section>

      {editions.length > 0 && (
        <Section title="Special Editions" icon={Sparkles}>
          <Grid chips={editions} design={design} favorite={favorite} onOpen={openChip} />
        </Section>
      )}

      <Card className="space-y-3 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Star className="size-4" /> Favorites on your profile</h2>
        <Toggle checked={data.show_on_profile} onChange={(v) => save({ show_on_profile: v })} label="Show my favorite chips on my profile"
          description={`Up to ${data.favorites_max}. Star a chip to pick it; signed-in members who visit your profile see them. This adds a Chips block to your page, which you can move in Edit your page. A sobriety chip says how long you've been sober, so pick the ones you're happy to share.`} />
        <p className="text-sm text-slate-500 dark:text-neutral-400">
          {data.favorites.length} of {data.favorites_max} picked.
          {data.show_on_profile && data.profile_path && <> <a href={data.profile_path} className={linkButton}>See your profile</a></>}
        </p>
      </Card>

      <p className="text-xs text-slate-500 dark:text-neutral-400">
        Triangle chips come at 1, 7, 30, 90, 180 and 365 10th steps or gratitude lists, then every 365 more, and for 7, 30, 90, 180 and 365 in a row.
        Meeting Maker chips come at 1, 5, 10, 25, 50 and 100 meetings, then every 100.
      </p>

      {open && (
        <ChipModal chip={open} design={design} text={story(open)} celebrate={celebrate} onClose={() => setOpenId(null)}>
          {open.note && <p className="!text-center italic">“{open.note}”</p>}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" className={favorite(open.id) ? primaryButton : quietButton}
              disabled={!favorite(open.id) && data.favorites.length >= data.favorites_max} onClick={() => toggleFavorite(open.id)}>
              <Star className={`size-4 ${favorite(open.id) ? "fill-current" : ""}`} /> {favorite(open.id) ? "A favorite" : "Favorite"}
            </button>
          </div>
          <ChipShare key={open.id} chip={open} options={data} startOpen={sharing} />
          <Duplicates chip={open} chips={chips} design={design} onPick={(c) => { save({ top: { slot: c.slot, id: c.id } }); setOpenId(c.id); }} />
        </ChipModal>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, action, children }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{Icon && <Icon className="size-4" />} {title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// "🔥 12 nights in a row · best 30", to keep a streak going
export function Streak({ streak, total, unit, done }) {
  const word = (n) => (n === 1 ? unit[0] : unit[1]);
  const alive = streak.current > 0;
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-4 py-3 text-sm ${alive ? "bg-orange-50 text-orange-900 dark:bg-orange-950/40 dark:text-orange-100" : "bg-neutral-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"}`}>
      <span className="flex items-center gap-1.5 font-semibold">
        <Flame className={`size-5 ${alive ? "fill-orange-400 text-orange-500" : "text-slate-400"}`} />
        {alive ? `${streak.current} ${word(streak.current)} in a row` : "No streak going"}
      </span>
      {alive && !done && <span>Keep it going today.</span>}
      {!alive && total > 0 && <span>Write one today to start a new one.</span>}
      <span className="ml-auto text-xs opacity-80">Best {streak.best} · {total} in all</span>
    </div>
  );
}

function Grid({ chips, next = [], design, favorite, onOpen, empty }) {
  return (
    <Card className="p-4 sm:p-6">
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4">
        {chips.map((c) => (
          <li key={c.id}>
            <button type="button" className="group relative flex w-full flex-col items-center gap-2 !bg-transparent text-center" onClick={() => onOpen(c)}>
              <FlatChip chip={c} design={design} className="transition-transform group-hover:scale-105" />
              {favorite(c.id) && <Star className="absolute right-2 top-0 size-5 fill-amber-400 text-amber-500" aria-label="A favorite" />}
              <span className="text-sm font-semibold text-slate-900 dark:text-white">{c.label}</span>
              <span className="-mt-2 flex flex-wrap items-center justify-center gap-1 text-xs text-slate-500 dark:text-neutral-400">
                {short(c.on)}
                {c.edition ? <Pill tone="accent">{c.edition.name}{c.edition.serial ? ` · No. ${c.edition.serial}` : ""}</Pill>
                  : c.source === "given" && <Pill tone="accent">{c.group.title}</Pill>}
                {c.others > 0 && <Pill><Layers className="size-3" /> +{c.others}</Pill>}
              </span>
            </button>
          </li>
        ))}
        {next.map((c) => (
          <li key={c.id} className="flex flex-col items-center gap-2 text-center">
            <FlatChip chip={c} design={design} faded />
            <span className="text-sm font-semibold text-slate-500 dark:text-neutral-400">{c.label}</span>
            <span className="-mt-2 text-xs text-slate-500 dark:text-neutral-400">
              {c.kind === "round" ? (c.to_go === 1 ? "Tomorrow" : `In ${c.to_go.toLocaleString()} days`) : `${c.to_go.toLocaleString()} to go`}
            </span>
          </li>
        ))}
      </ul>
      {chips.length === 0 && empty && <p className="mt-4 text-center text-sm text-slate-500">{empty}</p>}
    </Card>
  );
}

// When more than one chip marks the same milestone: the others, to pick which goes on top
function Duplicates({ chip, chips, design, onPick }) {
  const same = chips.filter((c) => c.slot === chip.slot);
  if (same.length < 2) return null;
  return (
    <div className="mt-4 space-y-2 border-t border-neutral-200 pt-3 dark:border-neutral-700">
      <p className="!text-center text-sm">You have {same.length} of these. The one on top shows first.</p>
      <div className="flex flex-wrap justify-center gap-3">
        {same.map((c) => (
          <button key={c.id} type="button" onClick={() => onPick(c)} aria-pressed={c.top}
            className={`flex flex-col items-center gap-1 rounded-xl !bg-transparent p-2 text-xs ${c.top ? "ring-2 ring-accent" : "ring-1 ring-neutral-200 dark:ring-neutral-700"}`}>
            <FlatChip chip={c} design={design} size={64} />
            {c.edition ? c.edition.name : c.source === "given" ? c.group.title : "RecoveryBot"}
            {c.top && <span className="font-semibold text-accent">On top</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// Special Editions waiting for them: a milestone they reached while one of their groups' was
// running. Theirs to claim with a tap, any time.
function Claims({ list, onClaim }) {
  const [busy, setBusy] = useState(null);
  const go = async (a) => { setBusy(`${a.edition_id}-${a.slot}`); await onClaim(a); setBusy(null); };
  return (
    <Section title="Ready to claim" icon={Sparkles}>
      <Card className="p-4 sm:p-6">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4">
          {list.map((a) => (
            <li key={`${a.edition_id}-${a.slot}`} className="flex flex-col items-center gap-2 text-center">
              <FlatChip chip={a} />
              <span className="text-sm font-semibold text-slate-900 dark:text-white">{a.edition.name}</span>
              <span className="-mt-2 text-xs text-slate-500 dark:text-neutral-400">
                {a.label} · {a.group.title}{a.edition.left != null && <><br />{a.edition.left.toLocaleString()} left</>}
              </span>
              <button type="button" className={primaryButton} disabled={!!busy} onClick={() => go(a)}>
                <Sparkles className="size-4" /> {busy === `${a.edition_id}-${a.slot}` ? "Claiming…" : "Claim it"}
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}
