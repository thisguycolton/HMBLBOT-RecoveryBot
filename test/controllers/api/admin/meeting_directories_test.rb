require "test_helper"
require "minitest/mock"

# Site Admin > Meeting lists (Api::Admin::MeetingDirectoriesController)
class Api::Admin::MeetingDirectoriesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @env = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "boss@example.com"
    @boss = User.create!(email: "boss@example.com", password: "password123", confirmed: true, name: "Boss", admin: true)
    @kim = User.create!(email: "kim@example.com", password: "password123", confirmed: true, name: "Kim")
  end

  teardown { ENV["ADMIN_EMAILS"] = @env }

  test "only suite admins" do
    sign_in @kim
    get "/api/admin/meeting_directories", as: :json
    assert_response :forbidden
  end

  test "add a list, preview, import, and find the meeting" do
    sign_in @boss
    post "/api/admin/meeting_directories", params: { meeting_directory: { name: "East Valley Intergroup", key: "EV Group" } }, as: :json
    assert_response :created
    list = response.parsed_body
    assert_equal "ev-group", list["key"]

    feed = [{ slug: "tue", name: "Tuesday Topic", day: 2, time: "18:00", formatted_address: "9 W Main St, Mesa, AZ" }].to_json
    post "/api/admin/meeting_directories/#{list['id']}/preview", params: { text: feed }, as: :json
    assert_response :success
    assert_equal({ "new" => 1, "missing" => 0 }, response.parsed_body["counts"])

    post "/api/admin/meeting_directories/#{list['id']}/import", params: { text: feed, keys: ["ev-group-tue"] }, as: :json
    assert_response :success
    assert_equal [1, 1], [response.parsed_body["saved"], response.parsed_body["directory"]["listed"]]

    sign_out @boss
    get "/api/meeting_search", params: { attendance: "in_person", q: "tuesday topic", time_zone: "America/Phoenix" }, as: :json
    assert_response :success
    hit = response.parsed_body["meetings"].first
    assert_equal ["Tuesday Topic", "in_person", "East Valley Intergroup"], [hit["name"], hit["attendance"], hit["group"]["source"]]

    # a list with listings can't be removed
    sign_in @boss
    delete "/api/admin/meeting_directories/#{list['id']}", as: :json
    assert_response :unprocessable_entity
  end

  test "a bad source answers with what's wrong" do
    sign_in @boss
    list = MeetingDirectory.create!(name: "X", key: "x")
    post "/api/admin/meeting_directories/#{list.id}/preview", params: { text: "nope,nope\n" }, as: :json
    assert_response :unprocessable_entity
    assert_match "Name, Day and Time", response.parsed_body["error"]
  end

  test "add many lists at once, and refresh one now" do
    sign_in @boss
    post "/api/admin/meeting_directories/bulk", params: { text: "Mesa Intergroup, https://example.org/feed\nnot a link", time_zone: "America/Denver" }, as: :json
    assert_response :success
    body = response.parsed_body
    assert_equal [["Mesa Intergroup", "America/Denver", true]], body["added"].map { |l| [l["name"], l["time_zone"], l["auto_refresh"]] }
    assert_equal ["No link in this line"], body["skipped"].map { |s| s["reason"] }

    list = MeetingDirectory.find_by!(name: "Mesa Intergroup")
    feed = [{ slug: "tue", name: "Tuesday Topic", day: 2, time: "18:00", formatted_address: "9 W Main St, Mesa, AZ" }].to_json
    OiaaFeed.stub(:fetch_feed, feed) do
      post "/api/admin/meeting_directories/#{list.id}/refresh", as: :json
    end
    assert_response :success
    assert_equal ["ok", 1, 1], [response.parsed_body["refresh_status"], response.parsed_body["refresh_result"]["new"], response.parsed_body["listed"]]

    patch "/api/admin/meeting_directories/#{list.id}", params: { meeting_directory: { auto_refresh: false } }, as: :json
    assert_equal false, response.parsed_body["auto_refresh"]
  end
end
