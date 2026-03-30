import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import {
  Sparkles,
  Timer,
  BookOpen,
  BadgeCheck,
  ClipboardCheck,
  ArrowRight,
  RefreshCw,
  BookHeart,
} from "lucide-react";

const features = [
  {
    title: "Topicificator",
    description:
      "Four ways to generate prompts: random topic, pick a number, previously shared, or check-in.",
    icon: <Sparkles className="h-5 w-5" />,
    href: "/topicificator",
    tag: "Popular",
  },
  {
    title: "Meeting Service Readings",
    description:
      "A handful of Service Readings formatted for easy reading during meetings.",
    icon: <BookHeart className="h-5 w-5" />,
    href: "/service_readings",
  },
  {
    title: "Recovery Library",
    description:
      "Browse readings, bookmark favorites, and share passages with your group.",
    icon: <BookOpen className="h-5 w-5" />,
    href: "/library",
  },
  {
    title: "Court Verification",
    description:
      "Generate attendance verification quickly with a clean, consistent workflow.",
    icon: <ClipboardCheck className="h-5 w-5" />,
    href: "/court-verification",
  },
  {
    title: "Group Utilities",
    description:
      "Formats, resources, and practical meeting helpers that reduce admin friction.",
    icon: <BadgeCheck className="h-5 w-5" />,
    href: "/tools",
  },
];

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
      <div className="relative rounded-2xl border dark:border-neutral-800 bg-gradient-to-r from-amber-600 to-amber-800 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-50 uppercase">
            Topicificator 9002
          </div>
          <div className="text-xs text-slate-50">Live Preview</div>
        </div>

        <div className="mt-22 min-h-[120px]">
          {loading && (
            <div className="space-y-3">
              <div className="h-8 lg:h-12 w-1/2 rounded bg-slate-100 animate-pulse mx-auto" />
              <div className="h-6 w-3/4 rounded bg-slate-100 animate-pulse mx-auto" />
            </div>
          )}

          {!loading && topic && (
            <>
              <div className="text-2xl lg:text-4xl font-bold text-slate-50 text-center mt-22 tracking-wide ttSans">
                {topic.title}
              </div>
              {topic.subtitle && (
                <div className="mt-2 text-sm text-semibold! text-slate-50 text-center">
                  {topic.subtitle}
                </div>
              )}
            </>
          )}

          {!loading && !topic && (
            <div className="text-2xl font-bold text-slate-50 text-center mt-22 tracking-wide ttSans">
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

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900 text-slate-900 lg:min-w-4xl">

      {/* Hero */}
      <div className="w-screen bg-gradient-to-r from-sky-600 to-sky-800">
      <section className=" mx-auto max-w-6xl px-4 py-16  text-white sm:px-6 lg:px-8 mt-8">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-3 inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 bg-white ttSans">
              Tools for meetings, readings, and group flow
            </p>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl ttSans">
              HumbleBot makes group tools feel effortless.
            </h1>
            <p className="mt-4 text-lg text-slate-200">
              A practical set of utilities—topics, readings, and admin
              helpers—built to reduce friction and keep the focus on the
              meeting.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="/topicificator"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
              >
                Try the Topicificator
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-xl border border-sky-200 px-5 py-3 text-sm font-medium text-slate-800 bg-sky-200 hover:bg-slate-50"
              >
                See everything it does
              </a>
            </div>
            <div className="mt-6 text-xs text-slate-200">
              No accounts required for basic tools (if you want it that way).
              Private features are be gated.
            </div>
          </div>

          {/* Visual placeholder */}
          <HomePreview />
        </div>
      </section>
      </div>

      {/* Features */}
      <section
        id="features"
        className="border-t border-neutral-200 dark:border-neutral-900 bg-slate-50/40 dark:bg-neutral-700/40"
      >
        <div className="mx-auto max-w-6xl px-4 py-16 text-neutral-950 dark:text-neutral-50 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Everything HumbleBot can do
            </h2>
            <p className="mt-2 text-neutral-600 dark:text-neutral-200">
              Pick what you need. Ignore what you don’t. Each tool stands alone.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <a
                key={f.title}
                href={f.href}
                className="group relative rounded-2xl border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-stone-600 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {f.tag ? (
                  <span className="absolute right-4 top-4 rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
                    {f.tag}
                  </span>
                ) : null}

                <div className="flex items-start gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-800 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-200">
                    {f.icon}
                  </div>
                  <div>
                    <div className="font-medium">{f.title}</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-neutral-100">
                      {f.description}
                    </div>
                    <div className="mt-3 inline-flex items-center text-sm font-medium text-slate-900 dark:text-white">
                      Learn more
                      <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <div className="w-full bg-gradient-to-r from-neutral-300 to-neutral-500 dark:from-neutral-500 dark:to-neutral-700 ">
      <section id="how" className="mx-auto max-w-6xl px-4 py-16 ">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              title: "Open a tool",
              body: "Jump straight into what you need—topics, readings, timers, or admin helpers.",
            },
            {
              title: "Use it live",
              body: "Designed to be readable and usable in real-time during meetings.",
            },
            {
              title: "Share cleanly",
              body: "Copy/share flows that look good on mobile, desktop, and Zoom screens.",
            },
          ].map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-stone-800 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="text-lg font-semibold dark:text-neutral-100">{s.title}</div>
              <div className="mt-2 text-slate-600 dark:text-neutral-300">{s.body}</div>
            </div>
          ))}
        </div>
      </section>
      </div>
      {/* FAQ */}
      <section id="faq" className=" border-slate-200 bg-gradient-to-r from-sky-600 to-sky-800  text-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            FAQ
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 text-slate-700 ">
            {[
              {
                q: "Is this free?",
                a: "You can keep core tools free and gate optional features—your call. The page supports either direction.",
              },
              {
                q: "Do I need an account?",
                a: "Not necessarily. Public tools can be open; private features can require sign-in.",
              },
              {
                q: "Can I run this on mobile during a meeting?",
                a: "That’s the point: big touch targets, readable layouts, and clean sharing.",
              },
              {
                q: "Can tools be added later?",
                a: "Yes—add another card + section. No editor system required.",
              },
            ].map((item) => (
              <div
                key={item.q}
                className="rounded-2xl border border-slate-200 p-6 bg-slate-50 dark:bg-neutral-900 dark:border-neutral-700"
              >
                <div className="font-medium dark:text-neutral-100">{item.q}</div>
                <div className="mt-2 text-slate-600 dark:text-neutral-300">{item.a}</div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-3xl border border-slate-200 bg-slate-50 dark:bg-neutral-900 dark:border-neutral-700 p-8 md:flex-row md:items-center">
            <div>
              <div className="text-lg font-semibold text-slate-600 dark:text-neutral-100">
                Ready to see the toolbox?
              </div>
              <div className="mt-1 text-slate-600 dark:text-neutral-300">
                I'll let the tools do the talking.
              </div>
            </div>
            <a
              href="/topicificator"
              className="inline-flex items-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              Open Topicificator
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-600">
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-slate-600 dark:text-neutral-300">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>© {new Date().getFullYear()} HMBLBOT</div>
            <div className="flex gap-4">
              <a href="/privacy" className="hover:text-slate-900">
                Privacy
              </a>
              <a href="/contact" className="hover:text-slate-900">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}