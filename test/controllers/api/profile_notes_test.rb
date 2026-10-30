require "test_helper"

# Notes written on someone else's profile (TimelineNote#recipient)
class Api::ProfileNotesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    ENV["GROUPS_FOR_EVERYONE"] = "1"
    @lee = User.create!(email: "lee@example.com", name: "Lee R.", password: "password123", confirmed: true)
    @mo = User.create!(email: "mo@example.com", name: "Mo", password: "password123", confirmed: true)
    @oz = User.create!(email: "oz@example.com", name: "Oz", password: "password123", confirmed: true)
    @mo.follows_given.create!(followed: @lee)
  end

  teardown { ENV.delete("GROUPS_FOR_EVERYONE") }

  def feed_of(username) = (get("/api/people/#{username}", as: :json) && response.parsed_body.dig("context", "feed"))

  test "you write on the page of someone you follow or who follows you" do
    sign_in @oz
    get "/api/people/lee-r", as: :json
    assert_not response.parsed_body.dig("context", "viewer", "can_write")
    post "/api/timeline_notes", params: { note: { body: "Hi", to: "lee-r" } }, as: :json
    assert_response :unprocessable_entity

    sign_in @lee
    get "/api/people/mo", as: :json
    assert response.parsed_body.dig("context", "viewer", "can_write"), "Mo follows Lee, so Lee can write on Mo's page"
    post "/api/timeline_notes", params: { note: { body: "Glad you came tonight", to: "mo", visibility: "private" } }, as: :json
    assert_response :created
    note = response.parsed_body
    assert_equal "mo", note.dig("recipient", "username")
    assert_not note["can_repost"]

    notification = @mo.notifications.sole
    assert_equal ["note.on_profile", "Lee R. wrote on your page", "/people/mo"], notification.attributes.values_at("kind", "title", "url")

    get "/api/people/me", as: :json
    assert_includes response.parsed_body.dig("context", "feed").map { |i| i["id"] }, note["id"], "it's on its author's timeline too"

    sign_in @mo
    item = feed_of("me").find { |i| i["id"] == note["id"] }
    assert item["can_remove"]
    assert_nil item["visibility"], "only its author picks who sees it"
    get "/api/people", as: :json
    assert_includes response.parsed_body["feed"].map { |i| i["id"] }, note["id"], "it's on their home feed"

    sign_in @oz
    assert_empty feed_of("mo"), "private is only the two of them"
    patch "/api/timeline_notes/#{note['id']}", params: { note: { visibility: "public" } }, as: :json
    assert_response :not_found
  end

  test "who else sees it counts from its author, and the person it's on can take it off" do
    sign_in @mo
    post "/api/timeline_notes", params: { note: { body: "Proud of you", to: "lee-r", visibility: "followers", group_slugs: [] } }, as: :json
    id = response.parsed_body["id"]

    sign_in @oz
    assert_empty feed_of("lee-r")
    @oz.follows_given.create!(followed: @mo)
    assert_equal [id], feed_of("lee-r").map { |i| i["id"] }, "Oz follows Mo, who wrote it"
    delete "/api/timeline_notes/#{id}", as: :json
    assert_response :not_found

    sign_in @lee
    delete "/api/timeline_notes/#{id}", as: :json
    assert_response :no_content
    assert_not TimelineNote.exists?(id)
  end

  test "you can't write on your own page that way, or to nobody" do
    sign_in @mo
    post "/api/timeline_notes", params: { note: { body: "Hi", to: "mo" } }, as: :json
    assert_response :unprocessable_entity
    post "/api/timeline_notes", params: { note: { body: "Hi", to: "nobody-here" } }, as: :json
    assert_response :not_found
    assert_equal 0, TimelineNote.count
  end
end
