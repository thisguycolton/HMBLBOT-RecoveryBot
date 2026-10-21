import React, { useState } from "react";
import { CircleCheck, HandHeart, Repeat } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { inputClass, labelClass } from "../ui/styles";
import HumanCheckFields from "./HumanCheckFields";

const dollars = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

// A group's 7th Tradition page (/g/CODE, ContributionsController): pick an amount, then Stripe
// Checkout on the group's own account. Shared by the hosts in the meeting, never listed publicly.
export default function GivePage({ action, authenticity_token, group, presets = [], min_cents, max_cents, fee, thanks, errors = [], values = {}, human_check }) {
  const [amount, setAmount] = useState(values.amount || "");
  const [coverFee, setCoverFee] = useState(!!values.cover_fee);
  const [monthly, setMonthly] = useState(!!values.monthly);
  const [submitting, setSubmitting] = useState(false);
  const cents = Math.round(parseFloat(String(amount).replace(/[$,]/g, "")) * 100) || 0;
  const withFee = Math.ceil((cents + fee.fixed) / (1 - fee.percent));

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 px-4 py-10 !font-sans dark:bg-neutral-950 sm:py-16 [&_*]:!font-sans">
      <div className="mx-auto w-full max-w-md">
        <Shell>
          <ShellBand icon={HandHeart} title="7th Tradition" subtitle={group.title} />
          <ShellPanel position="bottom" className="p-5">
            {thanks ? (
              <div className="space-y-3 py-4 text-center">
                <CircleCheck className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                <h1 className="!text-lg font-semibold text-slate-900 dark:text-white">Thank you</h1>
                <p className="text-sm text-slate-600 dark:text-neutral-400">Your contribution went to {group.title}. Stripe emails your receipt.</p>
              </div>
            ) : (
              <form action={action} method="post" acceptCharset="UTF-8" className="space-y-5" onSubmit={() => setSubmitting(true)}>
                <input type="hidden" name="authenticity_token" value={authenticity_token} />
                <p className="text-sm text-slate-600 dark:text-neutral-400">
                  {group.note || `For the members of ${group.title}. A.A. groups are fully self-supporting through their own members' contributions.`}
                </p>
                {errors.length > 0 && (
                  <ul role="alert" className="space-y-1 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
                    {errors.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                )}
                <div>
                  <span className={labelClass}>Amount</span>
                  <div className="mb-2 grid grid-cols-4 gap-2">
                    {presets.map((p) => (
                      <button key={p} type="button" onClick={() => setAmount((p / 100).toString())}
                        className={`rounded-xl px-2 py-2.5 text-sm font-semibold ring-1 ${cents === p ? "!bg-accent !text-white ring-accent" : "!bg-white text-slate-800 ring-slate-200 hover:!bg-slate-50 dark:!bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700"}`}>
                        {dollars(p)}
                      </button>
                    ))}
                  </div>
                  <label htmlFor="give_amount" className="sr-only">Other amount</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input id="give_amount" name="amount" inputMode="decimal" className={`${inputClass} !pl-7`} placeholder="Other amount"
                      value={amount} onChange={(e) => setAmount(e.target.value)} required />
                  </div>
                </div>
                <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-neutral-300">
                  <input type="checkbox" name="monthly" value="1" checked={monthly} onChange={(e) => setMonthly(e.target.checked)} className="mt-0.5 size-4" />
                  <span><Repeat className="mr-1 inline size-4 opacity-60" />Give this every month <span className="block text-xs text-slate-500">You can stop any time from the link in Stripe's receipt.</span></span>
                </label>
                <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-neutral-300">
                  <input type="checkbox" name="cover_fee" value="1" checked={coverFee} onChange={(e) => setCoverFee(e.target.checked)} className="mt-0.5 size-4" />
                  <span>Cover the card fee{cents > 0 && <> ({dollars(withFee)} in all)</>}
                    <span className="block text-xs text-slate-500">So the group gets the whole {cents > 0 ? dollars(cents) : "amount"}.</span></span>
                </label>
                <HumanCheckFields check={human_check} />
                <button type="submit" disabled={submitting || cents < min_cents || cents > max_cents}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl !bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-panel hover:opacity-90 disabled:opacity-60">
                  {submitting ? "Opening Stripe…" : `Contribute${cents > 0 ? ` ${dollars(coverFee ? withFee : cents)}` : ""}${monthly ? " a month" : ""}`}
                </button>
                <p className="text-center text-xs text-slate-500 dark:text-neutral-400">
                  Paid securely through Stripe, straight to {group.title}. RecoveryBot takes no cut and doesn't see your card.
                  The group sees totals, not names.
                </p>
              </form>
            )}
          </ShellPanel>
        </Shell>
      </div>
    </div>
  );
}
