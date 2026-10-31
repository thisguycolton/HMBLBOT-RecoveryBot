require "test_helper"

# #hashtags and @ mentions in the notes on highlights (UserHighlight)
class Api::HighlightNoteTagsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    ENV["GROUPS_FOR_EVERYONE"] = "1"
    @lee = User.create!(email: "lee@example.com", name: "Lee R", password: "password123", confirmed: true)
    @mo = User.create!(email: "mo@example.com", name: "Mo", password: "password123", confirmed: true)
    @oz = User.create!(email: "oz@example.com", name: "Oz", password: "password123", confirmed: true)
    book = Book.create!(title: "Big Book", slug: "big-book")
    @chapter = book.chapters.create!(title: "Chapter 5", slug: "how-it-works", index: 1)
  end

  teardown { ENV.delete("GROUPS_FOR_EVERYONE") }

  def highlight(user, note, visibility: "private")
    user.user_highlights.create!(chapter: @chapter, note: note, visibility: visibility,
                                 selector: { "quote" => { "exact" => "Rarely have we seen" } }, style: { "color" => "yellow" })
  end

  test "a highlight's note keeps its tags" do
    h = highlight(@lee, "So true #Honesty and #open_mind")
    assert_equal %w[honesty open_mind], h.hashtags
    h.update!(note: "changed #willingness")
    assert_equal %w[willingness], h.reload.hashtags
  end

  test "tag suggestions and pages count only shared highlights the viewer can see" do
    highlight(@lee, "private #honesty")
    shared = highlight(@lee, "members #honesty", visibility: "public")
    followers = highlight(@lee, "followers #honesty", visibility: "followers")
    @lee.timeline_notes.create!(body: "a note #honesty", visibility: "public")

    sign_in @oz
    get "/api/hashtags?q=hon", as: :json
    assert_equal [{ "name" => "honesty", "count" => 2 }], response.parsed_body["hashtags"]
    get "/api/hashtags/honesty", as: :json
    feed = response.parsed_body["feed"]
    assert_equal 2, response.parsed_body["count"]
    assert_equal %w[highlight note], feed.map { |i| i["kind"] }.sort
    assert_equal "members #honesty", feed.find { |i| i["kind"] == "highlight" }["note"]

    @oz.follows_given.create!(followed: @lee)
    get "/api/hashtags/honesty", as: :json
    assert_equal 3, response.parsed_body["count"]
    assert_includes response.parsed_body["feed"].map { |i| i["note"] }, followers.note

    sign_in @lee
    get "/api/hashtags/honesty", as: :json
    assert_equal 3, response.parsed_body["count"], "their own private highlight stays off the tag page too"

    UserBlock.create!(blocker: @oz, blocked: @lee)
    sign_in @oz
    get "/api/hashtags/honesty", as: :json
    assert_equal 0, response.parsed_body["count"], "nothing from someone they blocked"
    assert_not shared.reload.hashtags.empty?
  end

  test "mentions tell people only once the highlight is shared and they can see it" do
    @mo.follows_given.create!(followed: @lee)
    h = highlight(@lee, "")
    sign_in @lee

    assert_no_difference -> { Notification.count } do
      patch "/api/highlights/#{h.id}", params: { highlight: { note: "Thinking of @mo and @oz" } }, as: :json
    end
    assert_response :success
    assert_equal %w[mo oz], response.parsed_body["mentions"].keys.sort

    assert_difference -> { @mo.notifications.where(kind: "mention.note").count }, 1 do
      patch "/api/highlights/#{h.id}", params: { highlight: { visibility: "followers" } }, as: :json
    end
    note = @mo.notifications.last
    assert_equal "Lee R mentioned you in a highlight note", note.title
    assert_includes note.url, "/books/big-book/chapters/how-it-works?hl="
    assert_equal 0, @oz.notifications.count, "Oz doesn't follow Lee, so can't see it"

    UserBlock.create!(blocker: @oz, blocked: @lee)
    assert_no_difference -> { Notification.count } do
      patch "/api/highlights/#{h.id}", params: { highlight: { visibility: "public" } }, as: :json
    end
    UserBlock.delete_all
    assert_no_difference -> { Notification.count }, "nobody twice" do
      patch "/api/highlights/#{h.id}", params: { highlight: { note: "Thinking of @mo and @oz!" } }, as: :json
    end
    pat = User.create!(email: "pat@example.com", name: "Pat", password: "password123", confirmed: true)
    assert_difference -> { pat.notifications.count }, 1, "someone newly mentioned who can see it" do
      patch "/api/highlights/#{h.id}", params: { highlight: { note: "Thinking of @mo, @oz and @#{pat.username}" } }, as: :json
    end

    sign_in @mo
    get "/api/people/#{@lee.username}", as: :json
    item = response.parsed_body.dig("context", "feed").find { |i| i["kind"] == "highlight" }
    assert item["mentions_me"]
    assert_equal "mo", item.dig("mentions", "mo", "username")
  end

  test "names are left out of signed-out share links" do
    h = highlight(@lee, "Thanks @mo")
    h.mention!(@lee)
    get "/api/highlights?chapter_slug=how-it-works&hl=#{h.signed_id(purpose: :share)}", as: :json
    assert_equal({}, response.parsed_body.first["mentions"])
  end
end
