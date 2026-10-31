import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Check,
  HandHeart,
  Highlighter,
  House,
  Medal,
  MessagesSquare,
  MonitorPlay,
  MoonStar,
  RefreshCw,
  UserPlus,
  Users,
} from "lucide-react";
import { NAV_CATEGORIES } from "./nav/siteMenu";
import GroupNudge from "./GroupNudge";
import FeatureTour from "./home/FeatureTour";

const MIN_SKELETON_MS = 350;
const FADE_MS = 180;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function HomePreview() {
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);

  // controls crossfade of the topic content
  const [showTopic, setShowTopic] = useState(false);

  // prevent out-of-order responses if user clicks refresh quickly
  const reqIdRef = useRef(0);

  const fetchRandomTopic = useCallback(async () => {
    const myReqId = ++reqIdRef.current;

    const startedAt = Date.now();

    // fade current content out first (if any)
    setShowTopic(false);
    setLoading(true);

    try {
      const res = await axios.get(`${window.location.origin}/api/topics/random`);

      // ensure skeleton stays up for at least MIN_SKELETON_MS
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_SKELETON_MS - elapsed);
      if (remaining) await sleep(remaining);

      // ignore stale responses
      if (reqIdRef.current !== myReqId) return;

      setTopic(res.data);
    } catch (e) {
      console.error("Failed to load topic preview", e);

      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_SKELETON_MS - elapsed);
      if (remaining) await sleep(remaining);

      if (reqIdRef.current !== myReqId) return;

      setTopic(null);
    } finally {
      // ignore stale responses
      if (reqIdRef.current !== myReqId) return;

      setLoading(false);

      // small delay so the skeleton has a beat, then fade content in
      requestAnimationFrame(() => {
        setTimeout(() => setShowTopic(true), 60);
      });
    }
  }, []);

  useEffect(() => {
    fetchRandomTopic();
  }, [fetchRandomTopic]);

  return (
    <div className="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-slate-100 to-white p-6 shadow-sm dark:from-neutral-600 dark:to-neutral-700">
      <div className="relative rounded-2xl border dark:border-neutral-800 bg-gradient-to-r from-amber-600 to-amber-800 p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-50 uppercase">
            Topicificator 9002
          </div>
          <div className="text-xs text-slate-50">Live Preview</div>
        </div>

        <div className="mt-10 min-h-[120px]">
          {loading && (
            <div className="space-y-3">
              <div className="h-8 lg:h-12 w-1/2 rounded bg-slate-100 animate-pulse mx-auto" />
              <div className="h-6 w-3/4 rounded bg-slate-100 animate-pulse mx-auto" />
            </div>
          )}

          {!loading && topic && (
            <>
              <div className="text-2xl lg:text-4xl font-bold text-slate-50 text-center tracking-wide ttSans">
                {topic.title}
              </div>
              {topic.subtitle && (
                <div className="mt-2 text-sm font-semibold text-slate-50 text-center">
                  {topic.subtitle}
                </div>
              )}
            </>
          )}

          {!loading && !topic && (
            <div className="text-2xl font-bold text-slate-50 text-center tracking-wide ttSans">
              Unable to load topic preview.
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <a
            href="/topicificator"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Open Full Topicificator
          </a>

          {/* Bottom-right refresh icon */}
          <button
            type="button"
            onClick={fetchRandomTopic}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 p-2 text-slate-50 hover:bg-white/20 disabled:opacity-50"
            title="New random topic"
            aria-label="New random topic"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Home-only groups for the tool list below, beside the site menu's (the footer keeps to those)
const MORE_CATEGORIES = [
  {
    key: "groups",
    label: "Groups",
    blurb: "Your home group",
    items: [
      { label: "Find your group", href: "/groups/find", icon: Users, note: "Group pages with meetings, events and chat", groups: true },
      { label: "Home feed", href: "/people", icon: House, note: "Notes from the people you follow", auth: true, groups: true },
      { label: "Hosting", href: "/people/me/hosting", icon: MonitorPlay, note: "Your shifts, subs and HostDeck", auth: true, groups: true },
    ],
  },
  {
    key: "recovery",
    label: "Recovery",
    blurb: "Private to you",
    items: [
      { label: "Chips", href: "/recovery", icon: Medal, note: "Your day count and every chip you've earned", auth: true },
      { label: "10th step", href: "/recovery/inventory", icon: MoonStar, note: "The nightly review, with a reminder", auth: true },
      { label: "Gratitude", href: "/recovery/gratitude", icon: HandHeart, note: "A short list each day", auth: true },
    ],
  },
];

// Why make an account (shown to people who aren't signed in)
const MEMBER_PERKS = [
  { icon: Medal, text: "Keep your day count and collect your chips" },
  { icon: MoonStar, text: "A private 10th step and gratitude list, with reminders" },
  { icon: Highlighter, text: "Highlights and notes in every book" },
  { icon: MessagesSquare, text: "Chat with your home group and @ mention people" },
  { icon: CalendarDays, text: "See your service for the week in Today" },
];

const FAQ = [
  { q: "Is it free?", a: "Yes. Everything here is free to use. Donations help pay for the server." },
  {
    q: "Do I need an account?",
    a: "No. Finding a meeting, group pages, topics, service readings and the whole library are open to everyone. An account adds chips, your 10th step, highlights and notes, and your group's chat.",
  },
  {
    q: "Who sees what I write?",
    a: "Your 10th step, gratitude list and highlights are yours alone. A note or highlight only goes on a timeline when you share it and pick who sees it.",
  },
  {
    q: "How do I get an account?",
    a: "Sign up with your email. An admin approves new accounts before your first log in, which keeps the site for our fellowship.",
  },
  {
    q: "Can I use it on my phone during a meeting?",
    a: "That's the point: big text, dark mode, and pages that read well on a phone, a laptop or a Zoom screen share. You can add it to your home screen too.",
  },
];

function SignUpButton({ className = "" }) {
  return (
    <a
      href="/users/sign_up"
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold !text-sky-800 shadow-sm hover:bg-sky-50 ${className}`}
    >
      <UserPlus className="h-4 w-4" />
      Create a free account
    </a>
  );
}

export default function HomePage() {
  const signedIn = document.body.dataset.currentUser === "true";
  const groups = signedIn && document.body.dataset.groups === "true";
  // Members-only tools show to everyone here, marked; Groups ones only to who sees Groups (or
  // anyone signed out, since group pages are public)
  const categories = [...NAV_CATEGORIES, ...MORE_CATEGORIES]
    .map((c) => ({ ...c, items: c.items.filter((item) => (!item.groups || !signedIn || groups)) }))
    .filter((c) => c.items.length);

  return (
    <div className="min-h-screen w-full bg-white dark:bg-neutral-900 text-slate-900 !font-sans">
      {/* Hero */}
      <div className="w-full bg-gradient-to-r from-sky-600 to-sky-800">
        <section className="mx-auto max-w-6xl px-4 py-14 md:py-20 text-white sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <p className="sans !text-left !hyphens-none mb-3 inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/30">
                New: group chat, chips and HostDeck
              </p>
              <h1 className="!text-4xl md:!text-5xl font-semibold tracking-tight !leading-tight !font-sans !text-white">
                Meeting in a box? Meet Meeting in your Pocket.
              </h1>
              <p className="sans !text-left !hyphens-none mt-4 text-lg text-sky-100">
                Find a meeting, host it from one screen, and stay close to your home group between meetings. Read and
                highlight the Big Book, keep your day count, and earn a chip for every milestone.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                {signedIn ? (
                  <a
                    href={groups ? "/people" : "/library"}
                    className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold !text-sky-800 hover:bg-sky-50"
                  >
                    {groups ? "Open your home feed" : "Open the library"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                ) : (
                  <SignUpButton />
                )}
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium !text-white hover:bg-slate-800"
                >
                  See how it works
                  <ArrowDown className="ml-2 h-4 w-4" />
                </a>
              </div>
              {!signedIn && (
                <p className="sans !text-left !hyphens-none mt-4 text-sm text-sky-100">
                  Free, and no account needed to look around.{" "}
                  <a href="/users/sign_in" className="font-semibold !text-white underline underline-offset-2">
                    Already a member? Log in
                  </a>
                </p>
              )}
            </div>

            <HomePreview />
          </div>
        </section>
      </div>

      <GroupNudge />

      <FeatureTour signedIn={signedIn} />

      {/* Every tool, by category: the site menu's groups (the same as the footer) plus Groups and
          Recovery, as cards flowing down two or three columns */}
      <section id="features" className="border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
            <h2 className="!text-2xl md:!text-3xl font-semibold tracking-tight text-slate-900 dark:text-white !font-sans">
              Every tool in one place
            </h2>
            <p className="sans !text-left !hyphens-none !mb-0 text-sm text-slate-500 dark:text-neutral-400">Pick what you need. Each one stands alone.</p>
          </div>
          <div className="mt-6 gap-4 md:columns-2 lg:columns-3">
            {categories.map((category) => (
              <div
                key={category.key}
                className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="flex items-baseline justify-between gap-2 border-b border-neutral-200 bg-sky-50/70 px-4 py-2.5 dark:border-neutral-800 dark:bg-sky-950/30">
                  <h3 className="!text-sm font-semibold text-sky-900 dark:text-sky-200 !font-sans">{category.label}</h3>
                  <span className="text-xs text-slate-500 dark:text-neutral-400">{category.blurb}</span>
                </div>
                <ul className="divide-y divide-neutral-100 dark:divide-neutral-800 !m-0 !p-0 list-none">
                  {category.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <a
                          href={item.href}
                          className="group flex items-center gap-3 px-4 py-2.5 !no-underline transition hover:bg-slate-50 dark:hover:bg-neutral-800/60"
                        >
                          <Icon className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                              {item.label}
                              {item.auth && (
                                <span className="rounded-full bg-sky-100 px-1.5 py-px text-[10px] font-semibold text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">
                                  Members
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-slate-500 dark:text-neutral-400">{item.note}</span>
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-sky-600 dark:text-neutral-600" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sign up pitch */}
      {!signedIn && (
        <section className="bg-gradient-to-r from-sky-700 to-sky-900 text-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-2 md:items-center lg:px-8">
            <div>
              <h2 className="!text-2xl md:!text-3xl font-semibold tracking-tight !text-white !font-sans">
                Make it yours with a free account
              </h2>
              <p className="sans !text-left !hyphens-none mt-2 text-sky-100">
                Reading is open to everyone. Members get a little more out of the library and the meetings.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <SignUpButton />
                <a href="/users/sign_in" className="text-sm font-medium !text-white underline underline-offset-2">
                  I already have an account
                </a>
              </div>
            </div>
            <ul className="grid gap-3">
              {MEMBER_PERKS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
                  <Icon className="h-5 w-5 shrink-0 text-sky-200" />
                  <span>{text}</span>
                  <Check className="ml-auto h-4 w-4 text-emerald-300" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section id="faq" className="bg-white dark:bg-neutral-900">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="!text-2xl md:!text-3xl font-semibold tracking-tight text-slate-900 dark:text-white !font-sans">
            Questions
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {FAQ.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl border border-neutral-200 bg-slate-50 p-6 dark:border-neutral-700 dark:bg-neutral-800"
              >
                <div className="font-medium text-slate-900 dark:text-neutral-100">{item.q}</div>
                <div className="mt-2 text-slate-600 dark:text-neutral-300">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
