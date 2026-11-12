# RecoveryBot for iPhone and Android

The apps are a [Capacitor](https://capacitorjs.com) shell around the live site,
https://recoverybot.hmblbot.com. Every CapRover deploy reaches them straight away. Only changes
in this folder (plugins, icons, native code) need a new build of the app.

How the site knows it's in the app: the app adds `RecoveryBotApp/1.0 (iOS)` or
`RecoveryBotApp/1.0 (Android)` to its user agent. Rails reads it in `NativeAppRequest`
(`native_app?`), and the page loads `entrypoints/native_app.js`, which:

- opens other sites in an in-app browser sheet instead of leaving the app
- sends Share, Save and Download to the phone's share sheet (Save Image, Save to Files…)
- prints with the phone's own print screen (`Printer`, our own plugin in `AppDelegate.swift`
  and `PrinterPlugin.java`)
- matches the status bar to light/dark mode, and makes Android's back gesture go back a page
- turns on the site's pull to refresh

In the app the site also hides: "Continue with Google" (Google blocks its sign-in page inside
apps), web push settings, the Get the app / Install page, and on iPhone the Donate buttons
(Apple only allows tips through in-app purchase).

## Run it on your iPhone (free Apple ID is fine)

You need a Mac with Xcode 16 or newer and Node 22.

1. `cd mobile && npm install && npx cap sync ios`
2. `npx cap open ios` opens the project in Xcode.
3. Xcode > Settings > Accounts: add your Apple ID.
4. Click **App** in the left column, then the **Signing & Capabilities** tab. Tick
   "Automatically manage signing" and pick your team ("Your Name (Personal Team)").
5. Plug in your iPhone. On the phone, turn on Settings > Privacy & Security > Developer Mode
   (it restarts).
6. Pick your iPhone at the top of Xcode and press Run (▶).
7. The first time, the phone says the developer isn't trusted: Settings > General >
   VPN & Device Management > your Apple ID > Trust. Then open RecoveryBot.

With a free Apple ID the app stops opening after 7 days; press Run again to renew it. A paid
Apple Developer account removes that and is needed for TestFlight, push notifications and the
App Store.

## Run it on an Android phone

1. Install Android Studio.
2. `cd mobile && npm install && npx cap sync android && npx cap open android`
3. On the phone: Settings > About phone > tap Build number 7 times, then Developer options >
   USB debugging. Plug it in, pick it at the top of Android Studio, press Run.

Build > Build App Bundle(s) / APK(s) > Build APK(s) makes a file you can send to someone to
install.

## Try it against your own computer

`CAP_SERVER_URL=http://192.168.1.20:3000 npx cap sync` (your Mac's address on Wi-Fi, with
`bin/rails s -b 0.0.0.0`), then Run again. Run `npx cap sync` with no address to point it
back at the live site.

## Icons and splash screens

Made from `assets/` (the robot mark on the brand blue). After changing those pictures:
`npx @capacitor/assets generate --iconBackgroundColor '#4c7ba6' --splashBackgroundColor '#f5f5f4' --splashBackgroundColorDark '#292524'`
and delete the `icons/` folder and `www/manifest.json` it also makes.

## Widgets

Two Home Screen widgets: **Day count** (also on the iPhone Lock Screen) and **Favorite chip**.
The site hands them their data once it's deployed (`app/javascript/lib/appWidgets.js`), so they
show a "sign in" note until you open the app signed in.

- iPhone: the `RecoveryBotWidgets` extension shares an App Group (`group.com.hmblbot.recoverybot`)
  with the app. In Xcode, pick your team for both the App and RecoveryBotWidgets targets
  (Signing & Capabilities). Long-press the Home Screen, tap Edit > Add Widget, find RecoveryBot.
- Android: long-press the home screen, Widgets, RecoveryBot.

## Not in the app yet

Native push notifications and Face ID lock. Google and Apple sign-in and links that open the
app are built, and need the console setup in [SIGN_IN_SETUP.md](SIGN_IN_SETUP.md). See the plan:
https://claude.ai/artifact/D8Aft6jCHPzgLJTwj8kmEj
