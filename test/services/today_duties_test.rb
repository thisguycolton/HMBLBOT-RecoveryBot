require "test_helper"

class TodayDutiesTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  setup do
    @host = User.create!(email: "jo@example.com", name: "Jo Smith", password: "password123", confirmed: true)
    @sub = User.create!(email: "colton@example.com", name: "Colton", password: "password123", confirmed: true)
    @coordinator = User.create!(email: "cam@example.com", name: "Cam", password: "password123", confirmed: true)
    @bystander = User.create!(email: "bea@example.com", name: "Bea", password: "password123", confirmed: true)
    @group = Group.create!(title: "Acid Test", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @host, role: "member", can_host: true)
    @group.memberships.create!(user: @sub, role: "member", can_host: true)
    @group.memberships.create!(user: @coordinator, role: "member", can_schedule_hosts: true)
    @group.memberships.create!(user: @bystander, role: "member")
    @today = @group.zone.today
    @on = @today + 2
    @meeting = @group.meetings.create!(name: "The Acid Test", recurrence: "weekly", day_of_week: @on.wday, start_minute: 540, end_minute: 600)
    @meeting.hosts.create!(role: "co_host", user: @host, starts_on: @today - 30)
    @meeting.host_covers.create!(role: "co_host", user: @sub, on: @on)
  end

  def covers(user) = TodayDuties.new(user).covers.map { |c| c[:text] }

  test "the one filling in, the one filled in for and the coordinator see it, worded for each" do
    assert_equal ["You're filling in for Jo Smith as co-host for the 9 AM Acid Test meeting"], covers(@sub)
    assert_equal ["Colton is filling in for you as co-host for the 9 AM Acid Test meeting"], covers(@host)
    assert_equal ["Colton is filling in for Jo Smith as co-host for the 9 AM Acid Test meeting"], covers(@coordinator)
    assert_empty covers(@bystander)
    assert_equal 1, TodayDuties.new(@coordinator).covers(group: @group).size
    assert_empty TodayDuties.new(@host).covers(group: @group)
  end

  test "needs your attention: host dates, subs to take and coordinators' open requests" do
    other = @group.meetings.create!(name: "Noon", recurrence: "weekly", day_of_week: (@today + 1).wday, start_minute: 720)
    other.hosts.create!(role: "host", user: @host, starts_on: @today - 30)
    request = HostSubRequest.create!(meeting: other, role: "co_host", on: @today + 1, requested_by: @coordinator)

    host_items = TodayDuties.new(@host).attention
    assert_includes host_items.map { |i| i[:title] }, "You're the host for the 12 PM Noon meeting"
    # the covered date isn't theirs any more
    refute(host_items.any? { |i| i[:title].include?("Acid Test") && i[:title].start_with?("You're") })
    assert_includes host_items.map { |i| i[:title] }, "Sub needed: co-host for the 12 PM Noon meeting"

    coordinator_items = TodayDuties.new(@coordinator).attention
    item = coordinator_items.find { |i| i[:key] == "sub-#{request.id}" }
    assert item[:urgent]
    assert_equal "Host coordinator", item[:role]
    assert(coordinator_items.any? { |i| i[:key] == "open-#{@group.id}" })

    duties = TodayDuties.new(@bystander)
    refute duties.any_roles?
    assert_equal [], duties.attention.reject { |i| i[:key].start_with?("take-") }
  end

  test "treasurers, record keepers and admins see their part" do
    @group.memberships.find_by(user: @bystander).update!(role: "admin")
    User.create!(email: "new@example.com", name: "Nell", password: "password123", confirmed: true).then { |u| @group.memberships.create!(user: u, status: "requested") }
    @group.treasurer_reports.create!(period_on: @today.prev_month, status: "draft")

    titles = TodayDuties.new(@bystander).attention.map { |i| i[:title] }
    assert_includes titles, "1 person is asking to join"
    assert_includes titles, "Treasurer's report for #{@today.prev_month.strftime("%B %Y")}"
  end
end
