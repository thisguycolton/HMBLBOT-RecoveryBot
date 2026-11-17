require "test_helper"

# Members-only books (Book#members_only): only signed-in members of an approved group that has
# the book in its literature (GroupBook) can open it, everywhere its words are served
class MembersOnlyBooksTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  IMESSAGE = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0"

  setup do
    Rails.application.reload_routes_unless_loaded
    @reader = User.create!(email: "reader@example.com", name: "Lee Rivera", password: "password123", confirmed: true)
    @outsider = User.create!(email: "out@example.com", name: "Mo", password: "password123", confirmed: true)
    @admin = User.create!(email: "admin@example.com", name: "Ada", password: "password123", confirmed: true, admin: true)
    @book = Book.create!(title: "Living Sober", slug: "living-sober", work_key: "living-sober", members_only: true)
    @chapter = @book.chapters.create!(title: "Staying away from the first drink", slug: "first-drink", index: 1,
                                      tiptap_json: { "type" => "doc", "content" => [{ "type" => "paragraph", "content" => [{ "type" => "text", "text" => "secret words here" }] }] })
    @open = Book.create!(title: "Big Book", slug: "big-book", work_key: "bigbook")
    @open.chapters.create!(title: "How It Works", slug: "how-it-works", index: 1)

    @group = Group.create!(title: "Acid Test", time_zone: "America/Chicago", status: "active")
    @group.memberships.create!(user: @reader, role: "member")
    @group.group_books.create!(book: @book)
    @highlight = @reader.user_highlights.create!(chapter: @chapter, visibility: "public", note: "mine",
                                                 selector: { "quote" => { "exact" => "secret words here" } }, style: { "color" => "pink" })
  end

  test "who can read it" do
    assert @book.readable_by?(@reader)
    assert @book.readable_by?(@admin)
    assert_not @book.readable_by?(@outsider)
    assert_not @book.readable_by?(nil)
    assert @open.readable_by?(nil)
    mine = Book.where(id: [@book.id, @open.id])
    assert_equal %w[big-book], mine.readable_by(@outsider).pluck(:slug)
    assert_equal %w[big-book living-sober], mine.readable_by(@reader).order(:slug).pluck(:slug)
    assert_equal [@book.id], mine.locked_for(@outsider).pluck(:id)
    assert_empty mine.locked_for(@reader)

    # A pending (unapproved) group, or a membership that isn't active, doesn't count
    @group.update!(status: "pending")
    assert_not @book.reload.readable_by?(@reader)
    @group.update!(status: "active")
    @group.memberships.find_by(user: @reader).update!(status: "requested")
    assert_not @book.reload.readable_by?(@reader)
  end

  test "the library lists it as locked; its page says how to get access" do
    get "/api/books"
    row = response.parsed_body.find { |b| b["slug"] == "living-sober" }
    assert row["members_only"]
    assert row["locked"]

    get "/api/books/living-sober"
    assert_response :success
    assert response.parsed_body["locked"]
    assert_equal [{ "title" => "Acid Test", "slug" => @group.slug, "url" => "/groups/#{@group.slug}" }], response.parsed_body["groups"]

    sign_in @reader
    get "/api/books/living-sober"
    assert_equal false, response.parsed_body["locked"]
  end

  test "chapters, search and export are refused to others" do
    [nil, @outsider].each do |who|
      who ? sign_in(who) : sign_out(:user)
      get "/api/books/living-sober/chapters/first-drink.json"
      assert_response :forbidden
      assert_no_match "secret", response.body
      get "/api/books/living-sober/chapters"
      assert_response :forbidden
      get "/api/books/living-sober/search", params: { q: "secret" }
      assert_response :forbidden
      get "/api/books/living-sober/export"
      assert_response :forbidden
      get "/api/books/search", params: { q: "secret" }
      assert_empty response.parsed_body["results"]
      get "/books/living-sober/chapters.json"
      assert_response :forbidden
    end

    sign_in @reader
    get "/api/books/living-sober/chapters/first-drink.json"
    assert_response :success
    assert_match "secret", response.body
    get "/api/books/search", params: { q: "secret" }
    assert_equal ["living-sober"], response.parsed_body["results"].map { |r| r["slug"] }
  end

  test "the reader shows the members-only page, ?screen=1 too" do
    get "/books/living-sober/chapters/first-drink?screen=1"
    assert_response :forbidden
    assert_match "data-members-only", response.body

    sign_in @reader
    get "/books/living-sober/chapters/first-drink?screen=1"
    assert_response :success
    assert_no_match "data-members-only", response.body
  end

  test "highlights: no quotes, link previews or pictures for others" do
    sign_in @outsider
    get "/api/highlights", params: { chapter_slug: "first-drink", hl: @highlight.signed_id(purpose: :share) }
    assert_equal [], response.parsed_body
    assert_not @highlight.visible_to?(@outsider)
    feed = @highlight.as_feed_json(viewer: @outsider)
    assert feed[:locked]
    assert_nil feed[:quote]
    post "/api/highlights", params: { highlight: { chapter_slug: "first-drink", book_slug: "living-sober", selector: { quote: { exact: "x" } }, style: { color: "pink" } } }
    assert_response :forbidden

    sign_out :user
    get "/share_cards/highlight/#{@highlight.signed_id(purpose: :share)}.png"
    assert_response :not_found
    get "/books/living-sober/chapters/first-drink", params: { hl: @highlight.signed_id(purpose: :share) }, headers: { "User-Agent" => IMESSAGE }
    assert_no_match "secret", response.body

    # Even its owner can't make a picture: pictures go anywhere
    sign_in @reader
    get "/api/highlights/#{@highlight.id}/card"
    assert_response :forbidden
    assert_equal "secret words here", @highlight.as_feed_json(viewer: @reader)[:quote]
  end

  test "hosts pick only from books they can read" do
    @group.group_books.create!(book: @open)
    assert_equal %w[big-book], @group.books.merge(Book.readable_by(@outsider)).pluck(:slug)
    assert_equal %w[big-book living-sober], @group.books.merge(Book.readable_by(@reader)).order(:slug).pluck(:slug)
  end

  test "admins switch it on and off" do
    sign_in @admin
    patch "/api/books/big-book", params: { book: { members_only: "true" } }, as: :json
    assert_response :success
    assert @open.reload.members_only?
    assert response.parsed_body["members_only"]
  end
end
