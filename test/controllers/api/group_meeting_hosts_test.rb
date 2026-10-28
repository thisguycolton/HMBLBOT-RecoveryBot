require "test_helper"

class Api::GroupMeetingHostsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "boss@example.com"
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @coordinator = User.create!(email: "coord@example.com", name: "Cam", password: "password123", confirmed: true)
    @keeper = User.create!(email: "keeper@example.com", name: "Kay", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @other = User.create!(email: "other@example.com", name: "Oz", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    @group.memberships.create!(user: @coordinator, role: "member", can_schedule_hosts: true)
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
    Group.create!(title: "Night Owls", time_zone: "America/Phoenix").memberships.create!(user: @other, role: "member")
    @today = @group.zone.today
    @days = (0..6).map { |d| @group.meetings.create!(name: "Sunrise", recurrence: "weekly", day_of_week: d, start_minute: 420) }
    @monday = @days[1]
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  def body = response.parsed_body
  def path(*rest) = ["/api/groups/#{@group.slug}/meeting_hosts", *rest].join("/")
  def covers(*rest) = ["/api/groups/#{@group.slug}/meeting_host_covers", *rest].join("/")
  def slot(id) = body["slots"].find { |s| s["id"] == id }

  test "members read the schedule; people outside the group can't" do
    get path, as: :json
    assert_response :unauthorized
    sign_in @other
    get path, as: :json
    assert_response :not_found

    sign_in @member
    get path, as: :json
    assert_response :success
    assert_equal 7, body["slots"].size
    assert_equal [false, nil], [body["can_edit"], body["members"]]
    assert_equal({ "places" => 14, "open_hosts" => 7, "open_co_hosts" => 7 }, body["summary"])
  end

  test "only group admins and the people who schedule hosts change it" do
    [@member, @keeper].each do |user|
      sign_in user
      post path, params: { meeting_host: { meeting_id: @monday.id, role: "host", name: "Me" } }, as: :json
      assert_response :forbidden
    end
    sign_in @coordinator
    post path, params: { meeting_host: { meeting_id: @monday.id, role: "host", name: "Kay K." } }, as: :json
    assert_response :created
    sign_in @leader
    post path, params: { meeting_host: { meeting_id: @monday.id, role: "co_host", name: "Lee L." } }, as: :json
    assert_response :created
    assert_equal ["Kay K.", "Lee L."], [slot(@monday.id)["host"]["name"], slot(@monday.id)["co_host"]["name"]]
    assert_equal @today.iso8601, slot(@monday.id)["host"]["starts_on"], "starts today unless a date is given"
  end

  test "someone new in a place ends the one before the day before" do
    sign_in @coordinator
    post path, params: { meeting_host: { meeting_id: @monday.id, role: "host", name: "Kay K.", starts_on: (@today - 60).to_s } }, as: :json
    post path, params: { meeting_host: { meeting_id: @monday.id, role: "host", name: "Mo M.", starts_on: @today.to_s } }, as: :json
    assert_response :created
    assert_equal "Mo M.", slot(@monday.id)["host"]["name"]
    old = @monday.hosts.find_by(name: "Kay K.")
    assert_equal @today - 1, old.ends_on

    post path, params: { meeting_host: { meeting_id: @monday.id, role: "host", name: "" } }, as: :json
    assert_response :unprocessable_entity
    post path, params: { meeting_host: { meeting_id: @monday.id, role: "host", name: "X", starts_on: @today.to_s, ends_on: (@today - 3).to_s } }, as: :json
    assert_response :unprocessable_entity
    assert_equal 2, @monday.hosts.count, "a failed one changed nothing"
  end

  test "one person can take every day a meeting runs, and is told once" do
    sign_in @coordinator
    assert_difference -> { MeetingHost.count } => 7, -> { Notification.count } => 1 do
      post path, params: { meeting_host: { meeting_id: @monday.id, role: "host", user_id: @member.id, all_days: true } }, as: :json
    end
    assert_response :created
    assert_equal ["Mo"], @days.map { |m| slot(m.id)["host"]["name"] }.uniq
    note = Notification.last
    assert_equal [@member, "meeting_host.assigned", "/groups/sunrise-crew/meetings"], [note.user, note.kind, note.url]
    assert_match "You're now the host of Sunrise", note.title
  end

  test "someone outside the group isn't linked, and you aren't told about putting yourself on" do
    sign_in @coordinator
    assert_no_difference -> { Notification.count } do
      post path, params: { meeting_host: { meeting_id: @monday.id, role: "host", name: "Oz O.", user_id: @other.id } }, as: :json
      post path, params: { meeting_host: { meeting_id: @days[2].id, role: "host", user_id: @coordinator.id } }, as: :json
    end
    assert_equal false, slot(@monday.id)["host"]["linked"]
    assert_equal true, slot(@days[2].id)["host"]["linked"]
  end

  test "a one-time meeting has no hosts" do
    once = @group.meetings.create!(name: "Special", recurrence: "once", starts_at: 3.days.from_now)
    sign_in @coordinator
    post path, params: { meeting_host: { meeting_id: once.id, role: "host", name: "X" } }, as: :json
    assert_response :not_found
  end

  test "stepping down, changing and removing" do
    sign_in @coordinator
    post path, params: { meeting_host: { meeting_id: @monday.id, role: "host", name: "Kay K.", starts_on: (@today - 5).to_s } }, as: :json
    id = slot(@monday.id)["host"]["id"]
    patch path(id), params: { meeting_host: { ends_on: (@today - 1).to_s } }, as: :json
    assert_response :success
    assert_nil slot(@monday.id)["host"]
    assert_equal 1, body["summary"]["open_hosts"] - 6

    delete path(id), as: :json
    assert_response :success
    assert_equal 0, MeetingHost.count

    other = Group.create!(title: "Night Owls 2", time_zone: "America/Phoenix")
    theirs = other.meetings.create!(name: "X", recurrence: "weekly", day_of_week: 1, start_minute: 60).hosts.create!(role: "host", name: "T", starts_on: @today)
    delete path(theirs.id), as: :json
    assert_response :not_found
  end

  test "a cover for one date replaces the host on that day only" do
    monday = (@today..@today + 6).find { |d| d.wday == 1 }
    @monday.hosts.create!(role: "host", name: "Kay K.", starts_on: @today - 20)
    sign_in @member
    post covers, params: { cover: { meeting_id: @monday.id, role: "host", on: monday.to_s, name: "Cam C." } }, as: :json
    assert_response :forbidden

    sign_in @coordinator
    post covers, params: { cover: { meeting_id: @monday.id, role: "host", on: monday.to_s, user_id: @member.id } }, as: :json
    assert_response :created
    s = slot(@monday.id)
    assert_equal ["Kay K.", "Mo"], [s["host"]["name"], s["covers"].first["name"]]
    assert_equal({ "name" => "Mo", "cover" => true }, s["next_host"]) if s["next_on"] == monday.iso8601
    assert_equal ["meeting_host.covering"], Notification.where(user: @member).pluck(:kind)

    post covers, params: { cover: { meeting_id: @monday.id, role: "host", on: monday.to_s, name: "Lee L." } }, as: :json
    assert_equal ["Lee L."], slot(@monday.id)["covers"].map { |c| c["name"] }, "a new cover replaces the old"
    post covers, params: { cover: { meeting_id: @monday.id, role: "host", on: (monday + 1).to_s, name: "Lee L." } }, as: :json
    assert_response :unprocessable_entity
    assert_match "Mondays", body["error"]

    delete covers(MeetingHostCover.first.id), as: :json
    assert_response :success
    assert_empty slot(@monday.id)["covers"]
  end

  test "the Members tab can make someone schedule hosts" do
    membership = @group.memberships.find_by(user: @member)
    sign_in @keeper
    patch "/api/groups/#{@group.slug}/memberships/#{membership.id}", params: { can_schedule_hosts: true }, as: :json
    assert_response :forbidden
    sign_in @leader
    patch "/api/groups/#{@group.slug}/memberships/#{membership.id}", params: { can_schedule_hosts: true }, as: :json
    assert_response :no_content
    get "/api/groups/#{@group.slug}", as: :json
    assert_equal [true], body["members"].select { |m| m["name"] == "Mo" }.map { |m| m["can_schedule_hosts"] }
    sign_in @member
    get "/api/groups/#{@group.slug}", as: :json
    assert_equal true, body["can_schedule_hosts"]
  end

  test "the Overview tells the people who schedule hosts how many places are open" do
    sign_in @member
    get "/api/groups/#{@group.slug}/conscience", as: :json
    assert_nil body["hosts_open"]
    sign_in @coordinator
    get "/api/groups/#{@group.slug}/conscience", as: :json
    assert_equal({ "places" => 14, "open_hosts" => 7, "open_co_hosts" => 7 }, body["hosts_open"])
  end

  test "the Dashboard shows a coordinator the subs nobody has taken, and a treasurer the draft reports" do
    @monday.host_sub_requests.create!(role: "host", on: @today + ((1 - @today.wday) % 7) + 7, requested_by: @member)
    sign_in @member
    get "/api/groups/#{@group.slug}/conscience", as: :json
    assert_nil body["sub_requests"]
    assert_nil body["waiting"]
    sign_in @coordinator
    get "/api/groups/#{@group.slug}/conscience", as: :json
    assert_equal [["Sunrise", "host", "Mo"]], body["sub_requests"].map { |r| [r["meeting_name"], r["role"], r["requested_by"]] }

    treasurer = User.create!(email: "treasurer@example.com", name: "Tess", password: "password123", confirmed: true)
    @group.memberships.create!(user: treasurer, role: "member", can_keep_treasury: true)
    sign_in treasurer
    get "/api/groups/#{@group.slug}/conscience", as: :json
    assert_equal [], body.dig("waiting", "draft_minutes")
    assert_equal [], body.dig("waiting", "draft_reports")
  end
end
