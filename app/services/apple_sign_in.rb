# Sign in with Apple, on the website and in the apps.
# - Website (and the Android app, which shows the same page): Users::AppleSignInsController
#   sends them to Apple's page, which posts back an ID token. On only when APPLE_SERVICES_ID is
#   set: a Services ID made in the Apple Developer account, with Sign in with Apple turned on,
#   the domain recoverybot.hmblbot.com and the return URL https://<host>/users/auth/apple/callback.
# - iPhone app: Apple's own sheet (the app's NativeAuth plugin), checked by
#   Users::NativeSignInsController against the app's bundle ID (APPLE_BUNDLE_ID, default
#   com.hmblbot.recoverybot). It needs nothing set here, only Sign in with Apple turned on for
#   the App ID.
# Both end in User.from_identity(:apple, ...). Setup: mobile/SIGN_IN_SETUP.md.
module AppleSignIn
  AUTHORIZE_URL = "https://appleid.apple.com/auth/authorize".freeze

  module_function

  def services_id = ENV["APPLE_SERVICES_ID"].presence
  def bundle_id = ENV["APPLE_BUNDLE_ID"].presence || "com.hmblbot.recoverybot"
  def web_enabled? = services_id.present?

  # Where the website's button posts
  def path = ("/users/auth/apple" if web_enabled?)

  # Apple's sign-in page: name and email asked for, the answer posted back to us
  def authorize_url(redirect_uri:, state:, nonce:)
    query = { response_type: "code id_token", response_mode: "form_post", client_id: services_id,
              redirect_uri: redirect_uri, scope: "name email", state: state, nonce: nonce }
    "#{AUTHORIZE_URL}?#{query.to_query}"
  end

  # Apple sends the name only the first time, as JSON in the `user` field:
  # {"name":{"firstName":"Jordan","lastName":"Rivers"},"email":"..."}
  def name_from(user_json)
    name = JSON.parse(user_json.to_s)["name"] || {}
    User.short_name(name["firstName"], name["lastName"])
  rescue JSON::ParserError
    nil
  end
end
