import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BellDot, Check, CheckCircle2, ChevronRight, ClipboardList, Feather, Flower2, Hand, HandHeart, Handshake, HeartHandshake, Lock,
  MessageSquareText, MessagesSquare, MoonStar, NotebookPen, Plus, Signpost, Sparkles, Sprout, Sunrise, Users,
  PencilRuler,
} from "lucide-react";
import { api } from "../../groups/lib";
import { Card, ErrorNote, Loading, Pill, Tray, primaryButton, quietButton } from "../../groups/ui";
import { FlatChip } from "../ChipModal";
import { localDate } from "../lib";
import { stepLabel } from "./StepWorkPage";

const when = (iso) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

const ICONS = { sponsorship: Users, note: MessageSquareText, work: NotebookPen, next: Sparkles, inventory: MoonStar, gratitude: HandHeart, chip: Sparkles };
const SHOWN = 5;

// What needs them: today's 10th step and gratitude list, chips to claim (from /api/recovery),
// then step work and sponsorship (StepAttention on the server)
function Attention({ items }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, SHOWN);
  return (
    <Tray label={<span className="inline-flex items-center gap-1"><BellDot className="size-3.5" /> Needs your attention</span>}>
      {items.length === 0 ? (
        <Card className="p-4 text-slate-600 dark:text-neutral-300">Nothing waiting on you right now.</Card>
      ) : (
        <div className="space-y-1.5">
          {shown.map((item) => {
            const Icon = ICONS[item.kind] || BellDot;
            return (
              <Card key={item.key}>
                <Link to={item.url} className="flex items-center gap-3 p-3 !text-inherit hover:opacity-80">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent dark:bg-accent/25 dark:text-white"><Icon className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900 dark:text-white">{item.title}</div>
                    {item.body && <div className="line-clamp-2 text-sm text-slate-500 dark:text-neutral-400">{item.body}</div>}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-slate-400" />
                </Link>
              </Card>
            );
          })}
          {items.length > SHOWN && (
            <button type="button" className={quietButton} onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${items.length}`}</button>
          )}
        </div>
      )}
    </Tray>
  );
}

// Their newest chips and the next one coming, linking to the Chips page
function ChipsRow({ recovery }) {
  if (!recovery) return null;
  const { chips, upcoming, design, sobriety_date } = recovery;
  const recent = chips.filter((c) => c.top).sort((a, b) => (a.on < b.on ? 1 : -1)).slice(0, 4);
  const next = upcoming.filter((c) => c.kind === "round")[0] || upcoming[0];
  const label = (c) => <div className="mt-1 line-clamp-2 text-center text-xs text-slate-600 dark:text-neutral-300">{c.label}</div>;
  return (
    <Tray label="Your chips" action={<Link to="/" className="text-sm">All chips</Link>}>
      <Card className="p-4">
        {recent.length === 0 && !next ? (
          <p className="text-slate-600 dark:text-neutral-300">
            {sobriety_date ? "Your chips show up here as you earn them." : <>Add your sobriety date on <Link to="/">Chips</Link> to start earning chips.</>}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {recent.map((c) => <Link key={c.id} to="/" className="flex flex-col items-center !text-inherit hover:opacity-80"><FlatChip chip={c} design={design} size={72} />{label(c)}</Link>)}
            {next && (
              <Link to="/" className="flex flex-col items-center !text-inherit hover:opacity-80">
                <FlatChip chip={next} design={design} size={72} faded />
                {label(next)}
                <div className="text-center text-xs font-medium text-accent">
                  {next.kind === "round" ? (next.to_go === 1 ? "Tomorrow" : `In ${next.to_go.toLocaleString()} days`) : `${next.to_go.toLocaleString()} to go`}
                </div>
              </Link>
            )}
          </div>
        )}
      </Card>
    </Tray>
  );
}

const STEP_ICONS = { 1: Hand, 2: Sunrise, 3: Signpost, 4: ClipboardList, 5: MessagesSquare, 6: Sprout, 7: Feather, 8: Users, 9: Handshake, 10: MoonStar, 11: Flower2, 12: HeartHandshake };

// The green check, the same as for sponsors: this step is done
function DoneCheck({ label }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 py-0.5 pl-0.5 pr-2 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30">
      <span className="grid size-4 place-items-center rounded-full bg-emerald-500 text-white"><Check strokeWidth={3.5} className="size-2.5" /></span>{label}
    </span>
  );
}

// One of the Twelve Steps as a tile: its icon, its words, where they are with it (a green
// check once a worksheet for it is done), and its worksheets
function StepTile({ step, text, tools, works, busy, start, build, tonight }) {
  const Icon = STEP_ICONS[step] || CheckCircle2;
  const done = works.filter((w) => w.status === "done").sort((a, b) => (a.done_at < b.done_at ? 1 : -1))[0];
  const going = works.find((w) => w.status !== "done");
  const own = tools.filter((t) => t.step === step);
  const main = own.find((t) => t.default) || own[0];
  const others = own.filter((t) => t !== main);
  const elsewhere = tools.filter((t) => t.step !== step);
  const finished = step === 10 ? tonight : !!done;
  return (
    <Card id={`step-${step}`} className={`flex h-full scroll-mt-24 flex-col gap-3 p-5 ${finished ? "ring-emerald-300/70 dark:ring-emerald-500/40" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <span className={`relative grid size-14 shrink-0 place-items-center rounded-2xl ${finished ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-accent/10 text-accent dark:bg-accent/25 dark:text-white"}`}>
          <Icon className="size-8" strokeWidth={1.75} />
          {finished && <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-white dark:ring-neutral-900"><Check strokeWidth={3.5} className="size-3.5" /></span>}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Step {step}</span>
      </div>
      <p className="text-[15px] leading-snug text-slate-800 dark:text-neutral-100">{text}</p>
      <div className="flex flex-wrap gap-1.5">
        {step === 10 ? (tonight ? <DoneCheck label="Done tonight" /> : null)
          : done ? <DoneCheck label={`Done ${when(done.done_at)}`} /> : null}
        {going && <Link to={`/steps/${going.id}`}><Pill tone="accent">Working on {going.name}</Pill></Link>}
      </div>
      <div className="mt-auto space-y-2">
        <div className="flex flex-wrap justify-end gap-2">
          {step === 10 && <Link to="/inventory" className={primaryButton}>Tonight's review</Link>}
          {going && <Link to={`/steps/${going.id}`} className={primaryButton}>Continue</Link>}
          {!going && main && (
            <button type="button" className={done ? quietButton : primaryButton} disabled={busy === main.key} onClick={() => start(main.key)} title={main.summary}>
              <Plus className="size-4" /> {done ? "Do it again" : `Start ${own.length > 1 ? main.name : ""}`.trim()}
            </button>
          )}
        </div>
        {(others.length > 0 || (going && main)) && (
          <details className="group rounded-xl bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-800/60">
            <summary className="cursor-pointer text-slate-600 dark:text-neutral-300">{others.length + (going && main ? 1 : 0)} more {others.length + (going && main ? 1 : 0) === 1 ? "worksheet" : "worksheets"}</summary>
            <div className="mt-2 space-y-2">
              {[...(going && main ? [main] : []), ...others].map((t) => (
                <div key={t.key} className="flex items-center justify-between gap-2">
                  <div className="min-w-0"><div className="font-medium text-slate-900 dark:text-white">{t.name}</div><div className="line-clamp-2 text-xs text-slate-500 dark:text-neutral-400">{t.summary}</div></div>
                  <button type="button" className={quietButton} disabled={busy === t.key} onClick={() => start(t.key)}><Plus className="size-4" /> Start</button>
                </div>
              ))}
            </div>
          </details>
        )}
        <div className="flex justify-end">
          <button type="button" className="inline-flex items-center gap-1 !bg-transparent p-0 text-xs font-medium text-accent hover:underline disabled:opacity-50" disabled={busy === `build${step}`} onClick={() => build(step)}
            title="Start a blank worksheet for this step and make it yours in the HumbleBot Editor"><PencilRuler className="size-3.5" /> Build your own</button>
        </div>
        {elsewhere.length > 0 && <p className="text-xs text-slate-500 dark:text-neutral-400">{elsewhere.map((t) => t.name).join(", ")} (Step {elsewhere[0].step}) covers this step too.</p>}
        {step === 10 && <p className="text-xs text-slate-500 dark:text-neutral-400">The Big Book's nightly questions, or your own.</p>}
        {step !== 10 && tools.length === 0 && <p className="text-xs text-slate-400">No built-in worksheet for this step yet: build your own.</p>}
      </div>
    </Card>
  );
}

// Working the steps (/recovery/steps, Api::StepWorksController): a dashboard first (what needs
// their attention, their chips), then their worksheets in progress and done, and each of the
// Twelve Steps with the worksheets there are for it (StepTool). Starting one makes it theirs to
// fill in and change.
export default function StepsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const navigate = useNavigate();
  const { hash } = useLocation();
  useEffect(() => {
    document.title = "Steps | RecoveryBot";
    api("/step_works").then(setData).catch((e) => setError(e.message));
    api(`/recovery?today=${localDate()}`).then(setRecovery).catch(() => {});
  }, []);
  // A link to a step (#step-5) scrolls to it once the steps are there
  useEffect(() => {
    if (data && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [data, hash]);

  const startFrom = async (busyKey, path, body) => {
    setBusy(busyKey);
    setError(null);
    try {
      const d = await api(path, { method: "POST", body });
      navigate(`/steps/${d.work.id}`);
    } catch (e) { setError(e.message); setBusy(null); }
  };
  const setAside = async (sg) => {
    setError(null);
    try {
      await api(`/step_suggestions/${sg.id}`, { method: "DELETE" });
      setData((d) => ({ ...d, suggestions: d.suggestions.filter((x) => x.id !== sg.id), attention: d.attention.filter((i) => i.key !== `suggest:${sg.id}`) }));
    } catch (e) { setError(e.message); }
  };
  const takeDown = async (t) => {
    if (!window.confirm(`Take ${t.name} off ${t.group.title}'s worksheets? Copies people already started stay theirs.`)) return;
    try {
      await api(`/group_step_tools/${t.id}`, { method: "DELETE" });
      setData((d) => ({ ...d, group_tools: d.group_tools.filter((x) => x.id !== t.id) }));
    } catch (e) { setError(e.message); }
  };

  const start = async (key) => {
    setBusy(key);
    try {
      const d = await api("/step_works", { method: "POST", body: { tool_key: key } });
      navigate(`/steps/${d.work.id}`);
    } catch (e) { setError(e.message); setBusy(null); }
  };

  // A blank worksheet of their own for a step, straight into the editor
  const build = async (step) => {
    setBusy(`build${step}`);
    try {
      const d = await api("/step_works", { method: "POST", body: { step, blank: true } });
      navigate(`/steps/${d.work.id}/edit`);
    } catch (e) { setError(e.message); setBusy(null); }
  };

  if (!data) return error ? <ErrorNote error={error} /> : <Loading />;
  const going = data.works.filter((w) => w.status !== "done");
  const done = data.works.filter((w) => w.status === "done");
  const toolsFor = (n) => data.tools.filter((t) => t.steps.includes(n));
  // Their worksheets for a step, counting one that covers several (Drop the Rock: 6 and 7)
  const stepsOf = (w) => data.tools.find((t) => t.key === w.tool_key)?.steps || [w.step];
  const worksFor = (n) => data.works.filter((w) => stepsOf(w).includes(n));
  const today = [
    recovery && !recovery.today.inventory && { key: "inventory", kind: "inventory", title: "Your 10th step for today", body: "A few minutes of looking back on the day.", url: "/inventory" },
    recovery && !recovery.today.gratitude && { key: "gratitude", kind: "gratitude", title: "Today's gratitude list", body: "What are you grateful for today?", url: "/gratitude" },
    ...(recovery?.available || []).map((a) => ({ key: `claim:${a.edition_id}:${a.slot}`, kind: "chip", title: `A chip to claim: ${a.label}`, body: `From ${a.group.title}'s ${a.edition.name}.`, url: "/" })),
  ].filter(Boolean);

  const WorkRow = ({ w }) => (
    <Card>
      <Link to={`/steps/${w.id}`} className="flex items-center gap-3 p-3 !text-inherit hover:opacity-80">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-accent">{stepLabel(w)}</div>
          <div className="truncate font-medium text-slate-900 dark:text-white">{w.name}</div>
          <div className="text-sm text-slate-500 dark:text-neutral-400">{w.status === "done" ? `Done ${when(w.done_at)}` : `Last worked on ${when(w.updated_at)}`}</div>
        </div>
        <ChevronRight className="size-4 text-slate-400" />
      </Link>
    </Card>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Steps</h1>
        <p className="mt-1 text-slate-600 dark:text-neutral-400">
          Worksheets for working the steps with your sponsor. Pick one to start; it's yours to fill in at your own pace and change to suit
          how you and your sponsor work.
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500 dark:text-neutral-400"><Lock className="size-4 shrink-0" /> Private and encrypted. Only you can read your work, unless you send it to your sponsor.</p>
      </header>
      <ErrorNote error={error} />

      <Attention items={[...(data.attention || []).filter((i) => i.kind === "sponsorship"), ...today, ...(data.attention || []).filter((i) => i.kind !== "sponsorship")]} />
      <ChipsRow recovery={recovery} />

      <Tray label="The Twelve Steps">
        <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {data.steps.map(({ step, text }) => (
            <StepTile key={step} step={step} text={text} tools={toolsFor(step)} works={worksFor(step)} busy={busy} start={start} build={build}
              tonight={step === 10 && recovery?.today?.inventory} />
          ))}
        </div>
      </Tray>


      {data.suggestions?.length > 0 && (
        <Tray label="From your sponsor">
          <div id="suggested" className="scroll-mt-32 space-y-1.5">
            {data.suggestions.map((sg) => (
              <Card key={sg.id} className="space-y-2 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-accent">Step {sg.step} · suggested by {sg.sponsor.name}</div>
                <div className="font-medium text-slate-900 dark:text-white">{sg.name}</div>
                {sg.note && <p className="whitespace-pre-line rounded-xl bg-neutral-50 px-3 py-2 text-sm text-slate-700 dark:bg-neutral-800 dark:text-neutral-200">{sg.note}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" className={quietButton} onClick={() => setAside(sg)}>Set aside</button>
                  <button type="button" className={primaryButton} disabled={busy === `sg${sg.id}`} onClick={() => startFrom(`sg${sg.id}`, `/step_suggestions/${sg.id}/start`)}><Plus className="size-4" /> Start it</button>
                </div>
              </Card>
            ))}
          </div>
        </Tray>
      )}

      {going.length > 0 && <Tray label="Working on"><div className="space-y-1.5">{going.map((w) => <WorkRow key={w.id} w={w} />)}</div></Tray>}

      {data.group_tools?.length > 0 && (
        <Tray label="From your groups">
          <div className="space-y-1.5">
            {data.group_tools.map((t) => (
              <Card key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-accent">Step {t.step} · {t.group.title}</div>
                  <div className="font-medium text-slate-900 dark:text-white">{t.name}</div>
                  {t.summary && <div className="text-sm text-slate-500 dark:text-neutral-400">{t.summary}</div>}
                  {t.by && <div className="text-xs text-slate-400">Shared by {t.by}</div>}
                </div>
                <div className="flex gap-2">
                  {t.can_remove && <button type="button" className={quietButton} onClick={() => takeDown(t)}>Take down</button>}
                  <button type="button" className={primaryButton} disabled={busy === `gt${t.id}`} onClick={() => startFrom(`gt${t.id}`, "/step_works", { group_tool_id: t.id })}><Plus className="size-4" /> Start</button>
                </div>
              </Card>
            ))}
          </div>
        </Tray>
      )}

      {done.length > 0 && <Tray label={<span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3.5" /> Done</span>}><div className="space-y-1.5">{done.map((w) => <WorkRow key={w.id} w={w} />)}</div></Tray>}
    </div>
  );
}
