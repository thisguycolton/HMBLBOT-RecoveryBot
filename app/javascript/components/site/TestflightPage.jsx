import React, { useState } from "react";
import { CircleCheck, Send, Smartphone } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { inputClass, labelClass } from "../ui/styles";
import HumanCheckFields from "./HumanCheckFields";

const linkClass = "font-medium text-accent hover:underline";
const MAX_NOTE = 1000;

// Ask to try the iPhone app (/testflight, TestflightRequestsController): a plain HTML form.
// Site admins see each request in Site Admin > TestFlight requests and invite people from
// App Store Connect, which emails them a TestFlight link. Linked from a site notice.
export default function TestflightPage({ action, authenticity_token, sent, errors = [], values = {}, human_check }) {
  const [submitting, setSubmitting] = useState(false);
  const [length, setLength] = useState((values.note || "").length);

  return (
    <div className="bg-slate-50 dark:bg-neutral-950 min-h-[calc(100vh-56px)] px-4 py-10 sm:py-16 !font-sans [&_*]:!font-sans">
      <div className="mx-auto w-full max-w-xl">
        <Shell>
          <ShellBand icon={Smartphone} title="Try the iPhone app" subtitle="Ask for an invite to the TestFlight beta" />
          <ShellPanel position="bottom" className="p-5">
            {sent ? (
              <div className="space-y-3 py-4 text-center">
                <CircleCheck className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                <h1 className="!text-lg font-semibold text-slate-900 dark:text-white">Thanks, you're on the list</h1>
                <p className="text-sm text-slate-600 dark:text-neutral-400">
                  A person adds every invite by hand, so it can take a few days. When it's ready, Apple emails you from
                  TestFlight. Open that email on your iPhone, install Apple's free TestFlight app, and tap the link to get RecoveryBot.
                </p>
                <p className="text-sm"><a href="/" className={linkClass}>Back to RecoveryBot</a></p>
              </div>
            ) : (
              <form action={action} method="post" acceptCharset="UTF-8" className="space-y-4" onSubmit={() => setSubmitting(true)}>
                <input type="hidden" name="authenticity_token" value={authenticity_token} />
                <p className="text-sm text-slate-600 dark:text-neutral-400">
                  The RecoveryBot iPhone app is in testing before it goes in the App Store. Testing happens through Apple's
                  TestFlight app, and Apple sends the invite to the email address on your Apple ID. You'll need an iPhone.
                </p>
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
                  <label htmlFor="testflight_email" className={labelClass}>Apple ID email</label>
                  <input id="testflight_email" type="email" name="testflight[email]" className={inputClass} defaultValue={values.email || ""}
                    autoComplete="email" required maxLength={254} placeholder="The email you sign in to the App Store with" />
                  <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                    Not sure? On your iPhone, open Settings and tap your name at the top.
                  </p>
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
                  We only use your email to send the invite and share it with Apple for TestFlight. See the{" "}
                  <a href="/privacy" className={linkClass}>privacy policy</a>.
                </p>
              </form>
            )}
          </ShellPanel>
        </Shell>
      </div>
    </div>
  );
}
