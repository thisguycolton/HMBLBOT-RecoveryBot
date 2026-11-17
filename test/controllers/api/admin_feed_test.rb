require "test_helper"

# Site admins' "Everyone's posts" home feed (Api::AdminFeedsController, ProfilePage#everyone_feed)
class Api::AdminFeedTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    ENV["GROUPS_FOR_EVERYONE"] = "1"
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "boss@example.com,flag@example.com"
    @boss = User.create!(email: "boss@example.com", name: "Boss", password: "password123", confirmed: true, admin: true)
    # Admin flag but not in ADMIN_EMAILS, and in ADMIN_EMAILS without the flag: neither is a site admin
    @flag = User.create!(email: "half@example.com", name: "Half", password: "password123", confirmed: true, admin: true)
    @listed = User.create!(email: "flag@example.com", name: "Listed", password: "password123", confirmed: true)
    @mo = User.create!(email: "mo@example.com", name: "Mo", password: "password123", confirmed: true)
    @oz = User.create!(email: "oz@example.com", name: "Oz", password: "password123", confirmed: true)
    %w[private followers public].each { |v| @oz.timeline_notes.create!(body: "oz #{v}", visibility: v) }
    Follow.create!(follower: @oz, followed: @mo) # so Oz may write on Mo's page; Mo doesn't follow Oz
    @oz.timeline_notes.create!(body: "oz private to mo", visibility: "private", recipient: @mo)
  end

  teardown do
    ENV.delete("GROUPS_FOR_EVERYONE")
    ENV["ADMIN_EMAILS"] = @previous
  end

  def home_bodies
    get "/api/people", as: :json
    assert_response :success
    response.parsed_body["feed"].map { |i| i["body"] }
  end

  test "a site admin switches to everyone's posts, and never sees Only me posts" do
    sign_in @boss
    assert_empty home_bodies, "off by default: they don't follow Oz"
    assert_equal false, response.parsed_body["everyone"]
    get "/api/nav", as: :json
    assert_equal({ "see_all_posts" => false }, response.parsed_body["site_admin"])

    put "/api/admin_feed", params: { all: true }, as: :json
    assert_response :success
    assert @boss.reload.see_all_posts
    assert_equal ["oz followers", "oz public"], home_bodies.sort
    assert_equal true, response.parsed_body["everyone"]

    put "/api/admin_feed", params: { all: false }, as: :json
    assert_empty home_bodies
  end

  test "nobody else can turn it on or see more, even with the setting saved" do
    [@flag, @listed, @mo].each do |user|
      user.update_column(:see_all_posts, true)
      sign_in user
      put "/api/admin_feed", params: { all: true }, as: :json
      assert_response :forbidden
      bodies = home_bodies
      assert_nil response.parsed_body["everyone"]
      assert_not_includes bodies, "oz public", "#{user.email} doesn't follow Oz"
      get "/api/nav", as: :json
      assert_nil response.parsed_body["site_admin"]
    end
    assert_includes (sign_in(@mo) && home_bodies), "oz private to mo", "the note on Mo's page is still theirs"
  end

  test "signed out can't flip it" do
    put "/api/admin_feed", params: { all: true }, as: :json
    assert_response :unauthorized
  end
end
