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
