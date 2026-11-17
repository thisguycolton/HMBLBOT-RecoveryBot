require "test_helper"

class RecoveryRemindersTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  setup do
    @jo = User.create!(email: "jo@example.com", name: "Jo", password: "password123", confirmed: true)
    @sam = User.create!(email: "sam@example.com", name: "Sam", password: "password123", confirmed: true)
    @phoenix = ActiveSupport::TimeZone["America/Phoenix"]
  end

  test "nothing goes out until a reminder is turned on" do
    RecoveryReminders.send_due!(@phoenix.parse("2026-10-29 12:05"))
    assert_empty Notification.all
  end

  test "the gratitude reminder goes out once, at noon in their own time zone" do
    travel_to(@phoenix.parse("2026-10-29 08:00")) { @jo.update!(gratitude_reminder: true, time_zone: "America/New_York") }
    assert_equal "12:00", @jo.gratitude_reminder_at

    RecoveryReminders.send_due!(@phoenix.parse("2026-10-29 08:55")) # 11:55 in New York
    assert_empty @jo.notifications
    RecoveryReminders.send_due!(@phoenix.parse("2026-10-29 09:05"))
    note = @jo.notifications.sole
    assert_equal ["recovery.gratitude_reminder", "Time for your gratitude list", "/recovery/gratitude"], [note.kind, note.title, note.url]
    assert_equal "recovery_reminders", Notification.push_category(note.kind)

    RecoveryReminders.send_due!(@phoenix.parse("2026-10-29 10:00"))
    assert_equal 1, @jo.notifications.count
    RecoveryReminders.send_due!(@phoenix.parse("2026-10-30 09:01"))
    assert_equal 2, @jo.notifications.count
  end

  test "the 10th step reminder is at 6 PM, at a time they pick, and skipped when today's is written" do
    travel_to(@phoenix.parse("2026-10-29 08:00")) { @sam.update!(step_reminder: true) }
    assert_equal "18:00", @sam.step_reminder_at

    RecoveryReminders.send_due!(@phoenix.parse("2026-10-29 18:02"))
    assert_equal ["Time for your 10th step"], @sam.notifications.pluck(:title)

    travel_to(@phoenix.parse("2026-10-30 08:00")) do
      @sam.update!(step_reminder_at: "21:30")
      @sam.step_inventories.create!(on: Date.new(2026, 10, 30), notes: "Done early")
    end
    RecoveryReminders.send_due!(@phoenix.parse("2026-10-30 21:31"))
    assert_equal 1, @sam.notifications.count, "already written today"
    RecoveryReminders.send_due!(@phoenix.parse("2026-10-31 21:31"))
    assert_equal 2, @sam.notifications.count
  end

  test "turning one on after today's time starts it tomorrow, and a late server still sends it within a few hours" do
    travel_to(@phoenix.parse("2026-10-29 13:00")) { @jo.update!(gratitude_reminder: true) }
    RecoveryReminders.send_due!(@phoenix.parse("2026-10-29 13:05"))
    assert_empty @jo.notifications

    RecoveryReminders.send_due!(@phoenix.parse("2026-10-30 16:00"))
    assert_empty @jo.notifications, "too late in the day"
    RecoveryReminders.send_due!(@phoenix.parse("2026-10-31 14:30"))
    assert_equal 1, @jo.notifications.count
  end

  test "times and time zones are checked" do
    refute @jo.update(gratitude_reminder_at: "25:00")
    refute @jo.update(step_reminder_at: "6pm")
    refute @jo.update(time_zone: "Mars/Olympus")
    assert @jo.reload.update(time_zone: "Europe/London", step_reminder_at: "07:45")
  end
end
