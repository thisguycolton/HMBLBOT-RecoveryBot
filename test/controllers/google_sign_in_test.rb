require "test_helper"

# "Continue with Google" (GoogleSignIn, Users::OmniauthCallbacksController, User.from_google)
class GoogleSignInTest < ActionDispatch::IntegrationTest
  setup do
    Rails.application.reload_routes_unless_loaded
    OmniAuth.config.test_mode = true
  end

  teardown do
    OmniAuth.config.mock_auth[:google_oauth2] = nil
    OmniAuth.config.test_mode = false
  end

  def google_says(email:, uid: "g-123", verified: true, first: "Jordan", last: "Rivers")
    OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new(
      provider: "google_oauth2", uid: uid,
      info: { email: email, name: "#{first} #{last}", first_name: first, last_name: last },
      extra: { raw_info: { email_verified: verified } },
    )
  end

  # Google sends them back to the callback; in test mode the start redirects straight there
  def continue_with_google
    post "/users/auth/google_oauth2"
    follow_redirect! while response.redirect? && response.location.include?("/users/auth/")
  end

  def person(email, **attrs)
    User.create!(name: "Pat", email: email, password: "password123", password_confirmation: "password123", **attrs)
  end

  test "the log in and sign up pages offer Google" do
    get "/users/sign_in"
    assert_includes response.body, "google_path"
    get "/users/sign_up"
    assert_includes response.body, "/users/auth/google_oauth2"
  end

  test "a new person gets a confirmed account with their first name and last initial" do
    google_says(email: "Jordan@Example.com")
    assert_difference -> { User.count }, 1 do
      continue_with_google
    end
    user = User.find_by(email: "jordan@example.com")
    assert_equal "Jordan R.", user.name
    assert_equal "g-123", user.google_uid
    assert user.confirmed?
    assert user.confirmed
    assert_not user.password_chosen
    assert_redirected_to "/"
    get "/api/profile"
    assert_response :success
    assert_equal "jordan@example.com", response.parsed_body["email"]
    assert_equal false, response.parsed_body["password_chosen"]
  end

  test "an existing account with the same address is linked and keeps its password" do
    pat = person("pat@example.com", confirmed_at: Time.current, confirmed: true)
    google_says(email: "pat@example.com")
    assert_no_difference -> { User.count } do
      continue_with_google
    end
    pat.reload
    assert_equal "g-123", pat.google_uid
    assert pat.password_chosen
    assert pat.valid_password?("password123")
    get "/api/profile"
    assert_equal "pat@example.com", response.parsed_body["email"]
  end

  test "an unconfirmed account is confirmed but loses the password nobody proved was theirs" do
    pat = person("pat@example.com")
    assert_not pat.confirmed?
    google_says(email: "pat@example.com")
    continue_with_google
    pat.reload
    assert pat.confirmed?
    assert_not pat.valid_password?("password123")
    assert_not pat.password_chosen
  end

  test "once linked, the Google account signs in even after either email changes" do
    pat = person("pat@example.com", confirmed_at: Time.current, confirmed: true, google_uid: "g-123")
    google_says(email: "someone-else@example.com")
    assert_no_difference -> { User.count } do
      continue_with_google
    end
    get "/api/profile"
    assert_equal pat.email, response.parsed_body["email"]
  end

  test "an address Google hasn't verified is turned away" do
    person("pat@example.com", confirmed_at: Time.current, confirmed: true)
    google_says(email: "pat@example.com", verified: false)
    assert_no_difference -> { User.count } do
      continue_with_google
    end
    assert_redirected_to "/users/sign_in"
    assert_nil User.find_by(email: "pat@example.com").google_uid
    get "/api/profile"
    assert_not response.successful?
  end

  test "a cancelled Google sign-in goes back to log in" do
    OmniAuth.config.mock_auth[:google_oauth2] = :access_denied
    silence_omniauth { continue_with_google }
    assert_redirected_to "/users/sign_in"
  end

  test "an account from Google sets a password without a current one, then needs it" do
    google_says(email: "jordan@example.com")
    continue_with_google
    patch "/api/profile", params: { profile: { password: "newpassword1", password_confirmation: "newpassword1" } }, as: :json
    assert_response :success
    assert response.parsed_body["password_chosen"]
    user = User.find_by(email: "jordan@example.com")
    assert user.valid_password?("newpassword1")

    patch "/api/profile", params: { profile: { password: "another12345", password_confirmation: "another12345" } }, as: :json
    assert_response :unprocessable_entity
  end

  test "an account from Google is deleted by typing its email" do
    google_says(email: "jordan@example.com")
    continue_with_google
    delete "/api/profile", params: { confirm_email: "wrong@example.com" }, as: :json
    assert_response :unprocessable_entity
    assert_difference -> { User.count }, -1 do
      delete "/api/profile", params: { confirm_email: "Jordan@example.com" }, as: :json
    end
  end

  test "an account with a password still needs it to be deleted" do
    pat = person("pat@example.com", confirmed_at: Time.current, confirmed: true, google_uid: "g-1")
    sign_in pat
    delete "/api/profile", params: { confirm_email: "pat@example.com" }, as: :json
    assert_response :unprocessable_entity
  end

  private

  def silence_omniauth
    logger = OmniAuth.config.logger
    OmniAuth.config.logger = Logger.new(IO::NULL)
    yield
  ensure
    OmniAuth.config.logger = logger
  end
end
