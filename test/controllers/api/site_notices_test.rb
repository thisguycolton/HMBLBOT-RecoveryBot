require "test_helper"

class Api::SiteNoticesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "admin@example.com"
    @admin = User.create!(email: "admin@example.com", password: "password123", confirmed: true, admin: true)
    @reader = User.create!(email: "reader@example.com", password: "password123", confirmed: true)
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  def titles
    get "/api/site_notices", as: :json
    assert_response :success
    response.parsed_body.map { |n| n["title"] }
  end

  test "visitors see live notices for their audience" do
    SiteNotice.create!(title: "Everyone")
    SiteNotice.create!(title: "Members", audience: "members")
    SiteNotice.create!(title: "Guests", audience: "guests")
    SiteNotice.create!(title: "Off", active: false)
    SiteNotice.create!(title: "Later", starts_at: 1.day.from_now)
    SiteNotice.create!(title: "Over", starts_at: 2.days.ago, ends_at: 1.day.ago)

    assert_equal %w[Guests Everyone], titles
    sign_in @reader
    assert_equal %w[Members Everyone], titles
  end

  test "the iPhone and Android apps don't get notices about getting the app" do
    SiteNotice.create!(title: "Try the app", link_url: "/testflight")
    SiteNotice.create!(title: "Android testers", link_url: "/testflight?platform=android")
    SiteNotice.create!(title: "Join the beta", link_url: "https://testflight.apple.com/join/abc")
    SiteNotice.create!(title: "On Google Play", link_url: "https://play.google.com/store/apps/details?id=x")
    SiteNotice.create!(title: "Home screen", link_url: "/install")
    SiteNotice.create!(title: "We're on TestFlight now")
    SiteNotice.create!(title: "Install-ish", link_url: "/installations") # not the install page
    SiteNotice.create!(title: "Meeting change", link_url: "/groups/meetings")

    app = "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 RecoveryBotApp/1.0 (iOS)"
    get "/api/site_notices", as: :json, headers: { "User-Agent" => app }
    assert_equal ["Meeting change", "Install-ish"], response.parsed_body.map { |n| n["title"] }

    assert_includes titles, "Home screen" # a browser still gets them (the newest five)

    sign_in @admin
    get "/api/admin/site_notices", as: :json
    hidden = response.parsed_body.select { |n| n["hidden_in_app"] }.map { |n| n["title"] }
    assert_equal 6, hidden.size
  end

  test "a notice carries its write-up for the modal, and the admin's link" do
    SiteNotice.create!(title: "Story", body: "The **long** version", link_url: "/library", link_label: "Open the library")
    SiteNotice.create!(title: "Link", link_url: "https://example.com", link_label: "Go")
    get "/api/site_notices", as: :json
    by_title = response.parsed_body.index_by { |n| n["title"] }
    assert_equal ["The **long** version", "/library", "Open the library"], by_title["Story"].values_at("body", "link_url", "link_label")
    assert_equal [nil, "https://example.com", "Go"], by_title["Link"].values_at("body", "link_url", "link_label")
    assert by_title["Story"]["version"].positive?
  end

  test "only suite admins manage notices" do
    get "/api/admin/site_notices", as: :json
    assert_response :forbidden
    sign_in @reader
    post "/api/admin/site_notices", params: { site_notice: { title: "Nope" } }, as: :json
    assert_response :forbidden
    assert_equal 0, SiteNotice.count
  end

  test "admins create, edit, turn off and delete notices" do
    sign_in @admin
    post "/api/admin/site_notices", params: { site_notice: { title: "Hello", summary: "One line", tone: "warning", audience: "members" } }, as: :json
    assert_response :created
    notice = SiteNotice.sole
    assert_equal [@admin, "warning", "members", true], [notice.user, notice.tone, notice.audience, notice.live?]

    patch "/api/admin/site_notices/#{notice.id}", params: { site_notice: { active: false } }, as: :json
    assert_response :success
    assert_equal false, response.parsed_body["live"]

    patch "/api/admin/site_notices/#{notice.id}", params: { site_notice: { tone: "loud" } }, as: :json
    assert_response :unprocessable_entity

    patch "/api/admin/site_notices/#{notice.id}", params: { site_notice: { link_url: "javascript:alert(1)" } }, as: :json
    assert_response :unprocessable_entity

    delete "/api/admin/site_notices/#{notice.id}", as: :json
    assert_response :no_content
    assert_equal 0, SiteNotice.count
  end
end
