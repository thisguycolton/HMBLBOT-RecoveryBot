require "test_helper"

# Account settings > Ways to sign in: linking Google and Apple to the signed-in account
# (LinksIdentities, through the website's OmniAuth Google, Sign in with Apple, and the apps'
# sheets), unlinking (Api::SignInMethodsController), and moving one off a second account that
# Apple's "Hide My Email" made (User#take_identity_from!)
class SignInLinksTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  KEY = OpenSSL::PKey::RSA.generate(2048)
  JWK = JWT::JWK.new(KEY, kid: "test-key")
  APPLE_KEY = OpenSSL::PKey::EC.generate("prime256v1")
  ENV_KEYS = %w[APPLE_SERVICES_ID APPLE_TEAM_ID APPLE_KEY_ID APPLE_PRIVATE_KEY GOOGLE_IOS_CLIENT_ID].freeze
  IPHONE_APP = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 RecoveryBotApp/1.0 (iOS)"

  setup do
    Rails.application.reload_routes_unless_loaded
    OmniAuth.config.test_mode = true
    @source = IdentityToken.key_source
    IdentityToken.key_source = ->(_provider) { { keys: [JWK.export] } }
    @env = ENV.to_h.slice(*ENV_KEYS)
    @poster = AppleSignIn.poster
    ENV["APPLE_SERVICES_ID"] = "com.hmblbot.recoverybot.web"
    ENV["GOOGLE_IOS_CLIENT_ID"] = "123-ios.apps.googleusercontent.com"
    @me = person("me@example.com")
  end

  teardown do
    OmniAuth.config.mock_auth[:google_oauth2] = nil
    OmniAuth.config.test_mode = false
    IdentityToken.key_source = @source
    ENV_KEYS.each { |k| ENV[k] = @env[k] }
    AppleSignIn.poster = @poster
  end

  def person(email, **attrs)
    User.create!(name: "Pat", email: email, password: "password123", password_confirmation: "password123",
                 confirmed_at: Time.current, confirmed: true, **attrs)
  end

  # An account Sign in with Apple made with a private relay address: Apple is its only way in
  def relay_account(uid = "a-777")
    u = User.new(name: "Pat", email: "x1y2@privaterelay.appleid.com", apple_uid: uid, apple_refresh_token: "r-old", apple_client_id: "com.hmblbot.recoverybot")
    u.random_password!
    u.skip_confirmation!
    u.save!
    u
  end

  def fake_apple
    calls = []
    ENV["APPLE_TEAM_ID"] = "RJUT73YPEK"
    ENV["APPLE_KEY_ID"] = "KEY123"
    ENV["APPLE_PRIVATE_KEY"] = APPLE_KEY.to_pem
    AppleSignIn.poster = lambda do |url, form|
      calls << [url, form]
      url == AppleSignIn::TOKEN_URL ? { "refresh_token" => "r-#{form[:code]}" } : {}
    end
    calls
  end

  def apple_token(**claims)
    payload = { iss: "https://appleid.apple.com", aud: "com.hmblbot.recoverybot.web", sub: "a-777",
                email: "x1y2@privaterelay.appleid.com", email_verified: "true", iat: Time.now.to_i, exp: 10.minutes.from_now.to_i }.merge(claims)
    JWT.encode(payload, KEY, "RS256", { kid: "test-key" })
  end

  def google_says(uid: "g-123", email: "someone.else@gmail.com")
    OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
      provider: "google_oauth2", uid: uid, info: { email: email, first_name: "Jo", last_name: "Lee" },
      extra: { raw_info: { email_verified: true } },
    )
  end

  def link_google
    post "/users/auth/google_oauth2", params: { link: "1" }
    follow_redirect! while response.redirect? && response.location.include?("/users/auth/")
  end

  # Website Apple, from settings: there and back
  def link_apple_on_web(**claims)
    post "/users/auth/apple", params: { link: "1" }
    query = Rack::Utils.parse_query(URI(response.location).query)
    post "/users/auth/apple/callback", params: { state: query["state"], id_token: apple_token(nonce: query["nonce"], **claims), code: "web-code" }
  end

  def methods = (get("/api/sign_in_methods") && response.parsed_body)
  def provider(name) = methods["providers"].find { |p| p["provider"] == name }

  test "settings list a password account's ways in, with Link for Google and Apple on the website" do
    sign_in @me
    body = methods
    assert body["password"]
    assert_equal({ "kind" => "post", "path" => "/users/auth/google_oauth2" }, body["providers"][0]["link"])
    assert_equal({ "kind" => "post", "path" => "/users/auth/apple" }, body["providers"][1]["link"])
    assert_nil body["pending"]

    get "/api/sign_in_methods", headers: { "User-Agent" => IPHONE_APP }
    links = response.parsed_body["providers"].to_h { |p| [p["provider"], p["link"]] }
    assert_equal "native", links["apple"]["kind"], "the iPhone app links Apple with its own sheet"
    assert_equal "123-ios.apps.googleusercontent.com", links["google"]["client_id"]
  end

  test "Link Google from settings links it to the signed-in account, whatever its email, and emails them" do
    sign_in @me
    google_says
    assert_enqueued_emails 1 do
      link_google
    end
    assert_redirected_to "/users/edit#account"
    assert_equal "g-123", @me.reload.google_uid
    assert_nil User.find_by(email: "someone.else@gmail.com"), "no second account"
    assert provider("google")["linked"]
    assert provider("google")["can_unlink"], "they still have their password"
  end

  test "Link Apple on the website links the Apple ID, keeps its refresh token, and they stay signed in" do
    calls = fake_apple
    sign_in @me
    link_apple_on_web
    assert_redirected_to "/users/edit#account"
    @me.reload
    assert_equal "a-777", @me.apple_uid
    assert_equal "r-web-code", @me.apple_refresh_token
    assert_equal "com.hmblbot.recoverybot.web", @me.apple_client_id
    assert_equal 1, calls.size
    assert_nil User.find_by(email: "x1y2@privaterelay.appleid.com")
    get "/api/sign_in_methods"
    assert_response :success, "still signed in after Apple's cross-site post"
  end

  test "a signed-out Apple sign-in with link=1 is just a sign-in" do
    post "/users/auth/apple", params: { link: "1" }
    query = Rack::Utils.parse_query(URI(response.location).query)
    post "/users/auth/apple/callback", params: { state: query["state"], id_token: apple_token(nonce: query["nonce"]) }
    assert User.exists?(apple_uid: "a-777")
    assert_nil @me.reload.apple_uid
  end

  test "Link Apple in the iPhone app uses the native sheet's token" do
    sign_in @me
    get "/users/auth/native/nonce", headers: { "User-Agent" => IPHONE_APP }
    nonce = response.parsed_body["nonce"]
    post "/users/auth/native", params: { link: true, provider: "apple", id_token: apple_token(aud: "com.hmblbot.recoverybot", nonce: Digest::SHA256.hexdigest(nonce)) },
                               headers: { "User-Agent" => IPHONE_APP }, as: :json
    assert_response :success
    assert_equal "linked", response.parsed_body["result"]
    assert_equal "a-777", @me.reload.apple_uid
  end

  test "an Apple ID on a Hide My Email account: moving it here deletes that account and keeps Apple connected" do
    calls = fake_apple
    other = relay_account
    sign_in @me
    link_apple_on_web(email: nil)
    assert_nil @me.reload.apple_uid, "nothing changes until they choose"
    pending = methods["pending"]
    assert_equal "apple", pending["provider"]
    assert_equal "x1y2@privaterelay.appleid.com", pending["other"]["email"]
    assert pending["must_delete"]

    post "/api/sign_in_methods/move", params: { delete_other: false }, as: :json
    assert_response :unprocessable_entity, "it would be stranded"

    post "/api/sign_in_methods/move", params: { delete_other: true }, as: :json
    assert_response :success
    assert_not User.exists?(other.id)
    @me.reload
    assert_equal "a-777", @me.apple_uid
    assert_equal "r-old", @me.apple_refresh_token, "the refresh token moves with it"
    assert calls.none? { |url, _| url == AppleSignIn::REVOKE_URL }, "deleting the old account didn't disconnect the Apple ID"
    assert_nil response.parsed_body["pending"]
  end

  test "an account with another way in keeps it; only the Google sign-in moves" do
    other = person("other@example.com", google_uid: "g-123")
    sign_in @me
    google_says
    link_google
    pending = methods["pending"]
    assert_not pending["must_delete"]
    assert_equal ["a password", "Google"], pending["other"]["ways"]

    post "/api/sign_in_methods/move", params: { delete_other: true }, as: :json
    assert_response :unprocessable_entity, "an account that can still sign in isn't deleted from here"
    post "/api/sign_in_methods/move", params: { delete_other: false }, as: :json
    assert_response :success
    assert_nil other.reload.google_uid
    assert_equal "g-123", @me.reload.google_uid
  end

  test "Keep both forgets the choice, and it runs out" do
    relay_account
    sign_in @me
    link_apple_on_web
    assert methods["pending"]
    delete "/api/sign_in_methods/move"
    assert_nil response.parsed_body["pending"]
    post "/api/sign_in_methods/move", params: { delete_other: true }, as: :json
    assert_response :unprocessable_entity

    link_apple_on_web
    travel 11.minutes do
      assert_nil methods["pending"]
    end
  end

  test "unlinking is refused for the last way in; unlinking Apple tells Apple" do
    calls = fake_apple
    apple_only = relay_account
    sign_in apple_only
    assert_not provider("apple")["can_unlink"]
    delete "/api/sign_in_methods/apple"
    assert_response :unprocessable_entity
    assert_equal "a-777", apple_only.reload.apple_uid

    apple_only.update!(google_uid: "g-9")
    delete "/api/sign_in_methods/apple"
    assert_response :success
    apple_only.reload
    assert_nil apple_only.apple_uid
    assert_nil apple_only.apple_refresh_token
    assert_equal [AppleSignIn::REVOKE_URL], calls.map(&:first)
    assert_not provider("google")["can_unlink"], "Google is now the only way in"
  end

  test "linking a second, different Apple ID asks them to unlink the first" do
    @me.update!(apple_uid: "a-111")
    sign_in @me
    link_apple_on_web
    assert_equal "a-111", @me.reload.apple_uid
    assert_match(/different Apple account/, flash[:notice])
  end
end
