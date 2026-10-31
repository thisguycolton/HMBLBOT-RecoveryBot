require "test_helper"

# Pictures of highlights and notes to post anywhere (QuoteCard), and a highlight's share link
# preview (ShareMeta.highlight)
class HighlightShareCardsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  IMESSAGE = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0"
  BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"

  setup do
    Rails.application.reload_routes_unless_loaded
    ENV["GROUPS_FOR_EVERYONE"] = "1"
    @lee = User.create!(email: "lee@example.com", name: "Lee Rivera", password: "password123", confirmed: true)
    @mo = User.create!(email: "mo@example.com", name: "Mo", password: "password123", confirmed: true)
    book = Book.create!(title: "Big Book", slug: "big-book")
    @chapter = book.chapters.create!(title: "How It Works", slug: "how-it-works", index: 1)
    @highlight = @lee.user_highlights.create!(chapter: @chapter, note: "**So** true", visibility: "private",
                                              selector: { "quote" => { "exact" => "Rarely have we seen a person fail" } }, style: { "color" => "pink" })
  end

  teardown { ENV.delete("GROUPS_FOR_EVERYONE") }

  def meta(property) = css_select("meta[property='#{property}'], meta[name='#{property}']").first&.[]("content")
  def png_size(body) = body.b[16, 8].unpack("NN")
  def share_path = "/books/big-book/chapters/how-it-works?hl=#{CGI.escape(@highlight.signed_id(purpose: :share))}"

  test "its owner gets pictures in every look and size; nobody else does" do
    sign_in @lee
    { "wide" => [1200, 630], "square" => [1080, 1080], "story" => [1080, 1920] }.each do |size, dims|
      get "/api/highlights/#{@highlight.id}/card", params: { look: "marker", size: size }
      assert_response :success
      assert_equal "image/png", response.media_type
      assert_equal dims, png_size(response.body), size
    end
    get "/api/highlights/#{@highlight.id}/card", params: { look: "night", size: "square", download: "1" }
    assert_match "attachment", response.headers["Content-Disposition"]
    assert_match "rarely-have-we-seen-a-square.png", response.headers["Content-Disposition"]
    assert_match "private", response.headers["Cache-Control"]

    sign_in @mo
    get "/api/highlights/#{@highlight.id}/card"
    assert_response :not_found
  end

  test "pictures name nobody unless asked, and can leave the note off" do
    card = QuoteCard.highlight(@highlight)
    assert_nil card.by
    assert_equal "So true", card.note
    assert_equal "Big Book · How It Works", card.source
    assert_equal "Lee", QuoteCard.highlight(@highlight, name: true).by
    assert_nil QuoteCard.highlight(@highlight, note: false).note
    assert_equal "#fbcfe8", card.color
    assert_equal "paper", QuoteCard.new(quote: "x", look: "nope", size: "huge").look
  end

  test "a note with blocked words in it stays off the picture" do
    assert BlockedLanguage.found?("the gooks")
    @highlight.update_column(:note, "the gooks")
    assert_nil QuoteCard.highlight(@highlight).note
  end

  test "a highlight's share link shows link-preview fetchers its quote and picture, not the chapter" do
    get share_path, headers: { "User-Agent" => IMESSAGE }
    assert_response :success
    assert_equal "A highlight from Big Book", meta("og:title")
    assert_match "Rarely have we seen", meta("og:description")
    assert_no_match "Lee", response.body
    image = meta("og:image")
    assert_match %r{/share_cards/highlight/.+\.png\?v=}, image

    get URI(image).request_uri, headers: { "User-Agent" => IMESSAGE }
    assert_response :success
    assert_equal [1200, 630], png_size(response.body)

    # Without the link there's nothing: a made-up id, or the chapter with no ?hl=
    get "/share_cards/highlight/#{@highlight.id}.png", headers: { "User-Agent" => IMESSAGE }
    assert_response :not_found
    get "/books/big-book/chapters/how-it-works", headers: { "User-Agent" => IMESSAGE }
    assert_response :forbidden
    get share_path, headers: { "User-Agent" => "Mozilla/5.0 (compatible; GPTBot/1.2)" }
    assert_response :forbidden
  end

  test "people opening the share link get the reader with the highlight's preview tags" do
    get share_path, headers: { "User-Agent" => BROWSER }
    assert_response :success
    assert_match %r{/share_cards/highlight/}, meta("og:image")
    assert_match "noindex", response.headers["X-Robots-Tag"]
  end

  test "an author's own note becomes a picture; not reposts, and not someone else's" do
    note = @lee.timeline_notes.create!(body: "Day **41**. Said something at the [big book study](https://example.com).", visibility: "public")
    assert_equal "Day 41. Said something at the big book study.", QuoteCard.note(note).quote

    sign_in @lee
    get "/api/timeline_notes/#{note.id}/card", params: { look: "sunrise", size: "story", name: "1" }
    assert_response :success
    assert_equal [1080, 1920], png_size(response.body)

    sign_in @mo
    get "/api/timeline_notes/#{note.id}/card"
    assert_response :not_found
    repost = @mo.timeline_notes.create!(repost_of: note, body: "", visibility: "public")
    get "/api/timeline_notes/#{repost.id}/card"
    assert_response :unprocessable_entity
  end
end
