require "test_helper"

# Adopting someone else's highlight: a private copy in your own highlights that says whose it
# came from (UserHighlight#adopted_from)
class Api::HighlightAdoptionsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @sam = User.create!(email: "sam@example.com", name: "Sam T", password: "password123", confirmed: true)
    @mo = User.create!(email: "mo@example.com", name: "Mo", password: "password123", confirmed: true)
    book = Book.create!(title: "Big Book", slug: "big-book")
    @chapter = book.chapters.create!(title: "How It Works", slug: "how-it-works", index: 1)
    @original = @sam.user_highlights.create!(chapter: @chapter, note: "Sam's own thoughts", visibility: "private",
                                             selector: { "quote" => { "exact" => "Rarely have we seen a person fail" } },
                                             style: { "color" => "pink" })
  end

  test "adopting through a highlight link copies the words and color, not the note, kept private, once" do
    sign_in @mo
    share_id = @original.signed_id(purpose: :share)

    assert_difference -> { @mo.user_highlights.count }, 1 do
      post "/api/highlights/adopt", params: { hl: share_id }, as: :json
    end
    assert_response :created
    copy = response.parsed_body
    assert copy["mine"]
    assert_nil copy["note"]
    assert_equal "private", copy["visibility"]
    assert_equal({ "color" => "pink" }, copy["style"])
    assert_equal "Rarely have we seen a person fail", copy.dig("selector", "quote", "exact")
    assert_equal @original.id, copy.dig("adopted_from", "id")
    assert_equal "Sam", copy.dig("adopted_from", "by")
    assert_includes copy.dig("adopted_from", "url"), "/books/big-book/chapters/how-it-works?hl="

    assert_no_difference -> { UserHighlight.count } do
      post "/api/highlights/adopt", params: { hl: share_id }, as: :json
    end
    assert_response :ok
    assert_equal copy["id"], response.parsed_body["id"]

    # It shows on the chapter with their other highlights, still saying where it came from
    get "/api/highlights", params: { chapter_slug: "how-it-works" }
    assert_equal ["Sam"], response.parsed_body.map { |h| h.dig("adopted_from", "by") }
  end

  test "adopting through someone's all-highlights link needs the highlight to be theirs" do
    @sam.update!(share_token: "sam-token")
    other = @mo.user_highlights.create!(chapter: @chapter, selector: { "quote" => { "exact" => "x" } }, style: { "color" => "yellow" })
    oz = User.create!(email: "oz@example.com", name: "Oz", password: "password123", confirmed: true)
    sign_in oz

    post "/api/highlights/adopt", params: { share: "sam-token", id: other.id }, as: :json
    assert_response :not_found

    post "/api/highlights/adopt", params: { share: "sam-token", id: @original.id }, as: :json
    assert_response :created
  end

  test "a highlight you can't see can't be adopted by its id, and your own just comes back" do
    sign_in @mo
    post "/api/highlights/adopt", params: { id: @original.id }, as: :json
    assert_response :not_found

    sign_in @sam
    assert_no_difference -> { UserHighlight.count } do
      post "/api/highlights/adopt", params: { id: @original.id }, as: :json
    end
    assert_equal @original.id, response.parsed_body["id"]
  end

  test "once the original is deleted, the copy stays and just says it was adopted" do
    sign_in @mo
    post "/api/highlights/adopt", params: { hl: @original.signed_id(purpose: :share) }, as: :json
    @original.destroy!

    get "/api/highlights", params: { chapter_slug: "how-it-works" }
    assert_equal [{ "id" => nil, "by" => nil, "url" => nil }], response.parsed_body.map { |h| h["adopted_from"] }
  end

  test "signed out can't adopt" do
    post "/api/highlights/adopt", params: { hl: @original.signed_id(purpose: :share) }, as: :json
    assert_response :unauthorized
  end
end
