# A sponsor and their sponsee on the site. It starts one of two ways:
# - the sponsee asks someone by username (`pending` until that person accepts or declines), or
# - the sponsor hands out their invite link (users.sponsor_invite_token, /sponsor/:token) and
#   the sponsee accepts it (`active` straight away, since the sponsee is the one saying yes).
# A sponsor can't reach out to someone who didn't ask: requests only go from sponsee to sponsor.
#
# Nothing is shared by being linked. The sponsee sends things one at a time (SponsorshipShare),
# and the sponsor can read those and leave one short note on each. Either of them can end it,
# with no reason asked and without the other being notified; ending it takes everything that
# was sent away from the sponsor (the sponsee keeps their own entries). Blocking either way
# ends it too (UserBlock).
#
# One person can have several sponsors (a temporary one, a service sponsor) and any number of
# sponsees, but only one open sponsorship with the same person.
class Sponsorship < ApplicationRecord
  moderates_language :note

  STATUSES = %w[pending active declined ended].freeze
  OPEN = %w[pending active].freeze
  NOTE_MAX = 500
  # How many people someone can be waiting on at once, and ask in a week
  PENDING_MAX = 3
  WEEKLY_MAX = 5

  belongs_to :sponsor, class_name: "User"
  belongs_to :sponsee, class_name: "User"
  belongs_to :ended_by, class_name: "User", optional: true
  has_many :shares, class_name: "SponsorshipShare", dependent: :delete_all
  has_many :suggestions, class_name: "StepSuggestion", dependent: :delete_all

  validates :status, inclusion: { in: STATUSES }
  validates :note, length: { maximum: NOTE_MAX }
  validates :current_step, inclusion: { in: StepTool::STEPS }, allow_nil: true
  validate { errors.add(:base, "You can't be your own sponsor.") if sponsor_id == sponsee_id }
  validate :one_open_pair, if: -> { OPEN.include?(status) }

  before_validation { self.note = note.to_s.strip.presence }

  scope :current, -> { where(status: OPEN) }
  scope :active, -> { where(status: "active") }
  scope :pending, -> { where(status: "pending") }
  scope :involving, ->(user) { where(sponsor_id: user.id).or(where(sponsee_id: user.id)) }
  scope :between, ->(a, b) { where(sponsor_id: a.id, sponsee_id: b.id).or(where(sponsor_id: b.id, sponsee_id: a.id)) }

  def active? = status == "active"
  def pending? = status == "pending"
  def involves?(user) = !!user && [sponsor_id, sponsee_id].include?(user.id)
  def other(user) = user.id == sponsor_id ? sponsee : sponsor

  # The sponsee asks `sponsor` (found by username) to be their sponsor
  def self.ask!(sponsee:, sponsor:, note: nil)
    raise Refused, "That's you." if sponsor.id == sponsee.id
    raise Refused, "You can't ask them." if UserBlock.where(blocker: sponsor, blocked: sponsee).or(UserBlock.where(blocker: sponsee, blocked: sponsor)).exists?
    if (existing = current.find_by(sponsor: sponsor, sponsee: sponsee))
      raise Refused, existing.active? ? "They're already your sponsor." : "You've already asked them. They'll see it when they next look."
    end
    raise Refused, "They already asked you to sponsor them. Look under Asking you." if pending.exists?(sponsor: sponsee, sponsee: sponsor)
    raise Refused, "You're waiting on #{PENDING_MAX} people already. Give them a little time, or take one back." if pending.where(sponsee: sponsee).count >= PENDING_MAX
    raise Refused, "That's a lot of asks for one week. Try again in a few days." if where(sponsee: sponsee, created_at: 1.week.ago..).count >= WEEKLY_MAX

    sponsorship = create!(sponsor: sponsor, sponsee: sponsee, note: note)
    Notification.deliver(sponsor, kind: "sponsorship.request", from: sponsee,
                                  title: "#{sponsee.display_name} asked you to be their sponsor",
                                  body: sponsorship.note, url: "/recovery/sponsorship")
    sponsorship
  end

  # The sponsee says yes to a sponsor's invite link
  def self.accept_invite!(sponsee:, sponsor:)
    raise Refused, "That's your own link. Give it to someone you're sponsoring." if sponsor.id == sponsee.id
    raise Refused, "That link isn't working any more. Ask them for a new one." if UserBlock.where(blocker: sponsor, blocked: sponsee).or(UserBlock.where(blocker: sponsee, blocked: sponsor)).exists?

    existing = current.find_by(sponsor: sponsor, sponsee: sponsee)
    return existing.tap(&:accept!) if existing

    sponsorship = create!(sponsor: sponsor, sponsee: sponsee, status: "active", started_on: Date.current)
    Notification.deliver(sponsor, kind: "sponsorship.accepted", from: sponsee,
                                  title: "#{sponsee.display_name} is now your sponsee", url: "/recovery/sponsorship")
    sponsorship
  end

  # The person who was asked says yes
  def accept!
    return if active?

    update!(status: "active", started_on: Date.current)
    Notification.deliver(sponsee, kind: "sponsorship.accepted", from: sponsor,
                                  title: "#{sponsor.display_name} said yes to being your sponsor", url: "/recovery/sponsorship")
  end

  # The person who was asked says no. The asker isn't told; they see "not available right now".
  def decline!(by)
    update!(status: "declined", ended_at: Time.current, ended_by: by)
  end

  # Either of them, any time: no reason, no notification, and what was sent goes
  def end!(by)
    transaction do
      shares.delete_all
      suggestions.delete_all
      update!(status: "ended", ended_at: Time.current, ended_by: by)
    end
  end

  # Ends anything open between two people (one blocked the other)
  def self.end_between!(a, b)
    current.between(a, b).find_each { |s| s.pending? && s.sponsor_id == a.id ? s.decline!(a) : s.end!(a) }
  end

  def as_api_json(viewer)
    role = viewer.id == sponsor_id ? "sponsor" : "sponsee"
    {
      id: id, status: status, role: role, person: other(viewer).as_person_json,
      note: note, started_on: started_on&.iso8601, created_at: created_at.iso8601,
      asked_by_me: role == "sponsee", current_step: current_step,
    }
  end

  class Refused < StandardError; end

  private

  def one_open_pair
    clash = self.class.current.where(sponsor_id: sponsor_id, sponsee_id: sponsee_id).where.not(id: id)
    errors.add(:base, "There's already one between you.") if clash.exists?
  end
end
