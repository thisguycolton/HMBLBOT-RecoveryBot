require "test_helper"

class MotionTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  setup do
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @keeper = User.create!(email: "keeper@example.com", name: "Kay", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
  end

  def motion(attrs = {})
    @group.motions.create!({ title: "Send 7th Tradition 60/30/10", status: "passed", decided_on: Date.new(2026, 3, 3), category: "money" }.merge(attrs))
  end

  test "a passed decision nothing replaces is standing" do
    old = motion(title: "50/50 split", decided_on: Date.new(2024, 1, 7))
    assert_equal [old], @group.motions.standing.to_a

    newer = motion(supersedes: old)
    assert_equal [newer], @group.motions.standing.to_a
    json = old.as_api_json
    assert_equal false, json[:standing]
    assert_equal newer.id, json[:replaced_by][:id]
    assert_equal old.id, newer.as_api_json[:replaces][:id]
  end

  test "a replacement that didn't pass leaves the old decision standing" do
    old = motion
    motion(title: "Change it", status: "failed", supersedes: old)
    motion(title: "Maybe", status: "proposed", decided_on: nil, supersedes: old)
    assert_equal [old], @group.motions.standing.to_a
    assert old.as_api_json[:standing]
  end

  test "decisions only replace decisions of their own group, and never in a loop" do
    other = Group.create!(title: "Night Owls", time_zone: "America/Phoenix").motions.create!(title: "Theirs", status: "passed", decided_on: Date.today)
    assert_not @group.motions.new(title: "Ours", status: "passed", decided_on: Date.today, supersedes: other).valid?

    a = motion(title: "A")
    b = motion(title: "B", supersedes: a)
    assert_not a.update(supersedes: b)
    assert_not a.update(supersedes: a)
  end

  test "validations" do
    assert_not @group.motions.new(title: "", status: "passed", decided_on: Date.today).valid?
    assert_not @group.motions.new(title: "X", status: "passed").valid?, "a passed decision needs its date"
    assert @group.motions.new(title: "X", status: "proposed").valid?
    assert_not @group.motions.new(title: "X", status: "won", decided_on: Date.today).valid?
    assert_not @group.motions.new(title: "X", status: "proposed", category: "snacks").valid?
    assert_not @group.motions.new(title: "X", status: "proposed", votes_for: -1).valid?
    assert @group.motions.new(title: "X", status: "passed", decided_on: Date.today, votes_for: nil).valid?, "a past decision may have no count"
  end

  test "names are trimmed and blank ones dropped" do
    m = motion(moved_by_name: "  Kay   K. ", seconded_by_name: " ")
    assert_equal ["Kay K.", nil], [m.moved_by_name, m.seconded_by_name]
  end

  test "each viewer sees the decisions their access allows" do
    members = motion(title: "Members only")
    public_ = motion(title: "This meeting is closed", visibility: "public")
    public_failed = motion(title: "Public failed", visibility: "public", status: "failed")
    proposed = motion(title: "Proposed", status: "proposed", decided_on: nil)

    assert_equal [public_], Motion.visible_to(@group, nil).to_a
    assert_equal [public_], Motion.visible_to(@group, User.new).to_a
    assert_equal [members, public_, public_failed, proposed].sort_by(&:id), Motion.visible_to(@group, @member).sort_by(&:id)
    assert_equal 4, Motion.visible_to(@group, @keeper).count
    assert_equal 4, Motion.visible_to(@group, @leader).count
  end

  test "search covers the title and the wording" do
    motion(title: "Seventh Tradition", text: "Send 60% to the district")
    motion(title: "Coffee", text: "Buy the good kind")
    assert_equal ["Seventh Tradition"], Motion.search(@group.motions, "district").map(&:title)
    assert_equal ["Coffee"], Motion.search(@group.motions, "COFFEE").map(&:title)
  end

  test "newest decisions first, undated ones last" do
    old = motion(decided_on: Date.new(2024, 1, 1))
    undated = motion(status: "proposed", decided_on: nil)
    recent = motion(decided_on: Date.new(2026, 6, 1))
    assert_equal [recent, old, undated], @group.motions.newest_first.to_a
  end

  test "a document can be adopted only by a decision the group passed" do
    passed = motion
    failed = motion(status: "failed")
    doc = @group.documents.create!(title: "Guidelines", kind: "guidelines")
    assert doc.update(approved_by: passed)
    assert_not doc.update(approved_by: failed)
    foreign = Group.create!(title: "Night Owls", time_zone: "America/Phoenix").motions.create!(title: "Theirs", status: "passed", decided_on: Date.today)
    assert_not @group.documents.new(title: "X", approved_by: foreign).valid?
  end

  test "deleting a decision frees what it replaced and un-adopts documents" do
    old = motion(title: "Old")
    newer = motion(title: "New", supersedes: old)
    doc = @group.documents.create!(title: "Guidelines", approved_by: newer)

    newer.destroy!
    assert_nil doc.reload.approved_by_motion_id
    assert_equal [old], @group.motions.standing.to_a

    @group.destroy!
    assert_equal 0, Motion.where(group_id: @group.id).count
  end
end
