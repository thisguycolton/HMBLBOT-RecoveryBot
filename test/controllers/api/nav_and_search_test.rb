require "test_helper"

class Api::NavAndSearchTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @me = User.create!(email: "me@example.com", name: "Colton Hagan", password: "password123", confirmed: true)
    @jo = User.create!(email: "jo@example.com", name: "Jordan P", password: "password123", confirmed: true)
    @acid = Group.create!(title: "The Acid Test", location: "Phoenix, AZ", time_zone: "America/Phoenix")
    @step = Group.create!(title: "Monday Night Step Study", time_zone: "America/Phoenix")
    @acid.memberships.create!(user: @me, role: "member", can_keep_records: true, can_host: true)
    @acid.memberships.create!(user: @jo, role: "admin")
    @step.memberships.create!(user: @me, role: "admin")
    @step.memberships.create!(user: User.create!(email: "new@example.com", name: "Newcomer", password: "password123", confirmed: true), role: "member", status: "requested")
    today = @acid.zone.today
    @meeting = @acid.meetings.create!(name: "The Acid Test", recurrence: "weekly", day_of_week: today.wday, start_minute: 420)
    @meeting.host_sub_requests.create!(role: "host", on: today + 7, requested_by: @jo)
  end

  test "the shell gets your groups with the roles you hold, the Hosting badge and Today" do
    sign_in @me
    get "/api/nav", as: :json
    assert_response :success
    body = response.parsed_body
    assert_equal "Colton Hagan", body.dig("me", "name")

    acid, step = body["groups"].sort_by { |g| g["title"] }.then { |a| [a.second, a.first] }
    assert_equal({ "admin" => false, "record_keeper" => true, "host_coordinator" => false, "treasurer" => true, "host" => true }, acid["roles"])
    assert_equal 0, acid["requests"]
    assert acid["can_give"], "a host gives the group's chips from its folder"
    assert step.dig("roles", "admin")
    assert_equal 1, step["requests"]

    assert_equal 1, body.dig("hosting", "open_requests")
    assert body["today"]["has_groups"]
    assert_equal ["The Acid Test"], body["today"]["meetings"].map { |m| m["name"] }.uniq
  end

  test "asking for a sub yourself doesn't count toward your badge, and signed out there's no nav" do
    sign_in @jo
    get "/api/nav", as: :json
    assert_equal 0, response.parsed_body.dig("hosting", "open_requests")

    sign_out @jo
    get "/api/nav", as: :json
    assert_response :unauthorized
  end

  test "the search box finds groups, the site's readings and the library" do
    book = Book.create!(title: "Alcoholics Anonymous", slug: "aa")
    book.chapters.create!(title: "How It Works", slug: "how-it-works", index: 0, first_page: 58)
    Reading.create!(title: "How it works for me", user: @jo, published_at: 1.day.ago)
    Reading.create!(title: "How it works, a draft", user: @jo)

    get "/api/search", params: { q: "how it" }, as: :json
    assert_response :success
    sections = response.parsed_body["sections"].index_by { |s| s["key"] }
    assert_nil sections["people"], "people only for members"
    assert_equal ["How it works for me"], sections["readings"]["items"].map { |i| i["title"] }
    chapter = sections["literature"]["items"].sole
    assert_equal ["How It Works", "Alcoholics Anonymous · p. 58", "/books/aa/chapters/how-it-works"], chapter.values_at("title", "subtitle", "url")

    get "/api/search", params: { q: "acid" }, as: :json
    group = response.parsed_body["sections"].find { |s| s["key"] == "groups" }["items"].sole
    assert_equal ["The Acid Test", "Phoenix, AZ · 2 members", "/groups/#{@acid.slug}"], group.values_at("title", "subtitle", "url")

    get "/api/search", params: { q: "a" }, as: :json
    assert_empty response.parsed_body["sections"]
  end

  test "the Hosting page lists the subs you could take" do
    sign_in @me
    get "/api/hosting", as: :json
    assert_response :success
    request = response.parsed_body["open_requests"].sole
    assert_equal ["The Acid Test", @acid.slug, "host"], request.values_at("name", "group_slug", "place")
  end
end
