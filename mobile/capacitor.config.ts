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
    // Every plugin but @capacitor/status-bar, which only the iPhone app uses: on Android its
    // Window.setStatusBarColor calls are deprecated (Play warns) and do nothing from Android 15
    // on. AppBarsPlugin colors the bars instead. Add new plugins here too, or Android leaves
    // them out.
    includePlugins: [
      "@capacitor-firebase/messaging",
      "@capacitor/app",
      "@capacitor/browser",
      "@capacitor/filesystem",
      "@capacitor/haptics",
      "@capacitor/keyboard",
      "@capacitor/share",
      "@capacitor/splash-screen",
    ],
  },
  plugins: {
    // Up until the site's first page is there (native_app.js hides it, then shows its own
    // shimmering robot until everything has loaded), at most 8 seconds
    SplashScreen: {
      launchShowDuration: 8000,
      launchAutoHide: true,
      launchFadeOutDuration: 250,
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
