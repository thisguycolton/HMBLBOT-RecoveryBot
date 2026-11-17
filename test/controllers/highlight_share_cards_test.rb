require "test_helper"
require "minitest/mock"

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

  test "a link from Share as a picture previews in the look picked there" do
    get "#{share_path}&look=marker&note=0", headers: { "User-Agent" => IMESSAGE }
    assert_response :success
    image = meta("og:image")
    assert_match %r{look=marker}, image
    assert_match %r{note=0}, image
    assert_match %r{look=marker}, meta("og:url")

    marker = QuoteCard.highlight(@highlight, look: "marker", note: false, still: true)
    assert_includes image, "v=#{marker.key.first(12)}"
    assert_not_includes image, QuoteCard.highlight(@highlight).key.first(12)

    get URI(image).request_uri, headers: { "User-Agent" => IMESSAGE }
    assert_response :success
    assert_equal File.binread(marker.path), response.body

    # A look that isn't one is the usual Paper picture
    get "#{share_path}&look=nope", headers: { "User-Agent" => IMESSAGE }
    assert_includes meta("og:image"), "v=#{QuoteCard.highlight(@highlight, still: true).key.first(12)}"
    assert_no_match %r{look=}, meta("og:image")
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

  LONG = "Now about sex. Many of us needed an overhauling there. But above all, we tried to be sensible on this question. " \
         "It's so easy to get way off the track. Here we find human opinions running to extremes, absurd extremes, perhaps. " \
         "One set of voices cry that sex is a lust of our lower nature, a base necessity of procreation. Then we have the voices " \
         "who cry for sex and more sex; who bewail the institution of marriage; who think that most of the troubles of the race " \
         "are traceable to sex causes. They think we do not have enough of it, or that it isn't the right kind. They see its " \
         "significance everywhere. One school would allow man no flavor for his fare and the other would have us all on a " \
         "straight pepper diet. We want to stay out of this controversy. We do not want to be the arbiter of anyone's sex " \
         "conduct. We all have sex problems. We'd hardly be human if we didn't. What can we do about them?"

  def gif_frames(body) = body.b.scan("\x21\xF9\x04".b).size

  test "a highlight too long for one picture is a GIF that turns its pages, every word on one of them" do
    @highlight.update!(selector: { "quote" => { "exact" => LONG } })
    sign_in @lee
    get "/api/highlights/#{@highlight.id}/card", params: { look: "paper", size: "square" }
    assert_response :success
    assert_equal "image/gif", response.media_type
    pages = response.headers["X-Card-Pages"].to_i
    assert_operator pages, :>, 1
    assert_equal pages, gif_frames(response.body)
    assert_equal [1080, 1080], response.body.b[6, 4].unpack("vv")
    assert_operator response.body.bytesize, :<, 1.megabyte

    card = QuoteCard.highlight(@highlight, look: "paper", size: "square")
    assert_equal LONG.squish, card.pages.map(&:quote).join(" ")
    assert_equal "So true", card.pages.last.note
    assert card.pages[0...-1].all? { |p| p.note.nil? }

    get "/api/highlights/#{@highlight.id}/card", params: { look: "paper", size: "square", download: "1" }
    assert_match ".gif", response.headers["Content-Disposition"]

    # A still of it, for clipboards
    get "/api/highlights/#{@highlight.id}/card", params: { look: "paper", size: "square", still: "1" }
    assert_equal "image/png", response.media_type
    assert_equal "1", response.headers["X-Card-Pages"]
    assert_equal [1080, 1080], png_size(response.body)
  end

  test "a long highlight's link preview is a still picture" do
    @highlight.update!(selector: { "quote" => { "exact" => LONG } })
    get share_path, headers: { "User-Agent" => IMESSAGE }
    get URI(meta("og:image")).request_uri, headers: { "User-Agent" => IMESSAGE }
    assert_response :success
    assert_equal "image/png", response.media_type
    assert_equal [1200, 630], png_size(response.body)
  end

  test "a short highlight stays one picture" do
    card = QuoteCard.highlight(@highlight, size: "story")
    assert_not card.animated?
    assert_equal "image/png", card.content_type
  end

  test "a long quote the server's ImageMagick 6 won't lay out big gets a smaller size, not an error" do
    card = QuoteCard.new(quote: LONG, look: "paper", size: "story", still: true)
    real = Open3.method(:capture3)
    # As Debian's ImageMagick 6.9.11 answers a caption over about 2,000 pixels tall
    fake = lambda do |*args|
      size = args[args.index("-pointsize") + 1].to_i if args.include?("-pointsize") && args.any? { |a| a.to_s.start_with?("caption:") && a.size > 200 } && args.include?("info:")
      next ["", "convert-im6.q16: width or height exceeds limit `...' @ error/caption.c/ReadCAPTIONImage.", Struct.new(:success?).new(false)] if size && size > 60

      real.call(*args)
    end
    Open3.stub(:capture3, fake) { assert File.size(card.path).positive? }
    assert_equal [1080, 1920], png_size(File.binread(card.path))
  end

  test "a daily reading keeps its paragraphs, and its pages turn between them" do
    body = "When I let go, I think more clearly and wisely. " * 12
    reading = "NOVEMBER 7\nLET GO AND LET GOD\n… praying only for knowledge of His will for us.\nTWELVE STEPS AND TWELVE TRADITIONS, p. 96\n#{body.strip}\n#{body.strip}"
    card = QuoteCard.new(quote: reading, look: "night", size: "square")
    pages = card.pages
    assert_operator pages.size, :>, 1
    assert_equal "NOVEMBER 7\nLET GO AND LET GOD\n… praying only for knowledge of His will for us.\nTWELVE STEPS AND TWELVE TRADITIONS, p. 96", pages.first.quote
    assert pages.first.whole, "the first page ends where a paragraph does"
    assert_not pages.second.cont, "so the next one doesn't start with …"
    # Put back together, the pages are the reading, line breaks and all
    rejoined = pages.each_with_index.map { |pg, i| i.zero? ? pg.quote : "#{pages[i - 1].whole ? "\n" : ' '}#{pg.quote}" }.join
    assert_equal reading, rejoined
    assert_match(/\AGIF/, File.binread(card.path).first(3))
    assert card.send(:reading?), "a daily reading goes without quote marks"
    assert_equal "NOVEMBER 7", card.send(:quoted, "NOVEMBER 7", first: true, last: false, whole: true)
    assert_not QuoteCard.new(quote: "Remember 7 things").send(:reading?)
  end

  test "a highlight keeps how its chapter set it: headings, italics, a line in capitals" do
    doc = { "type" => "doc", "content" => [
      { "type" => "heading", "attrs" => { "level" => 3 }, "content" => [{ "type" => "text", "text" => "NOVEMBER", "marks" => [{ "type" => "bold" }] }, { "type" => "text", "text" => " 7" }] },
      { "type" => "heading", "attrs" => { "level" => 2 }, "content" => [{ "type" => "text", "text" => "LET GO AND LET GOD" }] },
      { "type" => "paragraph", "content" => [{ "type" => "text", "text" => "... " }, { "type" => "text", "text" => "praying only for knowledge of His will.", "marks" => [{ "type" => "italic" }] }] },
      { "type" => "paragraph", "content" => [{ "type" => "text", "text" => "TWELVE STEPS AND TWELVE TRADITIONS, p. 96" }] },
      { "type" => "paragraph", "content" => [{ "type" => "text", "text" => "When I let go, I think more clearly." }] }
    ] }
    chapter = Struct.new(:tiptap_json).new(doc)
    quote = "LET GO AND LET GOD\n... praying only for knowledge of His will.\nTWELVE STEPS AND TWELVE TRADITIONS, p. 96\nWhen I let go"
    h = Struct.new(:chapter, :quote, :selector).new(chapter, quote, { "position" => { "start" => 11 } })
    assert_equal({ "LET GO AND LET GOD" => :title, "... praying only for knowledge of His will." => :italic,
                   "TWELVE STEPS AND TWELVE TRADITIONS, p. 96" => :caps, "When I let go" => :body }, QuoteCard.formats_for(h))

    # Plain paragraphs keep the usual quote look
    plain = Struct.new(:chapter, :quote, :selector).new(chapter, "When I let go", { "position" => { "start" => 0 } })
    assert_equal({}, QuoteCard.formats_for(plain))

    card = QuoteCard.new(quote: quote, formats: QuoteCard.formats_for(h), look: "paper", size: "square")
    assert_equal "LET GO AND LET GOD", card.send(:quoted, "LET GO AND LET GOD", first: true, last: false, whole: true), "no quote marks around a heading"
    assert File.exist?(card.path)
  end

  test "a highlight from any book can be a video (or a GIF of one), with its note" do
    skip "no ffmpeg" unless system("ffmpeg", "-version", out: File::NULL, err: File::NULL)
    sign_in @lee
    get "/api/highlights/#{@highlight.id}/card", params: { look: "marker", size: "square", video: "1", turn: "fast" }
    assert_response :success
    assert_equal "video/mp4", response.media_type
    assert_equal "ftyp", response.body.b[4, 4]
    get "/api/highlights/#{@highlight.id}/card", params: { look: "night", size: "square", video: "1", as: "gif" }
    assert_equal "image/gif", response.media_type

    sign_in @mo
    get "/api/highlights/#{@highlight.id}/card", params: { video: "1" }
    assert_response :not_found
  end

  test "share this day: a daily reading as a picture or a video, for anyone signed in" do
    doc = { "type" => "doc", "content" => [
      { "type" => "heading", "attrs" => { "level" => 3 }, "content" => [{ "type" => "text", "text" => "NOVEMBER 7" }] },
      { "type" => "heading", "attrs" => { "level" => 2 }, "content" => [{ "type" => "text", "text" => "LET GO AND LET GOD" }] },
      { "type" => "paragraph", "content" => [{ "type" => "text", "text" => "praying only for knowledge of His will.", "marks" => [{ "type" => "italic" }] }] },
      { "type" => "paragraph", "content" => [{ "type" => "text", "text" => "When I let go, I think more clearly. " * 6 }] }
    ] }
    daily = Book.create!(title: "Daily Reflections", slug: "daily-reflections", work_key: "daily-reflections")
    daily.chapters.create!(title: "November 7: Let Go and Let God", slug: "november-7", index: 1, tiptap_json: doc)
    path = "/api/books/daily-reflections/chapters/november-7/card"

    get path, headers: { "User-Agent" => BROWSER }
    assert_redirected_to "/users/sign_in", "signed out, it asks you to sign in"

    sign_in @mo
    get path, params: { look: "night", size: "square" }, headers: { "User-Agent" => BROWSER }
    assert_response :success
    assert_includes %w[image/png image/gif], response.media_type

    card = QuoteCard.chapter(daily.chapters.first, look: "night", size: "square")
    assert_equal :title, card.send(:formats)["LET GO AND LET GOD"]
    assert_equal "NOVEMBER 7", card.send(:quoted, "NOVEMBER 7", first: true, last: false, whole: true), "no quote marks on a day"

    if system("ffmpeg", "-version", out: File::NULL, err: File::NULL)
      token = "progress-token-123"
      get "/api/card_progress/#{token}", headers: { "User-Agent" => BROWSER }
      assert_response :no_content, "nothing noted before it starts"
      get path, params: { look: "paper", size: "wide", video: "1", progress: token }, headers: { "User-Agent" => BROWSER }
      assert_response :success
      assert_equal "video/mp4", response.media_type
      assert_equal "ftyp", response.body.b[4, 4]
      get "/api/card_progress/#{token}", headers: { "User-Agent" => BROWSER }
      assert_equal({ "stage" => "done", "percent" => 100 }, response.parsed_body, "the ring ends full")

      sign_in @lee
      get "/api/card_progress/#{token}", headers: { "User-Agent" => BROWSER }
      assert_response :no_content, "someone else's progress isn't theirs to see"
    end

    # Other books' chapters aren't days
    get "/api/books/big-book/chapters/how-it-works/card", headers: { "User-Agent" => BROWSER }
    assert_response :unprocessable_entity
  end
end
