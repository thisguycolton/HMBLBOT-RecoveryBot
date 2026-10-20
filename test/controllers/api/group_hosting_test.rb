require "test_helper"

# The Hosting Command Center: who opens it, the kit host coordinators set up, and the live state
# the host and co-host share
class Api::GroupHostingTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @admin = User.create!(email: "admin@example.com", name: "Ada", password: "password123", confirmed: true)
    @coordinator = User.create!(email: "coord@example.com", name: "Cam", password: "password123", confirmed: true)
    @host = User.create!(email: "host@example.com", name: "Hal", password: "password123", confirmed: true)
    @co_host = User.create!(email: "co@example.com", name: "Cory", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @admin, role: "admin")
    @group.memberships.create!(user: @coordinator, role: "member", can_schedule_hosts: true)
    @group.memberships.create!(user: @host, role: "member", can_host: true)
    @group.memberships.create!(user: @co_host, role: "member", can_host: true)
    @group.memberships.create!(user: @member, role: "member")
    @today = @group.zone.today
    @meeting = @group.meetings.create!(name: "Sunrise", recurrence: "weekly", day_of_week: @today.wday, start_minute: 420)
    @other_day = @group.meetings.create!(name: "Sunrise", recurrence: "weekly", day_of_week: (@today.wday + 1) % 7, start_minute: 420)
    # on both days, since which one the Command Center opens on depends on the time of day
    [@meeting, @other_day].each { |m| m.hosts.create!(role: "host", user: @host, starts_on: @today - 30) }
    @script = @group.documents.create!(title: "Host script", kind: "format", body: "<h2>Opening</h2><p>Welcome</p>", body_format: "html", visibility: "hosts")
    @secret = @group.documents.create!(title: "Keepers only", kind: "format", body: "<p>Shh</p>", body_format: "html", visibility: "keepers")
  end

  def path(*rest) = ["/api/groups/#{@group.slug}/hosting", *rest].join("/")

  def save_kit(scope: "meeting", script: @script, postings: nil)
    postings ||= [{ title: "Welcome", icon: "message-circle", minute: 0, body: "Welcome to **{{meeting}}**" },
                  { title: "7th Tradition", icon: "hand-heart", minute: 45, body: "Venmo @sunrise" }]
    put path(@meeting.id, "kit"), params: { kit: { scope: scope, script_document_id: script&.id, postings: postings,
                                                   readings: [{ book_slug: "big-book", chapter_slug: "how-it-works", title: "How It Works" }, { url: "javascript:alert(1)", title: "Bad" }] } }, as: :json
  end

  test "members who can host open it; other members can't" do
    sign_in @member
    get path(@meeting.id), as: :json
    assert_response :forbidden

    sign_in @co_host
    get path, as: :json
    assert_response :success
    assert_equal ["Sunrise"], response.parsed_body["meetings"].map { |m| m["name"] }

    get path(@meeting.id), as: :json
    assert_response :success
    assert_equal "Hal", response.parsed_body.dig("hosts", "host")
    assert_not response.parsed_body["can_edit"]
    assert_nil response.parsed_body["my_role"]
    assert_includes [@meeting.id, @other_day.id], response.parsed_body.dig("meeting", "id")
    assert_includes response.parsed_body["court_url"], "meeting=#{response.parsed_body.dig("meeting", "id")}"
  end

  test "host coordinators set up a meeting's kit; it covers the meeting's other days, and hosts can't change it" do
    sign_in @host
    save_kit
    assert_response :forbidden

    sign_in @coordinator
    save_kit
    assert_response :success
    kit = response.parsed_body["kit"]
    assert kit["own"]
    assert_equal ["Welcome", "7th Tradition"], kit["postings"].map { |p| p["title"] }
    assert_equal ["How It Works"], kit["readings"].map { |r| r["title"]}, "a link that isn't http(s) is dropped"
    assert_equal "Host script", kit.dig("script", "title")

    get path(@other_day.id), as: :json
    assert_equal ["Welcome", "7th Tradition"], response.parsed_body.dig("kit", "postings").map { |p| p["title"] }

    # saving again keeps postings by id, drops the ones left out
    first = kit["postings"].first
    save_kit(postings: [first.merge("title" => "Hello")])
    assert_equal [[first["id"], "Hello"]], response.parsed_body.dig("kit", "postings").map { |p| [p["id"], p["title"]] }

    delete path(@meeting.id, "kit"), as: :json
    assert_not response.parsed_body.dig("kit", "exists")
  end

  test "a meeting without its own kit uses the group's default" do
    sign_in @admin
    save_kit(scope: "default")
    assert_response :success
    assert_not response.parsed_body.dig("kit", "own")
    assert response.parsed_body.dig("editor", "has_default")
    assert_equal 1, @group.hosting_kits.where(meeting_id: nil).count
  end

  test "a script hosts can't read stays out" do
    sign_in @admin
    save_kit(script: @secret)
    sign_in @host
    get path(@meeting.id), as: :json
    assert_nil response.parsed_body.dig("kit", "script")
    assert response.parsed_body.dig("kit", "script_hidden")
    assert_equal "host", response.parsed_body["my_role"]
  end

  test "the host and co-host share where they are, the timer and what was posted, and see each other" do
    sign_in @admin
    save_kit
    posting = @group.hosting_kits.first.postings.first

    sign_in @host
    post path(@meeting.id, "ping"), params: { activity: "Reading the script", section_index: 0 }, as: :json
    post path(@meeting.id, "act"), params: { act: "goto", index: 2, label: "Readings" }, as: :json
    post path(@meeting.id, "act"), params: { act: "timer_start" }, as: :json
    post path(@meeting.id, "act"), params: { act: "posted", posting_id: posting.id }, as: :json
    assert_response :success

    sign_in @co_host
    post path(@meeting.id, "ping"), params: { activity: "Looking at chat postings" }, as: :json
    live = response.parsed_body
    assert_equal 2, live["section_index"]
    assert live.dig("timer", "running")
    assert_equal "Hal", live.dig("posted", posting.id.to_s, "by")
    assert_equal ["Hal", "Cory"], live["presences"].map { |p| p["name"] }
    assert_equal "Reading the script", live["presences"].first["activity"]
    assert_equal ["Copied Welcome", "Started the timer", "Moved to Readings"], live["log"].map { |l| l["text"] }

    post path(@meeting.id, "act"), params: { act: "explode" }, as: :json
    assert_response :unprocessable_entity
    post path(@meeting.id, "act"), params: { act: "posted", posting_id: 0 }, as: :json
    assert_response :not_found
  end

  test "the court verification link picks the meeting (when it meets today) and fills in the host" do
    get "/court_verifications/new", params: { group: @group.slug, meeting: @meeting.id, host: "Hal" }
    assert_response :success
    group = JSON.parse(CGI.unescapeHTML(response.body[/data-group="([^"]*)"/, 1]))
    assert_equal [@meeting.id, "Hal"], [group["picked_meeting_id"], group["host_name"]]

    get "/court_verifications/new", params: { group: @group.slug, meeting: @other_day.id }
    group = JSON.parse(CGI.unescapeHTML(response.body[/data-group="([^"]*)"/, 1]))
    assert_nil group["picked_meeting_id"], "it doesn't meet today"
  end
end
