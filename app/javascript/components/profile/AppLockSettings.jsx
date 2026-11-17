import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { APP_LOCK_AFTER, appLockHere, appLockMethod, appLockStatus, disableAppLock, enableAppLock, setAppLockAfter } from "../../lib/appLock";
import { nativePlatform } from "../../lib/nativeApp";
import { labelClass, selectClass } from "../ui/styles";
import Toggle from "../ui/Toggle";
import { Card, ErrorNote, Tray } from "../groups/ui";

// Account settings > This phone, in the iPhone and Android apps: lock RecoveryBot behind Face ID
// (Touch ID, a fingerprint or face, or the phone's passcode). They stay signed in; the app covers
// itself when it's left and asks again when it's opened. Turning it on asks first, so nobody
// turns it on with a face the phone won't know. Kept by the app (lib/appLock.js); hidden in a
// browser and in app builds from before the lock.
const SETUP = {
  ios: "Set up Face ID or a passcode in the iPhone's Settings > Face ID & Passcode first.",
  android: "Set up a screen lock (PIN, pattern or password) in the phone's Settings > Security first.",
};

// What never leaves the phone, by what it checks with
const STAYS = {
  faceID: "Your face stays on your phone. RecoveryBot only hears whether it matched.",
  opticID: "Your eyes stay on your phone. RecoveryBot only hears whether they matched.",
  face: "Your face stays on your phone. RecoveryBot only hears whether it matched.",
  touchID: "Your fingerprint stays on your phone. RecoveryBot only hears whether it matched.",
  fingerprint: "Your fingerprint stays on your phone. RecoveryBot only hears whether it matched.",
  biometric: "Your face or fingerprint stays on your phone. RecoveryBot only hears whether it matched.",
  passcode: "RecoveryBot never sees your passcode. The phone only tells it whether it matched.",
};

export default function AppLockSettings() {
  const shown = appLockHere();
  const [lock, setLock] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!shown) return;
    appLockStatus().then(setLock, () => setLock({ available: false, kind: "none", enabled: false, after: 0 }));
    // Face ID set up (or the passcode turned off) in Settings while they were away
    const refresh = () => appLockStatus().then(setLock, () => {});
    window.addEventListener("app:resume", refresh);
    return () => window.removeEventListener("app:resume", refresh);
  }, [shown]);

  if (!shown || !lock) return null;

  const method = appLockMethod(lock.kind);
  const named = method.startsWith("your ") ? method.slice(5) : method;
  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const toggle = async (on) => {
    setBusy(true);
    setError(null);
    try {
      setLock(await (on ? enableAppLock(lock.after) : disableAppLock()));
      flash();
    } catch (e) {
      // Backing out of the Face ID prompt leaves it off without a fuss
      if (e?.message !== "Canceled") setError(e?.message === "Unavailable" ? SETUP[nativePlatform()] : "The app lock couldn't be changed.");
    } finally {
      setBusy(false);
    }
  };

  const changeAfter = async (after) => {
    const before = lock;
    setLock({ ...lock, after });
    setError(null);
    try {
      setLock(await setAppLockAfter(after));
      flash();
    } catch {
      setLock(before);
      setError("That couldn't be changed.");
    }
  };

  return (
    <section id="app-lock" className="scroll-mt-40">
      <Tray label="App lock">
        <Card className="space-y-4 p-4">
          <p className="text-sm text-slate-600 dark:text-neutral-400">
            Keep RecoveryBot private on this phone. You stay signed in, and the app asks for {method} each time it opens.
            {lock.kind !== "passcode" && ` If ${named} doesn't work, you can use your ${nativePlatform() === "android" ? "PIN, pattern or password" : "passcode"}, or sign out and sign in again.`}
          </p>
          <Toggle checked={lock.enabled} disabled={busy || (!lock.available && !lock.enabled)} onChange={toggle}
            label={<span className="inline-flex items-center gap-2">Lock with {named}{saved && <Check className="h-3.5 w-3.5 text-emerald-600" aria-label="Saved" />}</span>}
            description={!lock.available ? SETUP[nativePlatform()] : STAYS[lock.kind] || STAYS.biometric} />
          {lock.enabled && (
            <div className="max-w-xs">
              <label htmlFor="app-lock-after" className={labelClass}>Lock</label>
              <select id="app-lock-after" className={selectClass} value={lock.after} onChange={(e) => changeAfter(Number(e.target.value))}>
                {APP_LOCK_AFTER.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
          <ErrorNote error={error} />
        </Card>
      </Tray>
    </section>
  );
}
