require "test_helper"

class ServicePositionTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  setup do
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @holder = User.create!(email: "holder@example.com", name: "Hal", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    @group.memberships.create!(user: @holder, role: "member")
    @today = @group.zone.today
    @treasurer = @group.service_positions.create!(title: "Treasurer", term_months: 12, sobriety_months: 12)
  end

  test "a term's end follows the position's term length, a day short of a whole year" do
    term = @treasurer.terms.create!(name: "Hal H.", starts_on: Date.new(2026, 1, 1))
    assert_equal Date.new(2026, 12, 31), term.ends_on
    open = @group.service_positions.create!(title: "Greeter").terms.create!(name: "Mo", starts_on: Date.new(2026, 1, 1))
    assert_nil open.ends_on
  end

  test "the name comes from the member when left blank" do
    assert_equal "Hal", @treasurer.terms.create!(user: @holder, starts_on: @today).name
    assert_not @treasurer.terms.new(starts_on: @today).valid?
    assert_not @treasurer.terms.new(name: "X", starts_on: @today, ends_on: @today - 1).valid?
  end

  test "who holds it now, and when it needs someone" do
    assert_equal "vacant", @treasurer.rotation(@today)
    @treasurer.terms.create!(name: "Hal H.", starts_on: @today - 100, ends_on: @today + 200)
    assert_nil @treasurer.reload.rotation(@today)
    assert_equal "Hal H.", @treasurer.current_term(@today).name

    soon = @group.service_positions.create!(title: "Chair")
    soon.terms.create!(name: "Kay K.", starts_on: @today - 150, ends_on: @today + 20)
    assert_equal "due", soon.reload.rotation(@today)
    soon.terms.create!(name: "Next P.", starts_on: @today + 21)
    assert_nil soon.reload.rotation(@today), "someone is already lined up"

    soon.update!(archived: true)
    assert_nil soon.rotation(@today)
  end

  test "reminders go once, to the record keepers and the holder, and only for terms nobody follows" do
    due = @group.service_positions.create!(title: "Secretary")
    term = due.terms.create!(name: "Hal H.", user: @holder, starts_on: @today - 300, ends_on: @today + 10)
    followed = @group.service_positions.create!(title: "Chair")
    followed.terms.create!(name: "Kay K.", starts_on: @today - 300, ends_on: @today + 10)
    followed.terms.create!(name: "Next P.", starts_on: @today + 11)
    long_over = @group.service_positions.create!(title: "Librarian")
    long_over.terms.create!(name: "Old O.", starts_on: @today - 900, ends_on: @today - 400)
    far = @group.service_positions.create!(title: "Greeter")
    far.terms.create!(name: "Far F.", starts_on: @today, ends_on: @today + 200)

    assert_difference -> { Notification.count } => 2 do
      ServiceRotation.remind_group!(@group)
    end
    assert_equal ["service.rotation"], Notification.where(user: @leader).pluck(:kind)
    assert_equal ["service.term_ending"], Notification.where(user: @holder).pluck(:kind)
    assert_match "Secretary: Hal H.'s term ends", Notification.find_by(user: @leader).title
    assert term.reload.reminded_at

    assert_no_difference -> { Notification.count } do
      ServiceRotation.remind_group!(@group)
    end
  end

  test "a term that just ended without a successor is still reminded" do
    position = @group.service_positions.create!(title: "Secretary")
    position.terms.create!(name: "Hal H.", starts_on: @today - 200, ends_on: @today - 5)
    ServiceRotation.remind_group!(@group)
    assert_match "ended", Notification.find_by(user: @leader).title
  end

  test "deleting a position deletes its history" do
    @treasurer.terms.create!(name: "A", starts_on: @today)
    assert_difference -> { ServiceTerm.count } => -1 do
      @treasurer.destroy!
    end
  end
end
