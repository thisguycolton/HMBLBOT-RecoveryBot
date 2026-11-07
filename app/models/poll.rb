# A poll: one question, two or more answers, and a short link anyone can open (/p/:token).
# Each voter gets one PollBallot per poll, so who voted for what is always recorded; who can see
# the names is the poll's voters_visibility. Who can vote is its audience: anyone with the link
# (guests are known by the hb_voter cookie, one per network), people signed in, or members of its
# group. Results update live: PollChannel tells open pages the poll changed and each page asks
# Api::PollsController for what it may see.
# It can be attached to something (subject): a Reading or a Motion.
class Poll < ApplicationRecord
  moderates_language :question, :details
  AUDIENCES = %w[anyone signed_in members].freeze
  RESULTS = %w[always after_vote after_close].freeze
  VOTERS = %w[managers everyone].freeze
  MAX_OPTIONS = 20

  belongs_to :user, optional: true
  belongs_to :group, optional: true
  belongs_to :subject, polymorphic: true, optional: true
  has_many :options, -> { order(:position, :id) }, dependent: :destroy, inverse_of: :poll
  has_many :ballots, class_name: "PollBallot", dependent: :destroy

  accepts_nested_attributes_for :options, allow_destroy: true

  before_validation { self.token ||= self.class.new_token }
  before_validation { self.question = question.to_s.squish }

  validates :question, presence: true, length: { maximum: 200 }
  validates :details, length: { maximum: 2000 }
  validates :token, presence: true, uniqueness: true
  validates :audience, inclusion: { in: AUDIENCES }
  validates :results_visibility, inclusion: { in: RESULTS }
  validates :voters_visibility, inclusion: { in: VOTERS }
  validates :max_choices, numericality: { only_integer: true, in: 1..MAX_OPTIONS }
  validate :sensible_options
  validate :members_need_a_group

  after_commit :broadcast_change, on: %i[update]

  # Short, easy to read aloud: no 0/o or 1/l
  ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789".chars.freeze
  def self.new_token
    loop do
      token = Array.new(6) { ALPHABET.sample(random: SecureRandom) }.join
      break token unless exists?(token: token)
    end
  end

  def self.made_by(user)
    return none unless user
    return all if user.suite_admin?

    groups = GroupMembership.active.where(user: user).where("group_memberships.role = 'admin' OR group_memberships.can_keep_records").select(:group_id)
    where(user: user).or(where(group_id: groups))
  end

  def to_param = token
  def short_path = "/p/#{token}"
  def closed? = closed_at.present? || (closes_at.present? && Time.current >= closes_at)
  def multiple? = max_choices > 1

  # Who runs it: whoever made it, site admins, and the group's admins and record keepers
  def manager?(someone)
    return false unless someone
    return true if someone.suite_admin? || user_id == someone.id

    !!group&.records_editable_by?(someone)
  end

  # Who can make a poll for this group (or with no group: site admins)
  def self.creatable_by?(someone, group)
    return false unless someone
    return true if someone.suite_admin?

    !!group && (group.records_editable_by?(someone) || group.can_host?(someone))
  end

  # nil when they can vote, else why not
  def vote_problem(someone)
    return "Voting has closed." if closed?
    case audience
    when "signed_in" then "Sign in to vote in this poll." unless someone
    when "members" then "Only members of #{group&.title || 'the group'} can vote in this poll." unless group&.member?(someone) || manager?(someone)
    end
  end

  def results_visible_to?(someone, ballot)
    return true if manager?(someone)
    case results_visibility
    when "always" then true
    when "after_vote" then ballot.present? || closed?
    else closed?
    end
  end

  def voters_visible_to?(someone, ballot)
    manager?(someone) || (voters_visibility == "everyone" && results_visible_to?(someone, ballot))
  end

  # { option_id => count }
  def counts
    ballots.pluck(:option_ids).flatten.tally
  end

  def broadcast_change = PollChannel.broadcast_to(self, { changed: true })

  def as_api_json(viewer:, ballot:)
    show_results = results_visible_to?(viewer, ballot)
    show_voters = voters_visible_to?(viewer, ballot)
    tally = show_results ? counts : {}
    voters = show_voters ? ballots.includes(:user).order(:created_at).to_a : []
    {
      token: token, question: question, details: details, short_path: short_path,
      max_choices: max_choices, audience: audience, results_visibility: results_visibility,
      voters_visibility: voters_visibility, closes_at: closes_at&.iso8601, closed: closed?,
      group: group && { name: group.title, slug: group.slug },
      subject: subject_json,
      ballots_count: ballots.size, show_results: show_results, show_voters: show_voters,
      options: options.map do |o|
        { id: o.id, label: o.display_label, count: show_results ? tally[o.id].to_i : nil,
          voters: show_voters ? voters.select { |b| b.option_ids.include?(o.id) }.map(&:as_voter_json) : nil }
      end,
      can_manage: manager?(viewer), vote_problem: ballot ? (closed? ? "Voting has closed." : nil) : vote_problem(viewer),
    }
  end

  private

  def subject_json
    case subject
    when Reading then { type: "Reading", title: subject.title, path: "/readings/#{subject.id}" }
    when Motion then { type: "Motion", title: subject.title }
    end
  end

  def sensible_options
    kept = options.reject(&:marked_for_destruction?)
    errors.add(:base, "Add at least two answers") if kept.size < 2
    errors.add(:base, "A poll can have at most #{MAX_OPTIONS} answers") if kept.size > MAX_OPTIONS
    labels = kept.map { |o| o.display_label.downcase }
    errors.add(:base, "Each answer can only be listed once") if labels.uniq.size != labels.size
    errors.add(:max_choices, "can't be more than the number of answers") if kept.any? && max_choices.to_i > kept.size
  end

  def members_need_a_group
    errors.add(:audience, "can be members only when the poll belongs to a group") if audience == "members" && group.nil?
  end
end
