// Notifications in the iPhone and Android apps: Firebase Cloud Messaging, through the app's
// FirebaseMessaging plugin (@capacitor-firebase/messaging in mobile/). The app's token goes to
// the server (Api::PushSubscriptionsController#app_create), which sends every Notification to
// it (FcmSender). The token is kept here too, so turning off, logging out and settings can say
// which device this is.
import { api } from "../components/groups/lib";
import { callPlugin, hasPlugin, nativePlatform, onPlugin } from "./nativeApp";

const KEY = "hb-device-token";
// Set when they turn the app's notifications off in settings (not when they log out), so the
// app doesn't sign this phone up again on its own
const OFF_KEY = "hb-device-push-off";
const turnedOff = () => { try { return localStorage.getItem(OFF_KEY) === "1"; } catch { return false; } };
const setTurnedOff = (off) => { try { if (off) localStorage.setItem(OFF_KEY, "1"); else localStorage.removeItem(OFF_KEY); } catch { /* private mode */ } };

export const nativePushSupported = () => hasPlugin("FirebaseMessaging");

export const storedToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const store = (token) => { try { if (token) localStorage.setItem(KEY, token); else localStorage.removeItem(KEY); } catch { /* private mode */ } };

// "granted", "denied" or "prompt"
export async function nativePermission() {
  try { return (await callPlugin("FirebaseMessaging", "checkPermissions")).receive; } catch { return "prompt"; }
}

const appVersion = () => (navigator.userAgent.match(/RecoveryBotApp\/([\d.]+)/) || [])[1];

// On iPhone, Firebase can only make a token once Apple has given the app its own push address,
// which comes a moment after launch (and the first time, after permission). Asking too soon
// fails with "No APNS token specified before fetching FCM Token", so wait for it and ask again.
const notYet = (e) => /APNS token/i.test(e?.message || "");
async function fetchToken(tries = 8) {
  for (let i = 0; ; i += 1) {
    try {
      return (await callPlugin("FirebaseMessaging", "getToken")).token;
    } catch (e) {
      if (!notYet(e) || i >= tries) throw e;
      await new Promise((resolve) => {
        let stop = null;
        const done = () => { setTimeout(() => stop?.(), 0); resolve(); };
        stop = onPlugin("FirebaseMessaging", "apnsTokenReceived", done);
        setTimeout(done, 1500);
      });
    }
  }
}

// Asks for permission (from a tap), gets this install's token and tells the server
export async function turnOnNativePush() {
  const { receive } = await callPlugin("FirebaseMessaging", "requestPermissions");
  if (receive !== "granted") {
    const error = new Error(receive === "denied" ? "blocked" : "Notifications weren't allowed.");
    error.code = receive === "denied" ? "denied" : "default";
    throw error;
  }
  let token;
  try {
    token = await fetchToken();
  } catch (e) {
    if (notYet(e)) throw new Error("Your phone hasn't connected the app to Apple's notifications yet. Wait a minute, then try again.");
    throw e;
  }
  if (!token) throw new Error("The phone didn't give the app a notification address. Try again in a minute.");
  const state = await api("/push_subscriptions/app", { method: "POST", body: { token, platform: nativePlatform(), app_version: appVersion() } });
  store(token);
  setTurnedOff(false);
  return state;
}

// From the switch in settings (byThem), or logging out, which doesn't count as turning them off:
// signing in again brings them back
export async function turnOffNativePush({ byThem = true } = {}) {
  const token = storedToken();
  store(null);
  if (byThem) setTurnedOff(true);
  const state = token ? await api("/push_subscriptions/app", { method: "DELETE", body: { token } }).catch(() => null) : null;
  await callPlugin("FirebaseMessaging", "deleteToken").catch(() => {});
  return state;
}

// Every app page, signed in: the server gets this phone's token whenever the phone allows the
// app's notifications, so it can reach every device they use. That covers a token Firebase
// replaced, this phone now signed in to another account (the token moves there), signing in again
// after logging out, an Android phone that allowed notifications without asking, and a token
// the app forgot. Not when they turned notifications off in the app's settings.
export async function refreshNativeToken(token) {
  if (!document.body?.dataset.widget) return; // data-widget is blank when signed out
  const had = storedToken();
  if (!had && (turnedOff() || (await nativePermission()) !== "granted")) return;
  const next = token || (await fetchToken(3).catch(() => null));
  if (!next) return;
  const day = new Date().toISOString().slice(0, 10);
  const mark = `${next}|${day}`;
  if (next === had && sessionStorage.getItem("hb-device-token-sent") === mark) return;
  await api("/push_subscriptions/app", { method: "POST", body: { token: next, platform: nativePlatform(), app_version: appVersion() } })
    .then(() => { store(next); sessionStorage.setItem("hb-device-token-sent", mark); })
    .catch(() => {});
}

// Logged out (config/initializers/web_push.rb leaves a forget_push cookie): this phone stops
// getting that account's notifications, the same rule as Web Push (#91). A session that just ran
// out keeps them. Runs on every page in the app (native_app.js); lib/push.js leaves the app to it.
export async function forgetNativePushAfterSignOut() {
  if (!/(?:^|;\s*)forget_push=/.test(document.cookie)) return;
  if (document.body?.dataset.widget) return; // signed in again already
  document.cookie = "forget_push=; Max-Age=0; path=/; SameSite=Lax";
  if (storedToken()) await turnOffNativePush({ byThem: false });
}
