require "test_helper"

class Api::UserBlocksTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    ENV["GROUPS_FOR_EVERYONE"] = "1"
    @lee = User.create!(email: "lee@example.com", name: "Lee R", password: "password123", confirmed: true)
    @mo = User.create!(email: "mo@example.com", name: "Mo", password: "password123", confirmed: true)
    @oz = User.create!(email: "oz@example.com", name: "Oz", password: "password123", confirmed: true)
    @group = Group.create!(title: "Acid Test", time_zone: "America/Chicago")
    [@lee, @mo, @oz].each { |u| @group.memberships.create!(user: u, role: "member") }
    @lee.follows_given.create!(followed: @mo)
    @lee.follows_given.create!(followed: @oz)
    @mo.follows_given.create!(followed: @lee)
    @mine = @lee.timeline_notes.create!(body: "Mine", visibility: "public")
    @theirs = @mo.timeline_notes.create!(body: "From Mo", visibility: "public")
    @theirs.share_to!([@group])
    @oz.timeline_notes.create!(repost_of: @theirs, body: "", visibility: "public")
    @mine.comments.create!(user: @mo, body: "Mo's comment")
  end

  teardown { ENV.delete("GROUPS_FOR_EVERYONE") }

  def feed_bodies
    get "/api/people"
    response.parsed_body["feed"].map { |i| i["body"] || i.dig("note", "body") }
  end

  test "blocking hides their notes, reposts of them and their comments only from you" do
    sign_in @lee
    assert_includes feed_bodies, "From Mo"
    get "/api/groups/#{@group.slug}/page"
    assert_includes response.parsed_body.dig("context", "timeline").map { _1["id"] }, @theirs.id
    post "/api/people/#{@mo.username}/block", as: :json
    assert_response :success

    assert_equal ["Mine"], feed_bodies, "their note, and Oz's repost of it, are gone"
    item = response.parsed_body["feed"].find { _1["id"] == @mine.id }
    assert_equal [0, []], [item["comment_count"], item["comments"]]
    get "/api/people/#{@mo.username}"
    assert response.parsed_body["context"]["viewer"]["blocked"]
    assert_empty response.parsed_body["context"]["feed"]
    get "/api/groups/#{@group.slug}/page"
    refute_includes response.parsed_body.dig("context", "timeline").map { _1["id"] }, @theirs.id

    # Mo still sees everything, and isn't told
    sign_in @mo
    get "/api/people/#{@lee.username}"
    refute response.parsed_body["context"]["viewer"]["can_write"], "and can't write on Lee's page"
    get "/api/people"
    assert_includes response.parsed_body["feed"].map { _1["id"] }, @mine.id

    # Nothing Mo does reaches Lee
    assert_no_difference -> { @lee.notifications.count } do
      post "/api/timeline_notes/#{@mine.id}/comments", params: { body: "Hi @lee-r" }, as: :json
      put "/api/timeline_notes/#{@mine.id}/reaction", params: { kind: "love" }, as: :json
    end

    sign_in @lee
    delete "/api/people/#{@mo.username}/block", as: :json
    assert_includes feed_bodies, "From Mo"
  end

  test "you can't block yourself" do
    sign_in @lee
    post "/api/people/#{@lee.username}/block", as: :json
    assert_response :unprocessable_entity
  end
end
