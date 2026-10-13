require "test_helper"

class Api::BooksSearchTest < ActionDispatch::IntegrationTest
  # Builds its own books; the shared fixtures aren't needed.
  self.fixture_table_names = []

  def doc(*paragraphs)
    { "type" => "doc", "content" => paragraphs.map { |t| { "type" => "paragraph", "content" => [{ "type" => "text", "text" => t }] } } }
  end

  setup do
    big = Book.create!(title: "Alcoholics Anonymous", slug: "big-book", work_key: "bb", edition: "4e", language: "en")
    big.chapters.create!(title: "Bill's Story", slug: "bills-story", index: 0, first_page: 1,
                         tiptap_json: doc("Honesty and humility were essential.", "No match here."))
    big.chapters.create!(title: "How It Works", slug: "how-it-works", index: 1, tiptap_json: doc("Rarely have we seen."))

    twelve = Book.create!(title: "Twelve Steps and Twelve Traditions", slug: "twelve", work_key: "tt", edition: "1e",
                          language: "en")
    twelve.chapters.create!(title: "Step Seven", slug: "step-seven", index: 0,
                            tiptap_json: doc("Humility is the subject. We placed humility first."))
  end

  test "searches every book, grouped by book in title order" do
    get "/api/books/search", params: { q: "humility" }
    assert_response :success

    results = response.parsed_body["results"]
    assert_equal %w[big-book twelve], results.map { |b| b["slug"] }
    assert_equal [1, 2], results.map { |b| b["count"] }
    assert_equal ["bills-story"], results.first["chapters"].map { |c| c["slug"] }
    assert_equal "humility", results.first["chapters"].first["snippets"].first["match"]
    assert_equal 1, results.first["chapters"].first["snippets"].first["page"]
  end

  test "leaves out books with no matches" do
    get "/api/books/search", params: { q: "rarely" }
    assert_equal ["big-book"], response.parsed_body["results"].map { |b| b["slug"] }
  end

  test "needs at least two letters" do
    get "/api/books/search", params: { q: "h" }
    assert_equal [], response.parsed_body["results"]
  end

  test "single-book search still works" do
    get "/api/books/twelve/search", params: { q: "humility" }
    assert_equal [{ "slug" => "step-seven", "count" => 2 }],
                 response.parsed_body["results"].map { |c| c.slice("slug", "count") }
  end
end
