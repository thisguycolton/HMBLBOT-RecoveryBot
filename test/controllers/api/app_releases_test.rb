require "test_helper"

# Account settings > App info (Api::AppInfoController) and Site Admin > App releases
# (Api::Admin::AppReleasesController)
class Api::AppReleasesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "admin@example.com"
    @admin = User.create!(email: "admin@example.com", password: "password123", confirmed: true, admin: true)
    @reader = User.create!(email: "reader@example.com", password: "password123", confirmed: true)
    AppRelease.delete_all # the migration's starting builds
    AppRelease.create!(platform: "ios", build: 4, version: "1.0", notes: "Old", released_on: Date.new(2026, 11, 10))
    AppRelease.create!(platform: "ios", build: 5, version: "1.0", notes: "- Widgets", released_on: Date.new(2026, 11, 17))
    AppRelease.create!(platform: "ios", build: 6, version: "1.0", notes: "Not out")
    AppRelease.create!(platform: "android", build: 6, version: "1.0.5", released_on: Date.new(2026, 11, 17))
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  test "App info lists the builds that are out, the newest of each and how to update" do
    get "/api/app_info", headers: { "User-Agent" => "Mozilla/5.0 (iPhone) Mobile/15E148 RecoveryBotApp/1.0 (iOS)" }
    assert_response :success
    body = response.parsed_body
    assert_equal "ios", body["platform"]
    assert_equal [5, 4], body["releases"].select { |r| r["platform"] == "ios" }.map { |r| r["build"] }
    assert_equal({ "ios" => 5, "android" => 6 }, body["latest"])
    assert_includes body.dig("update_steps", "ios", "body"), "build 5"
    assert_includes body.dig("update_steps", "ios", "body"), "TestFlight"
    assert_includes body.dig("update_steps", "android", "body"), "Manage apps & device"
    assert_equal AppRelease::PLAY_URL, body.dig("update_steps", "android", "link_url")
  end

  test "only suite admins manage builds" do
    sign_in @reader
    get "/api/admin/app_releases", as: :json
    assert_response :forbidden
  end

  test "admins add a build, mark it out and get its update notice" do
    sign_in @admin
    get "/api/admin/app_releases", as: :json
    assert_response :success
    assert_equal [5, true], response.parsed_body.dig("update_notices", "ios").values_at("build", "released")
    assert_equal "Update RecoveryBot for iPhone", response.parsed_body.dig("update_notices", "ios", "title")

    post "/api/admin/app_releases", params: { app_release: { platform: "android", build: 7, version: "1.0.6", notes: "- Faster" } }, as: :json
    assert_response :created
    release = AppRelease.find_by!(platform: "android", build: 7)
    assert_not release.released?

    post "/api/admin/app_releases", params: { app_release: { platform: "android", build: 7, version: "1.0.6" } }, as: :json
    assert_response :unprocessable_entity

    patch "/api/admin/app_releases/#{release.id}", params: { app_release: { released_on: "2026-11-18" } }, as: :json
    assert_response :success
    get "/api/admin/app_releases", as: :json
    assert_equal 7, response.parsed_body.dig("update_notices", "android", "build")

    delete "/api/admin/app_releases/#{release.id}", as: :json
    assert_response :no_content
  end
end
