require "test_helper"

class TestflightRequestsTest < ActionDispatch::IntegrationTest
  setup do
    Rails.application.reload_routes_unless_loaded
    @env = ENV.to_h.slice("ADMIN_EMAILS", "COURT_VERIFICATION_ADMIN_EMAILS", "TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY")
    %w[ADMIN_EMAILS COURT_VERIFICATION_ADMIN_EMAILS TURNSTILE_SITE_KEY TURNSTILE_SECRET_KEY].each { |k| ENV.delete(k) }
    ENV["ADMIN_EMAILS"] = "admin@example.com"
    @admin = User.create!(email: "admin@example.com", name: "Admin", password: "password123", confirmed: true, admin: true)
  end

  teardown do
    %w[ADMIN_EMAILS COURT_VERIFICATION_ADMIN_EMAILS TURNSTILE_SITE_KEY TURNSTILE_SECRET_KEY].each { |k| ENV.delete(k) }
    @env.each { |k, v| ENV[k] = v }
  end

  def ask(**fields)
    { testflight: { name: "Sam P.", email: "Sam@Example.com ", note: "From the Tuesday group" }.merge(fields) }
  end

  test "the form is public, has the human check and isn't indexed" do
    get "/testflight"
    assert_response :success
    props = JSON.parse(Nokogiri::HTML(response.body).at("#site-page")["data-props"])
    assert_equal "testflight", Nokogiri::HTML(response.body).at("#site-page")["data-page"]
    assert_equal "website", props.dig("human_check", "decoy")
    assert_match(/noindex/, response.headers["X-Robots-Tag"].to_s + response.body[/<meta name="robots"[^>]*>/].to_s)
  end

  test "a request is saved and site admins are notified" do
    assert_difference -> { TestflightRequest.count }, 1 do
      post "/testflight", params: ask.merge(human_check_params)
    end
    assert_redirected_to "/testflight?sent=1"
    saved = TestflightRequest.last
    assert_equal ["Sam P.", "sam@example.com", "From the Tuesday group", "new", nil], [saved.name, saved.email, saved.note, saved.status, saved.user_id]

    note = Notification.find_by!(user: @admin, kind: "testflight.requested")
    assert_includes note.title, "Sam P."
    assert_equal "/admin_panel/testflight_requests", note.url
    assert_equal "site_admin", Notification.push_category("testflight.requested")
  end

  test "asking again with the same email doesn't make a second request" do
    post "/testflight", params: ask.merge(human_check_params)
    assert_no_difference -> { TestflightRequest.count } do
      post "/testflight", params: ask(email: "sam@example.com").merge(human_check_params)
    end
    assert_redirected_to "/testflight?sent=1"
  end

  test "Android testers: chosen on the form, from ?platform= or from an Android phone" do
    get "/testflight?platform=android"
    assert_equal "android", JSON.parse(Nokogiri::HTML(response.body).at("#site-page")["data-props"]).dig("values", "platform")
    get "/testflight", headers: { "User-Agent" => "Mozilla/5.0 (Linux; Android 15; Pixel 9)" }
    assert_equal "android", JSON.parse(Nokogiri::HTML(response.body).at("#site-page")["data-props"]).dig("values", "platform")
    get "/testflight"
    assert_equal "ios", JSON.parse(Nokogiri::HTML(response.body).at("#site-page")["data-props"]).dig("values", "platform")

    post "/testflight", params: ask(platform: "android").merge(human_check_params)
    assert_redirected_to "/testflight?platform=android&sent=1"
    assert_equal "android", TestflightRequest.last.platform
    assert_includes Notification.find_by!(user: @admin, kind: "testflight.requested").title, "Android app"

    # The same person can ask for both phones, but not the same one twice
    assert_difference -> { TestflightRequest.count }, 1 do
      post "/testflight", params: ask(platform: "ios").merge(human_check_params)
      post "/testflight", params: ask(platform: "android").merge(human_check_params)
    end

    post "/testflight", params: ask(platform: "android", email: "nope").merge(human_check_params)
    assert_includes response.body, "Google account"

    sign_in @admin
    get "/api/admin/testflight_requests?platform=android", as: :json
    assert_equal ["android"], response.parsed_body["testflight_requests"].map { _1["platform"] }
    assert_equal 1, response.parsed_body.dig("counts", "new")
  end

  test "bots and bad input are turned away" do
    post "/testflight", params: ask.merge(human_check_params).merge(website: "http://spam.example")
    assert_response :unprocessable_entity
    post "/testflight", params: ask
    assert_response :unprocessable_entity

    post "/testflight", params: ask(name: "", email: "nope").merge(human_check_params)
    assert_response :unprocessable_entity
    assert_includes response.body, "Please add your name."
    assert_includes response.body, "Apple ID"
    assert_equal 0, TestflightRequest.count
  end

  test "admins list, mark and delete requests" do
    member = User.create!(email: "m@example.com", name: "Member", password: "password123", confirmed: true)
    sign_in member
    post "/testflight", params: ask(email: "m@example.com").merge(human_check_params)
    req = TestflightRequest.last
    assert_equal member, req.user

    get "/api/admin/testflight_requests", as: :json
    assert_response :forbidden

    sign_in @admin
    get "/api/admin/overview", as: :json
    assert_equal 1, response.parsed_body.dig("testflight_requests", "new")
    get "/api/admin/testflight_requests", as: :json
    assert_equal ["m@example.com"], response.parsed_body["testflight_requests"].map { _1["email"] }

    assert_enqueued_emails 1 do
      patch "/api/admin/testflight_requests/#{req.id}", params: { status: "invited" }, as: :json
    end
    assert_equal ["invited", @admin.id], [req.reload.status, req.handled_by_id]
    assert req.invited_at
    patch "/api/admin/testflight_requests/#{req.id}", params: { status: "bogus" }, as: :json
    assert_response :unprocessable_entity

    get "/api/admin/testflight_requests", as: :json
    assert_empty response.parsed_body["testflight_requests"]
    get "/api/admin/testflight_requests?status=invited", as: :json
    assert_equal 1, response.parsed_body["testflight_requests"].size

    assert_no_enqueued_emails do
      patch "/api/admin/testflight_requests/bulk", params: { ids: [req.id], status: "done" }, as: :json
    end
    assert_response :no_content
    assert_equal "done", req.reload.status

    delete "/api/admin/testflight_requests/#{req.id}", as: :json
    assert_response :no_content
    refute TestflightRequest.exists?(req.id)
  end

  test "the invite email tells Android testers how to join on Google Play" do
    req = TestflightRequest.create!(name: "Sam P.", email: "sam@example.com", platform: "android")
    mail = TesterMailer.with(testflight_request: req).invited
    assert_equal ["sam@example.com"], mail.to
    assert_includes mail.subject, "Android"
    assert_includes mail.text_part.body.to_s, TesterMailer::PLAY_JOIN_URL
    assert_includes mail.html_part.body.to_s, "Become a tester"

    ios = TesterMailer.with(testflight_request: req.dup.tap { _1.platform = "ios" }).invited
    assert_includes ios.text_part.body.to_s, TesterMailer::TESTFLIGHT_JOIN_URL
  end
end
