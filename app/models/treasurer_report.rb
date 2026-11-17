# The treasurer's report for one month, as numbers: what the opening balance was, what came
# in and went out, the prudent reserve the group keeps, and how what's left above it is
# shared (the Seventh Tradition split). Money is whole cents. Drafts are for record keepers;
# a posted report is read by members.
class TreasurerReport < ApplicationRecord
  moderates_language :notes, :lines
  STATUSES = %w[draft posted].freeze
  VISIBILITIES = %w[members keepers].freeze
  KINDS = %w[income expense].freeze
  MAX_CENTS = 10**12
  MAX_LINES = 60

  belongs_to :group
  belongs_to :created_by, class_name: "User", optional: true

  before_validation { self.period_on = period_on.beginning_of_month if period_on }
  before_validation { self.lines = clean_lines(lines) }
  before_validation { self.splits = clean_splits(splits) }

  validates :period_on, presence: true, uniqueness: { scope: :group_id, message: "already has a report" }
  validates :opening_cents, :reserve_cents, numericality: { only_integer: true, in: -MAX_CENTS..MAX_CENTS }
  validates :status, inclusion: { in: STATUSES }
  validates :visibility, inclusion: { in: VISIBILITIES }
  validates :notes, length: { maximum: 5000 }
  validate { errors.add(:splits, "can't add up to more than 100%") if splits.sum { |s| s["percent"] } > 100.0001 }

  scope :newest_first, -> { order(period_on: :desc) }

  def self.visible_to(group, user)
    return group.treasurer_reports if group.treasury_editable_by?(user)

    group.member_or_site_admin?(user) ? group.treasurer_reports.where(status: "posted", visibility: "members") : none
  end

  def posted? = status == "posted"
  def income_cents = lines.sum { |l| l["kind"] == "income" ? l["cents"] : 0 }
  def expense_cents = lines.sum { |l| l["kind"] == "expense" ? l["cents"] : 0 }
  def closing_cents = opening_cents + income_cents - expense_cents

  # What's left above the prudent reserve, and how it divides; a month that ends under the
  # reserve shares nothing and says by how much it's short
  def summary
    above = closing_cents - reserve_cents
    base = [above, 0].max
    shares = splits.map { |s| { label: s["label"], percent: s["percent"], cents: (base * s["percent"] / 100.0).round } }
    {
      opening_cents: opening_cents, income_cents: income_cents, expense_cents: expense_cents, closing_cents: closing_cents,
      reserve_cents: reserve_cents, above_reserve_cents: above, shortfall_cents: [-above, 0].max,
      shares: shares, kept_cents: base - shares.sum { |s| s[:cents] },
    }
  end

  def as_api_json
    { id: id, period_on: period_on.iso8601, status: status, visibility: visibility, notes: notes.to_s, lines: lines, splits: splits,
      opening_cents: opening_cents, reserve_cents: reserve_cents, summary: summary, updated_at: updated_at.iso8601 }
  end

  private

  def clean_lines(raw)
    Array(raw).first(MAX_LINES).filter_map do |l|
      l = l.respond_to?(:to_unsafe_h) ? l.to_unsafe_h : l.to_h
      l = l.stringify_keys
      next unless KINDS.include?(l["kind"])

      cents = Integer(l["cents"].to_s, exception: false)
      next if cents.nil?

      { "kind" => l["kind"], "label" => l["label"].to_s.squish.first(80), "cents" => cents.clamp(0, MAX_CENTS) }
    end
  end

  def clean_splits(raw)
    Array(raw).first(12).filter_map do |s|
      s = s.respond_to?(:to_unsafe_h) ? s.to_unsafe_h : s.to_h
      s = s.stringify_keys
      label = s["label"].to_s.squish.first(80)
      percent = Float(s["percent"].to_s, exception: false)
      next if label.blank? || percent.nil?

      { "label" => label, "percent" => percent.clamp(0, 100).round(2) }
    end
  end
end
