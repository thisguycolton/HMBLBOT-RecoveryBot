# Google Play: what's left to publish the Android app

The app (`com.hmblbot.recoverybot`) builds an Android App Bundle (`.aab`), which is what Play
takes. It targets Android 16 (SDK 36), which Play requires of new apps.

## 1. The upload key (once, kept safe)

Play re-signs the app with its own key (Play App Signing); you sign each upload with an
**upload key** that only you hold. Make it once, on the Mac:

```bash
keytool -genkeypair -v -keystore ~/.android/recoverybot-upload.jks -alias upload \
  -keyalg RSA -keysize 4096 -validity 10000
```

It asks for a password and a name. Keep the `.jks` file and the password in your password
manager or a backup: without them you'd have to ask Google to reset the upload key.

Then make `mobile/android/keystore.properties` (git ignores it):

```properties
storeFile=/Users/<you>/.android/recoverybot-upload.jks
storePassword=<the password>
keyAlias=upload
keyPassword=<the password>
```

## 2. Build the bundle

```bash
cd mobile && npx cap sync android && cd android && ./gradlew bundleRelease
```

The bundle is `mobile/android/app/build/outputs/bundle/release/app-release.aab`. Each upload
needs a higher `versionCode` (`mobile/android/app/build.gradle`); `versionName` is what people see.

## 3. Play Console

A personal developer account made after November 2023 has to run a **closed test with at
least 12 testers for 14 days in a row** before it can publish to everyone. Start that early.

1. Finish the account checks (identity, a real Android device signed in to the Play Console
   app, phone number).
2. **Create app**: RecoveryBot, app, free.
3. **Set up your app** (Dashboard), each item:
   - Privacy policy: `https://recoverybot.hmblbot.com/privacy`
   - App access: sign-in is needed, so give a demo account with real-looking data
   - Ads: no
   - Content rating questionnaire: user chat, and talk of alcohol and drugs (recovery)
   - Target audience: 18+
   - Data safety: email, name, user ID, photos and videos, messages and other content, device
     ID (the push token); all for app functionality, none shared or sold, encrypted in transit;
     people can ask for deletion. **Account deletion URL**: Play wants a web page that explains
     how to delete an account (Profile > Delete account), reachable without the app
   - Health apps declaration, if asked: not a medical app
4. **Store listing**: name, short and full description, icon (512px), feature graphic
   (1024x500), phone screenshots.
5. **Testing > Closed testing**: create a track, add testers (an email list or Google Group),
   upload the `.aab`, roll out. Turn on **Play App Signing** when it asks.
6. **App integrity > App signing**: copy the SHA-256 of the **app signing key** and of the
   **upload key** into CapRover's `ANDROID_CERT_SHA256`, comma separated with the debug key's,
   so links open the app (App Links, SIGN_IN_SETUP.md). Add the app signing key's SHA-1 and
   SHA-256 to the Android app in Firebase too (Project settings), and to the Google Android
   OAuth client if "Continue with Google" is used in the app.
7. After the 14 days: **Production** > create release > send for review.
