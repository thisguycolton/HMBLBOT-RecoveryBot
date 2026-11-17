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

  test "the host and co-host share where they are and what was posted, and see each other" do
    sign_in @admin
    save_kit
    posting = @group.hosting_kits.first.postings.first

    sign_in @host
    post path(@meeting.id, "ping"), params: { activity: "Reading the script", section_index: 0 }, as: :json
    post path(@meeting.id, "act"), params: { act: "goto", index: 2, label: "Readings" }, as: :json
    post path(@meeting.id, "act"), params: { act: "posted", posting_id: posting.id }, as: :json
    assert_response :success

    sign_in @co_host
    post path(@meeting.id, "ping"), params: { activity: "Looking at chat postings" }, as: :json
    live = response.parsed_body
    assert_equal 2, live["section_index"]
    assert live["server_now"], "the page's meeting clock runs from the start time, on the server's clock"
    assert_equal "Hal", live.dig("posted", posting.id.to_s, "by")
    assert_equal ["Hal", "Cory"], live["presences"].map { |p| p["name"] }
    assert_equal "Reading the script", live["presences"].first["activity"]
    assert_equal ["Copied Welcome", "Moved to Readings"], live["log"].map { |l| l["text"] }

    # the timer runs from the meeting's start time: there's no starting or pausing it
    post path(@meeting.id, "act"), params: { act: "timer_start" }, as: :json
    assert_response :unprocessable_entity
    post path(@meeting.id, "act"), params: { act: "explode" }, as: :json
    assert_response :unprocessable_entity
    post path(@meeting.id, "act"), params: { act: "posted", posting_id: 0 }, as: :json
    assert_response :not_found
  end

  test "Reset takes both hosts back to the first section; the day's picks stay" do
    sign_in @admin
    save_kit
    put path(@meeting.id, "kit"), params: { kit: { scope: "meeting", script_document_id: @script.id, intro_title: "Getting ready" } }, as: :json
    assert_equal "Getting ready", response.parsed_body.dig("kit", "intro_title")

    sign_in @host
    post path(@meeting.id, "act"), params: { act: "complete", index: 0 }, as: :json
    post path(@meeting.id, "act"), params: { act: "goto", index: 2, label: "Readings" }, as: :json
    post path(@meeting.id, "act"), params: { act: "milestone_add", data: { name: "Kim" } }, as: :json
    post path(@meeting.id, "act"), params: { act: "reset", index: 0, label: "Getting ready" }, as: :json
    assert_response :success

    sign_in @co_host
    post path(@meeting.id, "ping"), params: {}, as: :json
    live = response.parsed_body
    assert_equal 0, live["section_index"]
    assert_empty live["completed"]
    assert_equal ["Kim"], live["milestones"].map { |m| m["name"] }
    assert_equal "Reset the deck to Getting ready", live["log"].first["text"]
  end

  test "the court verification link picks the meeting and fills in the host" do
    get "/court_verifications/new", params: { group: @group.slug, meeting: @meeting.id, host: "Hal" }
    assert_response :success
    group = JSON.parse(CGI.unescapeHTML(response.body[/data-group="([^"]*)"/, 1]))
    assert_equal [@meeting.id, "today", "Hal"], group["preselect"].values_at("meeting_id", "day", "host_name")

    get "/court_verifications/new", params: { group: @group.slug, meeting: @other_day.id }
    group = JSON.parse(CGI.unescapeHTML(response.body[/data-group="([^"]*)"/, 1]))
    assert_equal @meeting.id, group.dig("preselect", "meeting_id"), "the same meeting on another day picks today's"
    assert_nil group.dig("preselect", "host_name")
  end

  test "the live Topicificator window follows what the hosts draw, and the hosts run its timer and what's on screen" do
    set = TopicSet.create!(name: "Acid Test topics")
    gratitude = Topic.create!(topic_set_id: set.id, title: "Gratitude", subtitle: "What are you thankful for?", searchable_number: "7")
    Topic.create!(topic_set_id: set.id, title: "Fear", searchable_number: "8")
    sign_in @host
    get path(@meeting.id), as: :json
    code = response.parsed_body.dig("link", "code")

    # not asked for yet: nothing to show, and nobody needs to sign in to ask
    reset!
    get "/api/topicificator_links/#{code}", as: :json
    assert_response :success
    assert_equal false, response.parsed_body["active"]
    get "/api/topicificator_links/NOPE00", as: :json
    assert_response :not_found

    sign_in @host
    post path(@meeting.id, "act"), params: { act: "activity", activity: { kind: "topics", topic_set_id: set.id, topic_set_name: set.name } }, as: :json
    assert_not response.parsed_body["topicificator_connected"]
    post path(@meeting.id, "act"), params: { act: "draw_topic", number: "7" }, as: :json
    post path(@meeting.id, "act"), params: { act: "draw_topic" }, as: :json

    reset!
    get "/api/topicificator_links/#{code}", as: :json
    live = response.parsed_body
    assert live["active"]
    assert_equal "Fear", live["topic"]["title"], "the latest draw is on screen"
    assert_equal %w[Gratitude Fear], live["covered"].map { |t| t["title"] }
    assert_equal 180, live.dig("timer", "seconds")
    assert live.dig("timer", "started_at"), "a draw starts the timer"

    sign_in @host
    get path(@meeting.id), as: :json
    assert response.parsed_body.dig("live", "topicificator_connected"), "the deck sees the window asked"

    # back to an earlier topic, the free share, then the timer
    post path(@meeting.id, "act"), params: { act: "topic_show", index: gratitude.id }, as: :json
    assert_equal gratitude.id.to_s, response.parsed_body.dig("activity", "shown")
    post path(@meeting.id, "act"), params: { act: "topic_show", index: "free" }, as: :json
    post path(@meeting.id, "act"), params: { act: "topic_timer", data: { op: "set", value: "300" } }, as: :json
    post path(@meeting.id, "act"), params: { act: "topic_timer", data: { op: "set", value: "5" } }, as: :json
    assert_equal 300, response.parsed_body.dig("activity", "timer_seconds"), "a length out of range is ignored"
    reset!
    get "/api/topicificator_links/#{code}", as: :json
    assert response.parsed_body["free"]
    assert_equal "Free Share / Check-In", response.parsed_body.dig("topic", "title")
    assert_equal 300, response.parsed_body.dig("timer", "seconds")

    sign_in @host
    post path(@meeting.id, "act"), params: { act: "topic_timer", data: { op: "stop" } }, as: :json
    assert_nil response.parsed_body.dig("activity", "timer_started_at")
    post path(@meeting.id, "act"), params: { act: "topic_show", index: gratitude.id }, as: :json
    post path(@meeting.id, "act"), params: { act: "drop_topic", index: gratitude.id }, as: :json
    assert_nil response.parsed_body.dig("activity", "shown"), "dropping the topic on screen puts the latest back"
  end

  test "the hosts pick the day's reading or activity: today's page of a daily book, or Topicificator topics" do
    book = Book.create!(slug: "daily-reflections", title: "Daily Reflections")
    on = nil
    sign_in @host
    get path(@meeting.id), as: :json
    on = Date.parse(response.parsed_body["on"])
    slug = "#{Date::MONTHNAMES[on.month].downcase}-#{on.day}"
    book.chapters.create!(slug: slug, title: "#{Date::MONTHNAMES[on.month]} #{on.day}: Today", index: 1)
    book.chapters.create!(slug: "foreword", title: "Foreword", index: 0)

    get path(@meeting.id), as: :json
    assert_equal [slug], response.parsed_body.dig("activity_options", "daily").map { |d| d["chapter_slug"] }

    post path(@meeting.id, "act"), params: { act: "activity", activity: { kind: "daily", book_slug: book.slug, chapter_slug: slug, title: "Today", book_title: "Daily Reflections" } }, as: :json
    assert_equal "daily", response.parsed_body.dig("activity", "kind")
    assert_equal "Hal", response.parsed_body.dig("activity", "by")
    assert_equal "Picked Daily reading: Today", response.parsed_body["log"].first["text"]

    set = TopicSet.create!(name: "Acid Test topics")
    gratitude = Topic.create!(topic_set_id: set.id, title: "Gratitude", searchable_number: "7")
    Topic.create!(topic_set_id: set.id, title: "Fear", searchable_number: "8")
    post path(@meeting.id, "act"), params: { act: "draw_topic" }, as: :json
    assert_nil response.parsed_body.dig("activity", "topics"), "no topics drawn into a reading"

    sign_in @co_host
    post path(@meeting.id, "act"), params: { act: "activity", activity: { kind: "topics", topic_set_id: set.id, topic_set_name: set.name } }, as: :json
    post path(@meeting.id, "act"), params: { act: "draw_topic", number: "7" }, as: :json
    post path(@meeting.id, "act"), params: { act: "draw_topic" }, as: :json
    assert_equal ["Gratitude", "Fear"], response.parsed_body.dig("activity", "topics").map { |t| t["title"] }, "a random draw skips the ones drawn"
    post path(@meeting.id, "act"), params: { act: "drop_topic", index: gratitude.id }, as: :json
    assert_equal ["Fear"], response.parsed_body.dig("activity", "topics").map { |t| t["title"] }

    sign_in @host
    post path(@meeting.id, "ping"), as: :json
    assert_equal "Cory", response.parsed_body.dig("activity", "by"), "the other host sees it"
  end

  test "host coordinators say where the reading / activity goes in the script" do
    sign_in @coordinator
    put path(@meeting.id, "kit"), params: { kit: { scope: "meeting", script_document_id: @script.id, activity_anchor: "  You choose the format!  " } }, as: :json
    assert_equal "You choose the format!", response.parsed_body.dig("kit", "activity_anchor")
  end

  test "the hosts line up today's service and the milestones, and both see them" do
    sign_in @host
    get path(@meeting.id), as: :json
    assert_equal %w[host co_host hiw traditions timer closing], response.parsed_body.dig("kit", "service_roles").map { |r| r["key"] }

    post path(@meeting.id, "act"), params: { act: "service", index: "hiw", label: "How It Works", data: { value: "  Kim R. " } }, as: :json
    assert_equal({ "hiw" => "Kim R." }, response.parsed_body["service"])
    assert_equal "Put Kim R. on How It Works", response.parsed_body["log"].first["text"]

    post path(@meeting.id, "act"), params: { act: "milestone_add", data: { name: "Jo", length: "30 days" } }, as: :json
    post path(@meeting.id, "act"), params: { act: "milestone_add", data: { name: "Lee", length: "1 year" } }, as: :json
    lee = response.parsed_body["milestones"].last["id"]
    post path(@meeting.id, "act"), params: { act: "milestone_move", data: { id: lee, by: -1 } }, as: :json
    post path(@meeting.id, "act"), params: { act: "milestone_update", data: { id: lee, done: true } }, as: :json

    sign_in @co_host
    post path(@meeting.id, "ping"), as: :json
    assert_equal [["Lee", "1 year", true], ["Jo", "30 days", nil]], response.parsed_body["milestones"].map { |m| [m["name"], m["length"], m["done"]] }
    post path(@meeting.id, "act"), params: { act: "service", index: "hiw", data: { value: "" } }, as: :json
    assert_equal({}, response.parsed_body["service"])
    post path(@meeting.id, "act"), params: { act: "milestone_remove", data: { id: lee } }, as: :json
    assert_equal ["Jo"], response.parsed_body["milestones"].map { |m| m["name"] }
  end

  test "host coordinators name the group's own service roles" do
    sign_in @coordinator
    put path(@meeting.id, "kit"), params: { kit: { scope: "meeting", service_roles: [{ label: "How It Works", key: "hiw" }, { label: "Closing reading" }, { label: "Closing reading" }, { label: "" }] } }, as: :json
    assert_equal [["hiw", "How It Works"], ["closing_reading", "Closing reading"]],
                 response.parsed_body.dig("kit", "service_roles").map { |r| [r["key"], r["label"]] }
    assert response.parsed_body.dig("kit", "custom_service_roles")
  end
  test "each date gets a short link: hosts land on that day's Command Center, anyone else on its chat postings" do
    sign_in @coordinator
    save_kit(scope: "default")
    sign_in @host
    get path(@other_day.id), params: { on: (@today + 1).iso8601 }, as: :json
    assert_response :success
    assert_equal (@today + 1).iso8601, response.parsed_body["on"]
    assert_equal @other_day.id, response.parsed_body.dig("meeting", "id")
    code = response.parsed_body.dig("link", "code")
    assert_match(/\A[A-Z2-9]{6}\z/, code)
    assert_equal "/h/#{code}", response.parsed_body.dig("link", "path")
    post path(@other_day.id, "act"), params: { on: (@today + 1).iso8601, act: "posted", posting_id: HostChatPosting.first.id }, as: :json
    assert_response :success
    hosting = HostingSession.find_by!(code: code)
    assert_equal [@other_day.id, @today + 1], [hosting.meeting_id, hosting.on]
    assert hosting.posted.key?(HostChatPosting.first.id.to_s)

    get "/h/#{code.downcase}"
    assert_redirected_to "/groups/#{@group.slug}/host/#{@other_day.id}?on=#{(@today + 1).iso8601}"

    sign_out @host
    get "/h/#{code}"
    assert_redirected_to "/groups/#{@group.slug}/chat/#{code}"
    get "/h/#{code}", params: { sign_in: 1 }
    assert_redirected_to "/users/sign_in"
    get "/h/NOPE00"
    assert_redirected_to "/groups/meetings"

    get "/api/hosting_links/#{code}", as: :json
    assert_response :success
    body = response.parsed_body
    assert body["shown"]
    assert_not body["can_host"]
    assert_equal ["Welcome", "7th Tradition"], body.dig("kit", "postings").map { |p| p["title"] }
    assert body.dig("live", "posted").key?(HostChatPosting.first.id.to_s)
    assert_not body["live"].key?("log")
    assert_not body["live"].key?("milestones")

    @group.hosting_kits.first.update!(public_postings: false)
    get "/api/hosting_links/#{code}", as: :json
    assert_not response.parsed_body["shown"]
    assert_empty response.parsed_body.dig("kit", "postings")
    assert_nil response.parsed_body["live"]

    get "/api/hosting_links/NOPE00", as: :json
    assert_response :not_found
  end

  test "host coordinators keep the chat postings to hosts" do
    sign_in @coordinator
    put path(@meeting.id, "kit"), params: { kit: { scope: "meeting", public_postings: false, postings: [] } }, as: :json
    assert_response :success
    assert_equal false, response.parsed_body.dig("link", "public_postings")
  end

  test "a host picks one of their own readings: it comes with the page's copy as a chat posting, and both hosts can read it" do
    mine = Reading.create!(user: @host, title: "How It Works", source: "Alcoholics Anonymous", meetingName: "Sunrise", published_at: 1.day.ago,
                           content: "<p>Rarely have we seen a person fail.</p>", topic: "<ul><li>Honesty</li><li>Open-mindedness</li></ul>")
    draft = Reading.create!(user: @host, title: "Draft reading", content: "<p>Not yet</p>")
    theirs = Reading.create!(user: @co_host, title: "Cory's reading", published_at: 1.day.ago, content: "<p>Cory</p>")

    sign_in @host
    get path(@meeting.id, "my_readings"), as: :json
    assert_response :success
    assert_equal [["Draft reading", "draft"], ["How It Works", "published"]], response.parsed_body["readings"].map { |r| [r["title"], r["status"]] }.sort

    post path(@meeting.id, "act"), params: { act: "activity", activity: { kind: "my_reading", reading_id: theirs.id } }, as: :json
    assert_response :unprocessable_entity, "someone else's reading can't be picked"

    post path(@meeting.id, "act"), params: { act: "activity", activity: { kind: "my_reading", reading_id: mine.id, title: "Spoofed", reading_path: "/elsewhere" } }, as: :json
    assert_response :success
    activity = response.parsed_body["activity"]
    assert_equal "my_reading", activity["kind"]
    assert_equal "How It Works", activity["title"], "the title comes from the reading"
    assert_equal "/readings/#{mine.id}", activity["reading_path"]
    assert_equal "- Honesty\n- Open-mindedness", activity["reading_topics"]
    assert activity["reading_published"]
    assert_equal "Picked Reading: How It Works", response.parsed_body["log"].first["text"]

    post path(@meeting.id, "act"), params: { act: "posted", posting_id: "reading" }, as: :json
    assert_response :success
    assert_equal "Hal", response.parsed_body.dig("posted", "reading", "by")

    sign_in @co_host
    get path(@meeting.id, "reading"), as: :json
    assert_response :success
    assert_equal "How It Works", response.parsed_body["title"]
    assert_includes response.parsed_body["html"], "Rarely have we seen"
    assert_includes response.parsed_body["topics_html"], "Honesty"

    post path(@meeting.id, "act"), params: { act: "activity", activity: { kind: "my_reading", reading_id: draft.id } }, as: :json
    assert_response :unprocessable_entity, "the co-host picks from their own readings"
    sign_in @host
    post path(@meeting.id, "act"), params: { act: "activity", activity: { kind: "my_reading", reading_id: draft.id } }, as: :json
    assert_not response.parsed_body.dig("activity", "reading_published")
    assert_nil response.parsed_body["posted"]["reading"], "a new pick clears the old posting's copied mark"

    post path(@meeting.id, "act"), params: { act: "clear_activity" }, as: :json
    get path(@meeting.id, "reading"), as: :json
    assert_response :not_found

    post path(@meeting.id, "act"), params: { act: "posted", posting_id: "reading" }, as: :json
    assert_response :not_found, "there is no reading posting without a reading"
  end

  test "a reading scheduled to go live at the meeting's start shows as published once it does, without picking it again" do
    starts = 1.hour.from_now.change(sec: 0)
    scheduled = Reading.create!(user: @host, title: "Step One", published_at: starts, content: "<p>We admitted</p>")

    sign_in @host
    post path(@meeting.id, "act"), params: { act: "activity", activity: { kind: "my_reading", reading_id: scheduled.id } }, as: :json
    assert_response :success
    assert_not response.parsed_body.dig("activity", "reading_published"), "it isn't live yet"

    travel_to starts do
      post path(@meeting.id, "ping"), as: :json
      assert response.parsed_body.dig("activity", "reading_published"), "it went live at its publish time"

      get path(@meeting.id), as: :json
      assert response.parsed_body.dig("live", "activity", "reading_published"), "and a reload shows it live too"

      code = HostingSession.last.code
      get "/api/hosting_links/#{code}", as: :json
      assert response.parsed_body.to_json.include?('"reading_published":true'), "the short link's page sees it live"
    end
  end

  test "the picker lists the week's meetings by date, with who hosts each" do
    sign_in @host
    get path, as: :json
    assert_response :success
    occurrences = response.parsed_body["occurrences"]
    assert occurrences.size >= 2
    assert(occurrences.all? { |o| o["name"] == "Sunrise" && o["starts_at"] && o["on"] })
    assert(occurrences.any? { |o| o["mine"] && o["host"] == "Hal" })
    assert_equal occurrences.map { |o| o["starts_at"] }.sort, occurrences.map { |o| o["starts_at"] }
  end

  test "a script's sections: counted for the picker, and kept when the document is saved" do
    body = '<p>Welcome</p><div data-hc-section="" data-title="Top of the hour" data-cue="start+0" onclick="x()"></div><p>Hi</p>' \
           '<div data-hc-section="" data-title="Speaker" data-when="speaker" data-days="6"></div><p>Please welcome {{ speaker_name }}</p>'
    @script.update!(body: body)
    assert_includes @script.body, 'data-title="Top of the hour"'
    assert_includes @script.body, 'data-when="speaker"'
    assert_not_includes @script.body, "onclick"
    assert_equal 3, HostingKit.section_count(@script), "two sections and what comes before them"
    assert_equal 2, HostingKit.section_count(GroupDocument.new(body: "<h2>A</h2><p>x</p><h2>B</h2>", body_format: "html"))
    assert_nil HostingKit.section_count(GroupDocument.new(body: "<p>Just text</p>", body_format: "html"))

    sign_in @admin
    get path(@meeting.id), as: :json
    assert_equal 3, response.parsed_body.dig("editor", "documents").find { |d| d["id"] == @script.id }["sections"]
  end

  test "host coordinators pick the dynamic values the document editor offers" do
    sign_in @admin
    put path(@meeting.id, "kit"), params: { kit: { scope: "default", script_document_id: @script.id, allowed_values: ["milestones", "host", "bad key!"], postings: [] } }, as: :json
    assert_response :success
    assert_equal %w[milestones host], response.parsed_body.dig("kit", "allowed_values")

    sign_in @host
    get path("values"), params: { document_id: @script.id }, as: :json
    assert_equal %w[milestones host], response.parsed_body["allowed"]
    assert_includes response.parsed_body["roles"].map { |r| r["key"] }, "hiw"

    sign_in @admin
    put path(@meeting.id, "kit"), params: { kit: { scope: "default", script_document_id: @script.id, allowed_values: nil, postings: [] } }, as: :json
    assert_nil response.parsed_body.dig("kit", "allowed_values")
    get path("values"), params: { document_id: @secret.id }, as: :json
    assert_nil response.parsed_body["allowed"], "a document no kit uses follows the default kit"

    sign_in @member
    get path("values"), as: :json
    assert_response :forbidden
  end

  test "service readings: every version, and one version's text to share" do
    ServiceReading.delete_all # the scaffold fixtures, when the whole suite runs
    hiw = ServiceReading.create!(title: "How It Works", source: "Big Book", icon: "book-open", body: "<p>Rarely have we seen</p>")
    ServiceReading.create!(title: "How It Works", source: "Short form")
    sign_in @host
    get path("service_readings"), as: :json
    assert_response :success
    assert_equal ["Big Book", "Short form"], response.parsed_body["readings"].map { |r| r["source"] }

    get path("service_readings", hiw.id), as: :json
    assert_response :success
    assert_equal "How It Works", response.parsed_body["title"]
    assert_includes response.parsed_body["html"], "Rarely have we seen"

    sign_in @member
    get path("service_readings"), as: :json
    assert_response :forbidden
  end

  test "the Time Capsule keeps what each meeting picked, and the next pick sees the last ones" do
    sign_in @host
    get path(@meeting.id), as: :json
    on = Date.parse(response.parsed_body["on"])
    past = HostingSession.create!(meeting: @meeting, on: on - 7, activity: { "kind" => "speaker", "title" => "Kim R.", "by" => "Hal" },
                                  milestones: [{ "id" => "a", "name" => "Sam", "length" => "30 days" }], service: { "hiw" => "Jo" })
    HostingSession.create!(meeting: @meeting, on: on - 14) # opened, nothing done: left out

    get path("capsule"), as: :json
    assert_response :success
    sessions = response.parsed_body["sessions"]
    assert_equal [past.id], sessions.map { |x| x["id"] }
    assert_equal "Speaker: Kim R.", sessions.first["activity_label"]
    assert_equal [{ "label" => "How It Works", "name" => "Jo" }], sessions.first["service"]
    assert_equal "Sam", sessions.first["milestones"].first["name"]

    get path("capsule"), params: { meeting_id: @other_day.id }, as: :json
    assert_equal [past.id], response.parsed_body["sessions"].map { |x| x["id"] }, "a meeting's other days are the same meeting"

    get path(@meeting.id), params: { on: on.iso8601 }, as: :json
    assert_equal ["Speaker: Kim R."], response.parsed_body["previous"].map { |p| p["label"] }

    sign_in @member
    get path("capsule"), as: :json
    assert_response :forbidden
  end

  test "who's celebrating goes to the short link's page only when a posting names them" do
    sign_in @admin
    save_kit
    sign_in @host
    post path(@meeting.id, "act"), params: { act: "milestone_add", data: { name: "Sam", length: "30 days" } }, as: :json
    post path(@meeting.id, "act"), params: { act: "milestone_add", data: { name: "Kim" } }, as: :json
    code = HostingSession.last.code
    sign_out @host

    get "/api/hosting_links/#{code}", as: :json
    assert_nil response.parsed_body.dig("live", "milestones_text")

    @group.hosting_kits.first.postings.first.update!(body: "Congratulations {{ milestones }}!")
    get "/api/hosting_links/#{code}", as: :json
    assert_equal "Sam (30 days) and Kim", response.parsed_body.dig("live", "milestones_text")
  end
end
