// The app lock in the iPhone and Android apps: Face ID, Touch ID, or a fingerprint or face, with
// the phone's passcode as the fallback, before the app shows anything (AppLock in
// mobile/ios/App/App/AppDelegate.swift, AppLockPlugin.java on Android). The app keeps the setting
// itself; nothing about it reaches the server, and the face or fingerprint never leaves the phone.
// App builds from before it have no AppLock plugin, so everything here skips them.
import { callPlugin, hasPlugin, nativePlatform } from "./nativeApp";

export const appLockHere = () => hasPlugin("AppLock");

// { available, kind, enabled, after }
export const appLockStatus = () => callPlugin("AppLock", "status");

// Asks for Face ID (or the like) first; rejects with "Canceled" when they back out
export const enableAppLock = (after = 0) => callPlugin("AppLock", "enable", { after });
export const disableAppLock = () => callPlugin("AppLock", "disable");
export const setAppLockAfter = (after) => callPlugin("AppLock", "setAfter", { after });

// What the phone checks with, in words: "Face ID", "fingerprint", "passcode"…
export function appLockMethod(kind) {
  const android = nativePlatform() === "android";
  return {
    faceID: "Face ID",
    touchID: "Touch ID",
    opticID: "Optic ID",
    fingerprint: "your fingerprint",
    face: "face unlock",
    biometric: android ? "your fingerprint or face" : "Face ID",
    passcode: android ? "your screen lock" : "your passcode",
  }[kind] || "your screen lock";
}

export const APP_LOCK_AFTER = [
  { value: 0, label: "Right away" },
  { value: 60, label: "After 1 minute away" },
  { value: 300, label: "After 5 minutes away" },
  { value: 900, label: "After 15 minutes away" },
];

// Every page: whether someone is signed in (the layout's data-widget is "" when nobody is), so
// a signed-out app isn't locked. Logging out (the forget_push cookie it leaves) turns the lock
// off, as it does notifications: the next person to sign in here chooses for themselves.
export function syncAppLock() {
  if (!appLockHere()) return;
  const widget = document.body?.dataset.widget;
  if (widget === undefined) return; // not one of the site's own pages (the offline page)
  if (!widget && /(?:^|;\s*)forget_push=/.test(document.cookie)) disableAppLock().catch(() => {});
  callPlugin("AppLock", "signedIn", { signedIn: Boolean(widget) }).catch(() => {});
}
