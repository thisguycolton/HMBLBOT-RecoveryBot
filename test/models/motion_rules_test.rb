require "test_helper"

class MotionRulesTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  setup do
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    9.times { |i| @group.memberships.create!(user: User.create!(email: "m#{i}@example.com", name: "M#{i}", password: "password123", confirmed: true), role: "member") }
    @today = @group.zone.today
    @meeting = @group.business_meetings.create!(held_on: @today, status: "held")
  end

  def motion(attrs = {})
    @group.motions.create!({ title: "Buy a urn", kind: "main", status: "passed", decided_on: @today, seconded_by_name: "Kay K.", votes_for: 7, votes_against: 3, business_meeting: @meeting }.merge(attrs))
  end

  test "the catalogue covers Robert's Rules and says what each kind needs" do
    assert_equal MotionKinds::ALL.size, MotionKinds::KEYS.uniq.size
    assert MotionKinds::ALL.all? { |k| MotionKinds::GROUPS.key?(k[:group]) }
    assert_equal %w[main rescind], MotionKinds::DECISION_KINDS
    assert_equal ["majority", "two_thirds", nil, "majority"], [MotionKinds.required_vote("main"), MotionKinds.required_vote("previous_question"), MotionKinds.required_vote("point_of_order"), MotionKinds.required_vote("appeal")]
    assert_equal ["two_thirds", "majority"], [MotionKinds.required_vote("rescind"), MotionKinds.required_vote("rescind", previous_notice: true)]
    assert_equal "two_thirds", MotionKinds.required_vote("main", override: "two_thirds"), "the bylaws can ask for more"
    assert_not MotionKinds.find("question_of_privilege")[:second]
    assert_equal "main", MotionKinds.find("nonsense")[:key]
  end

  test "a majority is more than half of the votes cast: abstentions don't count and a tie is lost" do
    assert motion(votes_for: 6, votes_against: 5, abstentions: 20).vote_met?
    assert_not motion(votes_for: 5, votes_against: 5).vote_met?
    assert_nil motion(votes_for: nil, votes_against: nil).vote_met?
    assert_equal true, motion(votes_for: 3, votes_against: nil).vote_met?, "nobody against"
  end

  test "two thirds, three fourths, unanimous and a majority of the whole membership" do
    assert motion(kind: "previous_question", votes_for: 8, votes_against: 4).vote_met?, "exactly two thirds"
    assert_not motion(kind: "previous_question", votes_for: 7, votes_against: 5).vote_met?
    assert motion(required_vote: "three_fourths", votes_for: 9, votes_against: 3).vote_met?
    assert_not motion(required_vote: "three_fourths", votes_for: 8, votes_against: 4).vote_met?
    assert motion(required_vote: "unanimous", votes_for: 4, votes_against: 0).vote_met?
    assert_not motion(required_vote: "unanimous", votes_for: 4, votes_against: 1).vote_met?
    assert_equal 10, @group.active_memberships.count
    assert_not motion(required_vote: "entire_membership", votes_for: 5, votes_against: 0).vote_met?
    assert motion(required_vote: "entire_membership", votes_for: 6, votes_against: 0).vote_met?
  end

  test "a tie sustains the chair on an appeal" do
    assert motion(kind: "appeal", votes_for: 4, votes_against: 4).vote_met?
    assert_not motion(kind: "appeal", votes_for: 3, votes_against: 4).vote_met?
  end

  test "warnings say where a record doesn't follow the rules, and stay quiet when it does" do
    assert_empty motion.warnings
    assert_includes motion(votes_for: 4, votes_against: 4).warnings.join, "not a majority of the votes cast (a tie is lost)"
    assert_match "Recorded as failed, but 7 for and 3 against is a majority", motion(status: "failed").warnings.join
    assert_includes motion(seconded_by_name: nil).warnings, "No second is recorded."
    assert_empty motion(seconded_by_name: nil, status: "no_second", votes_for: nil, votes_against: nil).warnings
    assert_empty motion(kind: "point_of_order", seconded_by_name: nil, votes_for: nil, votes_against: nil).warnings, "it needs no second and no vote"
    assert_includes motion(kind: "previous_question", vote_method: "voice", votes_for: 8, votes_against: 2, parent: motion).warnings.join, "taken standing"
    assert_empty motion(kind: "previous_question", vote_method: "rising", votes_for: 8, votes_against: 2, parent: motion).warnings
    assert_includes motion(kind: "amend").warnings, "Say which motion this applies to."
    assert_empty motion(votes_for: nil, votes_against: nil).warnings, "no count to judge"
  end

  test "a motion that ranks below the one pending is out of order, but an amendment is always in order" do
    pending = motion(kind: "commit", status: "proposed", decided_on: nil, seconded_by_name: nil)
    assert_includes motion(kind: "postpone_indefinitely", parent: pending, status: "proposed", decided_on: nil).warnings.join, "out of order while a motion to commit or refer to a committee is pending"
    assert_not_includes motion(kind: "amend", parent: pending, status: "proposed", decided_on: nil).warnings.join, "out of order"
    assert_not_includes motion(kind: "lay_on_table", parent: pending, status: "proposed", decided_on: nil).warnings.join, "out of order"
  end

  test "business can't be done without a quorum, except to adjourn, recess and the like" do
    @group.update!(quorum_count: 8)
    @meeting.update!(attendance_count: 6)
    assert_includes motion.warnings.join, "no quorum"
    assert_not_includes motion(kind: "adjourn", seconded_by_name: "Kay K.").warnings.join, "quorum"
    @meeting.update!(attendance_count: 8)
    assert_not_includes motion.warnings.join, "quorum"
  end

  test "quorum comes from a number or a share of the members" do
    assert_nil @group.quorum_needed
    @group.update!(quorum_count: 4)
    assert_equal 4, @group.quorum_needed
    @group.update!(quorum_percent: 35)
    assert_equal 4, @group.quorum_needed, "35% of 10 members rounds up to 4"
    @group.update!(quorum_percent: 50)
    assert_equal 5, @group.quorum_needed
    assert_not @group.update(quorum_percent: 120)
    @group.reload
    assert_nil @meeting.quorum_met?
    @meeting.update!(attendance_count: 4)
    assert_equal false, @meeting.quorum_met?
    @meeting.update!(attendance_count: 5)
    assert_equal true, @meeting.quorum_met?
  end

  test "what a passed motion does to the motion it applies to" do
    item = @meeting.agenda_items.create!(title: "Urn")
    main = motion(status: "proposed", decided_on: nil, agenda_item: item, votes_for: nil, votes_against: nil)

    motion(kind: "amend", parent: main, amended_text: "Buy a larger urn", votes_for: 6, votes_against: 2).apply_effect!
    assert_equal "Buy a larger urn", main.reload.amended_text

    motion(kind: "lay_on_table", parent: main).apply_effect!
    assert_equal ["tabled", "tabled"], [main.reload.status, item.reload.status]
    assert_equal @today, main.decided_on

    motion(kind: "take_from_table", parent: main).apply_effect!
    assert_equal ["proposed", "on_agenda"], [main.reload.status, item.reload.status]

    motion(kind: "commit", parent: main, committee: "Supplies committee").apply_effect!
    assert_equal ["referred", "Supplies committee", "tabled"], [main.reload.status, main.committee, item.reload.status]

    motion(kind: "postpone_definitely", parent: main, postponed_to: "the next business meeting").apply_effect!
    assert_equal ["postponed", "the next business meeting"], [main.reload.status, main.postponed_to]

    motion(kind: "postpone_indefinitely", parent: main).apply_effect!
    assert_equal ["postponed_indefinitely", "done"], [main.reload.status, item.reload.status]

    motion(kind: "reconsider", parent: main).apply_effect!
    assert_equal "proposed", main.reload.status
  end

  test "a motion that failed, or has nothing to apply to, changes nothing" do
    main = motion(status: "proposed", decided_on: nil, votes_for: nil, votes_against: nil)
    motion(kind: "lay_on_table", parent: main, status: "failed", votes_for: 2, votes_against: 6).apply_effect!
    assert_equal "proposed", main.reload.status
    assert_nothing_raised { motion(kind: "lay_on_table").apply_effect! }
  end

  test "only main motions and ones that rescind them are decisions, and stand" do
    main = motion
    motion(kind: "lay_on_table", parent: main)
    motion(kind: "adjourn")
    rescind = motion(kind: "rescind", title: "Rescind the urn", supersedes: main, previous_notice: true)
    assert_equal [rescind], @group.motions.standing.to_a
    assert_equal [main, rescind].sort_by(&:id), @group.motions.decisions.sort_by(&:id)
  end

  test "a motion applies only to one in its own group, and never in a loop" do
    other = Group.create!(title: "Night Owls", time_zone: "America/Phoenix")
    theirs = other.motions.create!(title: "Theirs", status: "proposed")
    assert_not @group.motions.new(title: "X", status: "proposed", kind: "amend", parent: theirs).valid?
    a = motion(status: "proposed", decided_on: nil)
    b = motion(kind: "amend", parent: a, status: "proposed", decided_on: nil)
    assert_not a.update(parent: b)
    assert_not a.update(parent: a)
    assert_not @group.motions.new(title: "X", status: "proposed", kind: "teleport").valid?
    assert_not @group.motions.new(title: "X", status: "proposed", vote_method: "telepathy").valid?
  end

  test "set aside, put off or sent away and not dealt with is unfinished business, once" do
    tabled = motion(status: "tabled", title: "Tabled urn")
    referred = motion(status: "referred", title: "Referred roof", committee: "Building committee")
    motion(status: "passed", title: "Done deal")
    motion(kind: "lay_on_table", status: "tabled", title: "procedural")
    upcoming = @group.business_meetings.create!(held_on: @today + 14)
    assert_equal ["Referred roof", "Tabled urn"].sort, upcoming.unfinished_business.map(&:title).sort

    upcoming.agenda_items.create!(title: "Unfinished: Tabled urn", motion: tabled)
    assert_equal [referred], upcoming.reload.unfinished_business.to_a
    assert_empty @meeting.unfinished_business.where(id: [tabled.id, referred.id]), "not something decided at this very meeting"
  end

  test "a meeting's times are kept in the group's zone" do
    @meeting.set_times(called_to_order: "19:05", adjourned: "20:40")
    @meeting.save!
    assert_equal ["19:05", "20:40"], [@meeting.called_to_order_time, @meeting.adjourned_time]
    assert_equal 2, @meeting.called_to_order_at.utc.hour, "19:05 in Arizona is 02:05 UTC"
    @meeting.set_times(adjourned: "")
    @meeting.save!
    assert_nil @meeting.adjourned_time
    assert_equal "19:05", @meeting.called_to_order_time, "left alone when not given"
  end
end
