require "test_helper"

class BusinessMeetingTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  setup do
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @keeper = User.create!(email: "keeper@example.com", name: "Kay", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
    @today = @group.zone.today
  end

  def meeting(attrs = {})
    @group.business_meetings.create!({ held_on: @today + 7 }.merge(attrs))
  end

  test "who keeps records is who gets told" do
    assert_equal [@leader, @keeper].sort_by(&:id), @group.record_keepers.sort_by(&:id)
  end

  test "keepers see every meeting, members the ones for members, others none" do
    open = meeting
    closed = meeting(visibility: "keepers")
    assert_equal [open, closed].sort_by(&:id), BusinessMeeting.visible_to(@group, @keeper).sort_by(&:id)
    assert_equal [open], BusinessMeeting.visible_to(@group, @member).to_a
    assert_empty BusinessMeeting.visible_to(@group, nil)
    assert_empty BusinessMeeting.visible_to(@group, User.new)
  end

  test "the next one is the soonest planned one still ahead, today included" do
    meeting(held_on: @today - 3)
    meeting(held_on: @today + 30)
    soon = meeting(held_on: @today)
    meeting(held_on: @today + 1, status: "cancelled")
    assert_equal soon, BusinessMeeting.next_for(@group, @member)
    soon.update!(status: "held")
    assert_equal @today + 30, BusinessMeeting.next_for(@group, @member).held_on
  end

  test "the start time is kept in the group's own zone" do
    m = meeting(held_on: Date.new(2026, 11, 8))
    m.set_start("19:00")
    m.save!
    assert_equal "19:00", m.starts_time
    assert_equal 2, m.starts_at.utc.hour # 19:00 in Arizona (UTC-7) is 02:00 UTC
    assert_equal "Sun, Nov 8 · 7:00 PM MST", m.when_label
    m.set_start("")
    assert_nil m.starts_at
  end

  test "minutes stay out of the JSON until they're posted, and are cleaned" do
    m = meeting(minutes: %(<p onclick="x()">We met.</p><script>1</script>))
    assert_equal "<p>We met.</p>", m.minutes
    assert_nil m.as_api_json[:minutes]
    assert_equal "<p>We met.</p>", m.as_api_json(keeper: true)[:minutes]
    m.update!(minutes_status: "posted")
    assert_equal "<p>We met.</p>", m.as_api_json[:minutes]
  end

  test "posting and approving the minutes are stamped once" do
    m = meeting(status: "held")
    assert_nil m.minutes_posted_at
    m.update!(minutes_status: "posted")
    posted = m.minutes_posted_at
    assert posted
    assert_nil m.minutes_approved_at
    m.update!(minutes_status: "approved")
    assert_equal posted, m.minutes_posted_at
    assert m.minutes_approved_at
    m.update!(minutes_status: "draft")
    assert_nil m.reload.minutes_approved_at
  end

  test "validations" do
    assert_not @group.business_meetings.new.valid?, "needs a date"
    assert_not @group.business_meetings.new(held_on: @today, status: "over").valid?
    assert_not @group.business_meetings.new(held_on: @today, attendance_count: -1).valid?
    other = Group.create!(title: "Night Owls", time_zone: "America/Phoenix")
    assert_not @group.business_meetings.new(held_on: @today, event: other.events.create!(title: "Theirs", time_zone: "America/Phoenix")).valid?
  end

  test "agenda items keep their order and a suggestion starts as one" do
    m = meeting
    a = m.agenda_items.create!(title: "Treasurer's report", kind: "report")
    b = m.agenda_items.create!(title: "Coffee urn", submitted_by: @member, status: "suggested")
    assert_equal [1, 2], [a.position, b.position]
    assert b.suggested?
    assert_not m.agenda_items.new(title: "", kind: "report").valid?
    assert_not m.agenda_items.new(title: "X", kind: "gossip").valid?
    assert_equal @member.display_name, b.as_api_json(viewer: @member)[:submitted_by]
    assert b.as_api_json(viewer: @member)[:mine]
    assert_not a.as_api_json(viewer: @member)[:mine]
  end

  test "a decision records where it was made, and only at this group's meetings" do
    m = meeting(status: "held")
    item = m.agenda_items.create!(title: "Coffee urn")
    motion = @group.motions.create!(title: "Buy an urn", status: "passed", decided_on: @today, business_meeting: m, agenda_item: item)
    assert_equal m.id, motion.as_api_json(meetings: [m.id])[:meeting][:id]
    assert_nil motion.as_api_json(meetings: [])[:meeting], "a meeting the viewer can't see isn't linked"

    other = Group.create!(title: "Night Owls", time_zone: "America/Phoenix")
    theirs = other.business_meetings.create!(held_on: @today)
    assert_not @group.motions.new(title: "X", status: "proposed", business_meeting: theirs).valid?
    assert_not @group.motions.new(title: "X", status: "proposed", business_meeting: meeting, agenda_item: item).valid?, "the item is on another meeting's agenda"

    m.destroy!
    assert_nil motion.reload.business_meeting_id, "the decision stays in the log"
  end

  test "deleting a group removes its meetings and agendas" do
    meeting.agenda_items.create!(title: "X")
    assert_difference -> { BusinessMeeting.count } => -1, -> { AgendaItem.count } => -1 do
      @group.destroy!
    end
  end
end
