require "test_helper"
require_relative "../support/court_verification_test_data"

class AdminSuiteTest < ActionDispatch::IntegrationTest
  include CourtVerificationTestData
  include Devise::Test::IntegrationHelpers
  include ActionMailer::TestHelper

  API_GETS = %w[/api/admin/overview /api/admin/analytics /api/admin/users /api/admin/readings /api/admin/tags].freeze

  setup do
    @previous = ENV.values_at("ADMIN_EMAILS", "COURT_VERIFICATION_ADMIN_EMAILS")
    ENV["ADMIN_EMAILS"] = "court-admin@example.com"
    ENV["COURT_VERIFICATION_ADMIN_EMAILS"] = nil
  end

  teardown { ENV["ADMIN_EMAILS"], ENV["COURT_VERIFICATION_ADMIN_EMAILS"] = @previous }

  test "only the listed admin gets in: pages, APIs and AhoyCaptain" do
    [create_user(admin: false), create_user(admin: true)].each do |user|
      sign_in user
      %w[/admin_panel /admin_panel/users /admin_panel/analytics].each do |path|
        get path
        assert_redirected_to root_path, path
      end
      API_GETS.each do |path|
        get path, as: :json
        assert_response :forbidden, path
      end
      get "/ahoy_captain"
      assert_response :not_found
      sign_out user
    end

    sign_in create_court_admin
    get "/admin_panel/readings"
    assert_response :success
    assert_select "#admin-suite"
    API_GETS.each do |path|
      get path, as: :json
      assert_response :success, path
    end
    get "/ahoy_captain"
    assert_response :success
  end

  test "COURT_VERIFICATION_ADMIN_EMAILS still works when ADMIN_EMAILS is unset" do
    ENV["ADMIN_EMAILS"] = nil
    ENV["COURT_VERIFICATION_ADMIN_EMAILS"] = "court-admin@example.com"
    sign_in create_court_admin
    get "/api/admin/overview", as: :json
    assert_response :success
  end

  test "analytics counts visits, visitors and top pages inside the window" do
    zone = Time.find_zone!("America/Phoenix")
    today = zone.now.change(hour: 12)
    old = Ahoy::Visit.create!(visit_token: "v0", visitor_token: "returning", started_at: today - 40.days)
    a = Ahoy::Visit.create!(visit_token: "v1", visitor_token: "returning", started_at: today, device_type: "Mobile", referring_domain: "google.com")
    b = Ahoy::Visit.create!(visit_token: "v2", visitor_token: "new-one", started_at: today - 1.day, device_type: "Desktop")
    Ahoy::Event.create!(visit: a, name: "Ran action", time: today, properties: { controller: "readings", action: "show" })
    Ahoy::Event.create!(visit: b, name: "Ran action", time: today - 1.day, properties: { controller: "readings", action: "show" })
    Ahoy::Event.create!(visit: a, name: "Viewed Reading", time: today, properties: { title: "One hour of Freedom" })
    Ahoy::Event.create!(visit: a, name: "Ran action", time: today, properties: { controller: "api/v1/quest_sessions", action: "show" })
    Ahoy::Event.create!(visit: old, name: "Ran action", time: today - 40.days, properties: { controller: "topics", action: "index" })

    sign_in create_court_admin
    get "/api/admin/analytics", params: { days: 7 }, as: :json
    body = response.parsed_body

    assert_equal 7, body["days"]
    assert_equal({ "visits" => 2, "visitors" => 2, "signed_in_visitors" => 0, "events" => 4 }, body["totals"])
    assert_equal({ "new" => 1, "returning" => 1 }, body["new_vs_returning"])
    assert_equal 7, body["daily"].size
    assert_equal({ "date" => today.to_date.iso8601, "visits" => 1, "visitors" => 1 }, body["daily"].last)
    assert_equal [{ "label" => "readings#show", "count" => 2 }], body["top_pages"]
    assert_equal [{ "label" => "One hour of Freedom", "count" => 1 }], body["top_readings"]
    assert_equal [{ "label" => "google.com", "count" => 1 }], body["referrers"]
  end

  test "approves members and grants admin, but never changes your own access" do
    me = create_court_admin
    pending = User.create!(email: "new@example.com", password: "password123", confirmed: false)
    sign_in me

    assert_enqueued_emails 1 do
      patch "/api/admin/users/#{pending.id}/confirm", as: :json
    end
    assert pending.reload.confirmed

    patch "/api/admin/users/#{pending.id}", params: { admin: true }, as: :json
    assert pending.reload.admin

    patch "/api/admin/users/#{me.id}", params: { admin: false }, as: :json
    assert_response :unprocessable_entity
    assert me.reload.admin
  end

  test "publishes, unpublishes, schedules and deletes readings" do
    me = create_court_admin
    reading = Reading.create!(title: "Draft one", user: me)
    sign_in me

    patch "/api/admin/readings/#{reading.id}", params: { publish: "now" }, as: :json
    assert reading.reload.published?
    patch "/api/admin/readings/#{reading.id}", params: { publish: "unpublish" }, as: :json
    assert reading.reload.draft?
    patch "/api/admin/readings/#{reading.id}", params: { published_at: 2.days.from_now.iso8601 }, as: :json
    assert reading.reload.scheduled_for_later?

    get "/api/admin/readings", params: { status: "scheduled" }, as: :json
    assert_equal [reading.id], response.parsed_body["readings"].map { |r| r["id"] }

    delete "/api/admin/readings/#{reading.id}", as: :json
    assert_response :no_content
    assert_not Reading.exists?(reading.id)
  end

  test "creates, renames and deletes tags with icons" do
    sign_in create_court_admin

    post "/api/admin/tags", params: { tag: { title: "Hope", icon_name: "sunrise" } }, as: :json
    assert_response :created
    tag = Tag.find_by!(title: "Hope")
    assert_equal "sunrise", tag.icon_name

    patch "/api/admin/tags/#{tag.id}", params: { tag: { icon_name: "sun" } }, as: :json
    assert_equal "sun", tag.reload.icon_name

    delete "/api/admin/tags/#{tag.id}", as: :json
    assert_not Tag.exists?(tag.id)
  end
end
