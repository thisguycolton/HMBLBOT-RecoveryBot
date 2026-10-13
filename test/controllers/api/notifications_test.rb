require "test_helper"

class Api::NotificationsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "admin@example.com"
    book = Book.create!(title: "Daily Reflections", slug: "daily-reflections", work_key: "dr", edition: "1e", language: "en")
    @chapter = book.chapters.create!(title: "January 10", slug: "january-10", index: 0)
    @admin = User.create!(email: "admin@example.com", password: "password123", confirmed: true, admin: true)
    @reader = User.create!(email: "reader@example.com", password: "password123", confirmed: true)
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  test "a text report notifies admins, and resolving it notifies the reporter" do
    report = @reader.text_reports.create!(chapter: @chapter, message: "Typo", selector: { quote: { exact: "inrecovery" } })
    assert_equal ["text_report.created"], @admin.notifications.pluck(:kind)
    assert_empty @reader.notifications

    report.resolve!(@admin)
    n = @reader.notifications.sole
    assert_equal ["text_report.resolved", "/books/daily-reflections/chapters/january-10"], [n.kind, n.url]
  end

  test "sign-ups waiting for approval notify admins" do
    User.create!(email: "new@example.com", password: "password123")
    assert_equal ["user.pending"], @admin.notifications.pluck(:kind)
  end

  test "readers list their notifications and mark them read" do
    get "/api/notifications", as: :json
    assert_response :unauthorized

    Notification.deliver(@reader, kind: "test", title: "One")
    Notification.deliver(@reader, kind: "test", title: "Two")
    Notification.deliver(@admin, kind: "test", title: "Not yours")
    sign_in @reader

    get "/api/notifications", as: :json
    assert_equal [2, %w[Two One]], [response.parsed_body["unread"], response.parsed_body["notifications"].map { |n| n["title"] }]

    post "/api/notifications/#{@reader.notifications.find_by(title: 'One').id}/read", as: :json
    assert_equal 1, @reader.notifications.unread.count

    post "/api/notifications/#{@admin.notifications.sole.id}/read", as: :json
    assert_response :not_found

    post "/api/notifications/read_all", as: :json
    assert_equal 0, @reader.notifications.unread.count
  end
end
