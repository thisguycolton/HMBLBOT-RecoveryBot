// Web Push in the browser: the service worker (/service-worker.js), this device's subscription,
// and what kind of device it is, for the install instructions (/install) and account settings.
import { api } from "../components/groups/lib";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// Opened from the home screen rather than in a browser tab
export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

// "ios" (iPhone and iPad, which reports itself as a Mac), "android", "mac", "windows" or "other"
export function platform() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  if (/Windows/i.test(ua)) return "windows";
  return "other";
}

// iPhone and iPad only show web notifications for a site added to the Home Screen
export const needsInstallForPush = () => platform() === "ios" && !isStandalone();

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch(() => null);
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

function keyBytes(base64url) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// Asks for permission (has to come from a tap), subscribes and tells the server
export async function turnOnPush(publicKey) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    const error = new Error(permission === "denied" ? "blocked" : "Notifications weren't allowed.");
    error.code = permission;
    throw error;
  }
  const reg = (await registerServiceWorker()) || (await navigator.serviceWorker.ready);
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with another key (the server's keys changed) can't be used
  if (sub && sub.options?.applicationServerKey) {
    const had = new Uint8Array(sub.options.applicationServerKey);
    const want = keyBytes(publicKey);
    if (had.length !== want.length || had.some((b, i) => b !== want[i])) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  return api("/push_subscriptions", { method: "POST", body: { subscription: sub.toJSON() } });
}

export async function turnOffPush() {
  const sub = await currentSubscription();
  if (!sub) return null;
  const state = await api("/push_subscriptions", { method: "DELETE", body: { endpoint: sub.endpoint } });
  await sub.unsubscribe().catch(() => {});
  return state;
}

// After logging out (config/initializers/web_push.rb leaves a forget_push cookie), this browser
// shouldn't keep getting the last account's notifications. Just being signed out isn't enough:
// a session that ran out (or a home-screen app that lost it) keeps them.
export async function forgetPushAfterSignOut() {
  if (!/(?:^|;\s*)forget_push=/.test(document.cookie)) return;
  document.cookie = "forget_push=; Max-Age=0; path=/; SameSite=Lax";
  if (document.body.dataset.currentUser === "true") return;
  const sub = await currentSubscription().catch(() => null);
  if (!sub) return;
  await api("/push_subscriptions", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

// The number on the home-screen icon follows the bell
export function setAppBadge(unread) {
  if (!("setAppBadge" in navigator)) return;
  (unread > 0 ? navigator.setAppBadge(unread) : navigator.clearAppBadge()).catch(() => {});
}

// Chrome and Edge offer their own install prompt; it's caught early so a button can show it later
let installPrompt = null;
const listeners = new Set();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPrompt = e;
    listeners.forEach((fn) => fn(e));
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    listeners.forEach((fn) => fn(null));
  });
}
export const getInstallPrompt = () => installPrompt;
export function onInstallPrompt(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
