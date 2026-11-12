# The apps' own sign-in sheets (Users::NativeSignInsController): Google's (the iPhone's system
# sign-in sheet, Android's account picker) and Apple's (iPhone). The app gets an ID token from
# the provider and the page hands it to us. Google blocks its sign-in page inside web views,
# which is why the apps can't use the website's "Continue with Google".
#
# Google: the token is for one of our Google OAuth clients. GOOGLE_CLIENT_ID (the website's,
# which Android's picker also uses) and GOOGLE_IOS_CLIENT_ID (an iOS client for
# com.hmblbot.recoverybot). Apple: AppleSignIn.bundle_id. Setup: mobile/SIGN_IN_SETUP.md.
module NativeSignIn
  module_function

  def google_audiences = [ENV["GOOGLE_CLIENT_ID"], ENV["GOOGLE_IOS_CLIENT_ID"]].compact_blank
  def apple_audiences = [AppleSignIn.bundle_id]

  # What the sign-in pages tell the app (nil in a browser): which buttons to show and the
  # Google client the sheet signs in with
  def options(platform)
    case platform
    when "ios"
      { google_client_id: ENV["GOOGLE_IOS_CLIENT_ID"].presence, apple: true }
    when "android"
      # Android's picker asks for a token for the website's client; Apple is its web page
      { google_client_id: ENV["GOOGLE_CLIENT_ID"].presence, apple_path: AppleSignIn.path }
    end
  end
end
