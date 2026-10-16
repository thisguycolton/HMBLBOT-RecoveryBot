require "test_helper"

class OiaaMeetingTest < ActiveSupport::TestCase
  # One sync stamps every listing with the same time
  SYNCED = Time.zone.parse("2026-10-16 03:00")

  def listing(slug, name, group_name, day, time)
    OiaaMeeting.create!(slug: slug, name: name, group_name: group_name, days: [day], start_time: time, end_time: time,
                        time_zone: "America/Phoenix", conference_url: "https://zoom.us/j/987654321", last_seen_at: SYNCED)
  end

  test "a group's listings are every listing under its group name, earliest first" do
    7.times { |d| listing("acid-9pm-#{d}", "The Acid Test", "The Acid Test", d, "21:00") }
    7.times { |d| listing("acid-9am-#{d}", "The Acid Test", "The Acid Test", d, "09:00") }
    listing("acid-workshop", "Workshop Series", "The Acid Test", 0, "09:00")
    listing("other", "Acid Test Alumni", "Somebody Else", 2, "10:00")

    found = OiaaMeeting.for_group("the acid test ")
    assert_equal 15, found.size
    assert_includes found.map(&:slug), "acid-workshop"
    assert_not_includes found.map(&:slug), "other"
    assert_equal "09:00", found.first.start_time
  end

  test "without a group name match it falls back to searching" do
    listing("sunrise", "Sunrise Zoom", nil, 1, "08:30")
    assert_equal ["sunrise"], OiaaMeeting.for_group("Sunrise").map(&:slug)
    assert_empty OiaaMeeting.for_group("  ")
  end
end
