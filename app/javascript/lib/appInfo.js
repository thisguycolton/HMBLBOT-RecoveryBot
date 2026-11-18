// Which build of the iPhone or Android app this is, from the app's App plugin (@capacitor/app):
// { platform: "ios" | "android", version: "1.0.5", build: 6 }. In a browser it's
// { platform: "web" }. An app too old to have the plugin (iPhone build 1) gives build 0, so it
// counts as older than every build (SiteNotice#shown_to?, Account settings > App info).
import { callPlugin, hasPlugin, nativePlatform } from "./nativeApp";

let cached = null;

export function appInfo() {
  if (cached) return cached;
  const platform = nativePlatform();
  if (!platform) {
    cached = Promise.resolve({ platform: "web" });
  } else if (!hasPlugin("App")) {
    cached = Promise.resolve({ platform, version: null, build: 0 });
  } else {
    cached = callPlugin("App", "getInfo")
      .then((info) => ({ platform, version: info?.version || null, build: parseInt(info?.build, 10) || 0 }))
      .catch(() => ({ platform, version: null, build: 0 }));
  }
  return cached;
}

export const PLATFORM_NAMES = { web: "Website", ios: "iPhone", android: "Android" };
