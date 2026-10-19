require "test_helper"
require "minitest/mock"

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

  test "the privacy policy, terms and contact page are public" do
    get "/privacy"
    assert_response :success
    assert_includes response.body, %(data-page="privacy")

    get "/terms"
    assert_response :success
    assert_includes response.body, %(data-page="terms")

    get "/contact"
    assert_response :success
    props = JSON.parse(Nokogiri::HTML(response.body).at("#site-page")["data-props"])
    assert_equal "website", props.dig("human_check", "decoy")
    assert_nil props.dig("human_check", "turnstile_site_key")
  end

  test "a message is saved and emailed to support with a reply-to" do
    assert_difference -> { ContactRequest.count }, 1 do
      post "/contact", params: contact.merge(human_check_params)
    end
    assert_redirected_to "/contact?sent=1"
    saved = ContactRequest.last
    assert_equal ["Sam", "sam@example.com", "privacy", "open", nil], [saved.name, saved.email, saved.topic, saved.status, saved.user_id]

    mail = ActionMailer::Base.deliveries.last
    assert_equal ["support@hmblbot.com"], mail.to
    assert_equal ["sam@example.com"], mail.reply_to
    assert_includes mail.subject, "Privacy or deleting my data"
    assert_includes mail.text_part.body.to_s, "Please delete my RSVP."
    assert_includes mail.text_part.body.to_s, "Not signed in."
  end

  test "bots are turned away: decoy filled, too fast, no stamp or a forged one" do
    # Built as each post goes out, so a slow earlier request can't age the "too fast" stamp
    [
      -> { contact.merge(human_check_params).merge(website: "http://spam.example") },
      -> { contact.merge(human_check_params(drawn: 1.second.ago)) },
      -> { contact },
      -> { contact.merge(form_started: "forged") },
    ].each do |params|
      post "/contact", params: params.call
      assert_response :unprocessable_entity
    end
    assert_empty ActionMailer::Base.deliveries
    assert_equal 0, ContactRequest.count
  end

  test "it needs an email to reply to and a message" do
    post "/contact", params: contact(email: "nope", message: "").merge(human_check_params)
    assert_response :unprocessable_entity
    assert_includes response.body, "an email address we can reply to"
    assert_includes response.body, "Please write a message."
    assert_empty ActionMailer::Base.deliveries
  end

  test "a failed email still keeps the message" do
    ContactMailer.stub(:with, ->(*) { raise "SMTP is down" }) do
      post "/contact", params: contact.merge(human_check_params)
    end
    assert_redirected_to "/contact?sent=1"
    assert_equal 1, ContactRequest.count
  end

  test "admins see, handle and delete contact requests" do
    admin = User.create!(email: "admin@example.com", name: "Admin", password: "password123", confirmed: true, admin: true)
    member = User.create!(email: "m@example.com", name: "Member", password: "password123", confirmed: true)
    sign_in member
    post "/contact", params: contact(email: "m@example.com").merge(human_check_params)
    req = ContactRequest.last
    assert_equal member, req.user

    get "/api/admin/contact_requests", as: :json
    assert_response :forbidden

    sign_in admin
    get "/api/admin/overview", as: :json
    assert_equal 1, response.parsed_body.dig("contact_requests", "open")
    get "/api/admin/contact_requests", as: :json
    assert_equal ["Please delete my RSVP."], response.parsed_body["contact_requests"].map { _1["message"] }
    assert_equal "Member", response.parsed_body["contact_requests"].first.dig("account", "name")

    patch "/api/admin/contact_requests/#{req.id}", params: { status: "handled" }, as: :json
    assert_equal ["handled", admin.id], [req.reload.status, req.handled_by_id]
    get "/api/admin/contact_requests", as: :json
    assert_empty response.parsed_body["contact_requests"]
    get "/api/admin/contact_requests?status=handled", as: :json
    assert_equal 1, response.parsed_body["contact_requests"].size

    delete "/api/admin/contact_requests/#{req.id}", as: :json
    assert_response :no_content
    refute ContactRequest.exists?(req.id)
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
