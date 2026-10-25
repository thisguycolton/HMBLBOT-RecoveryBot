require "test_helper"

class Api::HashtagsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    ENV["GROUPS_FOR_EVERYONE"] = "1"
    @lee = User.create!(email: "lee@example.com", name: "Lee R.", password: "password123", confirmed: true)
    @mo = User.create!(email: "mo@example.com", name: "Mo", password: "password123", confirmed: true)
    @oz = User.create!(email: "oz@example.com", name: "Oz", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @lee, role: "admin")
    @group.memberships.create!(user: @mo, role: "member")
  end

  teardown { ENV.delete("GROUPS_FOR_EVERYONE") }

  test "finding the tags in a note" do
    assert_equal %w[gratitude day_1 grateful], Hashtags.in("#Gratitude for #day_1, so #grateful! #gratitude again")
    assert_empty Hashtags.in("# A heading, #1 in line, a.com/#anchor, &#39; and `#code`")
    assert_equal %w[café], Hashtags.in("(#café)")
    note = @lee.timeline_notes.create!(body: "Grateful tonight #Gratitude", visibility: "public")
    assert_equal %w[gratitude], note.hashtags
    note.update!(body: "changed my mind #serenity")
    assert_equal %w[serenity], note.reload.hashtags
  end

  test "suggestions and tag pages only count notes the viewer can see" do
    @lee.timeline_notes.create!(body: "public #gratitude", visibility: "public")
    @lee.timeline_notes.create!(body: "private #gratitude #gratitudelist", visibility: "private")
    followers = @lee.timeline_notes.create!(body: "followers #gratitude", visibility: "followers")
    @mo.timeline_notes.create!(body: "group only #grateful", visibility: "private").share_to!([@group])
    @mo.timeline_notes.create!(body: "just me #grateful", visibility: "private")

    sign_in @lee
    get "/api/hashtags?q=grat", as: :json
    assert_equal [{ "name" => "gratitude", "count" => 3 }, { "name" => "grateful", "count" => 1 }, { "name" => "gratitudelist", "count" => 1 }],
                 response.parsed_body["hashtags"]

    sign_in @oz
    get "/api/hashtags?q=%23Grat", as: :json
    assert_equal [{ "name" => "gratitude", "count" => 1 }], response.parsed_body["hashtags"], "private, followers and group notes don't count"
    get "/api/hashtags/gratitude", as: :json
    assert_response :success
    assert_equal 1, response.parsed_body["count"]
    assert_equal ["public #gratitude"], response.parsed_body["feed"].map { |n| n["body"] }

    @oz.follows_given.create!(followed: @lee)
    get "/api/hashtags/Gratitude", as: :json
    assert_equal ["followers #gratitude", "public #gratitude"], response.parsed_body["feed"].map { |n| n["body"] }
    get "/api/hashtags/gratitude?before=#{followers.created_at.iso8601(6)}", as: :json
    assert_equal ["public #gratitude"], response.parsed_body["feed"].map { |n| n["body"] }

    get "/api/hashtags/grateful", as: :json
    assert_equal 0, response.parsed_body["count"]
    sign_in @lee
    get "/api/hashtags/grateful", as: :json
    assert_equal ["group only #grateful"], response.parsed_body["feed"].map { |n| n["body"] }, "notes shared to a group you're both in"

    get "/api/hashtags/not-a-tag", as: :json
    assert_response :not_found
  end

  test "reposts don't count twice" do
    note = @lee.timeline_notes.create!(body: "#serenity now", visibility: "public")
    @mo.timeline_notes.create!(repost_of: note, body: "", visibility: "public")
    sign_in @oz
    get "/api/hashtags", as: :json
    assert_equal [{ "name" => "serenity", "count" => 1 }], response.parsed_body["hashtags"]
  end

  test "signed out gets nothing" do
    get "/api/hashtags", as: :json
    assert_response :unauthorized
  end
end
