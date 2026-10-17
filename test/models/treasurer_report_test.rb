require "test_helper"

class TreasurerReportTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  setup do
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    @group.memberships.create!(user: @member, role: "member")
  end

  def report(attrs = {})
    @group.treasurer_reports.create!({ period_on: Date.new(2026, 9, 15), opening_cents: 30_000, reserve_cents: 30_000,
      lines: [{ kind: "income", label: "Seventh Tradition", cents: 142_00 }, { kind: "income", label: "Literature", cents: 18_00 },
              { kind: "expense", label: "Rent", cents: 60_00 }, { kind: "expense", label: "Coffee", cents: 12_50 }],
      splits: [{ label: "District", percent: 30 }, { label: "Area", percent: 10 }, { label: "GSO", percent: 10 }] }.merge(attrs))
  end

  test "the month's numbers and how what's above the reserve is shared" do
    s = report.summary
    assert_equal [16_000, 7_250, 38_750], [s[:income_cents], s[:expense_cents], s[:closing_cents]]
    assert_equal 8_750, s[:above_reserve_cents]
    assert_equal 0, s[:shortfall_cents]
    assert_equal [["District", 2_625], ["Area", 875], ["GSO", 875]], s[:shares].map { |x| [x[:label], x[:cents]] }
    assert_equal 8_750 - 4_375, s[:kept_cents]
  end

  test "a month that ends under the reserve shares nothing and says how short it is" do
    s = report(period_on: Date.new(2026, 10, 1), opening_cents: 10_000, lines: [{ kind: "expense", label: "Rent", cents: 6_000 }]).summary
    assert_equal [4_000, 26_000, 0], [s[:closing_cents], s[:shortfall_cents], s[:shares].sum { |x| x[:cents] }]
  end

  test "any day in the month is the month, and a month has one report" do
    assert_equal Date.new(2026, 9, 1), report.period_on
    assert_not @group.treasurer_reports.new(period_on: Date.new(2026, 9, 30)).valid?
    assert @group.treasurer_reports.new(period_on: Date.new(2026, 10, 1)).valid?
  end

  test "lines and splits are tidied, and splits can't pass 100%" do
    r = report(period_on: Date.new(2026, 11, 1),
               lines: [{ kind: "income", label: "  Tradition  ", cents: "500" }, { kind: "bonus", label: "x", cents: 1 }, { kind: "expense", label: "n", cents: "abc" }, { kind: "expense", label: "ok", cents: -5 }],
               splits: [{ label: "A", percent: "40.555" }, { label: "", percent: 10 }])
    assert_equal [{ "kind" => "income", "label" => "Tradition", "cents" => 500 }, { "kind" => "expense", "label" => "ok", "cents" => 0 }], r.lines
    assert_equal [{ "label" => "A", "percent" => 40.56 }], r.splits
    assert_not @group.treasurer_reports.new(period_on: Date.new(2026, 12, 1), splits: [{ label: "A", percent: 60 }, { label: "B", percent: 50 }]).valid?
  end

  test "keepers see drafts; members only posted ones for members" do
    draft = report
    posted = report(period_on: Date.new(2026, 8, 1), status: "posted")
    keepers = report(period_on: Date.new(2026, 7, 1), status: "posted", visibility: "keepers")
    assert_equal [draft, posted, keepers].sort_by(&:id), TreasurerReport.visible_to(@group, @leader).sort_by(&:id)
    assert_equal [posted], TreasurerReport.visible_to(@group, @member).to_a
    assert_empty TreasurerReport.visible_to(@group, nil)
  end
end
