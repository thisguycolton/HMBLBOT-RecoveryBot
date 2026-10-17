require "test_helper"

class Api::TextReportsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  SELECTOR = { position: { start: 4, end: 9 }, quote: { exact: "inrecovery", prefix: "the ", suffix: "." } }.freeze

  setup do
    Rails.application.reload_routes_unless_loaded
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "admin@example.com"
    book = Book.create!(title: "Daily Reflections", slug: "daily-reflections", work_key: "dr", edition: "1e", language: "en")
    @chapter = book.chapters.create!(title: "January 10", slug: "january-10", index: 0)
    @reader = User.create!(email: "reader@example.com", password: "password123", confirmed: true)
    @admin = User.create!(email: "admin@example.com", password: "password123", confirmed: true, admin: true)
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  def report!(message: "Missing a space: in recovery")
    post "/api/text_reports", params: { text_report: { book_slug: "daily-reflections", chapter_slug: "january-10",
                                                       message: message, selector: SELECTOR } }, as: :json
  end

  test "signed-in readers report a problem with selected text" do
    report!
    assert_response :unauthorized

    sign_in @reader
    report!
    assert_response :created
    r = TextReport.last
    assert_equal [@reader, @chapter, "open", "inrecovery"], [r.user, r.chapter, r.status, r.quote]

    report!(message: " ")
    assert_response :unprocessable_entity
  end

  test "admins list, comment on, resolve and reopen reports" do
    sign_in @reader
    report!
    id = TextReport.last.id

    patch "/api/admin/text_reports/#{id}", params: { status: "resolved" }, as: :json
    assert_response :forbidden

    sign_in @admin
    get "/api/admin/text_reports", as: :json
    assert_equal [1, "inrecovery", "reader@example.com"],
                 [response.parsed_body["open"], *response.parsed_body["text_reports"].first.values_at("quote", "reporter")]

    post "/api/admin/text_reports/#{id}/comment", params: { body: "Fixed in the next import" }, as: :json
    assert_equal ["Fixed in the next import"], response.parsed_body["comments"].map { |c| c["body"] }

    patch "/api/admin/text_reports/#{id}", params: { status: "resolved" }, as: :json
    assert_equal ["resolved", "admin@example.com"], response.parsed_body.values_at("status", "resolved_by")
    get "/api/admin/text_reports", as: :json
    assert_empty response.parsed_body["text_reports"]

    patch "/api/admin/text_reports/#{id}", params: { status: "open" }, as: :json
    assert_equal "open", TextReport.find(id).status
  end
end
