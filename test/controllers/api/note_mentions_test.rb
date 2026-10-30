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

  test "a note on someone's page tells them once, not again for mentioning them" do
    @mo.follows_given.create!(followed: @lee)
    sign_in @mo
    assert_difference -> { @lee.notifications.count }, 1 do
      post "/api/timeline_notes", params: { note: { body: "Proud of you @lee-r", to: @lee.username, visibility: "private" } }, as: :json
    end
    assert_response :created
    assert_equal "note.on_profile", @lee.notifications.last.kind
    assert response.parsed_body["mentions"].key?("lee-r")
  end

  test "the author can turn comments off" do
    @mo.follows_given.create!(followed: @lee)
    sign_in @lee
    post "/api/timeline_notes", params: { note: { body: "Quiet one", visibility: "followers" } }, as: :json
    note = TimelineNote.last
    patch "/api/timeline_notes/#{note.id}", params: { note: { comments_off: true } }, as: :json
    assert_response :success
    assert response.parsed_body["comments_off"]
    assert_equal "Quiet one", note.reload.body
    refute response.parsed_body["edited"]

    sign_in @mo
    get "/api/people"
    item = response.parsed_body["feed"].find { _1["id"] == note.id }
    refute item["can_comment"]
    post "/api/timeline_notes/#{note.id}/comments", params: { body: "Hi" }, as: :json
    assert_response :forbidden
  end
end
