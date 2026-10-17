require "test_helper"

class Api::GroupBusinessMeetingsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "boss@example.com"
    @boss = User.create!(email: "boss@example.com", name: "Boss", password: "password123", confirmed: true, admin: true)
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @keeper = User.create!(email: "keeper@example.com", name: "Kay", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @other = User.create!(email: "other@example.com", name: "Oz", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
    @elsewhere = Group.create!(title: "Night Owls", time_zone: "America/Phoenix")
    @elsewhere.memberships.create!(user: @other, role: "member")
    @today = @group.zone.today
    @next = @group.business_meetings.create!(held_on: @today + 6, starts_at: nil, created_by: @keeper)
    @agenda = @next.agenda_items.create!(title: "Treasurer's report", kind: "report")
    @held = @group.business_meetings.create!(held_on: @today - 20, status: "held", minutes: "<p>Draft notes</p>")
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  def path(*rest) = ["/api/groups/#{@group.slug}/business_meetings", *rest].join("/")
  def body = response.parsed_body

  test "only members read business meetings" do
    get path, as: :json
    assert_response :unauthorized
    sign_in @other
    get path, as: :json
    assert_response :not_found

    sign_in @member
    get path, as: :json
    assert_response :success
    assert_equal [@next.id, @held.id], body["meetings"].map { |m| m["id"] }
    assert_equal [false, false], [body["can_edit"], body["can_make_events"]]
    get path(@next.id), as: :json
    assert_equal ["Treasurer's report"], body["agenda"].map { |i| i["title"] }
    assert_equal true, body["can_suggest"]
  end

  test "draft minutes stay with record keepers until they're posted" do
    sign_in @member
    get path(@held.id), as: :json
    assert_nil body["minutes"]
    sign_in @keeper
    get path(@held.id), as: :json
    assert_equal "<p>Draft notes</p>", body["minutes"]
    @held.update!(minutes_status: "posted")
    sign_in @member
    get path(@held.id), as: :json
    assert_equal "<p>Draft notes</p>", body["minutes"]
  end

  test "a meeting for record keepers is invisible to members" do
    secret = @group.business_meetings.create!(held_on: @today + 2, visibility: "keepers")
    sign_in @member
    get path, as: :json
    assert_not_includes body["meetings"].map { |m| m["id"] }, secret.id
    get path(secret.id), as: :json
    assert_response :not_found
    sign_in @keeper
    get path(secret.id), as: :json
    assert_response :success
  end

  test "record keepers schedule a meeting and members are told once" do
    sign_in @member
    post path, params: { business_meeting: { held_on: (@today + 14).to_s } }, as: :json
    assert_response :forbidden

    sign_in @keeper
    assert_difference -> { Notification.where(kind: "business_meeting.scheduled").count } => 2 do # the other two members, not Kay
      post path, params: { business_meeting: { held_on: (@today + 14).to_s, starts_time: "19:00", chair_name: " Lee  L. " } }, as: :json
    end
    assert_response :created
    assert_equal ["19:00", "Lee L.", "planned"], body.values_at("starts_time", "chair", "status")
    assert_equal [@leader, @member].sort_by(&:id), Notification.where(kind: "business_meeting.scheduled").map(&:user).sort_by(&:id)

    post path, params: { business_meeting: { held_on: "" } }, as: :json
    assert_response :unprocessable_entity
  end

  test "a meeting for keepers only tells only keepers; one in the past tells nobody" do
    sign_in @keeper
    assert_difference -> { Notification.count } => 1 do
      post path, params: { business_meeting: { held_on: (@today + 3).to_s, visibility: "keepers" } }, as: :json
    end
    assert_equal @leader, Notification.last.user
    assert_no_difference -> { Notification.count } do
      post path, params: { business_meeting: { held_on: (@today - 3).to_s, status: "held" } }, as: :json
    end
  end

  test "a group admin can have an event made to announce it, with the live agenda in it" do
    sign_in @keeper
    assert_no_difference -> { Event.count } do
      post path, params: { business_meeting: { held_on: (@today + 14).to_s }, create_event: true }, as: :json
    end
    assert_response :forbidden

    sign_in @leader
    assert_difference -> { Event.count } => 1 do
      post path, params: { business_meeting: { held_on: (@today + 14).to_s, starts_time: "19:00" }, create_event: true }, as: :json
    end
    assert_response :created
    event = Event.find_by!(token: body.dig("event", "token"))
    assert_equal ["draft", "Sunrise Crew business meeting"], [event.status, event.title]
    assert_equal %w[heading notes conscience_agenda], event.blocks.map { |b| b["type"] }
    assert_equal event.id, BusinessMeeting.find(body["id"]).event_id
    assert_equal event.starts_at, BusinessMeeting.find(body["id"]).starts_at
  end

  test "the announcing event shows its agenda to members only" do
    event = @group.events.create!(title: "Business meeting", time_zone: "America/Phoenix", status: "published", blocks: [{ type: "conscience_agenda" }])
    @next.update!(event: event)
    @next.agenda_items.create!(title: "Suggested by someone", status: "suggested")

    get "/api/events/#{event.token}", as: :json
    block = body["blocks"].first
    assert_nil block["agenda"]
    assert_equal true, block["linked"]

    sign_in @member
    get "/api/events/#{event.token}", as: :json
    assert_equal ["Treasurer's report"], body["blocks"].first["agenda"].map { |i| i["title"] }

    sign_in @other
    get "/api/events/#{event.token}", as: :json
    assert_nil body["blocks"].first["agenda"]
  end

  test "posting the minutes tells members once; editing them again doesn't" do
    sign_in @keeper
    assert_difference -> { Notification.where(kind: "business_meeting.minutes").count } => 2 do
      patch path(@held.id), params: { business_meeting: { minutes_status: "posted", attendance_count: 14, secretary_name: "Kay K." } }, as: :json
    end
    assert_response :success
    assert_equal ["posted", 14], body.values_at("minutes_status", "attendance_count")
    assert_no_difference -> { Notification.count } do
      patch path(@held.id), params: { business_meeting: { minutes_status: "approved" } }, as: :json
      patch path(@held.id), params: { business_meeting: { minutes: "<p>More</p>" } }, as: :json
    end
    assert body["minutes_approved_at"]
  end

  test "only record keepers change a meeting; only group admins delete one" do
    sign_in @member
    patch path(@next.id), params: { business_meeting: { status: "cancelled" } }, as: :json
    assert_response :forbidden
    sign_in @keeper
    patch path(@next.id), params: { business_meeting: { status: "cancelled" } }, as: :json
    assert_response :success
    delete path(@next.id), as: :json
    assert_response :forbidden
    sign_in @leader
    delete path(@next.id), as: :json
    assert_response :no_content
    assert_not BusinessMeeting.exists?(@next.id)
  end

  test "members suggest agenda items, which record keepers hear about and approve" do
    sign_in @member
    assert_difference -> { Notification.where(kind: "agenda_item.suggested").count } => 2 do
      post path(@next.id, "agenda_items"), params: { agenda_item: { title: "Buy a new urn", details: "Ours leaks", kind: "new_business", status: "on_agenda" } }, as: :json
    end
    assert_response :created
    assert_equal ["suggested", true], body.values_at("status", "mine")
    item = AgendaItem.find(body["id"])
    assert_equal @member, item.submitted_by

    patch path(@next.id, "agenda_items", item.id), params: { agenda_item: { title: "Buy a new coffee urn", status: "on_agenda" } }, as: :json
    assert_response :success
    assert_equal ["Buy a new coffee urn", "suggested"], item.reload.then { |i| [i.title, i.status] }, "a member can reword theirs but not approve it"
    patch path(@next.id, "agenda_items", @agenda.id), params: { agenda_item: { title: "Hijack" } }, as: :json
    assert_response :forbidden

    sign_in @keeper
    patch path(@next.id, "agenda_items", item.id), params: { agenda_item: { status: "on_agenda" } }, as: :json
    assert_equal "on_agenda", item.reload.status
    sign_in @member
    delete path(@next.id, "agenda_items", item.id), as: :json
    assert_response :forbidden, "once it's on the agenda it isn't theirs to take back"
  end

  test "a member takes back their own suggestion; nobody suggests for a meeting that's over" do
    sign_in @member
    post path(@next.id, "agenda_items"), params: { agenda_item: { title: "Oops" } }, as: :json
    delete path(@next.id, "agenda_items", body["id"]), as: :json
    assert_response :no_content

    post path(@held.id, "agenda_items"), params: { agenda_item: { title: "Too late" } }, as: :json
    assert_response :unprocessable_entity
    sign_in @keeper
    post path(@held.id, "agenda_items"), params: { agenda_item: { title: "Minutes of the last meeting", kind: "other" } }, as: :json
    assert_response :created, "record keepers can add to any agenda"
  end

  test "record keepers reorder the agenda" do
    second = @next.agenda_items.create!(title: "GSR report", kind: "report")
    third = @next.agenda_items.create!(title: "Old business", kind: "old_business")
    sign_in @member
    post path(@next.id, "agenda_items", "reorder"), params: { ids: [third.id, second.id, @agenda.id] }, as: :json
    assert_response :forbidden
    sign_in @keeper
    post path(@next.id, "agenda_items", "reorder"), params: { ids: [third.id, second.id, @agenda.id] }, as: :json
    assert_equal ["Old business", "GSR report", "Treasurer's report"], body["agenda"].map { |i| i["title"] }
  end

  test "recording a decision at a meeting links it and crosses the agenda item off" do
    sign_in @keeper
    post "/api/groups/#{@group.slug}/motions", params: { motion: { title: "Approve the report", status: "passed", decided_on: @today.to_s, business_meeting_id: @next.id, agenda_item_id: @agenda.id } }, as: :json
    assert_response :created
    assert_equal @next.id, body.dig("meeting", "id")
    assert_equal "done", @agenda.reload.status

    tabled = @next.agenda_items.create!(title: "Roof")
    post "/api/groups/#{@group.slug}/motions", params: { motion: { title: "Fix the roof", status: "tabled", decided_on: @today.to_s, business_meeting_id: @next.id, agenda_item_id: tabled.id } }, as: :json
    assert_equal "tabled", tabled.reload.status

    get path(@next.id), as: :json
    assert_equal ["Fix the roof", "Approve the report"], body["motions"].map { |m| m["title"] }

    post "/api/groups/#{@group.slug}/motions", params: { motion: { title: "Bad", status: "proposed", business_meeting_id: @elsewhere.business_meetings.create!(held_on: @today).id } }, as: :json
    assert_response :unprocessable_entity
  end

  test "the Decisions list links to a meeting only where the viewer may open it" do
    secret = @group.business_meetings.create!(held_on: @today - 1, visibility: "keepers", status: "held")
    @group.motions.create!(title: "Closed door", status: "passed", decided_on: @today, business_meeting: secret)
    sign_in @member
    get "/api/groups/#{@group.slug}/motions", as: :json
    assert_nil body["motions"].first["meeting"]
    sign_in @keeper
    get "/api/groups/#{@group.slug}/motions", as: :json
    assert_equal secret.id, body["motions"].first.dig("meeting", "id")
  end

  test "the page's business meeting block: members get the agenda, visitors only an announced meeting" do
    get "/api/groups/#{@group.slug}/page", as: :json
    assert_nil body.dig("context", "business_meeting")

    sign_in @member
    get "/api/groups/#{@group.slug}/page", as: :json
    block = body.dig("context", "business_meeting")
    assert_equal [@next.id, true, ["Treasurer's report"]], [block["id"], block["can_suggest"], block["agenda"].map { |i| i["title"] }]

    sign_out @member
    @next.update!(event: @group.events.create!(title: "Business meeting", time_zone: "America/Phoenix", status: "published"))
    get "/api/groups/#{@group.slug}/page", as: :json
    block = body.dig("context", "business_meeting")
    assert_equal @next.held_on.iso8601, block["held_on"]
    assert_nil block["agenda"], "visitors don't see the agenda"
    assert_nil block["id"]
    assert block.dig("event", "path")

    sign_in @leader
    patch "/api/groups/#{@group.slug}/page", params: { page: { blocks: [{ type: "business_meeting", title: "Next up" }] } }, as: :json
    assert_equal ["Next up"], @group.reload.page_blocks.map { |b| b["title"] }
  end

  test "the Overview gathers what members need, and what record keepers must do" do
    @next.agenda_items.create!(title: "Suggested", status: "suggested", submitted_by: @member)
    @group.motions.create!(title: "Send 60/30/10", status: "passed", decided_on: @today - 40)
    @group.documents.create!(title: "Format", pinned: true, kind: "format")
    @group.documents.create!(title: "Draft guidelines", status: "draft")
    @group.treasurer_reports.create!(period_on: @today, status: "draft")
    @group.service_positions.create!(title: "Treasurer")

    sign_in @member
    get "/api/groups/#{@group.slug}/conscience", as: :json
    assert_response :success
    assert_equal @next.id, body.dig("next_meeting", "id")
    assert_equal ["Send 60/30/10"], body["recent_decisions"].map { |m| m["title"] }
    assert_equal ["Format"], body["pinned_documents"].map { |d| d["title"] }
    assert_equal [["Treasurer", "vacant"]], body["service"].map { |s| [s["title"], s["rotation"]] }
    assert_nil body["waiting"]

    sign_in @keeper
    get "/api/groups/#{@group.slug}/conscience", as: :json
    assert_equal ["Suggested"], body.dig("waiting", "suggested_items").map { |i| i["title"] }
    assert_equal [@held.id], body.dig("waiting", "draft_minutes").map { |m| m["id"] }
    assert_equal ["Draft guidelines"], body.dig("waiting", "draft_documents").map { |d| d["title"] }
    assert_equal 1, body.dig("waiting", "draft_reports").size

    sign_in @other
    get "/api/groups/#{@group.slug}/conscience", as: :json
    assert_response :not_found
  end
end
