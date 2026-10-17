require "test_helper"

class Api::BooksImportLitconvTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  # Builds its own records; the shared fixtures aren't needed.
  self.fixture_table_names = []

  TWELVE_AND_TWELVE = Rails.root.join("db/imports/twelve-twelve.json")

  def import(payload)
    post "/api/books/import_json", params: { payload: payload }, as: :json
  end

  setup do
    Rails.application.reload_routes_unless_loaded # Devise's mappings come from the routes
    sign_in User.create!(email: "admin@example.com", password: "password123", confirmed: true, admin: true)
  end

  test "the library's Import button takes a litconv file" do
    import File.read(TWELVE_AND_TWELVE)
    assert_response :success
    assert_equal "litconv", response.parsed_body["source_format"]
    assert_equal 25, response.parsed_body["created_chapters"]

    book = Book.find_by!(slug: "twelve-steps-and-twelve-traditions")
    assert_equal 186, book.pages.count
    step_one = book.chapters.find_by!(slug: "step-one")
    assert_equal "Step", step_one.label
    # The Step's statement is one paragraph, not split at its last line.
    assert_includes step_one.content, "“We admitted we were powerless over alcohol—that our lives had become unmanageable.”"
  end

  test "importing the same file again updates in place" do
    import File.read(TWELVE_AND_TWELVE)
    import File.read(TWELVE_AND_TWELVE)
    assert_response :success
    assert_equal 0, response.parsed_body["created_chapters"]
    assert_equal 25, response.parsed_body["updated_chapters"]
    assert_equal 1, Book.where(work_key: "twelve_and_twelve").count
  end

  test "a tampered file is rejected" do
    data = JSON.parse(File.read(TWELVE_AND_TWELVE))
    data["chapters"][1]["content"] += " extra"
    import data.to_json
    assert_response :unprocessable_entity
    assert_match "content does not match", response.parsed_body["error"]
    assert_nil Book.find_by(slug: "twelve-steps-and-twelve-traditions")
  end

  test "members can't import" do
    sign_out :user
    sign_in User.create!(email: "member@example.com", password: "password123", confirmed: true, admin: false)
    import File.read(TWELVE_AND_TWELVE)
    assert_response :forbidden
  end
end
