# Release builds run R8 (minifyEnabled in build.gradle). Capacitor keeps every class that extends
# com.getcapacitor.Plugin with its @PluginMethod methods (its own consumer rules), which covers
# the app's plugins too (AppBars, AppClipboard, NativeAuth, Printer, WidgetBridge). Firebase
# Messaging and AndroidX bring their own rules. Activities, receivers (the widgets) and providers
# named in AndroidManifest.xml are kept automatically.

# Crash reports in the Play Console show real line numbers (Play reads the mapping file that the
# .aab carries), without naming source files
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Capacitor's bridge: the web view calls these by name
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# "Continue with Google" (NativeAuthPlugin): Credential Manager finds its Play services provider
# by class name. Google's documented rule for androidx.credentials.
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** {
  *;
}

# Widgets: the looks are read from saved settings by key, and the classes are reached from
# RemoteViews and the widget picker. Kept whole so nothing a home screen calls is renamed.
-keep class com.hmblbot.recoverybot.DayCountWidget { *; }
-keep class com.hmblbot.recoverybot.ChipWidget { *; }
-keep class com.hmblbot.recoverybot.WidgetData { *; }
-keep class com.hmblbot.recoverybot.WidgetSettingsActivity { *; }

# Classes some libraries mention but don't ship; harmless to leave out
-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**
-dontwarn org.slf4j.**
