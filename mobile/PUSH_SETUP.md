# Notifications in the apps: Apple Push Key and Firebase

The iPhone and Android apps get notifications through **Firebase Cloud Messaging** (Google).
The server sends each one to Firebase (`app/services/fcm_sender.rb`), and Firebase passes it to
Apple for iPhones and straight to Android phones. Until the steps below are done, the apps
simply don't offer notifications; nothing breaks.

You need the **paid Apple Developer account** for the Apple part. A free Apple ID can't make a
push key or sign a build that gets notifications. Debug builds use `App/App-Personal.entitlements`,
which leaves push out (see [SIGN_IN_SETUP.md](SIGN_IN_SETUP.md)); once the paid account is set up,
point Debug at `App/App.entitlements`, which has it.

Takes about 20 minutes. Do the steps in order.

## 1. The Apple Push Key (developer.apple.com)

This is one key for the whole team. It never expires, and you can only download it once.

1. Sign in at https://developer.apple.com/account and open **Certificates, Identifiers & Profiles**.
2. **Turn on push for the app**: Identifiers > `com.hmblbot.recoverybot` > tick
   **Push Notifications** > Save. (Leave the certificate buttons alone; the key replaces them.)
3. **Make the key**: Keys > the **+** button.
   - Key Name: `RecoveryBot Push`
   - Tick **Apple Push Notifications service (APNs)**, then **Configure** beside it:
     Environment **Sandbox & Production**, Key Restriction **Team Scoped (All Topics)**. Save.
   - Continue > Register.
4. **Download** the `.p8` file (`AuthKey_XXXXXXXXXX.p8`). Apple lets you download it only this
   once, so keep it somewhere safe, like your password manager. Don't put it in the repo.
5. Write down two things:
   - **Key ID**: the 10 characters on the key's page (also in the file name).
   - **Team ID**: the 10 characters at the top right of the account page, under your name.

## 2. The Firebase project (console.firebase.google.com)

1. **Add project** > name it `RecoveryBot`. Turn **Google Analytics off** (the apps don't use it).
2. **Add the iPhone app**: on the project's home, the iOS button.
   - Apple bundle ID: `com.hmblbot.recoverybot`. App nickname: `RecoveryBot iOS`.
   - Download **GoogleService-Info.plist**. Skip the remaining steps (the SDK is already in the app).
3. **Add the Android app**: Add app > Android.
   - Package name: `com.hmblbot.recoverybot`. App nickname: `RecoveryBot Android`.
   - Download **google-services.json**. Skip the remaining steps.
4. **Give Firebase the Apple Push Key**: the gear > Project settings > **Cloud Messaging** tab >
   Apple app configuration > APNs Authentication Key > **Upload**. Pick the `.p8` file and fill in
   the Key ID and Team ID from step 1.
5. **A key for the server**: Project settings > **Service accounts** tab > **Generate new private
   key** > Generate key. A JSON file downloads. This is a secret: it lets anyone send
   notifications as RecoveryBot.
   - On the same Cloud Messaging tab, **Firebase Cloud Messaging API (V1)** should say Enabled
     (new projects have it on). If it says Disabled, click its menu and enable it.

## 3. The server (CapRover)

recoverybot app > App Configs > Environmental Variables:

- `FIREBASE_SERVICE_ACCOUNT` = the whole service account JSON file from step 2.5, pasted as is.
  If CapRover mangles it (it's several lines), paste it base64-encoded instead:
  `base64 -i ~/Downloads/recoverybot-*.json | pbcopy` and paste. Both work.

Save & Update. Account settings in the apps now offer "Send notifications to this phone".

## 4. The apps (on the Mac)

1. Put the two Firebase files in place:
   - `google-services.json` goes in `mobile/android/app/` (the build picks it up by itself).
   - `GoogleService-Info.plist`: in Xcode, drag it into the **App** folder (beside `Info.plist`),
     tick **Copy items if needed** and the **App** target (not RecoveryBotWidgets).
   Neither file is secret (they only name the Firebase project), so commit both; the Xcode
   project then points at a file every checkout has.
2. `cd mobile && npm install && npx cap sync`
3. iPhone: Signing & Capabilities on the App target should now list **Push Notifications**
   (from `App.entitlements`). Run it on your phone (the Simulator can't get them).
4. In the app: Account settings > Notifications on this device > turn it on > Allow > **Send a test**.

## How it works

- Turning it on asks the phone for permission, gets this install's Firebase token
  (`lib/nativePush.js`) and posts it to `/api/push_subscriptions/app`, which saves a `DeviceToken`.
- Every `Notification` (the bell) also goes to the account's app installs, for the kinds they
  left on (`WebPushJob` > `FcmSender`). Firebase and Apple can read what a notification says (its
  title and the line under it, the same words as the bell), so the privacy policy says so.
- Tapping one opens `/notifications/:id/open`, which marks it read and goes to its page. On
  Android, one that comes while the app is open shows as a toast; on iPhone, as a banner.
- Logging out drops that phone's token (the `forget_push` cookie, same rule as Web Push). A
  session that just ran out keeps it. A token Firebase says is gone is deleted.

## If it doesn't work

- **No switch in settings**: `FIREBASE_SERVICE_ACCOUNT` isn't set (or isn't valid JSON), or the
  app was built before `@capacitor-firebase/messaging` was added. Rebuild.
- **"The phone didn't give the app a notification address"**: the Firebase file for that
  platform is missing from the build (step 4.1), or on iPhone the build has no Push
  Notifications entitlement (a Debug build still on `App-Personal.entitlements`).
- **The test says Firebase didn't take it**: CapRover's logs show `[fcm]` lines with Google's
  answer. `THIRD_PARTY_AUTH_ERROR` means the Apple Push Key wasn't uploaded, or the Key ID or
  Team ID is wrong.
