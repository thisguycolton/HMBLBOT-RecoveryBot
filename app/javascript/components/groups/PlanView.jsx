import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Copy, ExternalLink, HandHeart, Landmark, RefreshCw, Sparkles } from "lucide-react";
import { inputClass, labelClass } from "../ui/styles";
import { api } from "./lib";
import { Card, ErrorNote, Loading, Pill, copy, primaryButton, quietButton } from "./ui";

const dollars = (cents) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const day = (iso) => iso && new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

const STATES = {
  premium: ["Premium", "green"], waived: ["Premium (free for good)", "green"], trial: ["Trying premium", "accent"],
  grace: ["Renewal needed", "amber"], free: ["Free", "slate"],
};

export const PREMIUM_TOOLS = [
  "Business meetings, agendas and minutes",
  "The decisions log, with Robert's Rules",
  "Documents and document templates",
  "Elected officials and treasurer's reports",
  "The Hosting Command Center",
  "7th Tradition contributions online, with no cut taken",
];

// Plan & contributions in the group dashboard (Api::GroupBillingController): the group's premium,
// paid by an admin through Stripe, and its own Stripe account for 7th Tradition contributions.
export default function PlanView({ group, reload }) {
  const [billing, setBilling] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [params, setParams] = useSearchParams();
  const base = `/groups/${group.slug}/billing`;

  useEffect(() => {
    const back = params.get("paid") || params.get("connect");
    (back ? api(`${base}/refresh`, { method: "POST" }) : api(base)).then(setBilling).catch((e) => setError(e.message));
    if (back) { setParams({}, { replace: true }); reload?.(); }
  }, [base]); // eslint-disable-line react-hooks/exhaustive-deps

  // Checkout, the billing portal and Stripe's sign-up are Stripe's own pages
  const go = async (action) => {
    setBusy(action);
    setError(null);
    try {
      const { url } = await api(`${base}/${action}`, { method: "POST" });
      window.location.assign(url);
    } catch (e) { setError(e.message); setBusy(null); }
  };
  const save = async (patch) => {
    setError(null);
    try { setBilling(await api(base, { method: "PATCH", body: { billing: patch } })); reload?.(); } catch (e) { setError(e.message); }
  };
  const refresh = async () => {
    setBusy("refresh");
    try { setBilling(await api(`${base}/refresh`, { method: "POST" })); reload?.(); } catch (e) { setError(e.message); }
    setBusy(null);
  };

  if (!billing) return error ? <ErrorNote error={error} /> : <Loading />;
  const [stateLabel, tone] = STATES[billing.state] || STATES.free;

  return (
    <div className="max-w-3xl space-y-4">
      <ErrorNote error={error} />
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Sparkles className="size-5 text-accent" />
          <h2 className="flex-1 font-semibold text-slate-900 dark:text-white">Premium</h2>
          <Pill tone={tone}>{stateLabel}</Pill>
        </div>
        {!billing.enforced && (
          <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
            Premium isn't switched on yet, so every group has every tool for now. Nothing here changes until it is.
          </p>
        )}
        <p className="text-sm text-slate-600 dark:text-neutral-400">
          {billing.state === "premium" && <>Paid through {day(billing.premium_until)}. It renews by itself; an admin can change the card or cancel in Manage billing.</>}
          {billing.state === "waived" && <>{group.title} has premium for free. Nothing to pay.</>}
          {billing.state === "trial" && <>{group.title} has premium until {day(billing.premium_until)}. Bring it to your business meeting: it's {dollars(billing.price_cents)} a year for the whole group.</>}
          {billing.state === "grace" && <>The last renewal didn't go through. Everything keeps working until {day(billing.grace_until)}; after that, premium records stay readable but can't be changed.</>}
          {billing.state === "free" && <>{group.title} has the free tools. Anything it wrote with premium is still here to read and export. Premium is {dollars(billing.price_cents)} a year for the whole group.</>}
        </p>
        <ul className="grid gap-1.5 text-sm text-slate-700 dark:text-neutral-300 sm:grid-cols-2">
          {PREMIUM_TOOLS.map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{t}</li>)}
        </ul>
        <p className="text-xs text-slate-500 dark:text-neutral-400">
          Always free: the group page, members and roles, the meeting and host schedules, events, approved literature and court verifications.
          Can't fit it in the budget? <a href="/contact?topic=general" className="text-accent hover:underline">Tell us</a> and we'll waive it.
        </p>
        {billing.can_pay && billing.state !== "waived" && (
          <div className="flex flex-wrap gap-2">
            {!billing.subscribed && (
              <button type="button" className={primaryButton} disabled={!billing.stripe_configured || busy} onClick={() => go("checkout")}>
                <Sparkles className="size-4" /> {busy === "checkout" ? "Opening Stripe…" : `Get premium · ${dollars(billing.price_cents)}/year`}
              </button>
            )}
            {billing.has_billing && (
              <button type="button" className={quietButton} disabled={!billing.stripe_configured || busy} onClick={() => go("portal")}>
                <ExternalLink className="size-4" /> Manage billing
              </button>
            )}
            {!billing.stripe_configured && <span className="self-center text-xs text-slate-500">Payments aren't set up on RecoveryBot yet.</span>}
          </div>
        )}
        {billing.is_site_admin && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 text-sm dark:border-neutral-800">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Site admin</span>
            <button type="button" className={quietButton} onClick={() => save({ plan: billing.plan === "waived" ? "free" : "waived" })}>
              {billing.plan === "waived" ? "Stop waiving" : "Waive premium for good"}
            </button>
            <button type="button" className={quietButton} onClick={() => save({ gift_year: true })}>Give a year</button>
          </div>
        )}
      </Card>

      <Contributions group={group} billing={billing} busy={busy} go={go} refresh={refresh} save={save} />
    </div>
  );
}

function Contributions({ group, billing, busy, go, refresh, save }) {
  const c = billing.contributions;
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState(c.note || "");

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <HandHeart className="size-5 text-accent" />
        <h2 className="flex-1 font-semibold text-slate-900 dark:text-white">7th Tradition online</h2>
        {c.live ? <Pill tone="green">Taking contributions</Pill> : c.connected ? <Pill tone="amber">Setting up</Pill> : <Pill>Not set up</Pill>}
      </div>
      <p className="text-sm text-slate-600 dark:text-neutral-400">
        Members give with a card, Apple Pay or Google Pay, straight into <strong>{group.title}'s own Stripe account</strong>. RecoveryBot
        takes no cut and never holds the money; Stripe's card fee (2.9% + 30¢ in the US) comes out of each one, and members can choose to cover it.
      </p>

      {!billing.premium ? (
        <p className="text-sm text-slate-600 dark:text-neutral-400">Online contributions come with premium.</p>
      ) : c.live ? (
        <>
          <div>
            <span className={labelClass}>The link your hosts share in the meeting</span>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-neutral-800">{c.url}</code>
              <button type="button" className={quietButton} onClick={() => copy(c.url, () => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
              It isn't on the group's public page or in Find a meeting, so it stays with the group's own members. Hosts also find it in the Command Center.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Total label="This month" cents={c.month_cents} count={c.month_count} />
            <Total label="This year" cents={c.year_cents} count={c.year_count} />
          </div>
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            Totals before Stripe's fees. {c.monthly_givers > 0 && `${c.monthly_givers} give monthly. `}RecoveryBot keeps no names; Stripe's own dashboard has the details and the payouts.
          </p>
          <div>
            <label htmlFor="contribution_note" className={labelClass}>Note on the page <span className="font-normal normal-case">(optional)</span></label>
            <textarea id="contribution_note" rows={2} className={inputClass} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)}
              placeholder={`For the members of ${group.title}. A.A. groups are fully self-supporting through their own members' contributions.`} />
            {note !== (c.note || "") && <button type="button" className={`${quietButton} mt-2`} onClick={() => save({ contribution_note: note })}>Save note</button>}
          </div>
          <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className={quietButton}><ExternalLink className="size-4" /> Open Stripe</a>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryButton} disabled={!billing.stripe_configured || busy} onClick={() => go("connect")}>
              <Landmark className="size-4" /> {busy === "connect" ? "Opening Stripe…" : c.connected ? "Finish setting up in Stripe" : "Set up with Stripe"}
            </button>
            {c.connected && <button type="button" className={quietButton} disabled={busy} onClick={refresh}><RefreshCw className="size-4" /> Check again</button>}
          </div>
          <EinGuide />
        </>
      )}
    </Card>
  );
}

function Total({ label, cents, count }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-neutral-800/60">
      <div className="text-xs text-slate-500 dark:text-neutral-400">{label}</div>
      <div className="text-xl font-semibold text-slate-900 dark:text-white">{dollars(cents)}</div>
      <div className="text-xs text-slate-500 dark:text-neutral-400">{count} {count === 1 ? "contribution" : "contributions"}</div>
    </div>
  );
}

// Why and how a group gets its own tax ID before connecting Stripe, so no member's name or Social
// Security number is on the group's money
export function EinGuide({ open = false }) {
  return (
    <details open={open} className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-neutral-800/60 dark:text-neutral-300 [&_li]:mb-2">
      <summary className="cursor-pointer font-semibold text-slate-900 dark:text-white">How to get your group an EIN first (recommended)</summary>
      <p className="mt-3">
        Stripe has to know who the money belongs to. Without a tax ID of its own, the group's account would be in the treasurer's
        name, with their Social Security number and bank account, and Stripe would report the income to the IRS under them. An EIN puts it
        in the group's name. It's free, and takes about 15 minutes.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5">
        <li><strong>Take it to group conscience.</strong> Agree to get an EIN and open a group bank account, and choose who will be the IRS's contact
          (the "responsible party", usually the treasurer or a long-time member). The IRS keeps that private.</li>
        <li><strong>Apply free at <a className="text-accent hover:underline" href="https://www.irs.gov/ein" target="_blank" rel="noreferrer">irs.gov/ein</a></strong>
          (weekdays). For the kind of organization, look under the additional types for <em>other nonprofit or tax-exempt organizations</em>, and give the
          group's name as you'd like it on the account. You get the number straight away. Never pay a site to do this.</li>
        <li><strong>You don't need 501(c)(3) status.</strong> Most groups don't apply; contributions to the group just aren't tax-deductible.</li>
        <li><strong>Open a bank account in the group's name</strong> with the EIN. Banks often ask for the minutes that approved it. Two signers is a good habit.</li>
        <li><strong>Then come back and set up with Stripe.</strong> Choose a nonprofit, enter the group's name, EIN and bank account. Stripe still checks one
          person (the treasurer) privately, but the account, the payouts and any tax forms are the group's.</li>
        <li><strong>When service rotates,</strong> the outgoing treasurer adds the new one in Stripe (Settings, Team) and the IRS contact is changed with Form 8822-B.</li>
      </ol>
      <p className="mt-3 text-xs text-slate-500 dark:text-neutral-400">
        A.A.'s own guidance: <a className="text-accent hover:underline" href="https://www.aa.org/sites/default/files/literature/assets/SMF-223-FAQonVirtualBasket_en.pdf" target="_blank" rel="noreferrer">virtual basket FAQ</a> and{" "}
        <a className="text-accent hover:underline" href="https://www.aa.org/sites/default/files/literature/assets/mg-15_finance.pdf" target="_blank" rel="noreferrer">the finance guidelines</a>.
        This isn't tax advice; your area or intergroup treasurer has usually done it before.
      </p>
    </details>
  );
}
