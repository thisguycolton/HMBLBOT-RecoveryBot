require "test_helper"
require "minitest/mock"

class Api::NoteCommentsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    ENV["GROUPS_FOR_EVERYONE"] = "1"
    @lee = User.create!(email: "lee@example.com", name: "Lee R.", password: "password123", confirmed: true)
    @mo = User.create!(email: "mo@example.com", name: "Mo", password: "password123", confirmed: true)
    @oz = User.create!(email: "oz@example.com", name: "Oz", password: "password123", confirmed: true)
  end

  teardown { ENV.delete("GROUPS_FOR_EVERYONE") }

  test "people who can see a note comment on it, react to comments, and edit or delete their own" do
    note = @lee.timeline_notes.create!(body: "Day 90", visibility: "followers")
    @mo.follows_given.create!(followed: @lee)

    sign_in @oz
    post "/api/timeline_notes/#{note.id}/comments", params: { body: "Hi" }, as: :json
    assert_response :not_found, "Oz doesn't follow Lee, so can't see the note"

    sign_in @mo
    assert_difference -> { @lee.notifications.count }, 1 do
      post "/api/timeline_notes/#{note.id}/comments", params: { body: "So **proud** of you" }, as: :json
    end
    assert_response :created
    comment = response.parsed_body
    assert_equal "Mo commented on your note", @lee.notifications.last.title
    assert comment["mine"]
    assert comment["can_remove"]

    post "/api/timeline_notes/#{note.id}/comments", params: { body: "  " }, as: :json
    assert_response :unprocessable_entity

    patch "/api/note_comments/#{comment['id']}", params: { body: "So proud of you!" }, as: :json
    assert_response :success
    assert_equal "So proud of you!", response.parsed_body["body"]

    # Lee sees it on the note, reacts to it, can delete it but not change it
    sign_in @lee
    get "/api/people/me"
    item = response.parsed_body["context"]["feed"].first
    assert_equal 1, item["comment_count"]
    assert_equal ["So proud of you!"], item["comments"].map { |c| c["body"] }
    assert_difference -> { @mo.notifications.count }, 1 do
      put "/api/note_comments/#{comment['id']}/reaction", params: { kind: "love" }, as: :json
    end
    assert_equal "Lee R. loved your comment", @mo.notifications.last.title
    assert_equal 1, response.parsed_body["reactions"]["love"]
    patch "/api/note_comments/#{comment['id']}", params: { body: "Changed" }, as: :json
    assert_response :forbidden

    sign_in @oz
    delete "/api/note_comments/#{comment['id']}", as: :json
    assert_response :not_found

    sign_in @lee
    delete "/api/note_comments/#{comment['id']}", as: :json
    assert_response :no_content
    assert_not NoteComment.exists?(comment["id"])
    assert_equal 0, NoteReaction.count
  end

  test "comments on a repost go to the original, and go with it" do
    note = @lee.timeline_notes.create!(body: "Keep coming back", visibility: "public")
    repost = @mo.timeline_notes.create!(repost_of: note, body: "", visibility: "public")
    sign_in @oz
    post "/api/timeline_notes/#{repost.id}/comments", params: { body: "Yes" }, as: :json
    assert_response :created
    assert_equal 1, note.comments.count

    note.destroy!
    assert_equal 0, NoteComment.count
  end

  test "a note keeps the preview of its link, and loses it when the link is taken off" do
    preview = { url: "https://example.org/story", title: "A story", description: "About hope", site_name: "Example",
                image_url: "https://example.org/pic.png" }
    picture = -> { { io: StringIO.new(file_fixture("avatar.png").binread), filename: "link-preview.png", content_type: "image/png" } }
    sign_in @lee
    LinkPreview.stub(:fetch, preview) do
      LinkPreview.stub(:image, ->(_) { picture.call }) do
        get "/api/link_preview", params: { url: preview[:url] }
        assert_response :success
        assert_equal "A story", response.parsed_body["title"]
        assert_match %r{\A/api/link_preview/image\?token=}, response.parsed_body["image_url"]
        get response.parsed_body["image_url"]
        assert_response :success
        assert_equal "image/png", response.media_type
        get "/api/link_preview/image", params: { token: "forged" }
        assert_response :not_found

        post "/api/timeline_notes", params: { note: { body: "Read this https://example.org/story", visibility: "public", link_url: preview[:url] } }, as: :json
        assert_response :created
      end
    end
    note = TimelineNote.last
    assert_equal "A story", note.link_preview["title"]
    assert note.link_image.attached?
    get "/api/people/me"
    link = response.parsed_body["context"]["feed"].first["link"]
    assert_equal "Example", link["site_name"]
    assert_match %r{/rails/active_storage/}, link["image_url"]

    patch "/api/timeline_notes/#{note.id}", params: { note: { link_url: "" } }, as: :json
    assert_response :success
    assert_nil response.parsed_body["link"]
    assert_nil note.reload.link_preview
  end
end
