# One motion made at a meeting, as the group ran it by Robert's Rules: its kind (main motion,
# amend, lay on the table...), who moved and seconded it, how it was voted and the count as it stood
# in the room, and what became of it. Voting happens in the room; this only records it, and
# #warnings says where a record doesn't add up. The decisions log is the main motions and the
# ones that rescind a decision: a passed one that no later passed one replaces is "standing".
# Names are plain text (first name and last initial), never links to accounts, so a record read
# or printed by everyone exposes nobody.
class Motion < ApplicationRecord
  STATUSES = %w[proposed passed failed tabled withdrawn no_second referred postponed postponed_indefinitely out_of_order].freeze
  CATEGORIES = %w[money format service literature meeting other].freeze
  VISIBILITIES = %w[members public].freeze
  # These need the date they were decided
  DECIDED = %w[passed failed tabled referred postponed postponed_indefinitely].freeze
  # Recorded with a vote taken on them, or put by the chair, that a second should have come before
  REQUIRED_PHRASES = {
    "majority" => "a majority of the votes cast (a tie is lost)", "two_thirds" => "two thirds of the votes cast",
    "three_fourths" => "three fourths of the votes cast", "unanimous" => "unanimous", "entire_membership" => "a majority of the entire membership",
  }.freeze
  NO_QUORUM_OK = %w[adjourn recess fix_time_to_adjourn question_of_privilege].freeze
  TEXT_MAX = 10_000
  COUNT_MAX = 9_999

  belongs_to :group
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :supersedes, class_name: "Motion", optional: true
  # Where it was decided, when it was made at a business meeting
  belongs_to :business_meeting, optional: true
  belongs_to :agenda_item, optional: true
  # The motion it applies to (an amendment's main motion, what a motion to table sets aside)
  belongs_to :parent, class_name: "Motion", optional: true
  has_many :children, class_name: "Motion", foreign_key: :parent_id, inverse_of: :parent, dependent: :nullify
  has_many :agenda_items_from_it, class_name: "AgendaItem", dependent: :nullify
  has_many :replacements, class_name: "Motion", foreign_key: :supersedes_id, inverse_of: :supersedes, dependent: :nullify
  has_many :documents, class_name: "GroupDocument", foreign_key: :approved_by_motion_id, inverse_of: :approved_by, dependent: :nullify

  before_validation { self.title = title.to_s.squish }
  before_validation { %i[moved_by_name seconded_by_name].each { |a| self[a] = self[a].to_s.squish.presence } }

  validates :title, presence: true, length: { maximum: 160 }
  validates :text, length: { maximum: TEXT_MAX }
  validates :minority_opinion, length: { maximum: 5000 }
  validates :moved_by_name, :seconded_by_name, length: { maximum: 80 }
  validates :status, inclusion: { in: STATUSES }
  validates :kind, inclusion: { in: MotionKinds::KEYS }
  validates :vote_method, inclusion: { in: MotionKinds::VOTE_METHODS.keys }, allow_nil: true
  validates :required_vote, inclusion: { in: MotionKinds::REQUIRED_VOTES.keys }, allow_nil: true
  validates :committee, :postponed_to, length: { maximum: 120 }
  validates :note, length: { maximum: 2000 }
  validates :amended_text, length: { maximum: TEXT_MAX }
  validates :category, inclusion: { in: CATEGORIES }
  validates :visibility, inclusion: { in: VISIBILITIES }
  validates :decided_on, presence: true, if: -> { DECIDED.include?(status) }
  validates :votes_for, :votes_against, :abstentions, numericality: { only_integer: true, in: 0..COUNT_MAX }, allow_nil: true
  validate :supersedes_is_sensible
  validate :meeting_is_the_groups
  validate :parent_is_the_groups

  before_validation { self.vote_method = vote_method.presence; self.required_vote = required_vote.presence; self.committee = committee.to_s.squish.presence; self.postponed_to = postponed_to.to_s.squish.presence }

  scope :passed, -> { where(status: "passed") }
  scope :newest_first, -> { order(Arel.sql("motions.decided_on DESC NULLS LAST"), id: :desc) }
  scope :decisions, -> { where(kind: MotionKinds::DECISION_KINDS) }
  # A decision that passed and that no later passed decision replaces
  scope :standing, -> { decisions.passed.where.not(id: Motion.passed.where.not(supersedes_id: nil).select(:supersedes_id)) }
  # Set aside, put off or sent away at a meeting and not dealt with since: unfinished business
  scope :unfinished, -> { decisions.where(status: %w[tabled postponed referred]) }

  # What this person may see. Keepers see everything; members the Members and Public ones;
  # anyone else only Public decisions that passed (so a group can say "this meeting is closed").
  def self.visible_to(group, user)
    return group.motions if group.records_editable_by?(user)
    return group.motions.where(visibility: %w[public members], needs_review: false) if group.member_or_site_admin?(user)

    group.motions.where(visibility: "public", status: "passed", needs_review: false)
  end

  def self.search(scope, query)
    like = "%#{sanitize_sql_like(query.to_s.strip)}%"
    scope.where("motions.title ILIKE :q OR motions.text ILIKE :q", q: like)
  end

  def passed? = status == "passed"
  def kind_info = MotionKinds.find(kind)
  def decision? = MotionKinds::DECISION_KINDS.include?(kind)

  # The vote the rules (or the group's bylaws, if it set one) ask for, or nil if nobody votes
  def required_vote_key = MotionKinds.required_vote(kind, override: required_vote, previous_notice: previous_notice)

  # Whether the recorded count carries it: true, false, or nil when there's no count to judge.
  # Votes cast are for and against; abstentions don't count (and a tie is lost, except on an
  # appeal, where it sustains the chair).
  def vote_met?(required = required_vote_key)
    return if required.nil? || (votes_for.nil? && votes_against.nil?)

    f = votes_for.to_i
    a = votes_against.to_i
    total = f + a
    case required
    when "majority" then kind_info[:vote] == "tie_sustains" ? f >= a : f > a
    when "two_thirds" then total.positive? && f * 3 >= total * 2
    when "three_fourths" then total.positive? && f * 4 >= total * 3
    when "unanimous" then total.positive? && a.zero?
    when "entire_membership" then f * 2 > group.active_memberships.count
    end
  end

  # Where this record doesn't follow the rules, in plain words. Only for record keepers; none of
  # it stops anything being saved.
  def warnings
    info = kind_info
    recorded = DECIDED.include?(status)
    list = []
    list << "Brought in from old minutes: check it against them, then save it so members can see it." if needs_review
    return list if ignore_rules
    list << "No second is recorded." if info[:second] && seconded_by_name.blank? && recorded
    list << "Say which motion this applies to." if info[:pending] && parent_id.nil?
    required = required_vote_key
    if required && %w[passed failed].include?(status)
      met = vote_met?(required)
      phrase = "#{votes_for.to_i} for and #{votes_against.to_i} against"
      list << "Recorded as passed, but #{phrase} is not #{REQUIRED_PHRASES[required]}." if status == "passed" && met == false
      list << "Recorded as failed, but #{phrase} is #{REQUIRED_PHRASES[required]}." if status == "failed" && met == true
    end
    list << "A two-thirds vote is taken standing; this is recorded as a voice vote." if required == "two_thirds" && vote_method == "voice" && recorded
    if parent && info[:rank] && kind != "amend" && (above = MotionKinds.find(parent.kind))[:rank] && info[:rank] < above[:rank]
      list << "A motion to #{info[:label].downcase} is out of order while a motion to #{above[:label].downcase} is pending."
    end
    list << "There was no quorum at this meeting, so the group couldn't act on this." if business_meeting&.quorum_met? == false && NO_QUORUM_OK.exclude?(kind)
    list
  end

  # What a passed motion does to the motion it applies to: tables it, refers it, puts it off, brings
  # it back, or changes its wording. (Editing or deleting it later doesn't undo that; change the
  # motion itself.)
  def apply_effect!
    return unless parent && status == "passed"

    attrs = case kind_info[:effect]
            when "tabled" then { status: "tabled" }
            when "referred" then { status: "referred", committee: committee.presence || parent.committee }
            when "postponed" then { status: "postponed", postponed_to: postponed_to.presence || parent.postponed_to }
            when "postponed_indefinitely" then { status: "postponed_indefinitely" }
            when "proposed" then { status: "proposed" }
            else {}
            end
    attrs[:amended_text] = amended_text if kind == "amend" && amended_text.present?
    return if attrs.empty?

    attrs[:decided_on] = decided_on if attrs[:status] && attrs[:status] != "proposed" && parent.decided_on.nil?
    parent.update_columns(attrs.merge(updated_at: Time.current))
    parent.settle_agenda_item!
  end

  # Deciding an agenda item's motion crosses the item off; tabling, referring or postponing it
  # carries it forward
  def settle_agenda_item!
    return unless agenda_item && kind == "main"

    item_status = { "passed" => "done", "failed" => "done", "withdrawn" => "done", "no_second" => "done", "out_of_order" => "done", "postponed_indefinitely" => "done",
                    "tabled" => "tabled", "referred" => "tabled", "postponed" => "tabled", "proposed" => "on_agenda" }[status]
    agenda_item.update(status: item_status) if item_status
  end

  # `replacers`: passed motions of the group by what they replace ({ id => motion }), so a
  # list needn't ask once per row; `visible`: ids this viewer may see.
  # `meetings`: ids of the business meetings this viewer may see, so a link never leads nowhere
  # `keeper`: record keepers also get #warnings
  def as_api_json(replacers: nil, visible: nil, meetings: nil, keeper: false)
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
      supersedes_id: supersedes_id, agenda_item_id: agenda_item_id,
      kind: kind, kind_label: kind_info[:label], kind_group: kind_info[:group], parent_id: parent_id, vote_method: vote_method, required_vote: required_vote, previous_notice: previous_notice,
      required: required_vote_key, committee: committee, postponed_to: postponed_to, amended_text: amended_text.to_s, note: note.to_s,
      warnings: keeper ? warnings : [], needs_review: needs_review, ignore_rules: ignore_rules,
      business_meeting_id: business_meeting_id,
      meeting: business_meeting && (meetings.nil? || meetings.include?(business_meeting_id)) ? { id: business_meeting_id, held_on: business_meeting.held_on.iso8601 } : nil,
    }
  end

  def self.replacers_for(group)
    group.motions.passed.where.not(supersedes_id: nil).order(:decided_on, :id).index_by(&:supersedes_id)
  end

  private

  def meeting_is_the_groups
    errors.add(:business_meeting, "must be one of this group's meetings") if business_meeting && business_meeting.group_id != group_id
    errors.add(:agenda_item, "must be on one of this group's meetings") if agenda_item && agenda_item.business_meeting.group_id != group_id
    errors.add(:agenda_item, "must be on that meeting's agenda") if agenda_item && business_meeting && agenda_item.business_meeting_id != business_meeting_id
  end

  def parent_is_the_groups
    return unless parent

    errors.add(:parent, "must be one of this group's motions") if parent.group_id != group_id
    errors.add(:parent, "can't be the motion itself") if persisted? && parent_id == id
    seen = []
    node = parent
    while node && !seen.include?(node.id)
      return errors.add(:parent, "can't lead back to the motion itself") if persisted? && node.id == id

      seen << node.id
      node = node.parent
    end
  end

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
