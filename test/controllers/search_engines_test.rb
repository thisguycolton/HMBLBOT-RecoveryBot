require "test_helper"

# What search engines may list (SearchEngines): every page is noindex unless it opts in, and an
# approved group's public page and meetings are listed unless the group turns that off
class SearchEnginesTest < ActionDispatch::IntegrationTest
  self.fixture_table_names = []

  GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"

  setup do
    Rails.application.reload_routes_unless_loaded
    @host = User.create!(email: "hostname@example.com", name: "Hidden Hostperson", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", description: "Early birds", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @host, role: "admin", status: "active")
    @meeting = @group.meetings.create!(name: "Sunrise Crew", recurrence: "weekly", day_of_week: 1, start_minute: 420, end_minute: 480,
                                       time_zone: "America/Phoenix", conference_url: "https://zoom.us/j/123?pwd=secret", notes: "Call Pat at 555-0100")
    section = DocSection.create!(title: "Group tools", position: 1)
    @public_doc = section.pages.create!(title: "Group chat", body: "Talk between meetings.", position: 1)
    section.pages.create!(title: "About RecoveryBot", body: "Who we are.", path_alias: "about", position: 3)
    section.pages.create!(title: "History", body: "How it started.", path_alias: "history", position: 4)
    @members_doc = section.pages.create!(title: "Members page", body: "Only for members.", audience: "members", position: 2)
  end

  def crawl(path)
    get path, headers: { "User-Agent" => GOOGLEBOT }
  end

  def assert_listed(path)
    crawl path
    assert_response :success, path
    assert_nil response.headers["X-Robots-Tag"], "#{path} should be listed"
    assert_includes response.body, %(rel="canonical"), path
  end

  # A page behind sign-in redirects (Devise answers that itself); a redirect is never listed
  def assert_hidden(path)
    crawl path
    return assert_match %r{/users/sign_in\z}, response.location.to_s, path if response.redirect?

    assert_match "noindex", response.headers["X-Robots-Tag"].to_s, "#{path} should be noindex (#{response.status})"
  end

  test "the safe pages are listed" do
    ["/", "/about", "/history", "/docs", @public_doc.path, "/privacy", "/terms", "/contact", "/install", "/topicificator", "/groups/meetings"].each do |path|
      assert_listed path
    end
  end

  test "an approved group's page and meetings are listed, without people or notes" do
    %W[/groups/sunrise-crew /groups/sunrise-crew/home /groups/sunrise-crew/meetings /groups/sunrise-crew/meetings/#{@meeting.id} /groups/sunrise-crew/events].each do |path|
      assert_listed path
    end
    crawl "/groups/sunrise-crew"
    markup = JSON.parse(response.body[%r{<script type="application/ld\+json">(.*?)</script>}m, 1])
    event = markup.first
    assert_equal "Event", event["@type"]
    assert_equal "https://schema.org/Monday", event.dig("eventSchedule", "byDay")
    assert_equal "07:00", event.dig("eventSchedule", "startTime")
    assert_equal "America/Phoenix", event.dig("eventSchedule", "scheduleTimezone")
    assert_equal "VirtualLocation", event.dig("location", "@type")
    assert_match "/groups/sunrise-crew/meetings/#{@meeting.id}", event.dig("location", "url")
    assert_includes response.body, "Early birds"
    ["Hidden Hostperson", "555-0100", "pwd=secret", "zoom.us"].each { |text| assert_not_includes response.body, text }
  end

  test "a group that turned search off, or isn't approved yet, stays hidden" do
    @group.update!(search_listed: false)
    assert_hidden "/groups/sunrise-crew"
    assert_hidden "/groups/sunrise-crew/meetings/#{@meeting.id}"
    @group.update!(search_listed: true, status: "pending")
    assert_hidden "/groups/sunrise-crew"
  end

  test "a group's private side and everything personal stays hidden" do
    %w[/groups/sunrise-crew/conscience /groups/sunrise-crew/conscience/decisions /groups/sunrise-crew/meetings/999999
       /people /people/hostname /recovery /polls/abc123 /p/abc123 /share_cards/site/x.png /users/sign_in /library].each do |path|
      assert_hidden path
    end
    assert_hidden @members_doc.path
  end

  test "the sitemap lists only the safe pages and listed groups" do
    get "/sitemap.xml"
    assert_response :success
    assert_includes response.body, "/groups/sunrise-crew</loc>"
    assert_includes response.body, "/groups/sunrise-crew/meetings/#{@meeting.id}</loc>"
    assert_includes response.body, "#{@public_doc.path}</loc>"
    assert_not_includes response.body, @members_doc.path
    assert_not_includes response.body, "/library"

    @group.update!(search_listed: false)
    get "/sitemap.xml"
    assert_not_includes response.body, "sunrise-crew"
  end

  test "robots.txt points at the sitemap and leaves the Docs API readable" do
    robots = Rails.root.join("public/robots.txt").read
    assert_includes robots, "Sitemap: https://recoverybot.hmblbot.com/sitemap.xml"
    assert_includes robots, "Allow: /api/docs"
  end

  test "a group admin can turn search listing off" do
    sign_in_as(@host)
    patch "/api/groups/sunrise-crew", params: { group: { search_listed: false } }, as: :json
    assert_response :success
    assert_not @group.reload.search_listed
  end

  private

  def sign_in_as(user)
    post "/users/sign_in", params: { user: { email: user.email, password: "password123" } }
  end
end
