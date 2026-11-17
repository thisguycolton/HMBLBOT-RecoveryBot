require "net/http"

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
#
# Deleting an account made with Sign in with Apple has to revoke it with Apple (App Store rule
# 5.1.1(v)). Each sign-in hands over an authorization code, which is traded here for a refresh
# token (kept encrypted on the user), and deleting the account revokes that token. Both need a
# Sign in with Apple key from the Apple Developer account: APPLE_KEY_ID, APPLE_PRIVATE_KEY (the
# .p8 file's text) and APPLE_TEAM_ID. Without them sign-in works as before and nothing is kept.
module AppleSignIn
  AUTHORIZE_URL = "https://appleid.apple.com/auth/authorize".freeze
  TOKEN_URL = "https://appleid.apple.com/auth/token".freeze
  REVOKE_URL = "https://appleid.apple.com/auth/revoke".freeze

  # Posts a form to Apple and returns the parsed JSON (an empty hash for an empty body), or nil
  # when Apple says no or can't be reached. Tests swap in their own.
  mattr_accessor :poster, default: ->(url, form) { post_form(url, form) }

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

  def key_id = ENV["APPLE_KEY_ID"].presence
  def team_id = ENV["APPLE_TEAM_ID"].presence
  def private_key = ENV["APPLE_PRIVATE_KEY"].presence&.gsub("\\n", "\n")
  def tokens_enabled? = [key_id, team_id, private_key].all?(&:present?)

  # Our side of the conversation with Apple's token endpoints: a short-lived JWT signed with the key
  def client_secret(client_id)
    now = Time.now.to_i
    JWT.encode({ iss: team_id, iat: now, exp: now + 300, aud: "https://appleid.apple.com", sub: client_id },
               OpenSSL::PKey::EC.new(private_key), "ES256", { kid: key_id })
  end

  # The refresh token for a sign-in's authorization code, or nil. The website's codes were
  # issued for its return URL, which has to be sent again; the app's weren't.
  def refresh_token_for(code, client_id:, redirect_uri: nil)
    return if code.blank? || client_id.blank? || !tokens_enabled?

    form = { client_id: client_id, client_secret: client_secret(client_id), code: code, grant_type: "authorization_code" }
    form[:redirect_uri] = redirect_uri if redirect_uri
    poster.call(TOKEN_URL, form)&.dig("refresh_token").presence
  rescue StandardError => e
    Rails.logger.warn("[apple sign-in] couldn't trade the code: #{e.class}: #{e.message}")
    nil
  end

  # Tells Apple the account is gone: the app no longer has access, and Apple lists it as
  # disconnected in their Apple ID settings. True if Apple said yes.
  def revoke(refresh_token, client_id:)
    return false if refresh_token.blank? || client_id.blank? || !tokens_enabled?

    form = { client_id: client_id, client_secret: client_secret(client_id), token: refresh_token, token_type_hint: "refresh_token" }
    !poster.call(REVOKE_URL, form).nil?
  rescue StandardError => e
    Rails.logger.warn("[apple sign-in] couldn't revoke: #{e.class}: #{e.message}")
    false
  end

  def post_form(url, form)
    uri = URI(url)
    response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 5, read_timeout: 10) do |http|
      http.post(uri.path, URI.encode_www_form(form), "Content-Type" => "application/x-www-form-urlencoded")
    end
    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.warn("[apple sign-in] #{uri.path} answered #{response.code}: #{response.body.to_s.truncate(200)}")
      return nil
    end
    response.body.present? ? JSON.parse(response.body) : {}
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
