import React, { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, KeyRound, Link2, Unlink } from "lucide-react";
import { callPlugin } from "../../lib/nativeApp";
import { api } from "../groups/lib";
import { Card, ErrorNote, Tray, dangerButton, primaryButton, quietButton } from "../groups/ui";
import { AppleMark, GoogleMark } from "../auth/ProviderMarks";

const MARKS = { google: GoogleMark, apple: AppleMark };
const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
const QUICK_CANCEL_MS = 1500;

// In the apps: the phone's own Google or Apple sheet, the same as the sign-in page's, with
// link: true so the server links it to this account (Users::NativeSignInsController)
async function nativeLink(provider, option) {
  const { nonce } = await fetch("/users/auth/native/nonce", { credentials: "same-origin", headers: { Accept: "application/json" } }).then((r) => r.json());
  const started = Date.now();
  const result = await callPlugin("NativeAuth", provider, provider === "google" ? { clientId: option.client_id, nonce } : { nonce }).catch((e) => {
    if (provider === "google" && /cancel/i.test(String(e?.message || e)) && Date.now() - started < QUICK_CANCEL_MS) {
      throw new Error("Google sign-in didn't open on this phone. Please try it on the website for now.");
    }
    throw e;
  });
  const res = await fetch("/users/auth/native", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-CSRF-Token": csrfToken() },
    body: JSON.stringify({ link: true, provider, id_token: result.idToken, authorization_code: result.authorizationCode }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "We couldn't link that. Please try again.");
  return data.message;
}

// Account settings > Ways to sign in (Api::SignInMethodsController): a password, Google and
// Apple, each linked or not. Link runs the usual Google or Apple sign-in (a form post to the
// website's, or the app's own sheet) and comes back here; Unlink is refused for the last way
// in. After linking an account that another RecoveryBot account already has (often a second
// account Apple's "Hide My Email" made), it asks what to do with that one.
export default function SignInMethods() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const load = () => api("/sign_in_methods").then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const run = async (key, fn) => {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      const out = await fn();
      if (out?.providers) setData(out);
      if (out?.message) setMessage(out.message);
    } catch (e) {
      if (!/cancel/i.test(String(e?.message || e))) setError(e.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const linkNative = (p) => run(`link-${p.provider}`, async () => {
    const msg = await nativeLink(p.provider, p.link);
    const fresh = await api("/sign_in_methods");
    return { ...fresh, message: msg };
  });
  const unlink = (p) => {
    if (!window.confirm(`Unlink ${p.label}? You won't be able to sign in with it until you link it again.`)) return;
    run(`unlink-${p.provider}`, () => api(`/sign_in_methods/${p.provider}`, { method: "DELETE" }));
  };

  if (!data) return error ? <ErrorNote error={error} /> : null;

  return (
    <Tray label="Ways to sign in">
      <Card className="divide-y divide-neutral-100 dark:divide-neutral-800">
        <Row icon={<KeyRound className="h-[18px] w-[18px] text-slate-500" />} title="Email and password"
          detail={data.password ? <>Log in with {data.email}</> : <>No password yet. Choose one above to also log in with {data.email}.</>}
          status={data.password ? <Linked>Set</Linked> : null} />
        {data.providers.map((p) => {
          const Mark = MARKS[p.provider];
          const linking = busy === `link-${p.provider}`;
          let action = null;
          if (p.linked) {
            action = p.can_unlink ? (
              <button type="button" className={quietButton} disabled={!!busy} onClick={() => unlink(p)}>
                <Unlink className="h-4 w-4" /> {busy === `unlink-${p.provider}` ? "Unlinking…" : "Unlink"}
              </button>
            ) : <span className="text-xs text-slate-500 dark:text-neutral-400">Your only way in</span>;
          } else if (p.link?.kind === "native") {
            action = <button type="button" className={primaryButton} disabled={!!busy} onClick={() => linkNative(p)}><Link2 className="h-4 w-4" /> {linking ? "Opening…" : `Link ${p.label}`}</button>;
          } else if (p.link?.kind === "post") {
            action = (
              <form action={p.link.path} method="post" acceptCharset="UTF-8" onSubmit={() => setBusy(`link-${p.provider}`)}>
                <input type="hidden" name="authenticity_token" value={csrfToken()} />
                <input type="hidden" name="link" value="1" />
                <button type="submit" className={primaryButton} disabled={!!busy}><Link2 className="h-4 w-4" /> {linking ? "Opening…" : `Link ${p.label}`}</button>
              </form>
            );
          } else {
            action = <span className="text-xs text-slate-500 dark:text-neutral-400">Not available here</span>;
          }
          return (
            <Row key={p.provider} icon={<Mark className="h-[18px] w-[18px]" />} title={p.label}
              detail={p.linked ? `Sign in with ${p.label}` : `Not linked`} status={p.linked ? <Linked /> : null} action={action} />
          );
        })}
        <div className="space-y-2 p-4">
          {message && <p role="status" className="flex items-start gap-1.5 text-sm text-emerald-700 dark:text-emerald-300"><CircleCheck className="mt-0.5 h-4 w-4 shrink-0" /> {message}</p>}
          <ErrorNote error={error} />
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            If you use Apple's "Hide My Email", Apple gives us a different address from yours, so signing in with Apple can't find this
            account on its own. Link Apple here and it always opens this account. Link and Unlink take effect right away, without Save changes.
          </p>
        </div>
      </Card>
      {data.pending && <MoveChoice pending={data.pending} busy={busy} run={run} />}
    </Tray>
  );
}

function Linked({ children = "Linked" }) {
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"><CircleCheck className="h-3.5 w-3.5" /> {children}</span>;
}

function Row({ icon, title, detail, status, action }) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-slate-900 dark:bg-neutral-800 dark:text-white">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
          {status}
        </div>
        <p className="truncate text-xs text-slate-500 dark:text-neutral-400">{detail}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Just linked a Google or Apple account that's already on another RecoveryBot account
function MoveChoice({ pending, busy, run }) {
  const { label, other } = pending;
  const joined = new Date(`${other.joined}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  const move = (deleteOther) => {
    if (deleteOther && !window.confirm(`Delete the other account (${other.email}) for good and link ${label} here? This can't be undone.`)) return;
    run("move", () => api("/sign_in_methods/move", { method: "POST", body: { delete_other: deleteOther } }));
  };
  const keep = () => run("keep", () => api("/sign_in_methods/move", { method: "DELETE" }));

  return (
    <Card className="mt-3 space-y-3 p-4 ring-amber-300 dark:ring-amber-700">
      <p className="flex items-start gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> That {label} account already has its own RecoveryBot account
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-neutral-50 p-3 text-sm dark:bg-neutral-800/60">
        <dt className="text-slate-500 dark:text-neutral-400">Name</dt><dd className="text-slate-900 dark:text-white">{other.name}</dd>
        <dt className="text-slate-500 dark:text-neutral-400">Email</dt><dd className="break-all text-slate-900 dark:text-white">{other.email}</dd>
        <dt className="text-slate-500 dark:text-neutral-400">Joined</dt><dd className="text-slate-900 dark:text-white">{joined}</dd>
        <dt className="text-slate-500 dark:text-neutral-400">Has</dt>
        <dd className="text-slate-900 dark:text-white">{plural(other.notes, "note")}, {plural(other.groups, "group")}, {plural(other.chips, "chip")}</dd>
      </dl>
      {pending.blocked ? (
        <p className="text-sm text-slate-600 dark:text-neutral-400">
          That account added readings to the archive, so it can't be deleted here. Please use the <a href="/contact" className="text-accent hover:underline">Contact page</a> and we'll sort it out with you.
        </p>
      ) : pending.must_delete ? (
        <p className="text-sm text-slate-600 dark:text-neutral-400">
          {label} is that account's only way to sign in, so moving it here means deleting that account and what only it had. Nothing
          from it is copied over. If you'd rather keep it, choose Keep both.
        </p>
      ) : (
        <p className="text-sm text-slate-600 dark:text-neutral-400">
          That account also signs in with {other.ways.filter((w) => w !== label).join(" and ")}, so it stays as it is. {label} moves to this account.
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={quietButton} disabled={!!busy} onClick={keep}>Keep both</button>
        {!pending.blocked && (pending.must_delete ? (
          <button type="button" className={dangerButton} disabled={!!busy} onClick={() => move(true)}>{busy === "move" ? "Working…" : `Delete it and link ${label} here`}</button>
        ) : (
          <button type="button" className={primaryButton} disabled={!!busy} onClick={() => move(false)}>{busy === "move" ? "Working…" : `Move ${label} here`}</button>
        ))}
      </div>
    </Card>
  );
}
