import React from "react";
import {
  AtSign, Bell, BookOpen, CalendarDays, Check, ChevronRight, Gift, Hash, HandHeart, Heart, Highlighter, House, Medal,
  MessageCircle, MessagesSquare, MoonStar, Search, Share2, StickyNote, Users,
} from "lucide-react";
import { RoundChip, TriangleChip } from "../recovery/Chip";

// Small drawn versions of the real pages for the home page's walkthroughs (FeatureTour.jsx).
// Each takes `step` (from 0) and points at what that step is about. The people, meetings and
// words in them are made up.

// The look of members' earned chips (ChipDesign::DEFAULT, round and triangle parts)
const CHIP_DESIGN = {
  round: {
    top_text: "To thine own self be true",
    bottom_text: "Unity · Service · Recovery",
    back_text: "",
    emblem: "triangle",
    numerals: "roman",
    edge: "plain",
    finish: "classic",
    colors: { "24h": "#c3c9d2", "30d": "#c62839", "60d": "#d9a31e", "90d": "#1d8a4b", "6m": "#2356b8", "9m": "#6c3fa8", "18m": "#0d8789", year: "#a66d37" },
  },
  triangle: { sides: ["Unity", "Service", "Recovery"], finish: "plastic", colors: { inventory: "#3451b2", gratitude: "#d9480f", meeting: "#0f766e" } },
  meeting: { shape: "triangle", emblem: "number", sides: ["Meeting", "Maker", ""], back_text: "", finish: "plastic", color: "#0f766e", milestone_at: "badge", edge: "plain" },
};
const MILESTONES = [
  { key: "24h", label: "24 hours" },
  { key: "30d", label: "30 days" },
  { key: "60d", label: "60 days" },
  { key: "90d", label: "90 days" },
];

// The phone-sized screen every walkthrough draws in, with the page's name across the top
export function Screen({ title, icon: Icon, children }) {
  return (
    <div className="mx-auto flex h-[380px] w-full max-w-[360px] flex-col overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-white text-left text-slate-900 shadow-xl ring-4 ring-white/60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:ring-neutral-800/60">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:border-neutral-800 dark:text-neutral-400">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        <span className="truncate">{title}</span>
        <span className="ml-auto flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
        </span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden p-3 text-sm">{children}</div>
    </div>
  );
}

// What a step points at: ringed, with a pulsing dot where you'd tap
function Spot({ on, tap = false, className = "", children }) {
  return (
    <div
      className={`relative rounded-xl transition duration-300 ${
        on ? "ring-2 ring-sky-500 ring-offset-2 ring-offset-white dark:ring-sky-400 dark:ring-offset-neutral-900" : ""
      } ${className}`}
    >
      {children}
      {on && tap && (
        <span className="pointer-events-none absolute -right-1 -top-1 flex h-3.5 w-3.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-sky-500" />
        </span>
      )}
    </div>
  );
}

// Fades in what only shows on some steps
function Show({ when, className = "", children }) {
  return (
    // opacity as a style: the site's built CSS has a broken .opacity-0
    <div
      className={`transition-all duration-300 ${when ? "translate-y-0" : "pointer-events-none translate-y-1"} ${className}`}
      style={{ opacity: when ? 1 : 0 }}
      aria-hidden={!when}
    >
      {children}
    </div>
  );
}

const chip = "rounded-full px-2 py-0.5 text-[11px] font-semibold";
const card = "rounded-xl border border-neutral-200 bg-white p-2.5 dark:border-neutral-700 dark:bg-neutral-800";
const muted = "text-xs text-slate-500 dark:text-neutral-400";
const Avatar = ({ name, color = "bg-sky-600" }) => (
  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${color}`}>{name[0]}</span>
);

// ---------------- Find a meeting ----------------
export function FindMock({ step }) {
  const rows = [
    { name: "Acid Test", time: "7:00 AM", where: "Online", badge: "Live now", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200" },
    { name: "Big Book Study", time: "12:00 PM", where: "Online", badge: "In 25 min", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200" },
    { name: "Sunset Serenity", time: "6:30 PM", where: "Mesa, AZ", badge: "Tonight", tone: "bg-slate-100 text-slate-700 dark:bg-neutral-700 dark:text-neutral-200" },
  ];
  return (
    <Screen title="Find a meeting" icon={Search}>
      <Spot on={step === 0} tap className="space-y-2 p-0.5">
        <div className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-700">
          <Search className="h-4 w-4 text-slate-400" />
          <span className={step === 0 ? "text-slate-900 dark:text-white" : "text-slate-400"}>Big Book</span>
        </div>
        <div className="flex gap-1.5">
          {["Today", "Live now", "Online"].map((f, i) => (
            <span key={f} className={`${chip} ${i !== 1 ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"}`}>{f}</span>
          ))}
        </div>
      </Spot>
      <div className="mt-3 space-y-2">
        {rows.map((r, i) => (
          <Spot key={r.name} on={(step === 1 && i === 1)} className={card}>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{r.name}</div>
                <div className={muted}>{r.time} · {r.where}</div>
              </div>
              <span className={`${chip} ${r.tone}`}>{r.badge}</span>
              {i < 2 && (
                <Spot on={step === 2 && i === 1} tap>
                  <span className="block rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white">Join</span>
                </Spot>
              )}
            </div>
          </Spot>
        ))}
      </div>
      <Show when={step === 2} className="absolute inset-x-3 bottom-3">
        <div className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-white dark:text-slate-900">
          <TriangleChip design={CHIP_DESIGN} kind="meeting" count={5} size={28} />
          Joined early. It counts toward your Meeting Maker chip.
        </div>
      </Show>
    </Screen>
  );
}

// ---------------- HostDeck ----------------
export function HostMock({ step }) {
  const sections = ["Before we begin", "Readings", "Topic", "Milestones", "Closing"];
  const current = [0, 1, 3][step];
  return (
    <Screen title="HostDeck · Acid Test 7:00 AM" icon={BookOpen}>
      <div className="flex h-full gap-2">
        <Spot on={step === 1} className="w-[38%] shrink-0 space-y-1 p-0.5">
          {sections.map((s, i) => (
            <div
              key={s}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium ${
                i === current ? "bg-sky-600 text-white" : i < current ? "text-slate-400 line-through dark:text-neutral-500" : "text-slate-600 dark:text-neutral-300"
              }`}
            >
              {i < current ? <Check className="h-3 w-3" /> : <span className="w-3 text-center">{i + 1}</span>}
              <span className="truncate">{s}</span>
            </div>
          ))}
          <div className="mt-2 rounded-lg bg-slate-100 px-2 py-1 text-center font-mono text-[11px] text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">0:{["02", "14", "41"][step]}:08</div>
        </Spot>
        <div className="flex min-w-0 flex-1 flex-col">
          {step === 0 && (
            <Spot on className={`${card} flex-1 space-y-2`}>
              <div className="text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">Before we begin</div>
              <div className="text-xs leading-relaxed">Welcome to the Acid Test. My name is Sam, and I'm an alcoholic. Let's open with a moment of silence…</div>
              <div className="space-y-1.5 pt-1">
                <div className="h-1.5 w-full rounded bg-slate-200 dark:bg-neutral-700" />
                <div className="h-1.5 w-5/6 rounded bg-slate-200 dark:bg-neutral-700" />
                <div className="h-1.5 w-2/3 rounded bg-slate-200 dark:bg-neutral-700" />
              </div>
            </Spot>
          )}
          {step === 1 && (
            <div className="flex-1 space-y-2">
              <div className={card}>
                <div className="text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">Readings</div>
                <div className="mt-1 text-xs">How It Works · <span className="text-slate-500 dark:text-neutral-400">read by Jo</span></div>
                <div className="text-xs">The Twelve Traditions · <span className="text-slate-500 dark:text-neutral-400">read by Alex</span></div>
              </div>
              <div className="rounded-xl bg-gradient-to-r from-amber-600 to-amber-800 p-3 text-center text-white">
                <div className="text-[10px] uppercase tracking-wide opacity-80">Tonight's topic</div>
                <div className="text-lg font-bold">Acceptance</div>
              </div>
            </div>
          )}
          {step === 2 && (
            <Spot on className={`${card} flex-1 space-y-1.5`}>
              <div className="text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">Milestones</div>
              {[["Jo", "90 days", true], ["Riley", "1 year", true], ["Pat", "30 days", false]].map(([n, m, done]) => (
                <div key={n} className="flex items-center gap-2 text-xs">
                  <span className={`grid h-4 w-4 place-items-center rounded ${done ? "bg-emerald-500 text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>{done && <Check className="h-3 w-3" />}</span>
                  <span className="font-medium">{n}</span>
                  <span className="text-slate-500 dark:text-neutral-400">{m}</span>
                </div>
              ))}
              <div className="pt-1 text-center text-base">🎉</div>
            </Spot>
          )}
          <Spot on={step === 1} tap className="mt-2 self-end">
            <span className="flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white">Next <ChevronRight className="h-3.5 w-3.5" /></span>
          </Spot>
        </div>
      </div>
    </Screen>
  );
}

// ---------------- Today ----------------
export function TodayMock({ step }) {
  return (
    <Screen title="Today" icon={CalendarDays}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-bold">Good morning, Sam</div>
            <div className={muted}>Thursday, October 30</div>
          </div>
          <span className={`${chip} bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200`}>214 days</span>
        </div>
        <Spot on={step === 1} className="mt-3 space-y-1.5 p-0.5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Needs your attention</div>
          <div className={`${card} flex items-center gap-2 border-l-4 !border-l-amber-500`}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">You're hosting Acid Test</div>
              <div className={muted}>Tomorrow, 7:00 AM</div>
            </div>
          </div>
          <div className={`${card} flex items-center gap-2`}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">Sub needed: Big Book Study</div>
              <div className={muted}>Saturday, 12:00 PM</div>
            </div>
            <span className="rounded-lg bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white">Take it</span>
          </div>
        </Spot>
        <Spot on={step === 2} className="mt-3 space-y-1.5 p-0.5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Filling in</div>
          <div className={`${card} flex items-center gap-2`}>
            <Avatar name="Jo" color="bg-violet-600" />
            <div className="text-xs">Jo is filling in as co-host for the 9 AM Acid Test.</div>
          </div>
        </Spot>
        <div className="mt-auto flex items-center justify-around border-t border-neutral-200 pt-2 text-slate-400 dark:border-neutral-800">
          <House className="h-5 w-5" />
          <Search className="h-5 w-5" />
          <Spot on={step === 0} tap className="p-1"><CalendarDays className="h-5 w-5 text-sky-600 dark:text-sky-300" /></Spot>
          <Bell className="h-5 w-5" />
        </div>
      </div>
    </Screen>
  );
}

// ---------------- Group chat ----------------
export function ChatMock({ step }) {
  return (
    <Screen title="Acid Test · Chat" icon={MessagesSquare}>
      <div className="flex h-full flex-col">
        <Spot on={step === 0} tap className="flex gap-1.5 p-0.5">
          {["general", "hosts", "coffee"].map((c, i) => (
            <span key={c} className={`${chip} inline-flex items-center gap-0.5 ${i === 0 ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"}`}>
              <Hash className="h-3 w-3" />{c}
            </span>
          ))}
        </Spot>
        <div className="mt-3 space-y-2.5">
          <div className="flex gap-2">
            <Avatar name="Jo" color="bg-violet-600" />
            <div><div className="text-xs font-semibold">Jo</div><div className="text-xs">Who's making coffee Saturday?</div></div>
          </div>
          <div className="flex gap-2">
            <Avatar name="Riley" color="bg-emerald-600" />
            <div>
              <div className="text-xs font-semibold">Riley</div>
              <div className="text-xs"><span className="rounded bg-sky-100 px-0.5 font-semibold text-sky-800 dark:bg-sky-900/60 dark:text-sky-200">@Sam</span> you're on the list, right?</div>
            </div>
          </div>
        </div>
        <div className="relative mt-auto">
          <Show when={step === 1} className="absolute inset-x-0 bottom-full mb-1.5">
            <div className={`${card} space-y-1 shadow-lg`}>
              {[["@hosts", "Everyone who hosts"], ["@host-coordinator", "Service position"], ["@Holly", "Holly R."]].map(([h, d], i) => (
                <div key={h} className={`flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs ${i === 0 ? "bg-sky-50 dark:bg-sky-900/40" : ""}`}>
                  <AtSign className="h-3.5 w-3.5 text-sky-600 dark:text-sky-300" /><span className="font-semibold">{h}</span><span className="truncate text-slate-500 dark:text-neutral-400">{d}</span>
                </div>
              ))}
            </div>
          </Show>
          <Spot on={step === 1} tap className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-700">
            <span className="flex-1 text-xs">{step === 1 ? <>Thanks all! <span className="font-semibold text-sky-700 dark:text-sky-300">@ho</span></> : <span className="text-slate-400">Message #general</span>}</span>
          </Spot>
        </div>
        <Show when={step === 2} className="absolute inset-x-3 top-3">
          <Spot on className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-xs text-white shadow-lg dark:bg-white dark:text-slate-900">
            <Bell className="h-4 w-4 shrink-0" />
            <span><b>Riley</b> mentioned you in #general</span>
          </Spot>
        </Show>
      </div>
    </Screen>
  );
}

// ---------------- Day count and chips ----------------
export function ChipsMock({ step }) {
  return (
    <Screen title="Chips" icon={Medal}>
      <div className="flex h-full flex-col">
        <Spot on={step === 0} className="relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-600 to-sky-800 p-3 text-center text-white">
          {step === 0 && (
            <div className="pointer-events-none absolute inset-0 text-lg" aria-hidden="true">
              <span className="absolute left-3 top-1">🎉</span><span className="absolute right-4 top-2">✨</span><span className="absolute bottom-1 left-8">🎊</span>
            </div>
          )}
          <div className="text-4xl font-bold leading-none">90</div>
          <div className="mt-1 text-xs opacity-90">days today. Congratulations, Sam!</div>
        </Spot>
        <Spot on={step === 1} className="mt-3 p-1">
          <div className="grid grid-cols-4 place-items-center gap-1">
            {MILESTONES.map((m) => (
              <div key={m.key} className={`text-center ${m.key === "90d" && step === 1 ? "hb-home-spin" : ""}`}>
                <RoundChip design={CHIP_DESIGN} milestone={m} size={58} />
              </div>
            ))}
          </div>
          <div className="mt-1 text-center text-[11px] text-slate-500 dark:text-neutral-400">Tap a chip to spin it and flip it over</div>
        </Spot>
        <Spot on={step === 2} className={`${card} mt-auto flex items-center gap-3`}>
          <TriangleChip design={CHIP_DESIGN} kind="inventory" count={30} size={46} />
          <TriangleChip design={CHIP_DESIGN} kind="meeting" count={10} size={46} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold">Streaks and Meeting Maker</div>
            <div className={muted}>30 nights of the 10th step</div>
          </div>
          <span className="flex items-center gap-1 rounded-lg bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white"><Gift className="h-3 w-3" />Give</span>
        </Spot>
      </div>
    </Screen>
  );
}

// ---------------- 10th step and gratitude ----------------
export function ReflectMock({ step }) {
  const gratitude = step === 1;
  return (
    <Screen title={gratitude ? "Gratitude" : "10th step"} icon={gratitude ? HandHeart : MoonStar}>
      <div className="flex h-full flex-col">
        {step !== 1 && (
          <Spot on={step === 0} className="space-y-1.5 p-0.5">
            {[["Was I resentful?", "No"], ["Was I afraid?", "Yes"], ["Do I owe an apology?", "No"]].map(([q, a]) => (
              <div key={q} className={`${card} flex items-center gap-2`}>
                <span className="flex-1 text-xs">{q}</span>
                {["Yes", "No"].map((o) => (
                  <span key={o} className={`${chip} ${o === a ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-neutral-700 dark:text-neutral-300"}`}>{o}</span>
                ))}
              </div>
            ))}
            <div className="rounded-xl bg-slate-50 px-2.5 py-2 text-xs italic text-slate-600 dark:bg-neutral-800/60 dark:text-neutral-300">Worried about the job interview. Called my sponsor.</div>
          </Spot>
        )}
        {gratitude && (
          <Spot on className="space-y-1.5 p-0.5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Today I'm grateful for</div>
            {["Coffee with my sponsor", "A quiet morning", "The 7 AM meeting crew"].map((g, i) => (
              <div key={g} className={`${card} flex items-center gap-2 text-xs`}>
                <span className="grid h-5 w-5 place-items-center rounded-full bg-orange-100 text-[11px] font-bold text-orange-700 dark:bg-orange-900/50 dark:text-orange-200">{i + 1}</span>{g}
              </div>
            ))}
          </Spot>
        )}
        <Spot on={step === 2} tap className={`${card} mt-auto flex items-center gap-2`}>
          <Bell className="h-4 w-4 text-sky-600 dark:text-sky-300" />
          <span className="flex-1 text-xs">Remind me every day at <b>{gratitude ? "12:00 PM" : "6:00 PM"}</b></span>
          <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${step === 2 ? "justify-end bg-sky-600" : "bg-slate-300 dark:bg-neutral-600"}`}>
            <span className="h-4 w-4 rounded-full bg-white shadow" />
          </span>
        </Spot>
        <Show when={step === 2} className="absolute inset-x-3 top-3">
          <div className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-xs text-white shadow-lg dark:bg-white dark:text-slate-900">
            <MoonStar className="h-4 w-4 shrink-0" />
            <span><b>RecoveryBot</b> · Time for tonight's 10th step</span>
          </div>
        </Show>
      </div>
    </Screen>
  );
}

// ---------------- Library, highlights and notes ----------------
export function ReadMock({ step }) {
  return (
    <Screen title="Alcoholics Anonymous · p. 58" icon={BookOpen}>
      <div className="font-serif text-[13px] leading-relaxed text-slate-700 dark:text-neutral-300">
        <div className="mb-1 text-center text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-neutral-400">How It Works</div>
        <span className="rounded bg-amber-200/90 px-0.5 text-slate-900 dark:bg-amber-400/40 dark:text-white">Rarely have we seen a person fail who has thoroughly followed our path.</span>{" "}
        Those who do not recover are people who cannot or will not completely give themselves to this simple program…
      </div>
      <Show when={step === 0} className="absolute left-1/2 top-[88px] -translate-x-1/2">
        <Spot on tap className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-2 py-1.5 shadow-lg dark:bg-white">
          {["bg-amber-300", "bg-emerald-300", "bg-sky-300", "bg-rose-300"].map((c) => <span key={c} className={`h-4 w-4 rounded-full ${c}`} />)}
          <StickyNote className="ml-1 h-4 w-4 text-white dark:text-slate-900" />
        </Spot>
      </Show>
      <Show when={step >= 1} className="absolute inset-x-3 top-[132px]">
        <Spot on={step === 1} className={`${card} shadow-md`}>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-neutral-400"><Highlighter className="h-3.5 w-3.5" />Your note</div>
          <div className="mt-1 text-xs">This is the line that got me to stay. Read it at my 90-day meeting.</div>
        </Spot>
      </Show>
      <Show when={step === 2} className="absolute inset-x-3 bottom-3">
        <Spot on tap className={`${card} space-y-1 shadow-lg`}>
          <div className="flex items-center gap-1.5 text-xs font-semibold"><Share2 className="h-3.5 w-3.5" />Share to timeline</div>
          {[["Only me", false], ["Followers", false], ["Members", true]].map(([o, picked]) => (
            <div key={o} className={`flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs ${picked ? "bg-sky-50 font-semibold dark:bg-sky-900/40" : ""}`}>
              <span className={`h-3 w-3 rounded-full border ${picked ? "border-4 border-sky-600" : "border-neutral-400"}`} />{o}
            </div>
          ))}
        </Spot>
      </Show>
    </Screen>
  );
}

// ---------------- Groups, events and the home feed ----------------
export function GroupMock({ step }) {
  return (
    <Screen title={step === 2 ? "Home feed" : "Acid Test"} icon={step === 2 ? House : Users}>
      {step < 2 ? (
        <div className="flex h-full flex-col">
          <div className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 p-3 text-white">
            <div className="text-base font-bold">Acid Test</div>
            <div className="text-xs opacity-90">Daily · 7:00 AM · Online</div>
            <Spot on={step === 0} tap className="mt-2 inline-block">
              <span className="block rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800">Ask to join</span>
            </Spot>
          </div>
          <div className="mt-2 flex gap-3 border-b border-neutral-200 pb-1.5 text-xs font-medium text-slate-500 dark:border-neutral-800 dark:text-neutral-400">
            <span className="text-slate-900 dark:text-white">Home</span><span>Meetings</span><span>Chat</span><span>Events</span>
          </div>
          <Spot on={step === 1} className="mt-2 space-y-2 p-0.5">
            <div className={`${card} flex items-center gap-2`}>
              <span className={`${chip} bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200`}>Live now</span>
              <span className="flex-1 truncate text-xs font-semibold">Acid Test</span>
              <span className="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white">Join</span>
            </div>
            <div className={`${card} flex items-center gap-2`}>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-orange-100 text-center text-[10px] font-bold leading-tight text-orange-700 dark:bg-orange-900/50 dark:text-orange-200">NOV<br />8</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">Fall picnic and speaker</div>
                <div className={muted}>Saturday · Papago Park</div>
              </div>
              <span className={`${chip} bg-sky-600 text-white`}>Going</span>
            </div>
          </Spot>
        </div>
      ) : (
        <Spot on className="space-y-2 p-0.5">
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-500 dark:bg-neutral-800 dark:text-neutral-400">Write a note…</div>
          <div className={card}>
            <div className="flex items-center gap-2">
              <Avatar name="Jo" color="bg-violet-600" />
              <div><div className="text-xs font-semibold">Jo</div><div className={muted}>Acid Test · 2h</div></div>
            </div>
            <div className="mt-2 text-xs">Thank you all for the love at my 90 days. <span className="font-semibold text-sky-700 dark:text-sky-300">@Riley</span> that coffee was perfect ☕</div>
            <div className="mt-2 flex gap-3 text-xs text-slate-500 dark:text-neutral-400">
              <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />12</span>
              <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />4</span>
            </div>
          </div>
          <div className={`${card} flex items-center gap-2`}>
            <RoundChip design={CHIP_DESIGN} milestone={MILESTONES[3]} size={36} />
            <div className="text-xs"><b>Riley</b> shared a 90 days chip</div>
          </div>
        </Spot>
      )}
    </Screen>
  );
}
