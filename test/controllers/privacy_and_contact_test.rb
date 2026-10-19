require "test_helper"

class PrivacyAndContactTest < ActionDispatch::IntegrationTest
  setup do
    Rails.application.reload_routes_unless_loaded
    @env = ENV.to_h.slice("CONTACT_EMAIL", "ADMIN_EMAILS", "COURT_VERIFICATION_ADMIN_EMAILS", "TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY")
    %w[CONTACT_EMAIL ADMIN_EMAILS COURT_VERIFICATION_ADMIN_EMAILS TURNSTILE_SITE_KEY TURNSTILE_SECRET_KEY].each { |k| ENV.delete(k) }
    ENV["ADMIN_EMAILS"] = "admin@example.com, other@example.com"
    ActionMailer::Base.deliveries.clear
  end

  teardown do
    %w[CONTACT_EMAIL ADMIN_EMAILS COURT_VERIFICATION_ADMIN_EMAILS TURNSTILE_SITE_KEY TURNSTILE_SECRET_KEY].each { |k| ENV.delete(k) }
    @env.each { |k, v| ENV[k] = v }
  end

  def contact(**fields)
    { contact: { name: "Sam", email: "sam@example.com", topic: "privacy", message: "Please delete my RSVP." }.merge(fields) }
  end

  test "the privacy policy and contact page are public" do
    get "/privacy"
    assert_response :success
    assert_includes response.body, %(data-page="privacy")

    get "/contact"
    assert_response :success
    props = JSON.parse(Nokogiri::HTML(response.body).at("#site-page")["data-props"])
    assert props["configured"]
    assert_equal "website", props.dig("human_check", "decoy")
    assert_nil props.dig("human_check", "turnstile_site_key")
  end

  test "a message is emailed to the admins with a reply-to, and nothing is saved" do
    post "/contact", params: contact.merge(human_check_params)
    assert_redirected_to "/contact?sent=1"

    mail = ActionMailer::Base.deliveries.last
    assert_equal %w[admin@example.com other@example.com], mail.to
    assert_equal ["sam@example.com"], mail.reply_to
    assert_includes mail.subject, "Privacy or deleting my data"
    assert_includes mail.text_part.body.to_s, "Please delete my RSVP."
    assert_includes mail.text_part.body.to_s, "Not signed in."
  end

  test "CONTACT_EMAIL wins over the admin list" do
    ENV["CONTACT_EMAIL"] = "hello@example.com"
    post "/contact", params: contact.merge(human_check_params)
    assert_equal ["hello@example.com"], ActionMailer::Base.deliveries.last.to
  end

  test "bots are turned away: decoy filled, too fast, no stamp or a forged one" do
    [
      contact.merge(human_check_params).merge(website: "http://spam.example"),
      contact.merge(human_check_params(drawn: 1.second.ago)),
      contact,
      contact.merge(form_started: "forged"),
    ].each do |params|
      post "/contact", params: params
      assert_response :unprocessable_entity
    end
    assert_empty ActionMailer::Base.deliveries
  end

  test "it needs an email to reply to and a message" do
    post "/contact", params: contact(email: "nope", message: "").merge(human_check_params)
    assert_response :unprocessable_entity
    assert_includes response.body, "an email address we can reply to"
    assert_includes response.body, "Please write a message."
    assert_empty ActionMailer::Base.deliveries
  end

  test "with no admin address it says so instead of pretending to send" do
    ENV.delete("ADMIN_EMAILS")
    get "/contact"
    refute JSON.parse(Nokogiri::HTML(response.body).at("#site-page")["data-props"])["configured"]

    post "/contact", params: contact.merge(human_check_params)
    assert_response :unprocessable_entity
    assert_includes response.body, "set up on this site yet"
    assert_empty ActionMailer::Base.deliveries
  end

  test "sign-up needs the human check" do
    user = { name: "New P.", email: "new@example.com", password: "password123", password_confirmation: "password123" }
    get "/users/sign_up"
    assert_response :success
    assert_includes response.body, "form_started"

    post "/users", params: { user: user }
    assert_response :unprocessable_entity
    assert_includes response.body, "look like a person"
    assert_nil User.find_by(email: "new@example.com")

    post "/users", params: { user: user, **human_check_params }
    assert User.find_by(email: "new@example.com")
  end
end
