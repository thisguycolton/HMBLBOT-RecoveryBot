package com.hmblbot.recoverybot;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.SystemClock;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Arrays;
import java.util.List;

// The app lock (fingerprint or face unlock, with the phone's PIN, pattern or password as the
// fallback). Turned on in Account settings > This phone (AppLockSettings.jsx on the site). The
// app then covers itself whenever it leaves the screen, and coming back (or opening it from cold)
// asks before the cover lifts. They stay signed in the whole time: nothing about their account is
// kept here, only "on", when to lock, and whether the site last said someone is signed in (a
// signed-out app has nothing to hide). Their fingerprint or face never leaves Android: the app
// only hears yes or no. A cover that can't be unlocked offers "Sign out instead" (the site's own
// /users/sign_out), which turns the lock off. iOS: AppLock in AppDelegate.swift.
@CapacitorPlugin(name = "AppLock")
public class AppLockPlugin extends Plugin {
    private static final String PREFS = "app_lock";
    private static final List<Integer> AFTERS = Arrays.asList(0, 60, 300, 900);
    // Any fingerprint or face the phone accepts for unlocking it, or its PIN, pattern or password
    private static final int AUTHENTICATORS = BiometricManager.Authenticators.BIOMETRIC_WEAK
        | BiometricManager.Authenticators.DEVICE_CREDENTIAL;

    private FrameLayout cover;
    private Button unlockButton;
    private TextView signOutButton;
    private boolean locked = false;
    private boolean asked = false; // asked once by itself for this lock; after a cancel, Unlock asks
    private boolean authenticating = false;
    private long leftAt = 0;
    private boolean signingOut = false;

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private boolean enabled() { return prefs().getBoolean("enabled", false); }
    private int after() { return prefs().getInt("after", 0); }
    private boolean applies() { return enabled() && prefs().getBoolean("signedIn", false); }

    // Opened from cold: covered before the first page can show
    @Override
    public void load() {
        hideFromRecents(applies());
        if (applies()) lock();
    }

    // --- What the phone can check with ---------------------------------------------------------

    // "fingerprint", "face", "biometric" (both, or Android won't say), "passcode" (just a PIN,
    // pattern or password) or "none" (no screen lock at all: nothing to lock with)
    private String kind() {
        Context context = getContext();
        int biometric = BiometricManager.from(context).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK);
        if (biometric == BiometricManager.BIOMETRIC_SUCCESS) {
            PackageManager pm = context.getPackageManager();
            boolean finger = pm.hasSystemFeature(PackageManager.FEATURE_FINGERPRINT);
            boolean face = Build.VERSION.SDK_INT >= 29 && pm.hasSystemFeature(PackageManager.FEATURE_FACE);
            if (finger && !face) return "fingerprint";
            if (face && !finger) return "face";
            return "biometric";
        }
        KeyguardManager keyguard = (KeyguardManager) context.getSystemService(Context.KEYGUARD_SERVICE);
        return keyguard != null && keyguard.isDeviceSecure() ? "passcode" : "none";
    }

    private interface Answer { void done(boolean ok, String problem); }

    // The phone's own prompt. done(true) when it's them, done(false, "Canceled") when they backed
    // out, done(false, "Unavailable") with nothing to check with
    private void check(String title, Answer answer) {
        Activity activity = getActivity();
        if (!(activity instanceof FragmentActivity) || "none".equals(kind())) {
            answer.done(false, "Unavailable");
            return;
        }
        BiometricPrompt prompt = new BiometricPrompt((FragmentActivity) activity, ContextCompat.getMainExecutor(activity),
            new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                    answer.done(true, null);
                }

                @Override
                public void onAuthenticationError(int code, @NonNull CharSequence message) {
                    boolean nothing = code == BiometricPrompt.ERROR_NO_DEVICE_CREDENTIAL
                        || code == BiometricPrompt.ERROR_HW_NOT_PRESENT
                        || code == BiometricPrompt.ERROR_NO_BIOMETRICS;
                    answer.done(false, nothing ? "Unavailable" : "Canceled");
                }
                // A finger or face it didn't know: the prompt stays up and says so itself
            });
        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle("Use your fingerprint, face or screen lock")
            .setAllowedAuthenticators(AUTHENTICATORS)
            .build();
        prompt.authenticate(info);
    }

    // --- Leaving and coming back ---------------------------------------------------------------

    @Override
    protected void handleOnStop() {
        // The PIN screen on older Androids is its own screen, which stops this one
        if (!applies() || authenticating || signingOut) return;
        leftAt = SystemClock.elapsedRealtime();
        showCover();
    }

    @Override
    protected void handleOnStart() {
        if (cover == null || locked || signingOut) return;
        long away = leftAt == 0 ? Long.MAX_VALUE : (SystemClock.elapsedRealtime() - leftAt) / 1000;
        if (applies() && away >= after()) lock();
        else unlock();
    }

    @Override
    protected void handleOnResume() {
        if (!locked || asked || authenticating) return;
        asked = true;
        // Once the screen has settled in
        getActivity().getWindow().getDecorView().post(this::ask);
    }

    private void lock() {
        locked = true;
        asked = false;
        showCover();
    }

    private void ask() {
        if (!locked || authenticating) return;
        authenticating = true;
        check("Unlock RecoveryBot", (ok, problem) -> {
            authenticating = false;
            if (ok) {
                unlock();
            } else if ("Unavailable".equals(problem)) {
                // The screen lock was turned off since: there's nothing left to check with, and a
                // phone without one is open to anyone anyway
                prefs().edit().putBoolean("enabled", false).apply();
                hideFromRecents(false);
                unlock();
            }
        });
    }

    private void unlock() {
        locked = false;
        leftAt = 0;
        if (cover == null) return;
        View view = cover;
        cover = null;
        view.animate().alpha(0f).setDuration(200).withEndAction(() -> {
            if (view.getParent() instanceof ViewGroup) ((ViewGroup) view.getParent()).removeView(view);
        }).start();
    }

    // The lock's own way out: sign out on the site (which turns the lock off), and lift the cover
    // once the signed-out page has loaded (AppWebViewClient.onPageFinished)
    private void signOut() {
        prefs().edit().putBoolean("enabled", false).putBoolean("signedIn", false).apply();
        hideFromRecents(false);
        signingOut = true;
        if (unlockButton != null) unlockButton.setEnabled(false);
        if (signOutButton != null) {
            signOutButton.setText("Signing out…");
            signOutButton.setEnabled(false);
        }
        String server = getBridge().getServerUrl();
        if (server == null || server.isEmpty()) server = "https://recoverybot.hmblbot.com";
        WebView webView = getBridge().getWebView();
        AppWebViewClient.onNextPageFinished(this::signedOut);
        webView.loadUrl(server.replaceAll("/+$", "") + "/users/sign_out");
        webView.postDelayed(this::signedOut, 10000);
    }

    private void signedOut() {
        if (!signingOut) return;
        signingOut = false;
        unlock();
    }

    // Android 13+: the recent apps screen shows the app's icon, not a picture of the page
    private void hideFromRecents(boolean hide) {
        Activity activity = getActivity();
        if (activity != null && Build.VERSION.SDK_INT >= 33) activity.setRecentsScreenshotEnabled(!hide);
    }

    // --- The cover -----------------------------------------------------------------------------

    private int dp(float value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getContext().getResources().getDisplayMetrics()));
    }

    private void showCover() {
        Activity activity = getActivity();
        if (cover != null || activity == null) return;
        boolean dark = (activity.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        int accent = Color.parseColor("#4c7ba6");

        FrameLayout frame = new FrameLayout(activity);
        frame.setBackgroundColor(ContextCompat.getColor(activity, R.color.page_background));
        frame.setClickable(true); // nothing behind it can be tapped
        frame.setFocusable(true);
        frame.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);

        LinearLayout column = new LinearLayout(activity);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setGravity(Gravity.CENTER_HORIZONTAL);
        column.setPadding(dp(32), 0, dp(32), 0);

        ImageView icon = new ImageView(activity);
        icon.setImageResource(R.drawable.ic_app_lock);
        icon.setImageTintList(ColorStateList.valueOf(accent));
        column.addView(icon, new LinearLayout.LayoutParams(dp(64), dp(64)));

        TextView title = new TextView(activity);
        title.setText("RecoveryBot is locked");
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        title.setTextColor(dark ? Color.parseColor("#f5f5f5") : Color.parseColor("#0f172a"));
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        titleParams.topMargin = dp(16);
        column.addView(title, titleParams);

        TextView note = new TextView(activity);
        note.setText("You're still signed in. Unlock to pick up where you left off.");
        note.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        note.setTextColor(dark ? Color.parseColor("#a3a3a3") : Color.parseColor("#475569"));
        note.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams noteParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        noteParams.topMargin = dp(8);
        column.addView(note, noteParams);

        Button unlock = new Button(activity);
        unlock.setText("Unlock");
        unlock.setAllCaps(false);
        unlock.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        unlock.setTextColor(Color.WHITE);
        GradientDrawable pill = new GradientDrawable();
        pill.setColor(accent);
        pill.setCornerRadius(dp(14));
        unlock.setBackground(pill);
        unlock.setPadding(dp(28), dp(12), dp(28), dp(12));
        unlock.setOnClickListener(v -> ask());
        LinearLayout.LayoutParams unlockParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        unlockParams.topMargin = dp(24);
        column.addView(unlock, unlockParams);

        TextView signOut = new TextView(activity);
        signOut.setText("Sign out instead");
        signOut.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        signOut.setTextColor(dark ? Color.parseColor("#a3a3a3") : Color.parseColor("#475569"));
        signOut.setPadding(dp(16), dp(12), dp(16), dp(12));
        signOut.setClickable(true);
        signOut.setFocusable(true);
        signOut.setOnClickListener(v -> signOut());
        LinearLayout.LayoutParams signOutParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        signOutParams.topMargin = dp(8);
        column.addView(signOut, signOutParams);

        frame.addView(column, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER));
        activity.addContentView(frame, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        cover = frame;
        unlockButton = unlock;
        signOutButton = signOut;
    }

    // --- The site's side (lib/appLock.js) ------------------------------------------------------

    private JSObject state() {
        String kind = kind();
        JSObject result = new JSObject();
        result.put("available", !"none".equals(kind));
        result.put("kind", kind);
        result.put("enabled", enabled());
        result.put("after", after());
        return result;
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(state());
    }

    // Only once the phone says it's them
    @PluginMethod
    public void enable(PluginCall call) {
        int after = call.getInt("after", 0);
        getActivity().runOnUiThread(() -> check("Turn on the app lock", (ok, problem) -> {
            if (!ok) {
                call.reject(problem);
                return;
            }
            SharedPreferences.Editor edit = prefs().edit().putBoolean("enabled", true).putBoolean("signedIn", true);
            if (AFTERS.contains(after)) edit.putInt("after", after);
            edit.apply();
            hideFromRecents(true);
            call.resolve(state());
        }));
    }

    @PluginMethod
    public void disable(PluginCall call) {
        prefs().edit().putBoolean("enabled", false).apply();
        getActivity().runOnUiThread(() -> hideFromRecents(false));
        call.resolve(state());
    }

    @PluginMethod
    public void setAfter(PluginCall call) {
        int after = call.getInt("after", -1);
        if (!AFTERS.contains(after)) {
            call.reject("Unknown time");
            return;
        }
        prefs().edit().putInt("after", after).apply();
        call.resolve(state());
    }

    @PluginMethod
    public void signedIn(PluginCall call) {
        boolean signedIn = call.getBoolean("signedIn", false);
        prefs().edit().putBoolean("signedIn", signedIn).apply();
        getActivity().runOnUiThread(() -> hideFromRecents(applies()));
        call.resolve();
    }
}
