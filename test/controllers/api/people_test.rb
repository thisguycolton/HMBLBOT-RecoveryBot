require "test_helper"

class Api::PeopleTest < ActionDispatch::IntegrationTest
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
    book = Book.create!(title: "Big Book", slug: "big-book")
    @chapter = book.chapters.create!(title: "Chapter 5", slug: "how-it-works", index: 1)
  end

  teardown { ENV.delete("GROUPS_FOR_EVERYONE") }

  def highlight!(user, visibility)
    user.user_highlights.create!(chapter: @chapter, style: { "color" => "yellow" }, visibility: visibility,
                                 selector: { "quote" => { "exact" => "#{visibility} words" }, "position" => { "start" => 1, "end" => 5 } })
  end

  test "everyone gets a username, and they can change it" do
    assert_equal "lee-r", @lee.username
    assert_equal "mo", @mo.username
    assert_equal "mo-2", User.create!(email: "mo2@example.com", name: "Mo", password: "password123", confirmed: true).username
    assert_equal "member", User.create!(email: "x@example.com", name: "Me", password: "password123", confirmed: true).username

    sign_in @mo
    patch "/api/profile", params: { profile: { username: "Lee-R" } }, as: :json
    assert_response :unprocessable_entity
    patch "/api/profile", params: { profile: { username: "morning-mo", default_highlight_visibility: "followers", default_note_visibility: "public" } }, as: :json
    assert_response :success
    assert_equal "morning-mo", response.parsed_body["username"]
    assert_equal "followers", @mo.reload.default_highlight_visibility
  end

  test "what others see depends on visibility and following" do
    %w[private followers public].each { |v| highlight!(@lee, v) }
    %w[private followers public].each { |v| @lee.timeline_notes.create!(body: "#{v} note", visibility: v) }

    sign_in @lee
    get "/api/people/me", as: :json
    assert_response :success
    assert_equal 6, response.parsed_body.dig("context", "feed").size
    assert response.parsed_body["can_edit"]

    sign_in @oz
    get "/api/people/lee-r", as: :json
    feed = response.parsed_body.dig("context", "feed")
    assert_equal ["public note", "public words"].sort, feed.map { |i| i["body"] || i["quote"] }.sort
    assert_not response.parsed_body["can_edit"]
    assert_empty response.parsed_body.dig("context", "groups"), "groups only show when you're in them too"

    post "/api/people/lee-r/follow", as: :json
    assert_response :success
    assert response.parsed_body["following"]
    assert_equal 1, @lee.notifications.where(kind: "follow.created").count
    post "/api/people/lee-r/follow", as: :json
    assert_equal 1, @lee.follows_received.count

    get "/api/people/lee-r", as: :json
    assert_equal 4, response.parsed_body.dig("context", "feed").size
    get "/api/people", as: :json
    assert_equal 4, response.parsed_body["feed"].size, "the People page shows what people you follow share with followers"

    delete "/api/people/lee-r/follow", as: :json
    assert_not response.parsed_body["following"]

    sign_in @mo
    get "/api/people/lee-r", as: :json
    assert_equal ["Sunrise Crew"], response.parsed_body.dig("context", "groups").map { |g| g["title"] }
  end

  test "profiles are closed while Groups is" do
    ENV.delete("GROUPS_FOR_EVERYONE")
    sign_in @oz
    get "/api/people/lee-r", as: :json
    assert_response :forbidden
    get "/people/lee-r"
    assert_redirected_to root_path
  end

  test "new highlights and notes take your default, and notes hold pictures" do
    @mo.update!(default_highlight_visibility: "public", default_note_visibility: "followers")
    sign_in @mo
    post "/api/highlights", params: { highlight: { chapter_slug: "how-it-works", style: { color: "yellow" }, selector: { quote: { exact: "Rarely" } } } }, as: :json
    assert_response :created
    assert_equal "public", response.parsed_body["visibility"]
    patch "/api/highlights/#{response.parsed_body['id']}", params: { highlight: { visibility: "private" } }, as: :json
    assert_equal "private", response.parsed_body["visibility"]

    picture = fixture_file_upload("avatar.png", "image/png")
    post "/api/timeline_notes", params: { note: { body: "**Day 30**", images: [picture] } }
    assert_response :created
    note = TimelineNote.find(response.parsed_body["id"])
    assert_equal "followers", note.visibility
    assert_equal 1, response.parsed_body["images"].size

    post "/api/timeline_notes", params: { note: { body: "", images: [fixture_file_upload("avatar.png", "text/plain")] } }
    assert_response :unprocessable_entity

    image_id = note.images.first.id
    patch "/api/timeline_notes/#{note.id}", params: { note: { images: [fixture_file_upload("avatar.png", "image/png")], remove_image_ids: [image_id], visibility: "public" } }
    assert_response :success
    assert_equal 1, note.reload.images.size
    assert_not_equal image_id, note.images.first.id
    assert_equal "public", note.visibility

    patch "/api/timeline_notes/#{note.id}", params: { note: { body: "", remove_image_ids: [note.images.first.id] } }
    assert_response :unprocessable_entity
  end

  test "people lay out their own profile page" do
    sign_in @mo
    get "/api/people/me", as: :json
    assert_equal false, response.parsed_body["custom"]
    assert_equal %w[feed about groups people], response.parsed_body["blocks"].map { |b| b["type"] }

    patch "/api/profile_page", params: { page: { layout: "centered", blocks: [{ type: "about" }, { type: "meetings" }, { type: "feed", show: "highlights", color: "rose" }] } }, as: :json
    assert_response :success
    assert_equal %w[about feed], @mo.reload.page_blocks.map { |b| b["type"] }
    assert_equal "highlights", @mo.page_blocks.last["show"]

    patch "/api/profile_page", params: { page: { reset: true } }, as: :json
    assert_not @mo.reload.custom_page?
  end

  test "the old timeline goes to your profile" do
    sign_in @mo
    get "/groups/timeline"
    assert_redirected_to "/people/me"
  end
end
