import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { FEATURES } from "../home/FeatureTour";
import { primaryButton, quietButton } from "../groups/ui";
import "../../styles/home.css";

// The welcome wizard's optional tour: one card per thing people do most, each with the home
// page's drawing of it (home/mockups.jsx) walking through its steps by itself. Skip ends it.
const KEYS = ["groups", "find", "chips", "read", "reflect"];
const STEP_MS = 3200;

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function Tour({ groupsOpen, leaving, onFinish }) {
  const slides = KEYS.map((k) => FEATURES.find((f) => f.key === k)).filter((f) => f && (!f.groups || groupsOpen));
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(() => !reducedMotion());
  const slide = slides[index];
  const last = index === slides.length - 1;
  const { Mock, icon: Icon } = slide;

  useEffect(() => { setStep(0); }, [index]);
  // The drawing moves through the steps on its own until a step is tapped
  useEffect(() => {
    if (!auto) return undefined;
    const timer = setInterval(() => setStep((s) => (s + 1) % slide.steps.length), STEP_MS);
    return () => clearInterval(timer);
  }, [auto, index, slide.steps.length]);

  const move = (by) => { setIndex((i) => Math.min(slides.length - 1, Math.max(0, i + by))); window.scrollTo({ top: 0 }); };

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-1.5" aria-label={`${index + 1} of ${slides.length}`}>
          {slides.map((s, i) => (
            <button key={s.key} type="button" onClick={() => setIndex(i)} aria-label={s.label} aria-current={i === index ? "step" : undefined}
              className={`h-1.5 flex-1 rounded-full p-0 transition-colors ${i <= index ? "!bg-accent" : "!bg-neutral-200 dark:!bg-neutral-800"}`} />
          ))}
        </div>
        <button type="button" onClick={() => onFinish()} disabled={leaving}
          className="!bg-transparent px-1 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white">
          Skip tour
        </button>
      </div>

      <div key={slide.key} className="grid flex-1 content-start gap-5 motion-safe:animate-[hb-tour-in_.25s_ease-out] md:grid-cols-[1fr_minmax(0,340px)] md:items-start md:gap-8">
        <div className="md:order-2">
          <div className="rounded-3xl bg-gradient-to-br from-sky-100 to-sky-50 px-3 py-4 dark:from-sky-950/60 dark:to-neutral-900 sm:px-6 md:px-3">
            <div className="mx-auto h-[300px] max-w-[300px] overflow-hidden sm:h-[380px] sm:max-w-[360px] md:h-[320px] md:max-w-[302px]">
              <div className="origin-top-left max-sm:w-[360px] max-sm:scale-[0.79] md:w-[360px] md:scale-[0.84]">
                <Mock step={step} />
              </div>
            </div>
          </div>
        </div>

        <div className="md:order-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
            <Icon className="size-4" /> {slide.label}
          </div>
          <h1 className="!mt-1.5 !text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{slide.title}</h1>
          <p className="mt-1.5 text-slate-600 dark:text-neutral-300">{slide.blurb}</p>
          <ol className="!mx-0 !mt-3 !p-0">
            {slide.steps.map((s, i) => (
              <li key={s.title} className="list-none">
                <button type="button" onClick={() => { setAuto(false); setStep(i); }} aria-pressed={step === i}
                  className={`flex w-full gap-3 rounded-xl !bg-transparent px-1 py-2 text-left transition-opacity ${step === i ? "opacity-100" : "opacity-55 hover:opacity-90"}`}>
                  <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${step === i ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300"}`}>{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">{s.title}</span>
                    {step === i && <span className="mt-0.5 block text-sm text-slate-600 dark:text-neutral-300">{s.text}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 flex items-center gap-2 border-t border-neutral-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 sm:-mx-6 sm:px-6">
        {index > 0 ? (
          <button type="button" onClick={() => move(-1)} className={`${quietButton} py-2.5`}><ArrowLeft className="size-4" /> Back</button>
        ) : <span />}
        <span className="flex-1 text-center text-xs text-slate-500 dark:text-neutral-400">{index + 1} of {slides.length}</span>
        {last ? (
          <button type="button" onClick={() => onFinish()} disabled={leaving} className={`${primaryButton} py-2.5`}>
            {leaving ? "Opening…" : <>Done <Check className="size-4" /></>}
          </button>
        ) : (
          <button type="button" onClick={() => move(1)} className={`${primaryButton} py-2.5`}>Next <ArrowRight className="size-4" /></button>
        )}
      </div>
    </div>
  );
}
