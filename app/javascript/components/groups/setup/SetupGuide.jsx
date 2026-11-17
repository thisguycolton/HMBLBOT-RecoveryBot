import React, { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, BookOpen, CalendarClock, Check, ClipboardCheck, Copy, ImagePlus, Info, Landmark,
  LayoutTemplate, Medal, MessagesSquare, PartyPopper, Settings, Share2, SkipForward, Sparkles, UserPlus,
} from "lucide-react";
import { inputClass, labelClass, selectClass } from "../../ui/styles";
import { api, ZONES } from "../lib";
import { Card, ErrorNote, Pill, copy, primaryButton, quietButton } from "../ui";
import GroupLogo from "../GroupLogo";
import MeetingsTab from "../MeetingsTab";
import OfficesStep from "./OfficesStep";
import { GroupFrame, GroupRoute } from "../GroupDashboard";

// The setup guide (/groups/:slug/setup/:step), for a group's admins right after they start or
// claim it: about the group, its meetings, its offices (and what each lets its holder do),
// inviting the group, then extras. Every step can be skipped, the guide remembers where they got
// to (groups.setup_steps, POST /api/groups/:slug/setup), and the group page offers it again until
// it's finished or put away (SetupBanner).
export const STEPS = [
  { key: "details", label: "About the group", icon: Info, blurb: "How the group shows up on RecoveryBot: its name, a few words about it, its time zone and logo." },
  { key: "meetings", label: "Meetings", icon: CalendarClock, blurb: "When and where the group meets. Bring them in from AA Intergroup, or add them by hand." },
  { key: "offices", label: "Offices", icon: Landmark, blurb: "The group's service positions. Whoever holds an office gets what it lets them do here, and passes it on when the office changes hands." },
  { key: "invite", label: "Invite your group", icon: UserPlus, blurb: "Send the members your invite link. Anyone who uses it joins right away; others ask, and you let them in." },
  { key: "extras", label: "Extras", icon: Sparkles, blurb: "Optional things you can do now or any time later from Manage." },
];

const stepState = (group, key) => group.setup?.steps?.[key];
export const setupProgress = (group) => STEPS.filter((s) => stepState(group, s.key)).length;
export const firstOpenStep = (group) => STEPS.find((s) => !stepState(group, s.key))?.key || "done";

// /:slug/setup/*: the guide on the stage, for the group's admins
export function SetupRoute() {
  const { slug } = useParams();
  return (
    <GroupRoute>
      {(group, setGroup, reload) => (group.can_manage
        ? <GroupFrame group={group} title="Set up your group"><SetupGuide group={group} setGroup={setGroup} reload={reload} /></GroupFrame>
        : <Navigate to={`/${slug}`} replace />)}
    </GroupRoute>
  );
}

export default function SetupGuide({ group, setGroup, reload }) {
  const { slug, "*": rest = "" } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const key = rest.split("/")[0];
  const topRef = useRef(null);

  // a new step starts at the top (not on the first one, which is already there)
  const firstKey = useRef(key);
  useEffect(() => { if (key !== firstKey.current) window.scrollTo({ top: 0 }); }, [key]);

  if (!key) return <Navigate to={`/${slug}/setup/${firstOpenStep(group)}`} replace />;
  const index = STEPS.findIndex((s) => s.key === key);
  if (index < 0 && key !== "done") return <Navigate to={`/${slug}/setup`} replace />;

  const save = async (body) => {
    const setup = await api(`/groups/${slug}/setup`, { method: "POST", body });
    setGroup((g) => ({ ...g, setup }));
  };
  const go = (to) => navigate(`/${slug}/setup/${to}`);
  const next = async (state) => {
    setError(null);
    try {
      await save({ step: STEPS[index].key, state });
      go(STEPS[index + 1]?.key || "done");
    } catch (e) { setError(e.message); }
  };
  const footer = (props = {}) => (
    <StepFooter
      onBack={index > 0 ? () => go(STEPS[index - 1].key) : null}
      onSkip={() => next("skipped")}
      onContinue={() => next("done")}
      last={index === STEPS.length - 1}
      {...props}
    />
  );

  return (
    <div ref={topRef} className="scroll-mt-24 space-y-5">
      {group.status === "pending" && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900">
          <b>Waiting for a site admin to approve the group.</b> You can set everything up now. People can join once it's approved.
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <StepList group={group} current={key} onPick={go} />
        <div className="min-w-0 space-y-4">
          <PhoneProgress group={group} index={index} />
          <ErrorNote error={error} />
          {key === "done" ? <Finished group={group} save={save} /> : (
            <Card className="p-4 sm:p-6">
              <StepHeading step={STEPS[index]} n={index + 1} />
              {key === "details" && <DetailsStep group={group} setGroup={setGroup} footer={footer} />}
              {key === "meetings" && (
                <>
                  {group.meetings.some((m) => m.oiaa_slug) && (
                    <p className="mb-4 rounded-xl bg-accent/5 px-3 py-2 text-sm text-slate-700 dark:bg-accent/15 dark:text-neutral-200">
                      We brought in the meetings AA Intergroup lists for this group. Check the times, and add any it doesn't list.
                    </p>
                  )}
                  <MeetingsTab group={group} setGroup={setGroup} reload={reload} isNew={group.meetings.length === 0} />
                  {footer({ canContinue: group.meetings.length > 0 })}
                </>
              )}
              {key === "offices" && <OfficesStep group={group} footer={footer} />}
              {key === "invite" && <InviteStep group={group} footer={footer} />}
              {key === "extras" && <ExtrasStep group={group} footer={footer} />}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StepHeading({ step, n }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent dark:bg-accent/25 dark:text-white"><step.icon className="size-5" /></span>
      <div className="min-w-0">
        <p className="!text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Step {n} of {STEPS.length}</p>
        <h2 className="!text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{step.label}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-neutral-400">{step.blurb}</p>
      </div>
    </div>
  );
}

const StateMark = ({ state, active }) => {
  if (state === "done") return <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"><Check className="size-3.5" strokeWidth={3} /></span>;
  if (state === "skipped") return <span className="grid size-6 shrink-0 place-items-center rounded-full bg-neutral-200 text-slate-500 dark:bg-neutral-700 dark:text-neutral-300"><SkipForward className="size-3" /></span>;
  return <span className={`size-6 shrink-0 rounded-full ring-2 ${active ? "ring-accent" : "ring-neutral-300 dark:ring-neutral-600"}`} />;
};

// The steps down the side (wider windows): what's done, what was skipped, where you are
function StepList({ group, current, onPick }) {
  return (
    <nav aria-label="Setup steps" className="hidden lg:block">
      <ol className="!m-0 space-y-1 !p-0">
        {STEPS.map((s) => {
          const state = stepState(group, s.key);
          const active = s.key === current;
          return (
            <li key={s.key} className="list-none">
              <button type="button" onClick={() => onPick(s.key)} aria-current={active ? "step" : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${active ? "!bg-white font-semibold text-slate-900 shadow-panel ring-1 ring-neutral-200 dark:!bg-neutral-900 dark:text-white dark:ring-neutral-700" : "!bg-transparent text-slate-600 hover:!bg-neutral-100 dark:text-neutral-300 dark:hover:!bg-neutral-800"}`}>
                <StateMark state={state} active={active} />
                <span className="min-w-0 flex-1">{s.label}{state === "skipped" && <span className="block text-xs font-normal text-slate-500 dark:text-neutral-400">Skipped</span>}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 px-3 text-xs text-slate-500 dark:text-neutral-400">You can leave and come back. The group page keeps a link here until you finish.</p>
    </nav>
  );
}

// Phones: a bar of steps instead of the list
function PhoneProgress({ group, index }) {
  return (
    <div className="lg:hidden" aria-hidden="true">
      <div className="flex gap-1.5">
        {STEPS.map((s, i) => {
          const state = stepState(group, s.key);
          const tone = i === index ? "bg-accent" : state === "done" ? "bg-emerald-500" : state === "skipped" ? "bg-neutral-400 dark:bg-neutral-500" : "bg-neutral-200 dark:bg-neutral-700";
          return <span key={s.key} className={`h-1.5 flex-1 rounded-full ${tone}`} />;
        })}
      </div>
    </div>
  );
}

function StepFooter({ onBack, onSkip, onContinue, last, busy = false, canContinue = true, continueLabel }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      {onBack && <button type="button" onClick={onBack} className={quietButton}><ArrowLeft className="size-4" /> Back</button>}
      <span className="flex-1" />
      <button type="button" onClick={onSkip} disabled={busy} className={quietButton}>Skip for now</button>
      <button type="button" onClick={onContinue} disabled={busy || !canContinue} className={primaryButton}>
        {busy ? "Saving…" : continueLabel || (last ? "Finish" : "Continue")} {!busy && <ArrowRight className="size-4" />}
      </button>
    </div>
  );
}

// Step 1: the group's name, about, website, time zone and logo (the rest of Group details stays in Manage)
function DetailsStep({ group, setGroup, footer }) {
  const [form, setForm] = useState({ title: group.title || "", description: group.description || "", website: group.website || "", time_zone: group.time_zone });
  const [logo, setLogo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const preview = logo ? URL.createObjectURL(logo) : group.logo_url;

  const saveAndContinue = async (proceed) => {
    if (!form.title.trim()) { setError("The group needs a name."); return; }
    setBusy(true);
    setError(null);
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(`group[${k}]`, v ?? ""));
    if (logo) body.append("group[logo]", logo);
    try {
      const updated = await api(`/groups/${group.slug}`, { method: "PATCH", form: body });
      setGroup((g) => ({ ...updated, setup: g.setup }));
      setLogo(null);
      await proceed();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  // footer's Continue saves first; Skip leaves things as they are
  const base = footer();
  return (
    <div className="space-y-4">
      <ErrorNote error={error} />
      <div className="flex items-center gap-4">
        {preview ? <img src={preview} alt="" className="size-16 rounded-2xl object-cover ring-1 ring-neutral-200 dark:ring-neutral-700" /> : <GroupLogo group={group} className="size-16 text-base" />}
        <div>
          <button type="button" onClick={() => fileRef.current?.click()} className={quietButton}><ImagePlus className="size-4" /> {preview ? "Change logo" : "Add a logo"}</button>
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Square works best. Optional.</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setLogo(e.target.files?.[0] || null)} />
        </div>
      </div>
      <div>
        <label htmlFor="setup-title" className={labelClass}>Name</label>
        <input id="setup-title" required maxLength={120} className={inputClass} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="As the group calls itself" />
      </div>
      <div>
        <label htmlFor="setup-about" className={labelClass}>About the group</label>
        <textarea id="setup-about" rows={3} maxLength={1000} className={inputClass} value={form.description} onChange={(e) => set({ description: e.target.value })}
          placeholder="Who comes, what the meetings are like, anything a newcomer should know" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="setup-zone" className={labelClass}>Time zone</label>
          <select id="setup-zone" className={selectClass} value={form.time_zone} onChange={(e) => set({ time_zone: e.target.value })}>
            {ZONES.map(([z, l]) => <option key={z} value={z}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="setup-web" className={labelClass}>Website</label>
          <input id="setup-web" type="url" className={inputClass} value={form.website} placeholder="https://" onChange={(e) => set({ website: e.target.value })} />
        </div>
      </div>
      {React.cloneElement(base, { busy, onContinue: () => saveAndContinue(base.props.onContinue) })}
    </div>
  );
}

// Step 4: the invite link, to share however the group talks
function InviteStep({ group, footer }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && !!navigator.share;
  const share = () => navigator.share({ title: group.title, text: `Join ${group.title} on RecoveryBot`, url: group.invite_url }).catch(() => {});
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="setup-invite" className={labelClass}>Invite link</label>
        <div className="flex flex-wrap gap-2">
          <input id="setup-invite" readOnly className={`${inputClass} min-w-0 basis-full font-mono !text-xs sm:basis-auto sm:flex-1`} value={group.invite_url || ""} onFocus={(e) => e.target.select()} />
          <button type="button" onClick={() => copy(group.invite_url, () => { setCopied(true); setTimeout(() => setCopied(false), 1500); })} className={quietButton}>
            {copied ? <><Check className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy</>}
          </button>
          {canShare && <button type="button" onClick={share} className={quietButton}><Share2 className="size-4" /> Share</button>}
        </div>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
          Paste it in the group's chat, email list or text thread. Anyone with it joins, so share it with the group, not publicly. You can make a new one in Members if it gets around.
        </p>
      </div>
      <ul className="!m-0 space-y-2 !p-0 text-sm text-slate-700 dark:text-neutral-300">
        <li className="flex list-none gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> People who find the group page can ask to join. You'll get a notification, and you let them in from Members.</li>
        <li className="flex list-none gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> Once someone joins, you can put them in an office or mark them as someone who can host.</li>
      </ul>
      <p className="text-sm text-slate-600 dark:text-neutral-400">
        {group.members_count === 1 ? "It's just you so far." : `${group.members_count} people are in the group.`}{" "}
        <Link to={`/${group.slug}/members`} className="text-accent hover:underline">Open Members</Link>
      </p>
      {footer({ continueLabel: "Done inviting" })}
    </div>
  );
}

// Step 5: optional extras, each a page of its own
const EXTRAS = [
  { to: "page/edit", icon: LayoutTemplate, title: "Design the group page", text: "Lay out what visitors and members see first." },
  { to: "manage/literature", icon: BookOpen, title: "Approved literature", text: "Pick the books the group reads from." },
  { to: "manage/chips", icon: Medal, title: "Chips", text: "Design the group's chips for sobriety milestones." },
  { to: "messages", icon: MessagesSquare, title: "Group chat", text: "Set up channels for the group to talk in." },
  { to: "manage/court", icon: ClipboardCheck, title: "Court verification", text: "Set up the attendance form for people who need one signed." },
  { to: "manage", icon: Settings, title: "Privacy and other settings", text: "Who sees the hosts and sponsors, search listing, Robert's Rules." },
];

function ExtrasStep({ group, footer }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {EXTRAS.map((x) => (
          <Link key={x.to} to={`/${group.slug}/${x.to}`} className="flex gap-3 rounded-2xl bg-neutral-50 p-3 !text-slate-800 ring-1 ring-neutral-200 hover:bg-white hover:ring-accent/40 dark:bg-neutral-950 dark:!text-neutral-100 dark:ring-neutral-800">
            <x.icon className="mt-0.5 size-5 shrink-0 text-accent dark:text-sky-300" />
            <span className="min-w-0"><span className="block text-sm font-semibold">{x.title}</span><span className="block text-xs text-slate-500 dark:text-neutral-400">{x.text}</span></span>
          </Link>
        ))}
      </div>
      <p className="text-xs text-slate-500 dark:text-neutral-400">These open in place of the guide. Come back from the group page whenever you like.</p>
      {footer()}
    </div>
  );
}

// The end: what got done, what's left, and the way to the group
function Finished({ group, save }) {
  const navigate = useNavigate();
  const finished = !!group.setup?.finished_at;
  useEffect(() => { if (!finished) save({ finished: true }).catch(() => {}); }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps
  const skipped = STEPS.filter((s) => stepState(group, s.key) !== "done");
  return (
    <Card className="p-6 text-center sm:p-8">
      <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-accent/10 text-accent dark:bg-accent/25 dark:text-white"><PartyPopper className="size-8" /></span>
      <h2 className="!mt-4 !text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{group.title} is set up</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-neutral-400">
        {skipped.length === 0 ? "You did every step. Everything here can be changed any time from Manage." : "You can come back to anything you skipped from Manage."}
      </p>
      {skipped.length > 0 && (
        <ul className="!mx-auto mt-5 max-w-sm space-y-1.5 !p-0 text-left">
          {skipped.map((s) => (
            <li key={s.key} className="list-none">
              <Link to={`/${group.slug}/setup/${s.key}`} className="flex items-center gap-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm !text-slate-700 ring-1 ring-neutral-200 hover:ring-accent/40 dark:bg-neutral-950 dark:!text-neutral-200 dark:ring-neutral-800">
                <s.icon className="size-4 text-slate-400" /> <span className="flex-1">{s.label}</span> <Pill>Skipped</Pill>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => navigate(`/${group.slug}`)} className={`${primaryButton} mt-6`}>Go to {group.title} <ArrowRight className="size-4" /></button>
    </Card>
  );
}
