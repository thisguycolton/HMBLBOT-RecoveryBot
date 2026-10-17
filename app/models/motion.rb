# One thing a group voted on: the wording, who moved and seconded it, the count as it stood in
# the room, and what it replaced. The decisions log is this table. A passed motion that no
# later passed motion replaces is "standing". Names are plain text (first name and last
# initial), never links to accounts, so a record read or printed by everyone exposes nobody.
class Motion < ApplicationRecord
  STATUSES = %w[proposed passed failed tabled withdrawn].freeze
  CATEGORIES = %w[money format service literature meeting other].freeze
  VISIBILITIES = %w[members public].freeze
  # These need the date they were decided
  DECIDED = %w[passed failed tabled].freeze
  TEXT_MAX = 10_000
  COUNT_MAX = 9_999

  belongs_to :group
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :supersedes, class_name: "Motion", optional: true
  has_many :replacements, class_name: "Motion", foreign_key: :supersedes_id, inverse_of: :supersedes, dependent: :nullify
  has_many :documents, class_name: "GroupDocument", foreign_key: :approved_by_motion_id, inverse_of: :approved_by, dependent: :nullify

  before_validation { self.title = title.to_s.squish }
  before_validation { %i[moved_by_name seconded_by_name].each { |a| self[a] = self[a].to_s.squish.presence } }

  validates :title, presence: true, length: { maximum: 160 }
  validates :text, length: { maximum: TEXT_MAX }
  validates :minority_opinion, length: { maximum: 5000 }
  validates :moved_by_name, :seconded_by_name, length: { maximum: 80 }
  validates :status, inclusion: { in: STATUSES }
  validates :category, inclusion: { in: CATEGORIES }
  validates :visibility, inclusion: { in: VISIBILITIES }
  validates :decided_on, presence: true, if: -> { DECIDED.include?(status) }
  validates :votes_for, :votes_against, :abstentions, numericality: { only_integer: true, in: 0..COUNT_MAX }, allow_nil: true
  validate :supersedes_is_sensible

  scope :passed, -> { where(status: "passed") }
  scope :newest_first, -> { order(Arel.sql("motions.decided_on DESC NULLS LAST"), id: :desc) }
  # Passed and not replaced by a later passed decision
  scope :standing, -> { passed.where.not(id: Motion.passed.where.not(supersedes_id: nil).select(:supersedes_id)) }

  # What this person may see. Keepers see everything; members the Members and Public ones;
  # anyone else only Public decisions that passed (so a group can say "this meeting is closed").
  def self.visible_to(group, user)
    return group.motions if group.records_editable_by?(user)
    return group.motions.where(visibility: %w[public members]) if group.member_or_site_admin?(user)

    group.motions.where(visibility: "public", status: "passed")
  end

  def self.search(scope, query)
    like = "%#{sanitize_sql_like(query.to_s.strip)}%"
    scope.where("motions.title ILIKE :q OR motions.text ILIKE :q", q: like)
  end

  def passed? = status == "passed"

  # `replacers`: passed motions of the group by what they replace ({ id => motion }), so a
  # list needn't ask once per row; `visible`: ids this viewer may see.
  def as_api_json(replacers: nil, visible: nil)
    replacer = (replacers || self.class.replacers_for(group))[id]
    shown = ->(m) { m && (visible.nil? || visible.include?(m.id)) }
    {
      id: id, title: title, text: text.to_s, category: category, status: status, visibility: visibility,
      moved_by: moved_by_name, seconded_by: seconded_by_name,
      votes_for: votes_for, votes_against: votes_against, abstentions: abstentions,
      minority_opinion: minority_opinion.to_s, decided_on: decided_on&.iso8601, created_at: created_at.iso8601,
      standing: passed? && replacer.nil?,
      # A replacement the viewer can't see still counts, but its title stays out of it
      replaced_by: replacer && { id: (replacer.id if shown.call(replacer)), title: (replacer.title if shown.call(replacer)), decided_on: replacer.decided_on&.iso8601 },
      replaces: supersedes && shown.call(supersedes) ? { id: supersedes.id, title: supersedes.title, decided_on: supersedes.decided_on&.iso8601 } : nil,
      supersedes_id: supersedes_id,
    }
  end

  def self.replacers_for(group)
    group.motions.passed.where.not(supersedes_id: nil).order(:decided_on, :id).index_by(&:supersedes_id)
  end

  private

  def supersedes_is_sensible
    return unless supersedes
    return errors.add(:supersedes, "must be one of this group's decisions") if supersedes.group_id != group_id

    # walking up what it replaces must never come back to this decision
    seen = []
    node = supersedes
    while node && !seen.include?(node.id)
      return errors.add(:supersedes, "can't lead back to the decision itself") if persisted? && node.id == id

      seen << node.id
      node = node.supersedes
    end
  end
end
