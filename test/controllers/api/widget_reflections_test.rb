require "test_helper"

# The apps' Daily Reflection widget: two weeks of readings from a day, with what the widget shows
class Api::WidgetReflectionsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @book = Book.create!(title: "Daily Reflections", slug: "daily-reflections", work_key: "dr", edition: "1e", language: "en")
    doc = { "type" => "doc", "content" => [
      { "type" => "paragraph", "attrs" => { "role" => "intro" }, "content" => [{ "type" => "text", "text" => "Almost without exception, alcoholics are tortured by loneliness." }] },
      { "type" => "paragraph", "attrs" => { "role" => "signature" }, "content" => [{ "type" => "text", "text" => "AS BILL SEES IT, p. 90" }] },
      { "type" => "paragraph", "content" => [{ "type" => "text", "text" => (["word"] * 380).join(" ") }] },
    ] }
    @book.chapters.create!(title: "November 17: OVERCOMING LONELINESS", slug: "november-17", index: 0, tiptap_json: doc)
    @book.chapters.create!(title: "November 18", slug: "november-18", index: 1,
                           tiptap_json: { "type" => "doc", "content" => [{ "type" => "paragraph", "content" => [{ "type" => "text", "text" => "A plain day." }] }] })
    @book.chapters.create!(title: "December 25", slug: "december-25", index: 2)
    @reader = User.create!(email: "reader@example.com", password: "password123", confirmed: true)
  end

  test "signed in only" do
    get "/api/widget_reflections", as: :json
    assert_response :unauthorized
  end

  test "each day's reading from the day asked for, for two weeks" do
    sign_in @reader
    get "/api/widget_reflections", params: { from: "2026-11-17" }, as: :json
    assert_response :success
    list = response.parsed_body["reflections"]
    assert_equal %w[2026-11-17 2026-11-18], list.pluck("date"), "December 25 is past the two weeks"
    first = list.first
    assert_equal ["Overcoming Loneliness", "Almost without exception, alcoholics are tortured by loneliness.", "As Bill Sees It, p. 90", 2,
                  "/books/daily-reflections/chapters/november-17"],
                 first.values_at("title", "quote", "source", "minutes", "path")
    assert_equal ["November 18", "A plain day.", "", 1], list.second.values_at("title", "quote", "source", "minutes")
  end

  test "nothing from a members-only book they can't open" do
    @book.update!(members_only: true)
    sign_in @reader
    get "/api/widget_reflections", params: { from: "2026-11-17" }, as: :json
    assert_equal [], response.parsed_body["reflections"]
  end
end
