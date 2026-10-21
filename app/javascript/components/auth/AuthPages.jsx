import React, { useState } from "react";
import { BookOpen, CircleCheck, Highlighter, KeyRound, LogIn, Mail, Shuffle, UserPlus } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { inputClass, labelClass } from "../ui/styles";
import { RecoveryBotLogo } from "../brand/Logo";
import HumanCheckFields from "../site/HumanCheckFields";

// Devise's pages in the house panel style. Each posts a plain HTML form, so Devise
// handles the session, redirects and flash (shown as toasts) exactly as before.

const FEATURES = [
  { icon: Shuffle, title: "Topics for every meeting", text: "Draw discussion topics with the Topicificator and keep the group moving." },
  { icon: BookOpen, title: "The literature, in one library", text: "Read the Big Book, the Twelve and Twelve, Daily Reflections and more." },
  { icon: Highlighter, title: "Highlights and notes", text: "Mark the passages that matter to you and share them with your sponsor." },
];

const linkClass = "font-medium text-accent hover:underline";

// Two columns on wide screens (what RecoveryBot does, then the form); just the form on phones.
function AuthFrame({ icon, title, subtitle, children, footer }) {
  return (
    <div className="bg-slate-50 dark:bg-neutral-950 min-h-[calc(100vh-56px)] px-4 py-10 sm:py-16 !font-sans [&_*]:!font-sans">
      <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <section className="hidden lg:block space-y-8">
          <a href="/" className="inline-block !text-slate-900 dark:!text-white"><RecoveryBotLogo markClassName="h-9 w-auto" textClassName="text-2xl" /></a>
          <ul className="space-y-6">
            {FEATURES.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-tint text-accent dark:bg-accent/30 dark:text-white">
                  <Icon className="h-4 w-4" strokeWidth={2.5} />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t}</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-neutral-400">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="mx-auto w-full max-w-md">
          <a href="/" className="mb-6 flex justify-center !text-slate-900 dark:!text-white lg:hidden"><RecoveryBotLogo markClassName="h-9 w-auto" textClassName="text-2xl" /></a>
          <Shell>
            <ShellBand icon={icon} title={title} subtitle={subtitle} />
            <ShellPanel position="bottom" className="p-5">
              {children}
              {footer && <p className="mt-5 text-center text-sm text-slate-600 dark:text-neutral-400">{footer}</p>}
            </ShellPanel>
          </Shell>
        </div>
      </div>
    </div>
  );
}

function AuthForm({ action, method, authenticity_token, errors = [], submitLabel, busyLabel, children }) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <form action={action} method="post" acceptCharset="UTF-8" className="space-y-4" onSubmit={() => setSubmitting(true)}>
      <input type="hidden" name="authenticity_token" value={authenticity_token} />
      {method && method !== "post" && <input type="hidden" name="_method" value={method} />}
      {errors.length > 0 && (
        <ul role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200 space-y-1">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      {children}
      <button type="submit" disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl !bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-panel hover:opacity-90 disabled:opacity-60">
        <CircleCheck className="h-4 w-4" /> {submitting ? busyLabel : submitLabel}
      </button>
    </form>
  );
}

function Field({ id, label, aside, hint, ...input }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className={labelClass}>{label}</label>
        {aside}
      </div>
      <input id={id} className={inputClass} {...input} />
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">{hint}</p>}
    </div>
  );
}

const passwordHint = (min) => (min ? `At least ${min} characters` : null);

export function LoginPage({ email = "", remember = true, forgot_path, sign_up_path, confirm_path, ...form }) {
  return (
    <AuthFrame icon={LogIn} title="Welcome back" subtitle="Log in to your RecoveryBot account"
      footer={<>
        {sign_up_path && <>Don't have an account yet? <a href={sign_up_path} className={linkClass}>Sign up</a></>}
        {confirm_path && <><br /><a href={confirm_path} className={linkClass}>Didn't get the confirmation email?</a></>}
      </>}>
      <AuthForm {...form} submitLabel="Log in" busyLabel="Logging in…">
        <Field id="user_email" label="Email" type="email" name="user[email]" defaultValue={email} autoComplete="email" autoFocus required placeholder="you@example.com" />
        <Field id="user_password" label="Password" type="password" name="user[password]" autoComplete="current-password" required placeholder="••••••••"
          aside={forgot_path && <a href={forgot_path} className={`text-xs ${linkClass}`}>Forgot password?</a>} />
        {remember && (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-300">
            <input type="hidden" name="user[remember_me]" value="0" />
            <input type="checkbox" name="user[remember_me]" value="1" className="h-4 w-4 rounded accent-[#0b6ede]" />
            Remember me
          </label>
        )}
      </AuthForm>
    </AuthFrame>
  );
}

export function SignUpPage({ name = "", email = "", min_password_length, login_path, human_check, ...form }) {
  return (
    <AuthFrame icon={UserPlus} title="Create your account" subtitle="We'll email you a link to confirm your address"
      footer={login_path && <>Already have an account? <a href={login_path} className={linkClass}>Log in</a></>}>
      <AuthForm {...form} submitLabel="Sign up" busyLabel="Signing up…">
        <Field id="user_name" label="Name" name="user[name]" defaultValue={name} autoComplete="name" autoFocus required placeholder="First name and last initial" />
        <Field id="user_email" label="Email" type="email" name="user[email]" defaultValue={email} autoComplete="email" required placeholder="you@example.com" />
        <Field id="user_password" label="Password" type="password" name="user[password]" autoComplete="new-password" required minLength={min_password_length}
          hint={passwordHint(min_password_length)} />
        <Field id="user_password_confirmation" label="Confirm password" type="password" name="user[password_confirmation]" autoComplete="new-password" required />
        <HumanCheckFields check={human_check} />
        <p className="text-xs text-slate-500 dark:text-neutral-400">
          A first name and last initial is plenty. By signing up you agree to the <a href="/terms" className={linkClass}>terms of use</a> and{" "}
          <a href="/privacy" className={linkClass}>privacy policy</a>, which says what we keep and who sees it.
        </p>
      </AuthForm>
    </AuthFrame>
  );
}

export function ResendConfirmationPage({ email = "", login_path, ...form }) {
  return (
    <AuthFrame icon={Mail} title="Confirm your email" subtitle="We'll send a new confirmation link"
      footer={login_path && <>Already confirmed? <a href={login_path} className={linkClass}>Log in</a></>}>
      <AuthForm {...form} submitLabel="Send the link again" busyLabel="Sending…">
        <Field id="user_email" label="Email" type="email" name="user[email]" defaultValue={email} autoComplete="email" autoFocus required placeholder="you@example.com" />
        <p className="text-xs text-slate-500 dark:text-neutral-400">The link works for 3 days. Check your spam folder if it doesn't turn up.</p>
      </AuthForm>
    </AuthFrame>
  );
}

// Where a new account lands after signing up: confirm the address first (the email has the link),
// with a way to have it sent again
export function CheckEmailPage({ email = "", login_path, ...form }) {
  return (
    <AuthFrame icon={Mail} title="Check your email" subtitle="One more step before you can log in"
      footer={login_path && <>Already confirmed? <a href={login_path} className={linkClass}>Log in</a></>}>
      <div role="status" className="mb-5 space-y-2 text-sm text-slate-700 dark:text-neutral-300">
        <p>We sent a confirmation link to {email ? <strong className="break-all text-slate-900 dark:text-white">{email}</strong> : "your email address"}. Click it to confirm your address, then log in.</p>
        <p className="text-xs text-slate-500 dark:text-neutral-400">It can take a minute or two, and the link works for 3 days. Check your spam folder if it doesn't turn up.</p>
      </div>
      <AuthForm {...form} submitLabel="Send the link again" busyLabel="Sending…">
        {email ? <input type="hidden" name="user[email]" value={email} />
          : <Field id="user_email" label="Email" type="email" name="user[email]" autoComplete="email" required placeholder="you@example.com" />}
      </AuthForm>
    </AuthFrame>
  );
}

export function ForgotPasswordPage({ email = "", login_path, ...form }) {
  return (
    <AuthFrame icon={Mail} title="Forgot your password?" subtitle="We'll email you a link to choose a new one"
      footer={login_path && <>Remembered it? <a href={login_path} className={linkClass}>Log in</a></>}>
      <AuthForm {...form} submitLabel="Send reset instructions" busyLabel="Sending…">
        <Field id="user_email" label="Email" type="email" name="user[email]" defaultValue={email} autoComplete="email" autoFocus required placeholder="you@example.com" />
      </AuthForm>
    </AuthFrame>
  );
}

export function ResetPasswordPage({ reset_password_token, min_password_length, login_path, ...form }) {
  return (
    <AuthFrame icon={KeyRound} title="Choose a new password" subtitle="Then log in with it"
      footer={login_path && <a href={login_path} className={linkClass}>Back to log in</a>}>
      <AuthForm {...form} method="put" submitLabel="Change my password" busyLabel="Saving…">
        <input type="hidden" name="user[reset_password_token]" value={reset_password_token || ""} />
        <Field id="user_password" label="New password" type="password" name="user[password]" autoComplete="new-password" autoFocus required
          minLength={min_password_length} hint={passwordHint(min_password_length)} />
        <Field id="user_password_confirmation" label="Confirm new password" type="password" name="user[password_confirmation]" autoComplete="new-password" required />
      </AuthForm>
    </AuthFrame>
  );
}
