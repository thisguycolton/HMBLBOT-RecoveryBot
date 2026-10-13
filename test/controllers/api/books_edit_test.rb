require "test_helper"

class Api::BooksEditTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  # Builds its own records; the shared fixtures aren't needed.
  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded # Devise's mappings come from the routes
    @book = Book.create!(title: "Twelve Steps and Twelve Traditions", slug: "twelve", work_key: "tt", edition: "1e",
                         language: "en")
    @book.chapters.create!(title: "Step One", slug: "step-one", index: 0)
    Book.create!(title: "Alcoholics Anonymous", slug: "big-book", work_key: "bb", edition: "4e", language: "en")
    @admin = User.create!(email: "admin@example.com", password: "password123", confirmed: true, admin: true)
  end

  def update(attrs)
    patch "/api/books/twelve", params: { book: attrs }
  end

  test "admins set the cover color, author and visibility" do
    sign_in @admin
    update cover_color: "green", author: "Bill W.", publicly_accessible: "false"
    assert_response :success
    body = response.parsed_body
    assert_equal ["green", "Bill W.", false], body.values_at("cover_color", "author", "public")
    assert_equal "green", @book.reload.cover_color
  end

  test "a blank color goes back to automatic, and unknown colors are refused" do
    sign_in @admin
    @book.update!(cover_color: "blue")
    update cover_color: ""
    assert_nil @book.reload.cover_color

    update cover_color: "plaid"
    assert_response :unprocessable_entity
    assert_nil @book.reload.cover_color
  end

  test "uploading and removing a cover image" do
    sign_in @admin
    update cover_image: fixture_file_upload(Rails.root.join("public/apple-touch-icon.png"), "image/png")
    assert_response :success
    assert response.parsed_body["has_uploaded_cover"]
    assert_match %r{/rails/active_storage/}, response.parsed_body["image_url"]

    update remove_cover_image: "1"
    assert_not @book.reload.cover_image.attached?
    assert_nil response.parsed_body["image_url"]
  end

  test "members can't edit" do
    sign_in User.create!(email: "member@example.com", password: "password123", confirmed: true, admin: false)
    update cover_color: "green"
    assert_response :forbidden
    assert_nil @book.reload.cover_color
  end

  test "a hidden book is only visible to admins" do
    @book.update!(publicly_accessible: false)

    get "/api/books"
    assert_equal ["big-book"], response.parsed_body.map { |b| b["slug"] }
    get "/api/books/twelve"
    assert_response :not_found
    get "/api/books/twelve/chapters/step-one"
    assert_response :not_found

    sign_in @admin
    get "/api/books"
    assert_equal %w[big-book twelve], response.parsed_body.map { |b| b["slug"] }.sort
    get "/api/books/twelve"
    assert_response :success
  end
end
