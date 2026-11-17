import React, { useState } from "react";
import { CircleCheck, Send, Smartphone } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { inputClass, labelClass } from "../ui/styles";
import HumanCheckFields from "./HumanCheckFields";

const linkClass = "font-medium text-accent hover:underline";
const MAX_NOTE = 1000;

// What changes with the phone: iPhones test through Apple's TestFlight, Android phones through
// Google Play's closed test, and each sends the invite to a different account's email
const PLATFORMS = {
  ios: {
    label: "iPhone", title: "Try the iPhone app", subtitle: "Join the TestFlight beta",
    intro: "The RecoveryBot iPhone app is in testing before it goes in the App Store. Anyone can join: open this on your iPhone, tap the button, and Apple's free TestFlight app installs RecoveryBot.",
    // TestFlight's public link: no invite or email needed, so iPhones skip the form
    joinUrl: "https://testflight.apple.com/join/fCjuQmFW",
    emailLabel: "Apple ID email", emailPlaceholder: "The email you sign in to the App Store with",
    emailHint: "Not sure? On your iPhone, open Settings and tap your name at the top.",
    done: "A person adds every invite by hand, so it can take a few days. When it's ready, Apple emails you from TestFlight. Open that email on your iPhone, install Apple's free TestFlight app, and tap the link to get RecoveryBot.",
    privacy: "We only use your email to send the invite and share it with Apple for TestFlight.",
  },
  android: {
    label: "Android", title: "Try the Android app", subtitle: "Join the Google Play test",
    intro: "The RecoveryBot Android app is in a closed test before it goes public on Google Play. We add your Google account to the test, then you join it from a link and install the app from Google Play as usual.",
    emailLabel: "Google account email", emailPlaceholder: "The Gmail or Google account on your Android phone",
    emailHint: "It has to be the account your phone's Play Store uses. Not sure? Open the Play Store and tap your picture at the top.",
    done: "A person adds every tester by hand, so it can take a few days. Once you're added, open the link below on your Android phone, tap Become a tester, then install RecoveryBot from Google Play. Save it for later: it only works after we've added you.",
    joinUrl: "https://play.google.com/apps/testing/com.hmblbot.recoverybot",
    privacy: "We only use your email to add you to the test and share it with Google for Google Play testing.",
  },
};

// Ask to try the app before it's in the stores (/testflight, TestflightRequestsController): a
// plain HTML form, for an iPhone (TestFlight) or an Android phone (Google Play closed test). Site
// admins see each request in Site Admin > Tester requests and add people in App Store Connect or
// the Play Console. Linked from a site notice.
export default function TestflightPage({ action, authenticity_token, sent, errors = [], values = {}, human_check }) {
  const [submitting, setSubmitting] = useState(false);
  const [length, setLength] = useState((values.note || "").length);
  const [platform, setPlatform] = useState(values.platform === "android" ? "android" : "ios");
  const copy = PLATFORMS[platform];

  return (
    <div className="bg-slate-50 dark:bg-neutral-950 min-h-[calc(100vh-56px)] px-4 py-10 sm:py-16 !font-sans [&_*]:!font-sans">
      <div className="mx-auto w-full max-w-xl">
        <Shell>
          <ShellBand icon={Smartphone} title={sent ? copy.title : "Try the app early"} subtitle={sent ? copy.subtitle : "Test RecoveryBot on your iPhone or Android phone"} />
          <ShellPanel position="bottom" className="p-5">
            {sent ? (
              <div className="space-y-3 py-4 text-center">
                <CircleCheck className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                <h1 className="!text-lg font-semibold text-slate-900 dark:text-white">Thanks, you're on the list</h1>
                <p className="text-sm text-slate-600 dark:text-neutral-400">{copy.done}</p>
                {copy.joinUrl && <p className="text-sm break-all"><a href={copy.joinUrl} className={linkClass}>{copy.joinUrl}</a></p>}
                <p className="text-sm"><a href="/" className={linkClass}>Back to RecoveryBot</a></p>
              </div>
            ) : (
              <form action={action} method="post" acceptCharset="UTF-8" className="space-y-4" onSubmit={() => setSubmitting(true)}>
                <input type="hidden" name="authenticity_token" value={authenticity_token} />
                <fieldset>
                  <legend className={labelClass}>Your phone</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(PLATFORMS).map(([key, p]) => (
                      <label key={key} className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 ${platform === key ? "bg-accent/10 text-accent ring-accent" : "text-slate-700 ring-neutral-300 dark:text-neutral-200 dark:ring-neutral-700"}`}>
                        <input type="radio" name="testflight[platform]" value={key} checked={platform === key} onChange={() => setPlatform(key)} className="sr-only" />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <p className="text-sm text-slate-600 dark:text-neutral-400">{copy.intro}</p>
                {platform === "ios" ? (
                  <a href={PLATFORMS.ios.joinUrl}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl !bg-accent px-4 py-2.5 text-sm font-semibold !text-white shadow-panel hover:opacity-90">
                    <Smartphone className="h-4 w-4" /> Join the beta on TestFlight
                  </a>
                ) : <>
                {errors.length > 0 && (
                  <ul role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200 space-y-1">
                    {errors.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                )}
                <div>
                  <label htmlFor="testflight_name" className={labelClass}>Name</label>
                  <input id="testflight_name" name="testflight[name]" className={inputClass} defaultValue={values.name || ""} autoComplete="name"
                    required maxLength={100} placeholder="First name and last initial is fine" />
                </div>
                <div>
                  <label htmlFor="testflight_email" className={labelClass}>{copy.emailLabel}</label>
                  <input id="testflight_email" type="email" name="testflight[email]" className={inputClass} defaultValue={values.email || ""}
                    autoComplete="email" required maxLength={254} placeholder={copy.emailPlaceholder} />
                  <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">{copy.emailHint}</p>
                </div>
                <div>
                  <label htmlFor="testflight_note" className={labelClass}>Anything we should know <span className="normal-case font-normal">(optional)</span></label>
                  <textarea id="testflight_note" name="testflight[note]" rows={3} maxLength={MAX_NOTE} className={inputClass}
                    defaultValue={values.note || ""} onChange={(e) => setLength(e.target.value.length)}
                    placeholder="Your group, or what you'd most like to try" />
                  {length > MAX_NOTE - 200 && <p className="mt-1 text-xs text-slate-500">{MAX_NOTE - length} characters left</p>}
                </div>
                <HumanCheckFields check={human_check} />
                <button type="submit" disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl !bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-panel hover:opacity-90 disabled:opacity-60">
                  <Send className="h-4 w-4" /> {submitting ? "Sending…" : "Ask for an invite"}
                </button>
                <p className="text-center text-xs text-slate-500 dark:text-neutral-400">
                  {copy.privacy} See the{" "}
                  <a href="/privacy" className={linkClass}>privacy policy</a>.
                </p>
                </>}
              </form>
            )}
          </ShellPanel>
        </Shell>
      </div>
    </div>
  );
}
