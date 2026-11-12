# Sign-in and app links: what to set up

The code is in place. Each piece turns on once its console setting and CapRover variable exist.
Until then the website and apps just don't show that button, and links keep opening in the
browser.

You need the **paid Apple Developer account** for everything Apple below. A free Apple ID
can't sign builds that use Sign in with Apple or Associated Domains (Universal Links).

So that a free Apple ID can still put the app on your iPhone, **Debug** builds (what Xcode's
Run button makes) use `App/App-Personal.entitlements`, which leaves those two out: in them, the
Apple button and app links don't work, but everything else, widgets included, does. **Release**
builds (Archive, TestFlight, the App Store) use `App/App.entitlements` with everything. Once
the paid account is set up, point Debug at the full file too: App target > Build Settings >
Code Signing Entitlements > Debug: `App/App.entitlements`.

## 1. Apple Developer account (developer.apple.com > Certificates, Identifiers & Profiles)

1. **Team ID**: the 10 characters at the top right of the account page. In CapRover, set
   `APPLE_TEAM_ID` to it.
2. **App ID** `com.hmblbot.recoverybot`: turn on **Sign in with Apple**, **Associated Domains**
   and **App Groups** (group `group.com.hmblbot.recoverybot`). Make the widget's App ID
   `com.hmblbot.recoverybot.widgets` with App Groups (the same group). Xcode does this for you
   when you pick the team on both targets and press "Fix" if it asks.
3. **Services ID**, for Sign in with Apple on the website: Identifiers > + > Services IDs, for
   example `com.hmblbot.recoverybot.web`. Turn on Sign in with Apple, then Configure:
   - Primary App ID: com.hmblbot.recoverybot
   - Domains: `recoverybot.hmblbot.com`
   - Return URLs: `https://recoverybot.hmblbot.com/users/auth/apple/callback`

   In CapRover, set `APPLE_SERVICES_ID` to it. No key or secret is needed: the site checks the
   signed token Apple sends back.

## 2. Google Cloud console (the project that already has the website's OAuth client)

1. **iOS client**: APIs & Services > Credentials > Create credentials > OAuth client ID > iOS,
   bundle ID `com.hmblbot.recoverybot`. In CapRover, set `GOOGLE_IOS_CLIENT_ID` to its client ID
   (`…apps.googleusercontent.com`). The app opens Google's page in the iPhone's sign-in sheet
   and returns to `com.googleusercontent.apps.<id>:/oauth2redirect` by itself. Nothing to add
   in Xcode.
2. **Android client**: Create credentials > OAuth client ID > Android, package
   `com.hmblbot.recoverybot`, and the SHA-1 of each signing key: the debug key while testing
   (`keytool -list -v -keystore ~/.android/debug.keystore -storepass android`) and Google
   Play's app signing key later (Play Console > Setup > App signing). The Android app signs in
   for the **website's** client (`GOOGLE_CLIENT_ID`, already set), so there's nothing new to set
   in CapRover for it.
3. The OAuth consent screen should list the privacy policy, https://recoverybot.hmblbot.com/privacy.

## 3. App links (links to the site open the apps)

- **iPhone (Universal Links)**: once `APPLE_TEAM_ID` is set, https://recoverybot.hmblbot.com/.well-known/apple-app-site-association
  names the app. The app already claims `applinks:recoverybot.hmblbot.com`. Apple's servers
  cache the file, so a new install picks it up, and it can take a day after the first deploy.
- **Android (App Links)**: in CapRover, set `ANDROID_CERT_SHA256` to the SHA-256 fingerprints
  of the signing keys, comma separated (the same keytool command shows them, and so does Play
  Console > App signing). Check it with
  `adb shell pm get-app-links com.hmblbot.recoverybot`, which should say `verified`.
- Sign-in callbacks (`/users/auth/…`) and file downloads stay in the browser on iPhone. Android
  can't leave paths out, so the app ignores a sign-in callback it's handed.

## After setting the variables

Redeploy (or restart the app in CapRover) so the site reads them. Then rebuild the apps in
Xcode / Android Studio once, since the entitlements and Android's link list changed.

## CapRover variables, all together

| Variable | What |
| --- | --- |
| `APPLE_TEAM_ID` | Apple team ID, for Universal Links and iPhone password autofill |
| `APPLE_SERVICES_ID` | Services ID for Sign in with Apple on the website |
| `APPLE_BUNDLE_ID` | Optional, defaults to `com.hmblbot.recoverybot` |
| `GOOGLE_IOS_CLIENT_ID` | Google iOS OAuth client, for the iPhone app's Google sheet |
| `ANDROID_CERT_SHA256` | Android signing key SHA-256 fingerprints, comma separated |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Already set up for the website; the Android app uses the client ID |
