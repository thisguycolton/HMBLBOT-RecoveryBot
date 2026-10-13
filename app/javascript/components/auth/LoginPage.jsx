import React, { useState } from "react";
import { BookOpen, CircleCheck, Highlighter, LogIn, Shuffle } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { inputClass, labelClass } from "../ui/styles";

const FEATURES = [
  { icon: Shuffle, title: "Topics for every meeting", text: "Draw discussion topics with the Topicificator and keep the group moving." },
  { icon: BookOpen, title: "The literature, in one library", text: "Read the Big Book, the Twelve and Twelve, Daily Reflections and more." },
  { icon: Highlighter, title: "Highlights and notes", text: "Mark the passages that matter to you and share them with your sponsor." },
];

// Two columns on wide screens (what HumbleBot does, then the form); just the form on phones.
// A plain HTML form post, so Devise handles the session, redirect and flash.
export default function LoginPage({ action, authenticity_token, email = "", remember = true, forgot_path, sign_up_path }) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="bg-slate-50 dark:bg-neutral-950 min-h-[calc(100vh-56px)] px-4 py-10 sm:py-16 !font-sans [&_*]:!font-sans">
      <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <section className="hidden lg:block space-y-8">
          <a href="/" className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">HumbleBot</a>
          <ul className="space-y-6">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-tint text-accent dark:bg-accent/30 dark:text-white">
                  <Icon className="h-4 w-4" strokeWidth={2.5} />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-neutral-400">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="mx-auto w-full max-w-md">
          <a href="/" className="mb-6 block text-center text-2xl font-semibold tracking-tight text-slate-900 dark:text-white lg:hidden">HumbleBot</a>
          <Shell>
            <ShellBand icon={LogIn} title="Welcome back" subtitle="Log in to your HumbleBot account" />
            <ShellPanel position="bottom" className="p-5">
              <form action={action} method="post" acceptCharset="UTF-8" className="space-y-4" onSubmit={() => setSubmitting(true)}>
                <input type="hidden" name="authenticity_token" value={authenticity_token} />
                <div>
                  <label htmlFor="user_email" className={labelClass}>Email</label>
                  <input id="user_email" type="email" name="user[email]" defaultValue={email} autoComplete="email" autoFocus required
                    placeholder="you@example.com" className={inputClass} />
                </div>
                <div>
                  <div className="flex items-baseline justify-between">
                    <label htmlFor="user_password" className={labelClass}>Password</label>
                    {forgot_path && <a href={forgot_path} className="text-xs font-medium text-accent hover:underline">Forgot password?</a>}
                  </div>
                  <input id="user_password" type="password" name="user[password]" autoComplete="current-password" required
                    placeholder="••••••••" className={inputClass} />
                </div>
                {remember && (
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-300">
                    <input type="hidden" name="user[remember_me]" value="0" />
                    <input type="checkbox" name="user[remember_me]" value="1" className="h-4 w-4 rounded accent-[#0b6ede]" />
                    Remember me
                  </label>
                )}
                <button type="submit" disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl !bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-panel hover:opacity-90 disabled:opacity-60">
                  <CircleCheck className="h-4 w-4" /> {submitting ? "Logging in…" : "Log in"}
                </button>
              </form>
              {sign_up_path && (
                <p className="mt-5 text-center text-sm text-slate-600 dark:text-neutral-400">
                  Don't have an account yet? <a href={sign_up_path} className="font-medium text-accent hover:underline">Sign up</a>
                </p>
              )}
            </ShellPanel>
          </Shell>
        </div>
      </div>
    </div>
  );
}
