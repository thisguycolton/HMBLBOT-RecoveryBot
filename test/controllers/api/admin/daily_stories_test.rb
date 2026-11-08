require "test_helper"
require "minitest/mock"

# Site Admin > Daily story (Api::Admin::DailyStoriesController) and Facebook's sign-in
# (AdminPanel::FacebookController)
class Api::Admin::DailyStoriesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @env = ENV.to_h.slice("ADMIN_EMAILS", "FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET")
    ENV["ADMIN_EMAILS"] = "boss@example.com"
    ENV["FACEBOOK_APP_ID"] = "app-1"
    ENV["FACEBOOK_APP_SECRET"] = "shh"
    @boss = User.create!(email: "boss@example.com", password: "password123", confirmed: true, name: "Boss", admin: true)
    @kim = User.create!(email: "kim@example.com", password: "password123", confirmed: true, name: "Kim", admin: true)
    book = Book.create!(title: "Daily Reflections", slug: "daily-reflections")
    book.chapters.create!(title: "Today's Reading", slug: "#{Date::MONTHNAMES[Time.current.in_time_zone('America/Phoenix').month].downcase}-#{Time.current.in_time_zone('America/Phoenix').day}", index: 1)
  end

  teardown do
    %w[ADMIN_EMAILS FACEBOOK_APP_ID FACEBOOK_APP_SECRET].each { |k| @env.key?(k) ? ENV[k] = @env[k] : ENV.delete(k) }
  end

  PAGE = { "id" => "123", "name" => "RecoveryBot", "access_token" => "PAGE-TOKEN", "instagram_business_account" => { "id" => "ig-9", "username" => "recoverybot" } }.freeze

  test "only suite admins" do
    sign_in @kim
    get "/api/admin/daily_story", as: :json
    assert_response :forbidden
    get "/admin_panel/facebook/connect"
    assert_redirected_to "/"
  end

  test "paste a Page token, set the time, post now, disconnect; the token never comes back" do
    sign_in @boss
    get "/api/admin/daily_story", as: :json
    assert_response :success
    assert_equal [false, true], [response.parsed_body.dig("connection", "connected"), response.parsed_body.dig("connection", "app_configured")]
    assert_equal "Today's Reading", response.parsed_body.dig("today", "title")

    MetaGraph.stub(:page_for_token, ->(token) { PAGE.merge("access_token" => token) }) do
      post "/api/admin/daily_story/token", params: { token: " PAGE-TOKEN " }, as: :json
    end
    assert_response :success
    assert_equal ["RecoveryBot", "recoverybot"], response.parsed_body["connection"].values_at("page_name", "instagram_username")
    assert_not_includes response.body, "PAGE-TOKEN"
    assert_equal ["PAGE-TOKEN", @boss], FacebookPageConnection.current.then { |c| [c.page_token, c.connected_by] }

    patch "/api/admin/daily_story", params: { enabled: true, instagram_enabled: true, post_at: "07:30", time_zone: "America/Chicago", look: "sunrise" }, as: :json
    assert_response :success
    assert_equal [true, true, "07:30", "America/Chicago", "sunrise"], response.parsed_body["connection"].values_at("enabled", "instagram_enabled", "post_at", "time_zone", "look")
    assert response.parsed_body.dig("connection", "next_post_at")

    patch "/api/admin/daily_story", params: { post_at: "25:00" }, as: :json
    assert_response :unprocessable_entity

    DailyStory.stub(:clips, ->(*, **) { ["/tmp/story-1.mp4"] }) do
      MetaGraph.stub(:post_page_story, "123_1") do
        MetaGraph.stub(:post_instagram_story, "ig1") do
          post "/api/admin/daily_story/post_now", as: :json
        end
      end
    end
    assert_response :success
    post_json = response.parsed_body["posts"].first
    assert_equal ["posted", "admin", "Boss", ["123_1"], ["ig1"]], post_json.values_at("status", "triggered_by", "by", "facebook_ids", "instagram_ids")

    delete "/api/admin/daily_story", as: :json
    assert_response :success
    assert_equal [false, false], response.parsed_body["connection"].values_at("connected", "enabled")
    assert_nil FacebookPageConnection.current.page_token
  end

  test "a bad token says why" do
    sign_in @boss
    MetaGraph.stub(:page_for_token, ->(_) { raise MetaGraph::Error, "That's a token for a person, not a Page." }) do
      post "/api/admin/daily_story/token", params: { token: "user-token" }, as: :json
    end
    assert_response :unprocessable_entity
    assert_match(/not a Page/, response.parsed_body["error"])
  end

  test "Facebook sign-in: one Page connects it, several ask which" do
    sign_in @boss
    get "/admin_panel/facebook/connect?instagram=1"
    assert_response :redirect
    dialog = URI(response.location)
    query = Rack::Utils.parse_query(dialog.query)
    assert_equal ["www.facebook.com", "app-1", "http://www.example.com/admin_panel/facebook/callback"], [dialog.host, query["client_id"], query["redirect_uri"]]
    assert_includes query["scope"], "pages_manage_posts"
    assert_includes query["scope"], "instagram_content_publish"

    get "/admin_panel/facebook/callback", params: { code: "c", state: "wrong" }
    assert_match(/error=/, response.location)
    assert_not FacebookPageConnection.current.connected?

    get "/admin_panel/facebook/connect"
    state = Rack::Utils.parse_query(URI(response.location).query)["state"]
    MetaGraph.stub(:user_token, "USER") do
      MetaGraph.stub(:pages, [PAGE, PAGE.merge("id" => "456", "name" => "Other Page", "access_token" => "OTHER")]) do
        get "/admin_panel/facebook/callback", params: { code: "c", state: state }
      end
    end
    assert_redirected_to "/admin_panel/daily_story?choose=1"
    get "/api/admin/daily_story", as: :json
    assert_equal %w[RecoveryBot Other\ Page], response.parsed_body.dig("connection", "choices").map { |c| c["name"] }
    assert_not_includes response.body, "OTHER"

    post "/api/admin/daily_story/choose", params: { page_id: "456" }, as: :json
    assert_response :success
    assert_equal ["Other Page", []], response.parsed_body["connection"].values_at("page_name", "choices")
    assert_equal "OTHER", FacebookPageConnection.current.page_token
  end
end
