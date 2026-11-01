require "test_helper"

# Reposting someone's shared highlight to your own timeline (TimelineNote#repost_of_highlight),
# and reacting to it
class Api::HighlightRepostsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    ENV["GROUPS_FOR_EVERYONE"] = "1"
    @lee = User.create!(email: "lee@example.com", name: "Lee R", password: "password123", confirmed: true)
    @mo = User.create!(email: "mo@example.com", name: "Mo", password: "password123", confirmed: true)
    @oz = User.create!(email: "oz@example.com", name: "Oz", password: "password123", confirmed: true)
    book = Book.create!(title: "Big Book", slug: "big-book")
    @chapter = book.chapters.create!(title: "How It Works", slug: "how-it-works", index: 1)
  end

  teardown { ENV.delete("GROUPS_FOR_EVERYONE") }

  def highlight(user, visibility: "public", note: "So true")
    user.user_highlights.create!(chapter: @chapter, note: note, visibility: visibility,
                                 selector: { "quote" => { "exact" => "Rarely have we seen a person fail" } }, style: { "color" => "yellow" })
  end

  test "reposting a Members highlight puts it on your timeline, crediting its reader, once" do
    h = highlight(@lee)
    Follow.create!(follower: @oz, followed: @mo)
    sign_in @mo

    assert_difference -> { @lee.notifications.count }, 1 do
      post "/api/highlights/#{h.id}/repost", params: { visibility: "followers" }, as: :json
    end
    assert_response :created
    repost = response.parsed_body
    assert_equal "repost", repost["kind"]
    assert_equal "followers", repost["visibility"]
    assert_equal "highlight", repost.dig("note", "kind")
    assert_equal "Rarely have we seen a person fail", repost.dig("note", "quote")
    assert_equal "Lee R", repost.dig("note", "author", "name")
    assert repost.dig("note", "reposted")
    assert_equal "Mo reposted your highlight", @lee.notifications.last.title

    assert_no_difference -> { TimelineNote.count } do
      post "/api/highlights/#{h.id}/repost", as: :json
    end

    # On Mo's profile, and on Oz's home feed (Oz follows Mo)
    feed = ProfilePage.new(@oz).feed(@mo)
    assert_equal [["repost", h.id]], feed.map { |i| [i[:kind], i.dig(:note, :id)] }
    assert_equal ["repost"], ProfilePage.new(@oz).following_feed.map { |i| i[:kind] }

    # Undo
    delete "/api/highlights/#{h.id}/repost", as: :json
    assert_response :success
    assert_not response.parsed_body["reposted"]
    assert_equal 0, h.reposts.count
  end

  test "only highlights shared with Members can be reposted, never your own" do
    friends = highlight(@lee, visibility: "followers")
    secret = highlight(@lee, visibility: "private")
    Follow.create!(follower: @mo, followed: @lee)
    sign_in @mo

    post "/api/highlights/#{friends.id}/repost", as: :json
    assert_response :unprocessable_entity
    assert_match "shared with Members", response.parsed_body["error"]

    post "/api/highlights/#{secret.id}/repost", as: :json
    assert_response :not_found

    assert_match "only with their followers", friends.as_feed_json(viewer: @mo)[:repost_blocked]
    assert_not friends.as_feed_json(viewer: @mo)[:can_repost]

    sign_in @lee
    post "/api/highlights/#{highlight(@lee).id}/repost", as: :json
    assert_response :unprocessable_entity
    assert_equal 0, TimelineNote.count
  end

  test "narrowing who sees it, taking it off the timeline or deleting it takes its reposts away" do
    h = highlight(@lee)
    @mo.timeline_notes.create!(repost_of_highlight: h, body: "", visibility: "public")
    @oz.timeline_notes.create!(repost_of_highlight: h, body: "", visibility: "public")
    assert_equal 2, h.reposts.count

    h.update!(visibility: "followers")
    assert_equal 0, h.reposts.count

    h.update!(visibility: "public")
    @mo.timeline_notes.create!(repost_of_highlight: h, body: "", visibility: "public")
    h.update!(visibility: "private")
    assert_equal 0, TimelineNote.count

    h.update!(visibility: "public")
    @mo.timeline_notes.create!(repost_of_highlight: h, body: "", visibility: "public")
    h.destroy!
    assert_equal 0, TimelineNote.count
  end

  test "people who blocked its reader don't see reposts of it, and can't repost it" do
    h = highlight(@lee)
    @mo.timeline_notes.create!(repost_of_highlight: h, body: "", visibility: "public")
    UserBlock.create!(blocker: @oz, blocked: @lee)

    assert_empty ProfilePage.new(@oz).feed(@mo)
    assert_equal 1, ProfilePage.new(@lee).feed(@mo).size

    sign_in @oz
    post "/api/highlights/#{h.id}/repost", as: :json
    assert_response :not_found
  end

  test "a reposted highlight's quote and note show, but can't be reacted to or commented on as a note" do
    h = highlight(@lee)
    repost = @mo.timeline_notes.create!(repost_of_highlight: h, body: "", visibility: "public")
    sign_in @oz

    put "/api/timeline_notes/#{repost.id}/reaction", params: { kind: "like" }, as: :json
    assert_response :not_found
    post "/api/timeline_notes/#{repost.id}/comments", params: { comment: { body: "hi" } }, as: :json
    assert_response :not_found
  end

  test "people who see a shared highlight react to it, once each, and its reader hears about the first" do
    h = highlight(@lee)
    sign_in @mo
    assert_difference -> { @lee.notifications.count }, 1 do
      put "/api/highlights/#{h.id}/reaction", params: { kind: "love" }, as: :json
    end
    assert_response :success
    assert_equal "love", response.parsed_body["my_reaction"]
    assert_equal({ "like" => 0, "love" => 1, "hugs" => 0 }, response.parsed_body["reactions"])
    assert_equal "Mo loved your highlight", @lee.notifications.last.title
    assert_equal "highlight.reaction", @lee.notifications.last.kind

    assert_no_difference -> { @lee.notifications.count } do
      put "/api/highlights/#{h.id}/reaction", params: { kind: "hugs" }, as: :json
    end
    assert_equal({ "like" => 0, "love" => 0, "hugs" => 1 }, response.parsed_body["reactions"])
    assert_equal [["Mo", "hugs"]], ProfilePage.new(@oz).feed(@lee).first[:reactors].map { |p| [p[:name], p[:reaction]] }

    delete "/api/highlights/#{h.id}/reaction", as: :json
    assert_nil response.parsed_body["my_reaction"]
    assert_equal 0, h.reactions.count

    secret = highlight(@lee, visibility: "private")
    put "/api/highlights/#{secret.id}/reaction", params: { kind: "like" }, as: :json
    assert_response :not_found

    put "/api/highlights/#{h.id}/reaction", params: { kind: "like" }, as: :json
    h.destroy!
    assert_equal 0, NoteReaction.count
  end
end
