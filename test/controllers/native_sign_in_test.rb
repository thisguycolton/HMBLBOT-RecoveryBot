require "test_helper"

# The apps' native Google and Apple sign-in sheets (Users::NativeSignInsController), Sign in with
# Apple on the website (Users::AppleSignInsController), the tokens they hand over (IdentityToken)
# and the files that let links open the apps (WellKnownController)
class NativeSignInTest < ActionDispatch::IntegrationTest
  IPHONE_APP = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 RecoveryBotApp/1.0 (iOS)"
  ANDROID_APP = "Mozilla/5.0 (Linux; Android 15; Pixel 9 Build/AP3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0 Mobile Safari/537.36 RecoveryBotApp/1.0 (Android)"
  IOS_CLIENT = "123-ios.apps.googleusercontent.com"
  KEY = OpenSSL::PKey::RSA.generate(2048)
  JWK = JWT::JWK.new(KEY, kid: "test-key")
  ENV_KEYS = %w[GOOGLE_IOS_CLIENT_ID APPLE_SERVICES_ID APPLE_TEAM_ID ANDROID_CERT_SHA256 APPLE_KEY_ID APPLE_PRIVATE_KEY].freeze
  APPLE_KEY = OpenSSL::PKey::EC.generate("prime256v1") # stands in for the Sign in with Apple .p8 key

  # Apple's token endpoints, played here: records each call and answers like Apple
  def fake_apple
    calls = []
    ENV["APPLE_TEAM_ID"] = "RJUT73YPEK"
    ENV["APPLE_KEY_ID"] = "KEY123"
    ENV["APPLE_PRIVATE_KEY"] = APPLE_KEY.to_pem.gsub("\n", "\\n") # as one line, the way it's pasted into CapRover
    AppleSignIn.poster = lambda do |url, form|
      calls << [url, form]
      url == AppleSignIn::TOKEN_URL ? { "refresh_token" => "r-#{form[:code]}", "access_token" => "a" } : {}
    end
    calls
  end

  setup do
    Rails.application.reload_routes_unless_loaded
    @source = IdentityToken.key_source
    IdentityToken.key_source = ->(_provider) { { keys: [JWK.export] } }
    @env = ENV.to_h.slice(*ENV_KEYS)
    @poster = AppleSignIn.poster
    ENV["GOOGLE_IOS_CLIENT_ID"] = IOS_CLIENT
  end

  teardown do
    IdentityToken.key_source = @source
    ENV_KEYS.each { |k| ENV[k] = @env[k] }
    AppleSignIn.poster = @poster
  end

  def token(key: KEY, **claims)
    payload = { iss: "https://accounts.google.com", aud: IOS_CLIENT, sub: "g-555", email: "sam@example.com", email_verified: true,
                given_name: "Sam", family_name: "Lee", iat: Time.now.to_i, exp: 10.minutes.from_now.to_i }.merge(claims)
    JWT.encode(payload, key, "RS256", { kid: "test-key" })
  end

  def apple_token(**claims) = token(**{ iss: "https://appleid.apple.com", aud: "com.hmblbot.recoverybot", sub: "a-777",
                                         email: "x1y2@privaterelay.appleid.com", email_verified: "true", given_name: nil, family_name: nil }.merge(claims))

  def nonce
    get "/users/auth/native/nonce"
    response.parsed_body["nonce"]
  end

  def native(provider, id_token, **extra)
    post "/users/auth/native", params: { provider: provider, id_token: id_token, **extra }, as: :json
  end

  test "Google's native sheet signs a new person in, kept signed in, with first name and last initial" do
    n = nonce
    assert_difference -> { User.count }, 1 do
      native("google", token(nonce: n))
    end
    assert_response :success
    user = User.find_by(email: "sam@example.com")
    assert_equal "g-555", user.google_uid
    assert_equal "Sam L.", user.name
    assert user.confirmed?
    assert_equal "/welcome", response.parsed_body["redirect"], "a new account starts with the welcome wizard"
    assert cookies["remember_user_token"].present?, "the app keeps them signed in"
    get "/recovery"
    assert_response :success
  end

  test "a Google token for someone else's client, an old nonce or a forged signature is turned away" do
    native("google", token(nonce: nonce, aud: "someone-else.apps.googleusercontent.com"))
    assert_response :unprocessable_entity

    n = nonce
    native("google", token(nonce: "not-#{n}"))
    assert_response :unprocessable_entity

    native("google", token(nonce: n)) # the nonce went with the last try
    assert_response :unprocessable_entity

    native("google", token(nonce: nonce, key: OpenSSL::PKey::RSA.generate(2048)))
    assert_response :unprocessable_entity
    assert_nil User.find_by(email: "sam@example.com")
  end

  test "Apple's native sheet (hashed nonce) links an Apple account and takes the name the sheet gave" do
    n = nonce
    native("apple", apple_token(nonce: Digest::SHA256.hexdigest(n)), given_name: "Jordan", family_name: "Rivers")
    assert_response :success
    user = User.find_by(apple_uid: "a-777")
    assert_equal "x1y2@privaterelay.appleid.com", user.email
    assert_equal "Jordan R.", user.name

    # Later sign-ins find the same account, though Apple sends no name or email
    delete "/users/sign_out"
    native("apple", apple_token(nonce: nonce, email: nil))
    assert_response :success
    assert_equal 1, User.where(apple_uid: "a-777").count
  end

  test "an Apple sign-in with an existing account's confirmed address links to it" do
    user = User.create!(name: "Pat", email: "pat@example.com", password: "password123", password_confirmation: "password123")
    user.confirm
    native("apple", apple_token(nonce: nonce, email: "Pat@Example.com"))
    assert_response :success
    assert_equal "a-777", user.reload.apple_uid
  end

  test "Apple's native sheet's code is traded for a refresh token, and deleting the account revokes it" do
    calls = fake_apple
    native("apple", apple_token(nonce: nonce), authorization_code: "code-1")
    assert_response :success
    user = User.find_by(apple_uid: "a-777")
    assert_equal ["r-code-1", "com.hmblbot.recoverybot"], [user.apple_refresh_token, user.apple_client_id]
    assert_not_equal "r-code-1", User.connection.select_value("SELECT apple_refresh_token FROM users WHERE id = #{user.id}"), "kept encrypted"

    url, form = calls.first
    assert_equal [AppleSignIn::TOKEN_URL, "code-1", "authorization_code", "com.hmblbot.recoverybot"], [url, form[:code], form[:grant_type], form[:client_id]]
    secret, = JWT.decode(form[:client_secret], APPLE_KEY, true, algorithm: "ES256")
    assert_equal ["RJUT73YPEK", "com.hmblbot.recoverybot", "https://appleid.apple.com"], secret.values_at("iss", "sub", "aud")
    assert_nil form[:redirect_uri], "the app's codes weren't issued for a return URL"

    delete "/api/profile", params: { confirm_email: user.email }, as: :json
    assert_response :no_content
    assert_not User.exists?(user.id)
    url, form = calls.last
    assert_equal [AppleSignIn::REVOKE_URL, "r-code-1", "refresh_token", "com.hmblbot.recoverybot"], [url, form[:token], form[:token_type_hint], form[:client_id]]
  end

  test "the account is deleted even if Apple won't revoke, and nothing is kept without the Apple key" do
    native("apple", apple_token(nonce: nonce), authorization_code: "code-1")
    user = User.find_by(apple_uid: "a-777")
    assert_nil user.apple_refresh_token, "no key set up: no code traded"

    calls = fake_apple
    AppleSignIn.poster = ->(url, form) { calls << url; url == AppleSignIn::TOKEN_URL ? { "refresh_token" => "r" } : nil }
    native("apple", apple_token(nonce: nonce), authorization_code: "code-2")
    assert_equal "r", user.reload.apple_refresh_token
    delete "/api/profile", params: { confirm_email: user.email }, as: :json
    assert_response :no_content
    assert_not User.exists?(user.id)
    assert_equal AppleSignIn::REVOKE_URL, calls.last
  end

  test "Sign in with Apple on the website goes to Apple and back" do
    ENV["APPLE_SERVICES_ID"] = "com.hmblbot.recoverybot.web"
    get "/users/sign_in"
    assert_includes response.body, "/users/auth/apple"

    post "/users/auth/apple"
    assert_response :redirect
    location = URI(response.location)
    assert_equal "appleid.apple.com", location.host
    query = Rack::Utils.parse_query(location.query)
    assert_equal "com.hmblbot.recoverybot.web", query["client_id"]
    assert_equal "form_post", query["response_mode"]

    id_token = apple_token(aud: "com.hmblbot.recoverybot.web", nonce: query["nonce"])
    post "/users/auth/apple/callback", params: { state: query["state"], id_token: id_token, code: "c",
                                                  user: { name: { firstName: "Robin", lastName: "Hill" } }.to_json }
    assert_response :redirect
    user = User.find_by(apple_uid: "a-777")
    assert_equal "Robin H.", user.name
  end

  test "the website's Apple code is traded with its Services ID and return URL" do
    ENV["APPLE_SERVICES_ID"] = "com.hmblbot.recoverybot.web"
    calls = fake_apple
    post "/users/auth/apple"
    query = Rack::Utils.parse_query(URI(response.location).query)
    post "/users/auth/apple/callback", params: { state: query["state"], id_token: apple_token(aud: "com.hmblbot.recoverybot.web", nonce: query["nonce"]), code: "web-code" }
    user = User.find_by(apple_uid: "a-777")
    assert_equal ["r-web-code", "com.hmblbot.recoverybot.web"], [user.apple_refresh_token, user.apple_client_id]
    assert_equal "http://www.example.com/users/auth/apple/callback", calls.first.last[:redirect_uri]
  end

  test "Apple's answer without the state we sent is turned away" do
    ENV["APPLE_SERVICES_ID"] = "com.hmblbot.recoverybot.web"
    post "/users/auth/apple"
    query = Rack::Utils.parse_query(URI(response.location).query)
    post "/users/auth/apple/callback", params: { state: "forged", id_token: apple_token(aud: "com.hmblbot.recoverybot.web", nonce: query["nonce"]) }
    assert_redirected_to "/users/sign_in"
    assert_nil User.find_by(apple_uid: "a-777")
  end

  test "the website hides Apple until it's set up; the apps get their own sheets and always stay signed in" do
    ENV.delete("APPLE_SERVICES_ID")
    get "/users/sign_in"
    assert_not_includes response.body, "/users/auth/apple"
    assert_not_includes response.body, "native_sign_in&quot;:{"

    get "/users/sign_in", headers: { "User-Agent" => IPHONE_APP }
    assert_includes response.body, "&quot;google_client_id&quot;:&quot;#{IOS_CLIENT}&quot;"
    assert_includes response.body, "&quot;apple&quot;:true"
    assert_includes response.body, "always_remember&quot;:true"

    ENV["APPLE_SERVICES_ID"] = "com.hmblbot.recoverybot.web"
    get "/users/sign_in", headers: { "User-Agent" => ANDROID_APP }
    assert_includes response.body, "&quot;apple_path&quot;:&quot;/users/auth/apple&quot;"
  end

  test "the app link files name the apps once they're set up, and keep sign-in callbacks in the browser" do
    ENV.delete("APPLE_TEAM_ID")
    ENV.delete("ANDROID_CERT_SHA256")
    get "/.well-known/apple-app-site-association"
    assert_response :success
    assert_equal [], response.parsed_body.dig("applinks", "details")
    get "/.well-known/assetlinks.json"
    assert_equal [], response.parsed_body

    ENV["APPLE_TEAM_ID"] = "ABCDE12345"
    ENV["ANDROID_CERT_SHA256"] = "AA:BB, CC:DD"
    get "/.well-known/apple-app-site-association"
    assert_equal "application/json", response.media_type
    detail = response.parsed_body.dig("applinks", "details", 0)
    assert_equal ["ABCDE12345.com.hmblbot.recoverybot"], detail["appIDs"]
    assert_includes detail["components"], { "/" => "/users/auth/*", "exclude" => true }
    assert_equal({ "/" => "*" }, detail["components"].last)
    assert_equal ["ABCDE12345.com.hmblbot.recoverybot"], response.parsed_body.dig("webcredentials", "apps")

    get "/.well-known/assetlinks.json"
    target = response.parsed_body.first["target"]
    assert_equal "com.hmblbot.recoverybot", target["package_name"]
    assert_equal ["AA:BB", "CC:DD"], target["sha256_cert_fingerprints"]
  end
end
