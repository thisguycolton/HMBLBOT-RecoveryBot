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
end
