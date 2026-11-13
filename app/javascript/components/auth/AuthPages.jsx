import React, { useState } from "react";
import { BookOpen, CircleCheck, Highlighter, Inbox, KeyRound, LogIn, Mail, Shuffle, UserPlus } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { inputClass, labelClass } from "../ui/styles";
import { RecoveryBotLogo } from "../brand/Logo";
import HumanCheckFields from "../site/HumanCheckFields";
import { callPlugin, hasPlugin } from "../../lib/nativeApp";

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

const providerButton = "w-full inline-flex items-center justify-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm disabled:opacity-60";
const googleLook = `${providerButton} border-slate-300 !bg-white !text-slate-800 hover:!bg-slate-50 dark:border-neutral-600`;
// Apple's own look for its button: black with white, or white with black in dark mode
const appleLook = `${providerButton} border-black !bg-black !text-white hover:opacity-90 dark:border-white dark:!bg-white dark:!text-black`;

// A plain POST, since OmniAuth (Google) and Sign in with Apple only start from a form carrying
// the page's token
function PostButton({ path, authenticity_token, className, busy, children }) {
  const [going, setGoing] = useState(false);
  return (
    <form action={path} method="post" acceptCharset="UTF-8" onSubmit={() => setGoing(true)}>
      <input type="hidden" name="authenticity_token" value={authenticity_token} />
      <button type="submit" disabled={going} className={className}>{going ? busy : children}</button>
    </form>
  );
}

// The apps' own sign-in sheets (NativeSignIn): the page asks the server for a nonce, the app's
// NativeAuth plugin signs in with Google or Apple and returns an ID token, and the server checks
// it and signs them in
async function nativeSignIn(provider, options, authenticityToken) {
  const { nonce } = await fetch("/users/auth/native/nonce", { credentials: "same-origin", headers: { Accept: "application/json" } }).then((r) => r.json());
  const args = provider === "google" ? { clientId: options.google_client_id, nonce } : { nonce };
  const result = await callPlugin("NativeAuth", provider, args);
  const res = await fetch("/users/auth/native", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-CSRF-Token": authenticityToken },
    body: JSON.stringify({ provider, id_token: result.idToken, authorization_code: result.authorizationCode, given_name: result.givenName, family_name: result.familyName }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "We couldn't sign you in. Please try again.");
  window.location.href = data.redirect || "/";
}

function NativeButton({ provider, options, authenticity_token, className, busy, children }) {
  const [going, setGoing] = useState(false);
  const [error, setError] = useState(null);
  const go = async () => {
    setGoing(true);
    setError(null);
    try {
      await nativeSignIn(provider, options, authenticity_token);
    } catch (e) {
      const message = String(e?.message || e);
      if (!/cancel/i.test(message)) setError(message);
      setGoing(false);
    }
  };
  return (
    <div>
      <button type="button" onClick={go} disabled={going} className={className}>{going ? busy : children}</button>
      {error && <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}

// "Continue with Google" and "Sign in with Apple", above the email form. In a browser they're
// the website's own (GoogleSignIn, AppleSignIn), each shown only when the server has it set
// up; in the apps, Google (and Apple on iPhone) use the phone's own sheet, since Google blocks
// its page inside apps. Nothing shows when none is set up.
function ProviderButtons({ google_path, apple_path, native_sign_in, authenticity_token, verb = "Continue", note }) {
  const native = native_sign_in && hasPlugin("NativeAuth") ? native_sign_in : null;
  const googleLabel = <><GoogleMark className="h-[18px] w-[18px]" /> {verb} with Google</>;
  const appleLabel = <><AppleMark className="h-[18px] w-[18px]" /> {verb === "Continue" ? "Sign in" : verb} with Apple</>;
  const buttons = [];
  if (native?.google_client_id) {
    buttons.push(<NativeButton key="g" provider="google" options={native} authenticity_token={authenticity_token} className={googleLook} busy="Opening Google…">{googleLabel}</NativeButton>);
  } else if (google_path) {
    buttons.push(<PostButton key="g" path={google_path} authenticity_token={authenticity_token} className={googleLook} busy="Opening Google…">{googleLabel}</PostButton>);
  }
  if (native?.apple) {
    buttons.push(<NativeButton key="a" provider="apple" options={native} authenticity_token={authenticity_token} className={appleLook} busy="Opening Apple…">{appleLabel}</NativeButton>);
  } else if (apple_path || native?.apple_path) {
    buttons.push(<PostButton key="a" path={apple_path || native.apple_path} authenticity_token={authenticity_token} className={appleLook} busy="Opening Apple…">{appleLabel}</PostButton>);
  }
  if (!buttons.length) return null;
  return (
    <>
      <div className="space-y-3">{buttons}</div>
      {note && <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">{note}</p>}
      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400 dark:text-neutral-500" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200 dark:bg-neutral-700" /> or <span className="h-px flex-1 bg-slate-200 dark:bg-neutral-700" />
      </div>
    </>
  );
}

// Apple's logo for the Sign in with Apple button (the outline from Font Awesome Free, CC BY 4.0)
function AppleMark({ className }) {
  return (
    <svg viewBox="0 0 384 512" className={className} aria-hidden="true" fill="currentColor">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

// Google's "G", in its own colors as Google's sign-in branding asks
function GoogleMark({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

const passwordHint = (min) => (min ? `At least ${min} characters` : null);

export function LoginPage({ email = "", remember = true, always_remember = false, forgot_path, sign_up_path, confirm_path, google_path, apple_path, native_sign_in, ...form }) {
  return (
    <AuthFrame icon={LogIn} title="Welcome back" subtitle="Log in to your RecoveryBot account"
      footer={<>
        {sign_up_path && <>Don't have an account yet? <a href={sign_up_path} className={linkClass}>Sign up</a></>}
        {confirm_path && <><br /><a href={confirm_path} className={linkClass}>Didn't get the confirmation email?</a></>}
      </>}>
      <ProviderButtons google_path={google_path} apple_path={apple_path} native_sign_in={native_sign_in} authenticity_token={form.authenticity_token} />
      <AuthForm {...form} submitLabel="Log in" busyLabel="Logging in…">
        <Field id="user_email" label="Email" type="email" name="user[email]" defaultValue={email} autoComplete="email" autoFocus required placeholder="you@example.com" />
        <Field id="user_password" label="Password" type="password" name="user[password]" autoComplete="current-password" required placeholder="••••••••"
          aside={forgot_path && <a href={forgot_path} className={`text-xs ${linkClass}`}>Forgot password?</a>} />
        {always_remember && <input type="hidden" name="user[remember_me]" value="1" />}
        {remember && (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-300">
            <input type="hidden" name="user[remember_me]" value="0" />
            <input type="checkbox" name="user[remember_me]" value="1" defaultChecked className="h-4 w-4 rounded accent-[#0b6ede]" />
            Remember me
          </label>
        )}
      </AuthForm>
    </AuthFrame>
  );
}

export function SignUpPage({ name = "", email = "", min_password_length, login_path, human_check, google_path, apple_path, native_sign_in, ...form }) {
  return (
    <AuthFrame icon={UserPlus} title="Create your account" subtitle="We'll email you a link to confirm your address"
      footer={login_path && <>Already have an account? <a href={login_path} className={linkClass}>Log in</a></>}>
      <ProviderButtons google_path={google_path} apple_path={apple_path} native_sign_in={native_sign_in} authenticity_token={form.authenticity_token} verb="Sign up"
        note={<>We use only your first name, last initial and email address from Google or Apple (Apple can hide your address from us). By signing up you agree to the{" "}
          <a href="/terms" className={linkClass}>terms of use</a> and <a href="/privacy" className={linkClass}>privacy policy</a>.</>} />
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

// Right after sign-up: the account can't log in until the emailed link is clicked.
export function CheckEmailPage({ email = "", login_path, sign_up_path, ...form }) {
  return (
    <AuthFrame icon={Inbox} title="Check your email" subtitle="One more step before you can log in"
      footer={<>
        {login_path && <>Clicked the link? <a href={login_path} className={linkClass}>Log in</a></>}
        {sign_up_path && <><br />Wrong address? <a href={sign_up_path} className={linkClass}>Sign up again</a></>}
      </>}>
      <div className="mb-5 space-y-3 text-left text-sm text-slate-700 dark:text-neutral-300 [&_p]:!text-left">
        <p>
          We sent a confirmation link to <strong className="font-semibold text-slate-900 dark:text-white break-all">{email}</strong>.
          Click it to confirm your address, then log in.
        </p>
        <p className="text-xs text-slate-500 dark:text-neutral-400">
          It can take a minute or two. If it doesn't turn up, check your spam or promotions folder. The link works for 3 days.
        </p>
      </div>
      <AuthForm {...form} submitLabel="Send the link again" busyLabel="Sending…">
        <input type="hidden" name="user[email]" value={email} />
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
