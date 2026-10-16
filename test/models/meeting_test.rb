require "test_helper"

class MeetingTest < ActiveSupport::TestCase
  setup { @group = groups(:one) }

  test "a weekly meeting's next start is the coming weekday at its local time" do
    meeting = @group.meetings.create!(name: "Mon AM", day_of_week: 1, start_minute: 7 * 60, time_zone: "America/New_York")
    from = Time.find_zone("America/New_York").parse("2026-10-14 12:00") # a Wednesday
    assert_equal Time.find_zone("America/New_York").parse("2026-10-19 07:00"), meeting.next_start(from)
    assert_equal 8 * 60, meeting.end_minute, "defaults to an hour long"
    assert_match(/\AMondays, 7:00 AM–8:00 AM E[DS]T\z/, meeting.schedule_label)
  end

  test "a one-time meeting keeps its date and drops the weekly fields" do
    zone = Time.find_zone("America/Phoenix")
    meeting = @group.meetings.create!(name: "Workshop", recurrence: "once", starts_at: zone.parse("2026-10-20 18:00"), day_of_week: 3)
    assert_nil meeting.day_of_week
    assert_equal zone.parse("2026-10-20 19:00"), meeting.ends_at
    assert meeting.start_on(Date.new(2026, 10, 20))
    assert_nil meeting.start_on(Date.new(2026, 10, 21))
  end

  test "weekly meetings need a day and a time; links must be web links" do
    meeting = @group.meetings.new(name: "x", conference_url: "zoom.us/j/1")
    assert_not meeting.valid?
    assert meeting.errors[:day_of_week].any?
    assert meeting.errors[:start_minute].any?
    assert meeting.errors[:conference_url].any?
  end

  test "linking to an OIAA listing copies its details; unlinking keeps them" do
    record = OiaaMeeting.create!(slug: "sunrise-1", name: "Sunrise Zoom", days: [1, 3], start_time: "08:30", end_time: "09:30",
                                 time_zone: "America/Chicago", conference_url: "https://zoom.us/j/123456789", types: %w[O D],
                                 last_seen_at: Time.current)
    meeting = @group.meetings.new.apply_oiaa(record, day: 3)
    meeting.save!
    assert_equal ["Sunrise Zoom", 3, 510, 570, "America/Chicago", %w[O D]], [meeting.name, meeting.day_of_week, meeting.start_minute, meeting.end_minute, meeting.time_zone, meeting.types]
    assert meeting.oiaa_linked?

    meeting.unlink_oiaa.save!
    assert_not meeting.oiaa_linked?
    assert_equal "Sunrise Zoom", meeting.reload.name
  end
end
