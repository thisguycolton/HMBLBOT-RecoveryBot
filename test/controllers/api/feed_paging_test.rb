require "test_helper"

# Feeds come a page at a time behind "Load more" (FeedPage): the home page, a profile's feed,
# a group's Timeline block and a #hashtag's page.
class Api::FeedPagingTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    ENV["GROUPS_FOR_EVERYONE"] = "1"
    @lee = User.create!(email: "lee@example.com", name: "Lee R.", password: "password123", confirmed: true)
    @mo = User.create!(email: "mo@example.com", name: "Mo", password: "password123", confirmed: true)
    @oz = User.create!(email: "oz@example.com", name: "Oz", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @lee, role: "admin")
    @group.memberships.create!(user: @mo, role: "member")
    book = Book.create!(title: "Big Book", slug: "big-book")
    @chapter = book.chapters.create!(title: "Chapter 5", slug: "how-it-works", index: 1)
    @mo.follows_given.create!(followed: @lee)
  end

  teardown { ENV.delete("GROUPS_FOR_EVERYONE") }

  # 45 notes and 5 shared highlights, several of them in the very same second
  def lots!(user = @lee, tag: nil)
    base = Time.utc(2026, 11, 1, 12)
    45.times do |i|
      at = base + (i / 3).seconds + (i % 3) * 0.000001 # three to a second, a microsecond apart
      at = base + 3.seconds if i.between?(30, 34) # five at exactly the same moment
      user.timeline_notes.create!(body: "note #{i} #{tag}", visibility: "public", created_at: at)
    end
    5.times do |i|
      user.user_highlights.create!(chapter: @chapter, style: { "color" => "yellow" }, visibility: "public", shared_at: base + 3.seconds,
                                   note: "highlight #{i} #{tag}", selector: { "quote" => { "exact" => "words #{i}" }, "position" => { "start" => 1, "end" => 5 } })
    end
  end

  def walk(first_url, next_key:, &more_url)
    get first_url, as: :json
    assert_response :success
    pages = [response.parsed_body]
    while (cursor = pages.last[next_key])
      get more_url.call(cursor), as: :json
      assert_response :success
      pages << response.parsed_body
      flunk "too many pages" if pages.size > 10
    end
    pages
  end

  def ids(items) = items.map { |i| "#{i['kind']}-#{i['id']}" }

  test "the home feed comes 20 at a time and every post shows once, in order" do
    lots!
    sign_in @mo
    pages = walk("/api/people", next_key: "feed_next") { |c| "/api/people?cursor=#{CGI.escape(c)}" }
    assert_equal [20, 20, 10], pages.map { |p| p["feed"].size }
    all = pages.flat_map { |p| p["feed"] }
    assert_equal 50, ids(all).uniq.size, "nothing doubled or skipped, even in the same second"
    times = all.map { |i| Time.iso8601(i["created_at"]) }
    assert_equal times.sort.reverse, times, "newest first"
    assert_nil pages.last["feed_next"], "and then it's the end"
    assert pages.first.key?("coming_up"), "the first page has the rest of the home page"
    assert_not pages.second.key?("coming_up"), "Load more only sends the feed"
  end

  test "a post written while you read doesn't push anything onto the next page twice" do
    lots!
    sign_in @mo
    get "/api/people", as: :json
    first = response.parsed_body
    @lee.timeline_notes.create!(body: "brand new", visibility: "public")
    get "/api/people?cursor=#{CGI.escape(first['feed_next'])}", as: :json
    assert_empty ids(first["feed"]) & ids(response.parsed_body["feed"])
  end

  test "an old-style before time still works" do
    lots!
    sign_in @mo
    get "/api/people?before=#{CGI.escape(Time.utc(2026, 11, 1, 12, 0, 2).iso8601)}", as: :json
    assert_response :success
    assert_equal 6, response.parsed_body["feed"].size, "the six notes from the first two seconds"
  end

  test "a profile's feed pages too" do
    lots!
    sign_in @oz
    get "/api/people/lee-r", as: :json
    first = response.parsed_body["context"]
    assert_equal 20, first["feed"].size
    pages = [{ "feed" => first["feed"], "next" => first["feed_next"] }]
    while (cursor = pages.last["next"])
      get "/api/people/lee-r/feed?cursor=#{CGI.escape(cursor)}", as: :json
      pages << response.parsed_body
    end
    assert_equal 50, ids(pages.flat_map { |p| p["feed"] }).uniq.size
  end

  test "a group's timeline pages, for members only" do
    base = Time.utc(2026, 11, 1, 12)
    25.times { |i| @lee.timeline_notes.create!(body: "group #{i}", visibility: "private", created_at: base + i.seconds).share_to!([@group]) }
    sign_in @mo
    get "/api/groups/#{@group.slug}/page", as: :json
    first = response.parsed_body["context"]
    assert_equal 20, first["timeline"].size
    get "/api/groups/#{@group.slug}/page/timeline?cursor=#{CGI.escape(first['timeline_next'])}", as: :json
    assert_response :success
    assert_equal (0..4).map { |i| "group #{i}" }.reverse, response.parsed_body["feed"].map { |n| n["body"] }
    assert_nil response.parsed_body["next"]

    sign_in @oz
    get "/api/groups/#{@group.slug}/page/timeline?cursor=#{CGI.escape(first['timeline_next'])}", as: :json
    assert_includes [403, 404], response.status
  end

  test "a hashtag's page pages" do
    lots!(tag: "#serenity")
    sign_in @mo
    pages = walk("/api/hashtags/serenity", next_key: "next") { |c| "/api/hashtags/serenity?cursor=#{CGI.escape(c)}" }
    assert_equal 50, ids(pages.flat_map { |p| p["feed"] }).uniq.size
    assert pages.first["more"]
    assert_not pages.last["more"]
  end
end
