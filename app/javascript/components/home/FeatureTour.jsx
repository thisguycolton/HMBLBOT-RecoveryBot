import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight, BookOpen, CalendarDays, HandHeart, Medal, MapPinned, MessagesSquare, MonitorPlay, Users,
} from "lucide-react";
import { ChatMock, ChipsMock, FindMock, GroupMock, HostMock, ReadMock, ReflectMock, TodayMock } from "./mockups";
import "../../styles/home.css";

// The home page's walkthroughs: one section per feature, its steps on one side and a drawing
// of the page on the other (mockups.jsx) that follows the step you're on. On wide screens the
// drawing stays put while the steps scroll past it; on phones you tap a step.
// `auth` features send signed-out visitors to sign up; `groups` ones only show to accounts
// that see Groups (and to everyone signed out, since group pages are public).
export const FEATURES = [
  {
    key: "find",
    label: "Find a meeting",
    icon: MapPinned,
    title: "Find a meeting, any hour",
    blurb: "Every online meeting in the AA Intergroup listings plus our groups' own, searchable by day, time and name. No account needed.",
    steps: [
      { title: "Search or filter", text: "Type a name, or pick Today, Live now, a time of day, online or in person. The filters stay in the address, so you can bookmark your usual search." },
      { title: "See what's starting", text: "Each meeting shows if it's live now or how long until it starts, in your own time zone." },
      { title: "Tap Join", text: "Join opens the meeting link. Signed in and a few minutes early? It counts toward your Meeting Maker chip." },
    ],
    Mock: FindMock,
    href: "/groups/meetings",
    cta: "Find a meeting",
  },
  {
    key: "groups",
    label: "Your group",
    icon: Users,
    title: "Your home group, between meetings",
    blurb: "Each group gets its own page with its meetings, events, chat and members, plus a feed of notes from the people you follow.",
    steps: [
      { title: "Find your group", text: "Search for your home group and tap Ask to join. An admin of the group lets you in." },
      { title: "Meetings and events", text: "The group's page shows the next meeting with a Join button, and events you can RSVP to. You hear about changes to the ones you're going to." },
      { title: "Your home feed", text: "Post a note with photos, react and comment, and @ mention someone. Each note can be just for you, your followers or all members, and shared to your groups." },
    ],
    Mock: GroupMock,
    href: "/groups/find",
    cta: "Find your group",
    groups: true,
  },
  {
    key: "chat",
    label: "Group chat",
    icon: MessagesSquare,
    title: "Group chat with @ mentions",
    blurb: "Channels for your group, right next to its meetings. Tag one person, a whole role or a service position.",
    steps: [
      { title: "Open Chat", text: "It's in your group's folder in the menu. Pick a channel, or start one if your group lets you." },
      { title: "Type @ to tag", text: "Pick a person, a role like @hosts, or a service position like the host coordinator. Admins can tag @everyone." },
      { title: "They get the ping", text: "Whoever you tag gets a bell notification, and a push on their phone if they turned those on." },
    ],
    Mock: ChatMock,
    href: "/groups/find",
    cta: "Find your group",
    groups: true,
  },
  {
    key: "today",
    label: "Today",
    icon: CalendarDays,
    title: "Today: what's on your plate",
    blurb: "A short daily view of your day count and the service that's yours this week.",
    steps: [
      { title: "Open Today", text: "Tap the calendar on the phone's bottom bar. On a computer it sits beside your home feed." },
      { title: "Needs your attention", text: "Meetings you're hosting, sub requests you could take and anything your service role is waiting on, the soonest first." },
      { title: "Filling in", text: "When someone covers a shift, the host, the person filling in and the host coordinators all see who's on." },
    ],
    Mock: TodayMock,
    href: "/people",
    cta: "Open your home feed",
    auth: true,
    groups: true,
  },
  {
    key: "host",
    label: "HostDeck",
    icon: MonitorPlay,
    title: "Host a meeting with HostDeck",
    blurb: "Your group's script, readings, topic and milestones on one screen, so the host can just host.",
    steps: [
      { title: "Open the deck", text: "When it's your turn, open HostDeck from Hosting. The script is your group's own, with today's names and readings filled in." },
      { title: "Go section by section", text: "Next moves you through the meeting while the timer keeps time. Readings, readers and tonight's topic are right there." },
      { title: "Celebrate milestones", text: "Add who's celebrating in the Milestones form and check them off as you go." },
    ],
    Mock: HostMock,
    href: "/people/me/hosting",
    cta: "Go to Hosting",
    auth: true,
    groups: true,
  },
  {
    key: "chips",
    label: "Chips",
    icon: Medal,
    title: "Your day count and chips",
    blurb: "Keep your days and collect the chips you've earned, made to turn in your hand.",
    steps: [
      { title: "Add your sobriety date", text: "Set it in your settings. Your day count shows when you sign in, with confetti on milestone days." },
      { title: "Collect your chips", text: "Every milestone earns a chip. Spin it, flip it over, and pin your favorites to your page if you like." },
      { title: "Streaks and gifts", text: "Writing your 10th step or gratitude list night after night, and showing up early to meetings, earn chips too. Hosts can give a chip to anyone." },
    ],
    Mock: ChipsMock,
    href: "/recovery",
    cta: "See your chips",
    auth: true,
  },
  {
    key: "reflect",
    label: "10th step",
    icon: HandHeart,
    title: "A nightly 10th step and gratitude list",
    blurb: "The Big Book's evening review and a gratitude list, private to you, with a reminder if you want one.",
    steps: [
      { title: "Take your inventory", text: "Answer the questions from page 86 with a yes or no and a note. It takes a few minutes." },
      { title: "Write what you're grateful for", text: "A short list each day. Look back over past days whenever you want." },
      { title: "Turn on a reminder", text: "Pick a time and get a nudge each day, skipped if you've already written. Only you ever see your entries." },
    ],
    Mock: ReflectMock,
    href: "/recovery/inventory",
    cta: "Start tonight's 10th step",
    auth: true,
  },
  {
    key: "read",
    label: "Highlights",
    icon: BookOpen,
    title: "Read, highlight and share",
    blurb: "The Big Book, the Twelve and Twelve, Daily Reflections and more, with highlights and notes that stay yours until you share them.",
    steps: [
      { title: "Highlight a line", text: "Select any passage and pick a color. Everything you mark lands in My highlights." },
      { title: "Add a note", text: "Write why it hit home. Notes can have formatting and photos." },
      { title: "Share when you want", text: "Highlights are private. Share to timeline puts one in front of your followers or all members." },
    ],
    Mock: ReadMock,
    href: "/library",
    cta: "Open the library",
  },
];

export const visibleFeatures = (signedIn) =>
  FEATURES.filter((f) => !f.groups || !signedIn || document.body.dataset.groups === "true");

const wide = () => window.matchMedia?.("(min-width: 1024px)").matches;

function Explainer({ feature, signedIn, index }) {
  const [step, setStep] = useState(0);
  const stepRefs = useRef([]);
  const { Mock, icon: Icon } = feature;
  const locked = feature.auth && !signedIn;

  // On wide screens, the step in the middle of the window is the one shown
  useEffect(() => {
    if (!wide() || !("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setStep(Number(e.target.dataset.step))),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    stepRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id={`tour-${feature.key}`}
      className={`scroll-mt-20 border-t border-neutral-200 dark:border-neutral-800 ${index % 2 ? "bg-slate-50 dark:bg-neutral-950" : "bg-white dark:bg-neutral-900"}`}
    >
      <div className="mx-auto grid max-w-6xl gap-x-12 gap-y-6 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-2 lg:px-8">
        <div className="lg:col-start-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
            <Icon className="h-4 w-4" /> {feature.label}
          </div>
          <h2 className="!mt-2 !text-2xl md:!text-3xl font-semibold tracking-tight text-slate-900 dark:text-white !font-sans">{feature.title}</h2>
          <p className="sans !text-left !hyphens-none !mb-0 mt-2 text-slate-600 dark:text-neutral-300">{feature.blurb}</p>
        </div>

        {/* The drawing: under the title on phones, beside the steps (and staying put) on wide screens */}
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="rounded-3xl bg-gradient-to-br from-sky-100 to-sky-50 px-4 py-6 dark:from-sky-950/60 dark:to-neutral-900 sm:px-8 lg:sticky lg:top-24">
            <Mock step={step} />
          </div>
        </div>

        <div className="lg:col-start-1">
          <ol className="!m-0 !p-0 list-none">
            {feature.steps.map((s, i) => (
              <li key={s.title} ref={(el) => (stepRefs.current[i] = el)} data-step={i} className="lg:flex lg:min-h-[26vh] lg:items-center">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  aria-pressed={step === i}
                  className={`flex w-full gap-4 rounded-2xl !bg-transparent p-3 text-left transition ${
                    step === i ? "opacity-100" : "opacity-60 hover:opacity-90"
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold transition ${
                      step === i ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-900 dark:text-white">{s.title}</span>
                    <span className="mt-1 block text-sm text-slate-600 dark:text-neutral-300">{s.text}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <a
            href={locked ? "/users/sign_up" : feature.href}
            className="ml-3 mt-4 inline-flex items-center gap-1.5 text-sm font-semibold !text-sky-700 !no-underline hover:!text-sky-900 dark:!text-sky-300 dark:hover:!text-sky-100"
          >
            {locked ? "Create a free account to start" : feature.cta}
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

// "How it works": a row of chips to jump to each feature, then a section for each
export default function FeatureTour({ signedIn }) {
  const features = visibleFeatures(signedIn);
  return (
    <div id="how-it-works">
      <div className="bg-white dark:bg-neutral-900">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-12 sm:px-6 md:pt-16 lg:px-8">
          <h2 className="!text-2xl md:!text-3xl font-semibold tracking-tight text-slate-900 dark:text-white !font-sans">How it works</h2>
          <p className="sans !text-left !hyphens-none mt-2 max-w-2xl text-slate-600 dark:text-neutral-300">
            A quick walk through each part of RecoveryBot, step by step. Pick one to jump to it.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {features.map(({ key, label, icon: Icon }) => (
              <a
                key={key}
                href={`#tour-${key}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium !text-slate-700 !no-underline transition hover:border-sky-300 hover:!text-sky-800 dark:border-neutral-700 dark:bg-neutral-800 dark:!text-neutral-200 dark:hover:border-sky-700 dark:hover:!text-white"
              >
                <Icon className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
      {features.map((f, i) => (
        <Explainer key={f.key} feature={f} signedIn={signedIn} index={i} />
      ))}
    </div>
  );
}
