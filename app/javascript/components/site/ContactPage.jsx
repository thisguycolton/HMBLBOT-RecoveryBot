import React, { useState } from "react";
import { CircleCheck, Mail, Send } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { inputClass, labelClass, selectClass } from "../ui/styles";
import HumanCheckFields from "./HumanCheckFields";

const linkClass = "font-medium text-accent hover:underline";
const MAX_MESSAGE = 5000;

// The Contact page (/contact, ContactsController): a plain HTML form the server emails on
export default function ContactPage({ action, authenticity_token, sent, errors = [], configured, topics = [], values = {}, human_check }) {
  const [submitting, setSubmitting] = useState(false);
  const [length, setLength] = useState((values.message || "").length);

  return (
    <div className="bg-slate-50 dark:bg-neutral-950 min-h-[calc(100vh-56px)] px-4 py-10 sm:py-16 !font-sans [&_*]:!font-sans">
      <div className="mx-auto w-full max-w-xl">
        <Shell>
          <ShellBand icon={Mail} title="Contact us" subtitle="Questions, problems, privacy requests or a listing to fix" />
          <ShellPanel position="bottom" className="p-5">
            {sent ? (
              <div className="space-y-3 py-4 text-center">
                <CircleCheck className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                <h1 className="!text-lg font-semibold text-slate-900 dark:text-white">Thanks, your message is on its way</h1>
                <p className="text-sm text-slate-600 dark:text-neutral-400">
                  A person reads every message. We'll reply to the email address you gave, usually within a few days.
                </p>
                <p className="text-sm"><a href="/" className={linkClass}>Back to RecoveryBot</a></p>
              </div>
            ) : !configured ? (
              <p className="py-4 text-sm text-slate-600 dark:text-neutral-400">
                The contact form isn't set up on this site yet. In the meantime you can reach us on{" "}
                <a href="https://discord.gg/mBkUUwH7hd" target="_blank" rel="noreferrer" className={linkClass}>Discord</a>.
              </p>
            ) : (
              <form action={action} method="post" acceptCharset="UTF-8" className="space-y-4" onSubmit={() => setSubmitting(true)}>
                <input type="hidden" name="authenticity_token" value={authenticity_token} />
                <p className="text-sm text-slate-600 dark:text-neutral-400">
                  This goes by email to the people who run RecoveryBot. We don't save it on the site. Please don't include anything about
                  other members you wouldn't say in the meeting room.
                </p>
                {errors.length > 0 && (
                  <ul role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200 space-y-1">
                    {errors.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="contact_name" className={labelClass}>Name <span className="normal-case font-normal">(optional)</span></label>
                    <input id="contact_name" name="contact[name]" className={inputClass} defaultValue={values.name || ""} autoComplete="name"
                      placeholder="First name is fine" maxLength={100} />
                  </div>
                  <div>
                    <label htmlFor="contact_email" className={labelClass}>Email</label>
                    <input id="contact_email" type="email" name="contact[email]" className={inputClass} defaultValue={values.email || ""}
                      autoComplete="email" required placeholder="So we can reply" />
                  </div>
                </div>
                <div>
                  <label htmlFor="contact_topic" className={labelClass}>About</label>
                  <select id="contact_topic" name="contact[topic]" className={selectClass} defaultValue={values.topic || "general"}>
                    {topics.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="contact_message" className={labelClass}>Message</label>
                  <textarea id="contact_message" name="contact[message]" rows={7} required maxLength={MAX_MESSAGE} className={inputClass}
                    defaultValue={values.message || ""} onChange={(e) => setLength(e.target.value.length)} />
                  {length > MAX_MESSAGE - 500 && <p className="mt-1 text-xs text-slate-500">{MAX_MESSAGE - length} characters left</p>}
                </div>
                <HumanCheckFields check={human_check} />
                <button type="submit" disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl !bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-panel hover:opacity-90 disabled:opacity-60">
                  <Send className="h-4 w-4" /> {submitting ? "Sending…" : "Send message"}
                </button>
                <p className="text-center text-xs text-slate-500 dark:text-neutral-400">
                  See the <a href="/privacy" className={linkClass}>privacy policy</a> for how we handle what you send.
                </p>
              </form>
            )}
          </ShellPanel>
        </Shell>
      </div>
    </div>
  );
}
