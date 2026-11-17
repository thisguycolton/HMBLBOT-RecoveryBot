require "test_helper"

# Hosts connected to accounts: linking names on the schedule, the hosting settings and reminders,
# the court verification picker, and hosts on the group's public page
class Api::HostAccountsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers
  include ActionMailer::TestHelper

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @sam = User.create!(email: "sam@example.com", name: "Sam R.", password: "password123", confirmed: true)
    @alex = User.create!(email: "alex@example.com", name: "Alex", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    @group.memberships.create!(user: @sam, role: "member")
    @group.memberships.create!(user: @alex, role: "member", can_host: true)
    @group.memberships.create!(user: @member, role: "member")
    @today = @group.zone.today
    @days = (0..6).map { |d| @group.meetings.create!(name: "Sunrise", recurrence: "weekly", day_of_week: d, start_minute: 420) }
    @night = @group.meetings.create!(name: "Night Owls", recurrence: "weekly", day_of_week: 5, start_minute: 1260)
  end

  def body = response.parsed_body

  def put_on(meeting, name, role: "host", user: nil, from: @today - 7)
    meeting.hosts.create!(role: role, name: name, user: user, starts_on: from)
  end

  test "a host coordinator connects a name to an account everywhere it's written, and can undo it" do
    @days.first(3).each { |m| put_on(m, "sam r.") }
    put_on(@days[4], "Sam R.", role: "co_host")
    @days[5].host_covers.create!(role: "host", name: "Sam R.", on: @today + ((5 - @today.wday) % 7))
    put_on(@days[6], "Someone else")

    sign_in @member
    post "/api/groups/#{@group.slug}/meeting_hosts/link", params: { name: "Sam R.", user_id: @sam.id }, as: :json
    assert_response :forbidden

    sign_in @leader
    post "/api/groups/#{@group.slug}/meeting_hosts/link", params: { name: "Sam R.", user_id: @sam.id }, as: :json
    assert_response :success
    assert_equal 4, MeetingHost.where(user: @sam).count
    assert_equal 1, MeetingHostCover.where(user: @sam).count
    assert_nil MeetingHost.find_by(name: "Someone else").user_id
    assert_equal "sam r.", MeetingHost.where(user: @sam).first.name, "the name stays as the group wrote it"
    assert_equal ["meeting_host.linked"], @sam.notifications.pluck(:kind)
    assert body["slots"].first.dig("host", "linked")

    post "/api/groups/#{@group.slug}/meeting_hosts/link", params: { name: "Sam R.", user_id: User.create!(email: "x@example.com", password: "password123", confirmed: true).id }, as: :json
    assert_response :unprocessable_entity

    post "/api/groups/#{@group.slug}/meeting_hosts/link", params: { name: "Sam R.", user_id: nil }, as: :json
    assert_response :success
    assert_equal 0, MeetingHost.where(user: @sam).count + MeetingHostCover.where(user: @sam).count
  end

  test "hosting settings show only to hosts, and only hosts can change them" do
    sign_in @member
    get "/api/profile", as: :json
    assert_nil body["hosting"]
    patch "/api/profile", params: { profile: { host_reminders: true } }, as: :json
    assert_not @member.reload.host_reminders

    sign_in @alex # marked "can host", on no schedule yet
    get "/api/profile", as: :json
    assert_equal [false, 24, true, []], body["hosting"].values_at("reminders", "hours", "email", "upcoming")

    sign_in @sam # on the schedule, not marked
    put_on(@days[@today.wday], "Sam R.", user: @sam)
    get "/api/profile", as: :json
    assert_equal ["Sunrise Crew"], body["hosting"]["groups"].map { |g| g["title"] }
    assert_equal "host", body["hosting"]["upcoming"].first["role"]

    patch "/api/profile", params: { profile: { host_reminders: true, host_reminder_hours: 6, host_reminder_email: false } }, as: :json
    assert_response :success
    assert_equal [true, 6, false], body["hosting"].values_at("reminders", "hours", "email")
    patch "/api/profile", params: { profile: { host_reminder_hours: 5 } }, as: :json
    assert_response :unprocessable_entity
  end

  test "reminders go once, to people who turned them on, for the dates they're really on" do
    now = @group.zone.now.change(hour: 8) # 23 hours before tomorrow's 7:00 AM Sunrise
    tomorrow = (now + 1.day).to_date
    put_on(@days[tomorrow.wday], "Sam R.", user: @sam)
    put_on(@days[tomorrow.wday], "Alex", role: "co_host", user: @alex)
    @sam.update!(host_reminders: true)

    assert_emails(1) { HostReminders.send_due!(now) }
    note = @sam.notifications.sole
    assert_equal "meeting_host.reminder", note.kind
    assert_match(/You're hosting Sunrise tomorrow at 7:00 AM/, note.title)
    assert_empty @alex.notifications, "Alex didn't turn reminders on"

    assert_no_emails { HostReminders.send_due!(now + 10.minutes) }
    assert_equal 1, @sam.notifications.count

    # someone covering the date gets it instead, and the host doesn't
    week_after = tomorrow + 7
    @days[tomorrow.wday].host_covers.create!(role: "host", name: "Alex", user: @alex, on: week_after)
    @alex.update!(host_reminders: true, host_reminder_email: false)
    assert_no_emails { HostReminders.send_due!(now + 7.days) }
    assert_equal 1, @sam.notifications.count
    assert_equal ["You're co-hosting Sunrise tomorrow at 7:00 AM MST", "You're hosting Sunrise tomorrow at 7:00 AM MST"],
                 @alex.notifications.where(kind: "meeting_host.reminder").pluck(:title).sort
  end

  test "the account menu's court verification lists the meetings a host serves" do
    sign_in @member
    get "/api/hosting", as: :json
    assert_equal [[], []], body.values_at("meetings", "groups")

    sign_in @sam
    @days.first(2).each { |m| put_on(m, "Sam R.", user: @sam) }
    put_on(@night, "Sam R.", role: "co_host", user: @sam)
    get "/api/hosting", as: :json
    assert_equal [["Sunrise", "Sun, Mon · 7:00 AM", ["host"]], ["Night Owls", "Fri · 9:00 PM", ["co_host"]]],
                 body["meetings"].map { |m| m.values_at("name", "label", "roles") }
    assert_equal "/court_verifications/new?group=#{@group.slug}", body["groups"].sole["court_url"]

    get body["meetings"].first["court_url"]
    assert_response :success
    group = JSON.parse(Nokogiri::HTML(response.body).at("#court-verification-root")["data-group"])
    pick = group["preselect"]
    assert_equal "Sam R.", pick["host_name"]
    assert_includes [@days[@today.wday].id, @days[(@today - 1).wday].id], pick["meeting_id"] if [0, 1].include?(@today.wday) || [0, 1].include?((@today - 1).wday)
  end

  test "the public page names who hosts next, unless the group turned it off" do
    day = @days[@today.wday]
    put_on(day, "Sam R.", user: @sam)
    put_on(day, "Pat", role: "co_host")

    get "/api/groups/#{@group.slug}/page", as: :json
    with_hosts = body.dig("context", "meetings").select { |m| m["hosts"].present? }
    assert_equal [[{ "role" => "host", "name" => "Sam R." }, { "role" => "co_host", "name" => "Pat" }]], with_hosts.map { |m| m["hosts"] }, "no profile link for visitors"
    assert_equal [], body.dig("context", "meetings").find { |m| m["id"] == @night.id }["hosts"], "a meeting nobody hosts looks as before"

    @group.update!(show_hosts_publicly: false)
    get "/api/groups/#{@group.slug}/page", as: :json
    assert body.dig("context", "meetings").none? { |m| m.key?("hosts") }
  end
end
