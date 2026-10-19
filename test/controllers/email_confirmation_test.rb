require "test_helper"

# Sign-up: people confirm their own email (Devise :confirmable) instead of waiting for an admin
class EmailConfirmationTest < ActionDispatch::IntegrationTest
  setup do
    Rails.application.reload_routes_unless_loaded
    ActionMailer::Base.deliveries.clear
  end

  def sign_up
    post "/users", params: { user: { name: "New P.", email: "new@example.com", password: "password123", password_confirmation: "password123" }, **human_check_params }
    User.find_by!(email: "new@example.com")
  end

  def log_in
    post "/users/sign_in", params: { user: { email: "new@example.com", password: "password123" } }
  end

  test "sign-up emails a confirmation link, and the link lets them log in" do
    user = sign_up
    refute user.confirmed?
    refute user.confirmed
    assert_empty Notification.where(kind: "user.pending")

    mail = ActionMailer::Base.deliveries.last
    assert_equal ["new@example.com"], mail.to
    assert_equal "Confirm your email for RecoveryBot", mail.subject
    link = mail.body.to_s[%r{http://[^"]+/users/confirmation\?confirmation_token=[^"]+}]
    assert link

    log_in
    assert_redirected_to "/users/sign_in"
    assert_includes flash[:alert], "confirm your email"

    get link.sub(%r{\Ahttp://[^/]+}, "")
    assert_redirected_to "/users/sign_in"
    assert user.reload.confirmed?
    assert user.confirmed, "the old flag follows, so queries on it still work"

    log_in
    assert_response :redirect
    refute_equal "/users/sign_in", URI(response.location).path
  end

  test "the resend page sends a new link" do
    sign_up
    ActionMailer::Base.deliveries.clear
    get "/users/confirmation/new"
    assert_response :success
    assert_includes response.body, "resend_confirmation"

    post "/users/confirmation", params: { user: { email: "new@example.com" } }
    assert_equal ["new@example.com"], ActionMailer::Base.deliveries.last.to
  end

  test "accounts made confirmed (admins, already approved) need no email" do
    user = User.create!(email: "old@example.com", name: "Old", password: "password123", confirmed: true)
    assert user.confirmed?
    assert user.confirmed_at
    assert_empty ActionMailer::Base.deliveries
  end

  test "changing email waits for the new address to be confirmed" do
    user = User.create!(email: "old@example.com", name: "Old", password: "password123", confirmed: true)
    sign_in user
    patch "/api/profile", params: { profile: { email: "fresh@example.com", current_password: "password123" } }, as: :json
    assert_response :success
    assert_equal ["old@example.com", "fresh@example.com"], response.parsed_body.values_at("email", "unconfirmed_email")
    assert_equal ["fresh@example.com"], ActionMailer::Base.deliveries.last.to
  end
end
