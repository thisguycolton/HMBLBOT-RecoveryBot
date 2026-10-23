import React from "react";
import {
  AlarmClock, ArrowLeft, ArrowRight, BookOpen, BookText, Clock, History, LayoutList, Link2, MessageSquare, PartyPopper, ScrollText, Users, X, Zap,
} from "lucide-react";
import { primaryButton, quietButton } from "../../ui";
import ActivityPanel from "../Activity";
import { Milestones } from "../Service";
import ServiceReadings from "../ServiceReadings";
import { ACTIVITY_TITLE, cueLabel } from "../lib";
import { ActivityCard, ActivityLog, ChatPostings, Flow, HostsHere, MeetingClock, QuickActions, ReadingView, Readings, ScriptView, ShareLink } from "../parts";

// HostDeck's blocks: each module of a meeting's HostDeck (what was the Hosting Command Center) as
// a block that a layout places in a region (templates.js). Every block draws itself from `deck`
// (useHostingDeck.js) at a size:
//
//   main  the big area in the middle
//   side  a compact card or list, for the sidebars
//   bar   short and stretched out, for the bottom bar (and the strip of reminders at the top)
//
// `sizes` lists the ones a block has; a block in a region whose size it doesn't have isn't
// offered there. `tab` is the phone tab it shows under (null: not on phones, the stage shows the
// flow itself there). `empty(deck)` says when there's nothing to show, so the block takes no room;
// `collapse` is for a block that finds that out itself (it loads what it lists) and draws nothing.
//
// Phase 0 of HostDeck: every block has the one size it had in the Command Center. The others
// come with the layout editor (hostdeck/plan.md in the project files).

const FlowBlock = ({ deck }) => (
  <Flow sections={deck.sections} shown={deck.shown} index={deck.index} completed={deck.live.completed} presences={deck.live.presences} goto={deck.goto} picked={!!deck.live.activity} />
);

// The middle of the deck: the script a section at a time, or what another block opened here
// (a kit reading, or the day's activity when the script has no spot for it)
function StageBlock({ block, deck }) {
  const { center, live, reading, setReading, size } = deck;
  if (reading === "activity") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-8 sm:py-8">
        <div className="mb-3 flex items-center gap-2"><h1 className="flex-1 text-2xl font-bold sm:text-3xl">{ACTIVITY_TITLE}</h1><button type="button" className={quietButton} onClick={() => setReading(null)}><X className="size-4" /> Back to the script</button></div>
        <ActivityPanel center={center} live={live} act={deck.act} size={size} />
      </div>
    );
  }
  if (reading) return <ReadingView reading={reading} size={size} onClose={() => setReading(null)} />;
  return (
    <ScriptView center={center} sections={deck.sections} shown={deck.shown} index={deck.index} section={deck.section} live={live} size={size} upNextIndex={deck.nextIndex(deck.index, 1)}
      goto={deck.goto} next={deck.next} act={deck.act} openSetup={() => deck.setSetup(true)}
      flow={block.settings?.phone_flow === false ? null : <div className="lg:hidden"><FlowBlock deck={deck} /></div>} />
  );
}

// The reminders whose time has come, across the top
function RemindersBlock({ deck }) {
  const { cues, now, index } = deck;
  return cues.map(({ sec, i, at }) => (
    <div key={i} role="alert" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-amber-950 dark:border-amber-700/60 dark:bg-amber-900/50 dark:text-amber-50">
      <AlarmClock className="size-5 shrink-0 animate-pulse" />
      <p className="min-w-0 flex-1 text-sm"><strong>{now < at ? `Coming up: ${sec.title}` : `It's time: ${sec.title}`}</strong> <span className="opacity-80">· {cueLabel(sec.cue)}</span></p>
      {index !== i && <button type="button" className={`${primaryButton} !px-3 !py-1.5`} onClick={() => deck.goto(i)}>Go there <ArrowRight className="size-4" /></button>}
      <button type="button" className="inline-grid size-8 place-items-center rounded-lg !bg-transparent hover:!bg-amber-200/70 dark:hover:!bg-amber-800/60" onClick={() => deck.dismiss(i)} aria-label={`Close the reminder for ${sec.title}`}><X className="size-4" /></button>
    </div>
  ));
}

function PreviousBlock({ deck }) {
  const to = deck.nextIndex(deck.index, -1);
  return (
    <button type="button" className={`${quietButton} sm:!px-4`} onClick={() => deck.goto(to)} disabled={to < 0} aria-label="Previous section">
      <ArrowLeft className="size-4" /> <span className="hidden sm:inline">Previous</span>
    </button>
  );
}

function NextBlock({ deck }) {
  return (
    <button type="button" className={`${primaryButton} sm:!px-5`} onClick={deck.next} disabled={deck.nextIndex(deck.index, 1) < 0} aria-label="Next section">
      <span className="hidden sm:inline">Next</span> <ArrowRight className="size-4" />
    </button>
  );
}

export const BLOCKS = {
  stage: { label: "Script", icon: ScrollText, sizes: ["main"], tab: "script", component: StageBlock },
  reminders: { label: "Reminders", icon: AlarmClock, sizes: ["bar"], tab: "all", component: RemindersBlock },
  flow: { label: "Meeting flow", icon: LayoutList, sizes: ["side"], tab: null, component: FlowBlock },
  activity: {
    label: "Reading / activity", icon: Zap, sizes: ["side"], tab: "readings",
    component: ({ deck }) => <ActivityCard activity={deck.live.activity} open={deck.reading === "activity" || !!deck.section?.activity} onOpen={deck.openActivity} />,
  },
  meeting_readings: {
    label: "Meeting readings", icon: BookOpen, sizes: ["side"], tab: "readings",
    component: ({ deck }) => <Readings kit={deck.center.kit} open={deck.reading} onOpen={deck.openReading} />,
  },
  service_readings: { label: "Service readings", icon: BookText, sizes: ["side"], tab: "readings", collapse: true, component: ({ deck }) => <ServiceReadings slug={deck.slug} /> },
  quick_actions: { label: "Quick actions", icon: History, sizes: ["side"], tab: "readings", component: ({ deck }) => <QuickActions center={deck.center} /> },
  chat_postings: {
    label: "Chat postings", icon: MessageSquare, sizes: ["side"], tab: "chat",
    component: ({ deck }) => <ChatPostings center={deck.center} live={deck.live} elapsed={deck.elapsed} act={deck.act} />,
  },
  share_link: { label: "Share link", icon: Link2, sizes: ["side"], tab: "people", component: ({ deck }) => <ShareLink link={deck.center.link} /> },
  hosts_here: { label: "Hosts here", icon: Users, sizes: ["side"], tab: "people", component: ({ deck }) => <HostsHere live={deck.live} now={deck.now} /> },
  milestones: { label: "Milestones", icon: PartyPopper, sizes: ["side"], tab: "people", component: ({ deck }) => <Milestones live={deck.live} act={deck.act} /> },
  activity_log: { label: "Done so far", icon: History, sizes: ["side"], tab: "people", empty: (deck) => !deck.live.log.length, component: ({ deck }) => <ActivityLog live={deck.live} /> },
  previous: { label: "Previous", icon: ArrowLeft, sizes: ["bar"], tab: "all", component: PreviousBlock },
  clock: { label: "Meeting clock", icon: Clock, sizes: ["bar"], tab: "all", component: ({ deck }) => <MeetingClock center={deck.center} elapsed={deck.elapsed} /> },
  next: { label: "Next", icon: ArrowRight, sizes: ["bar"], tab: "all", component: NextBlock },
};
