require "test_helper"

class Api::NoteMentionsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    ENV["GROUPS_FOR_EVERYONE"] = "1"
    @lee = User.create!(email: "lee@example.com", name: "Lee R", password: "password123", confirmed: true)
    @mo = User.create!(email: "mo@example.com", name: "Mo", password: "password123", confirmed: true)
    @oz = User.create!(email: "oz@example.com", name: "Oz", password: "password123", confirmed: true)
    @group = Group.create!(title: "Acid Test", time_zone: "America/Chicago")
    @group.memberships.create!(user: @lee, role: "member")
    @group.memberships.create!(user: @oz, role: "member", can_host: true)
  end

  teardown { ENV.delete("GROUPS_FOR_EVERYONE") }

  test "mentions in notes tell people who can see them, and roles in the groups it's shared to" do
    @mo.follows_given.create!(followed: @lee)
    sign_in @lee
    assert_difference -> { Notification.where(kind: "mention.note").count }, 1 do
      post "/api/timeline_notes", params: { note: { body: "Thanks @mo and @oz", visibility: "followers" } }, as: :json
    end
    assert_response :created
    assert_equal [@mo], Notification.where(kind: "mention.note").map(&:user), "Oz doesn't follow Lee, so can't see it"
    note = TimelineNote.last
    assert_equal %w[mo oz], note.mentions.keys.sort
    assert response.parsed_body["mentions"].key?("mo")

    assert_difference -> { @oz.notifications.count }, 1 do
      patch "/api/timeline_notes/#{note.id}", params: { note: { body: "Thanks @mo and @hosts", group_slugs: [@group.slug] } }, as: :json
    end
    assert_equal "Lee R mentioned @hosts in a note", @oz.notifications.last.title
    assert_no_difference -> { Notification.count } do
      patch "/api/timeline_notes/#{note.id}", params: { note: { body: "Thanks @mo and @hosts!" } }, as: :json
    end

    sign_in @mo
    assert_difference -> { @oz.notifications.where(kind: "mention.note").count }, 1 do
      post "/api/timeline_notes/#{note.id}/comments", params: { body: "Yes @oz" }, as: :json
    end
    assert_equal "Mo mentioned you in a comment", @oz.notifications.last.title
  end

  test "writing a note on the page of someone you follow, or who follows you" do
    sign_in @mo
    post "/api/timeline_notes", params: { note: { body: "Hi Lee", profile: @lee.username, visibility: "private" } }, as: :json
    assert_response :unprocessable_entity

    @mo.follows_given.create!(followed: @lee)
    get "/api/people/#{@lee.username}"
    assert response.parsed_body["context"]["viewer"]["can_write_note"]
    assert_difference -> { @lee.notifications.where(kind: "note.profile").count }, 1 do
      post "/api/timeline_notes", params: { note: { body: "Proud of you @lee-r", profile: @lee.username, visibility: "private", group_slugs: [@group.slug] } }, as: :json
    end
    assert_response :created
    assert_equal 0, Notification.where(kind: "mention.note").count, "told once, that it's on their page"
    note = TimelineNote.last
    assert_equal [@lee, []], [note.profile, note.groups.to_a]
    assert_equal "Mo wrote on your page", @lee.notifications.last.title
    assert_equal @lee.username, response.parsed_body["on_page"]["username"]

    # On Lee's page, not Mo's; "private" is just the two of them
    get "/api/people/#{@lee.username}"
    assert_includes response.parsed_body["context"]["feed"].map { _1["id"] }, note.id
    get "/api/people/#{@mo.username}"
    refute_includes response.parsed_body["context"]["feed"].map { _1["id"] }, note.id
    sign_in @oz
    @oz.follows_given.create!(followed: @lee)
    get "/api/people/#{@lee.username}"
    refute_includes response.parsed_body["context"]["feed"].map { _1["id"] }, note.id
    note.update!(visibility: "followers")
    get "/api/people/#{@lee.username}"
    assert_includes response.parsed_body["context"]["feed"].map { _1["id"] }, note.id
    get "/api/people"
    assert_includes response.parsed_body["feed"].map { _1["id"] }, note.id, "on the home feed of Lee's followers"
    post "/api/timeline_notes/#{note.id}/repost", as: :json
    assert_response :unprocessable_entity

    # Lee can take it off their page; Mo still can't be the one to change Lee's mind
    sign_in @lee
    get "/api/people/me"
    item = response.parsed_body["context"]["feed"].find { _1["id"] == note.id }
    assert item["can_delete"]
    delete "/api/timeline_notes/#{note.id}"
    assert_response :no_content
  end
end
