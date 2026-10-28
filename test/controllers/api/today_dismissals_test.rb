require "test_helper"

class Api::TodayDismissalsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @me = User.create!(email: "me@example.com", name: "Colton", password: "password123", confirmed: true)
    @group = Group.create!(title: "Acid Test", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @me, role: "admin")
    @group.memberships.create!(user: User.create!(email: "new@example.com", name: "New", password: "password123", confirmed: true), role: "member", status: "requested")
  end

  def today = (get("/api/nav", as: :json) && response.parsed_body["today"])

  test "clearing a Needs your attention item, and restoring it" do
    post "/api/today_dismissals", params: { key: "x", title: "y" }, as: :json
    assert_response :unauthorized

    sign_in @me
    item = today["attention"].find { |i| i["key"] == "join-#{@group.id}" }
    assert_equal "1 person is asking to join", item["title"]

    post "/api/today_dismissals", params: { key: item["key"], title: item["title"] }, as: :json
    assert_response :no_content
    assert_nil today["attention"].find { |i| i["key"] == item["key"] }
    assert_equal [item["key"]], today["cleared"].map { |i| i["key"] }

    post "/api/today_dismissals", params: { key: item["key"], title: item["title"] }, as: :json
    assert_equal 1, @me.today_dismissals.count, "clearing twice keeps one"

    delete "/api/today_dismissals", params: { key: item["key"] }, as: :json
    assert_response :no_content
    assert today["attention"].any? { |i| i["key"] == item["key"] }
    assert_empty today["cleared"]
  end
end
