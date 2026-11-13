import type { CapacitorConfig } from "@capacitor/cli";

// The RecoveryBot iPhone and Android apps load the live site, so every CapRover deploy reaches
// them without a store update. Only changes in this folder (plugins, icons, native code) need a
// new build. To try the apps against a local server: CAP_SERVER_URL=http://192.168.x.x:3000 npx cap sync
const url = process.env.CAP_SERVER_URL || "https://recoverybot.hmblbot.com";
const VERSION = "1.0";

const config: CapacitorConfig = {
  appId: "com.hmblbot.recoverybot",
  appName: "RecoveryBot",
  // Only the offline page lives in the app itself
  webDir: "www",
  server: {
    url,
    cleartext: url.startsWith("http://"),
    // Shown when the site can't be reached (no signal, or the server is down)
    errorPath: "offline.html",
  },
  // How the site knows it's in the app (NativeAppRequest, lib/nativeApp.js). Keep the
  // "RecoveryBotApp/<version> (iOS|Android)" shape: both of those match on it.
  ios: {
    appendUserAgent: `RecoveryBotApp/${VERSION} (iOS)`,
    // The site doesn't draw under the status bar or home indicator itself, so the web view
    // keeps its content clear of them
    contentInset: "automatic",
    backgroundColor: "#f5f5f4",
  },
  android: {
    appendUserAgent: `RecoveryBotApp/${VERSION} (Android)`,
    backgroundColor: "#f5f5f4",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#f5f5f4",
      showSpinner: false,
    },
    Keyboard: {
      // The page shrinks to fit above the keyboard; the chat box's own fit (useKeyboardFit)
      // reads visualViewport, which follows it
      resize: "native",
      resizeOnFullScreen: true,
    },
    // Android: keep the page clear of the status and navigation bars, and give the page
    // --safe-area-inset-* values that are right on older Android web views
    SystemBars: {
      insetsHandling: "css",
    },
    // Notifications (lib/nativePush.js on the site): on iPhone, one that comes while the app is
    // open still shows as a banner. Android hands those to the page, which shows a toast.
    FirebaseMessaging: {
      presentationOptions: ["alert", "sound"],
    },
  },
  // Keeps Swift Package Manager from seeing two packages named "firebase-ios-sdk"
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          "@capacitor-firebase/messaging": { symlink: true },
        },
      },
    },
  },
};

export default config;
