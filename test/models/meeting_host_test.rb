require "test_helper"

class MeetingHostTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  setup do
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @coordinator = User.create!(email: "coord@example.com", name: "Cam", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    @group.memberships.create!(user: @coordinator, role: "member", can_schedule_hosts: true)
    @group.memberships.create!(user: @member, role: "member")
    @today = @group.zone.today
    # a meeting on each day, at 7 AM, and a noon one on Mondays
    @days = (0..6).map { |d| @group.meetings.create!(name: "Sunrise", recurrence: "weekly", day_of_week: d, start_minute: 420) }
    @noon = @group.meetings.create!(name: "Noon", recurrence: "weekly", day_of_week: 1, start_minute: 720)
    @monday = @days[1]
  end

  test "who schedules hosts" do
    assert @group.hosts_editable_by?(@leader)
    assert @group.hosts_editable_by?(@coordinator)
    assert_not @group.hosts_editable_by?(@member)
    assert_not @group.hosts_editable_by?(nil)
    assert_equal [@leader, @coordinator].sort_by(&:id), @group.host_schedulers.sort_by(&:id)
  end

  test "a meeting's other days are its series, and a different meeting isn't" do
    assert_equal @days.map(&:id).sort, @monday.series.pluck(:id).sort
    assert_equal [@noon.id], @noon.series.pluck(:id)
  end

  test "the assignment in place on a date is the latest to have started and not ended" do
    old = @monday.hosts.create!(role: "host", name: "Kay K.", starts_on: @today - 90, ends_on: @today - 31)
    now = @monday.hosts.create!(role: "host", name: "Mo M.", starts_on: @today - 30)
    later = @monday.hosts.create!(role: "host", name: "Lee L.", starts_on: @today + 30)
    assert_equal old, @monday.host_on("host", @today - 60)
    assert_equal now, @monday.host_on("host", @today)
    assert_equal later, @monday.host_on("host", @today + 60)
    assert_nil @monday.host_on("co_host", @today)
    assert_nil @monday.host_on("host", @today - 100)
  end

  test "validations" do
    assert_not @monday.hosts.new(role: "boss", name: "X", starts_on: @today).valid?
    assert_not @monday.hosts.new(role: "host", name: "", starts_on: @today).valid?
    assert_not @monday.hosts.new(role: "host", name: "X").valid?
    assert_not @monday.hosts.new(role: "host", name: "X", starts_on: @today, ends_on: @today - 1).valid?
    once = @group.meetings.create!(name: "Special", recurrence: "once", starts_at: 3.days.from_now)
    assert_not once.hosts.new(role: "host", name: "X", starts_on: @today).valid?, "only weekly meetings have hosts"
    assert_equal "Mo", @monday.hosts.create!(role: "host", user: @member, starts_on: @today).name, "the name comes from the member when left blank"
  end

  test "a cover is for a date the meeting meets, once per place" do
    monday = (@today + 1..@today + 7).find { |d| d.wday == 1 }
    assert @monday.host_covers.create!(role: "host", name: "Cam C.", on: monday)
    assert_not @monday.host_covers.new(role: "host", name: "X", on: monday).valid?, "one cover per place and date"
    assert @monday.host_covers.new(role: "co_host", name: "X", on: monday).valid?
    tuesday = monday + 1
    cover = @monday.host_covers.new(role: "host", name: "X", on: tuesday)
    assert_not cover.valid?
    assert_includes cover.errors[:on].join, "Mondays"
    assert_equal "Cam C.", @monday.reload.cover_on("host", monday).name
  end

  test "the schedule shows who is in each place, who is next, who covers, and what's open" do
    @monday.hosts.create!(role: "host", name: "Kay K.", starts_on: @today - 10)
    @monday.hosts.create!(role: "host", name: "Mo M.", starts_on: @today + 20)
    @days[2].hosts.create!(role: "co_host", name: "Lee L.", starts_on: @today - 10)
    monday = (@today..@today + 6).find { |d| d.wday == 1 }
    @monday.host_covers.create!(role: "host", name: "Cam C.", on: monday)

    json = HostSchedule.new(@group, @coordinator).as_json
    slot = json[:slots].find { |s| s[:id] == @monday.id }
    assert_equal ["Kay K.", "Mo M."], [slot[:host][:name], slot[:host_lined_up][:name]]
    assert_nil slot[:co_host]
    assert_equal({ name: "Cam C.", cover: true }, slot[:next_host]) if slot[:next_on] == monday.iso8601
    assert_equal ["Cam C."], slot[:covers].map { |c| c[:name] }
    assert json[:can_edit]
    assert_equal %w[Cam Lee Mo], json[:members].map { |m| m[:name] }

    # 8 weekly meetings: 16 places; Monday's host and Tuesday's co-host are filled, Monday's host is lined up too
    assert_equal({ places: 16, open_hosts: 7, open_co_hosts: 7 }, json[:summary])
    assert_not HostSchedule.new(@group, @member).as_json[:can_edit]
    assert_nil HostSchedule.new(@group, @member).as_json[:members]
  end

  test "deleting a meeting removes its hosts" do
    @monday.hosts.create!(role: "host", name: "Kay K.", starts_on: @today)
    assert_difference -> { MeetingHost.count } => -1 do
      @monday.destroy!
    end
  end
end
