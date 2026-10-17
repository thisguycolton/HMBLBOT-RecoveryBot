require "test_helper"

class ReadingArchiveTest < ActionDispatch::IntegrationTest
  test "themes to browse are the ones with published readings, with their counts" do
    user = User.create!(email: "writer@example.com", name: "W", password: "password123", confirmed: true)
    used = Tag.create!(title: "Gratitude Test")
    unused = Tag.create!(title: "Unused Test")
    2.times { |i| Reading.create!(title: "R#{i}", content: "x", user: user, published_at: 1.day.ago, tags: [used]) }

    get "/readings", headers: { "User-Agent" => "Mozilla/5.0 Chrome" }
    assert_response :success
    tags = JSON.parse(CGI.unescapeHTML(response.body[/data-tags="([^"]*)"/, 1]))
    mine = tags.find { |t| t["id"] == used.id }
    assert_equal 2, mine["count"]
    assert_nil tags.find { |t| t["id"] == unused.id }
  end

  test "readings come a page at a time, and search covers title and source" do
    user = User.create!(email: "pager@example.com", name: "P", password: "password123", confirmed: true)
    30.times { |i| Reading.create!(title: "Page test #{i}", content: "x", user: user, published_at: (i + 1).hours.ago) }
    Reading.create!(title: "Something else", source: "Daily Reflections", content: "x", user: user, published_at: 1.hour.ago)
    total = Reading.published.count
    readings = ->(body) { JSON.parse(CGI.unescapeHTML(body[/data-readings="([^"]*)"/, 1])) }

    get "/readings", headers: { "User-Agent" => "Mozilla/5.0 Chrome" }
    assert_equal ReadingsController::READINGS_PER_PAGE, readings.(response.body).size
    assert_includes response.body, %(data-total="#{total}")

    get "/readings?page=99", headers: { "User-Agent" => "Mozilla/5.0 Chrome" }
    last = (total / ReadingsController::READINGS_PER_PAGE.to_f).ceil
    assert_includes response.body, %(data-page="#{last}")

    get "/readings?q=daily+reflect", headers: { "User-Agent" => "Mozilla/5.0 Chrome" }
    assert_equal ["Something else"], readings.(response.body).map { |r| r["title"] }
  end
end
