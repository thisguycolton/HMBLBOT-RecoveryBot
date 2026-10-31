# A Special Edition: a limited chip a group makes for a window of time (a year, a month, a week,
# a holiday), in its own design (Group dashboard > Chips > Special Editions).
#
# - Milestone editions ("milestone"): round chips for sobriety milestones members reach inside
#   the window. A member claims theirs with a tap (any time, forever), and hosts can give it
#   during the run (Give a chip). `milestones` limits it to some (none listed: all of them).
# - Meeting Maker editions ("meeting_maker"): for clicking Join at `target_count` of the group's
#   meetings (or the listed ones) inside the window, given automatically
#   (ChipEdition.award_meeting_makers, when a member's chips load).
#
# How many: everyone who qualifies ("everyone"), the first `limit` to claim or earn it
# ("first_n"), or only `limit`, given by hosts ("given_n", milestone editions). Each one is
# numbered in the order it was claimed, earned or given (ChipEditionChip#serial).
#
# Minted chips never change: once the first is out (locked_at), the design and name are fixed.
class ChipEdition < ApplicationRecord
  moderates_language :name
  KINDS = %w[milestone meeting_maker].freeze
  HOW_MANY = %w[everyone first_n given_n].freeze
  WINDOWS = %w[year month week holiday custom].freeze
  LOCKED = %w[design name kind milestones meeting_ids target_count numbered starts_on how_many].freeze
  class SoldOut < StandardError; end
  class NotYours < StandardError; end

  belongs_to :group
  belongs_to :created_by, class_name: "User", optional: true
  has_many :chips, class_name: "ChipEditionChip", dependent: :delete_all
  has_many :chip_awards, dependent: :nullify

  scope :published, -> { where.not(published_at: nil) }
  scope :running_on, ->(date) { published.where("starts_on <= :d AND ends_on >= :d", d: date) }
  scope :ordered, -> { order(starts_on: :desc, id: :desc) }

  before_validation { self.design = ChipDesign.pin(design) if design_changed? }
  before_validation { self.milestones = Array(milestones).map(&:to_s) & ChipDesign::ROUND_KEYS }
  before_validation { self.limit = nil if how_many == "everyone" }
  validates :name, presence: true, length: { maximum: 40 }
  validates :kind, inclusion: { in: KINDS }
  validates :how_many, inclusion: { in: HOW_MANY }
  validates :window, inclusion: { in: WINDOWS }
  validates :starts_on, :ends_on, presence: true
  validates :limit, numericality: { only_integer: true, in: 1..100_000 }, unless: -> { how_many == "everyone" }
  validates :target_count, numericality: { only_integer: true, in: 1..1000 }, if: -> { kind == "meeting_maker" }
  validate { errors.add(:ends_on, "has to be after it starts") if starts_on && ends_on && ends_on < starts_on }
  validate { errors.add(:ends_on, "can be at most a year after it starts") if starts_on && ends_on && ends_on > starts_on.next_year }
  validate { errors.add(:how_many, "for Meeting Maker chips is everyone or the first ones to earn it") if kind == "meeting_maker" && how_many == "given_n" }
  validate { errors.add(:limit, "can't be less than the #{issued} already out") if limit && persisted? && limit < issued }
  validate do
    changed = LOCKED.select { |a| will_save_change_to_attribute?(a) }
    errors.add(:base, "Chips are already out in this edition, so its #{changed.first.humanize.downcase} can't change") if locked_at_was && changed.any?
  end

  # Where Special Editions will be part of a paid plan: open to every group for now
  def self.open_to?(_group) = true

  def published? = published_at.present?
  def locked? = locked_at.present?
  def covers?(date) = date.between?(starts_on, ends_on)
  def running?(today = Date.current) = published? && covers?(today)
  def limited? = how_many != "everyone"
  def issued = chips.count
  def sold_out? = limited? && issued >= limit
  def claimable? = kind == "milestone" && how_many != "given_n"
  def givable?(today = Date.current) = kind == "milestone" && running?(today) && !sold_out?

  # The design it's minted in, ready to draw: a Meeting Maker edition's blank third side is
  # its name
  def chip_design
    @chip_design ||= ChipDesign.resolve(ChipDesign.merge(design)).tap do |d|
      sides = d["meeting"]["sides"]
      d["meeting"]["sides"] = [sides[0], sides[1], sides[2].presence || name.to_s.first(24)]
    end
  end

  # Along the bottom of the back: "2027 EDITION · NO. 014 OF 25"
  def mark(serial)
    number = (format("No. %03d", serial) + (limited? ? " of #{limit}" : "") if numbered && serial)
    [name, number].compact.join(" · ").upcase
  end

  def edition_json(serial) = { id: id, name: name, serial: (serial if numbered), limit: limit, mark: mark(serial) }

  # The round milestones `user` reached inside the window that this edition is for
  def qualifying(user, today = Date.current)
    return [] unless kind == "milestone" && user.sobriety_date

    Chips.round_milestones(user.sobriety_date, today)[:earned]
      .select { |m| covers?(m[:on]) && (milestones.empty? || milestones.include?(m[:key])) }
  end

  # A member taps Claim on a milestone reached in the window (they can, forever after)
  def claim!(user, slot, today = Date.current)
    raise NotYours unless published? && claimable? && group.members.exists?(user.id)

    m = qualifying(user, today).find { |x| Chips.round_slot(x[:key], x[:years]) == slot } or raise NotYours
    issue!(user: user, slot: slot, milestone_key: m[:key], years: m[:years], earned_on: m[:on], claimed_at: Time.current)
  end

  # The next one out, numbered, unless they're all gone (or it's theirs already)
  def issue!(**attrs)
    with_lock do
      existing = chips.find_by(user: attrs[:user], slot: attrs[:slot], chip_award_id: nil) unless attrs[:chip_award]
      existing || begin
        raise SoldOut if sold_out?

        chip = chips.create!(attrs.merge(serial: (chips.maximum(:serial) || 0) + 1))
        update_column(:locked_at, Time.current) unless locked_at
        chip
      end
    end
  end

  # Does this Join count toward it: one of its meetings (or any of the group's), inside the window
  def counts?(join)
    return false unless meeting_ids.empty? ? join.meeting.group_id == group_id : meeting_ids.include?(join.meeting_id)

    covers?(join.starts_at.in_time_zone(join.meeting.zone).to_date)
  end

  # Meeting Maker editions `user` earned and doesn't have yet, given to them now, with a
  # notification (minted when their chips load; there's no scheduler)
  def self.award_meeting_makers(user, now = Time.current)
    joins = MeetingJoin.where(user: user, starts_at: ..now).includes(:meeting).order(:starts_at).to_a
    return [] if joins.empty?

    have = ChipEditionChip.where(user: user).pluck(:chip_edition_id)
    published.where(kind: "meeting_maker", group_id: joins.map { |j| j.meeting.group_id }.uniq)
      .where("starts_on <= ?", now.to_date).where.not(id: have).includes(:group).filter_map do |edition|
      edition.award_meeting_maker(user, joins)
    end
  end

  def award_meeting_maker(user, joins)
    counted = joins.select { |j| counts?(j) }
    return if counted.size < target_count

    join = counted[target_count - 1]
    chip = issue!(user: user, slot: "edition-#{id}", count: target_count, earned_on: join.starts_at.in_time_zone(join.meeting.zone).to_date, claimed_at: Time.current)
    Notification.deliver(user, kind: "chip.edition", title: "You earned #{group.title}'s #{name} chip",
                               body: "#{target_count} meetings, #{window_label}", url: "/recovery?chip=edition:#{chip.id}")
    chip
  rescue SoldOut
    nil
  end

  # Everyone who's earned this Meeting Maker edition gets it (when the group's admins look at
  # their editions), so the numbers follow the order it was earned in more closely
  def award_everyone!(now = Time.current)
    return unless kind == "meeting_maker" && published?

    meetings = meeting_ids.empty? ? group.meetings.select(:id) : meeting_ids
    users = MeetingJoin.where(meeting_id: meetings, starts_at: starts_on.beginning_of_day - 1.day..[ends_on.end_of_day + 1.day, now].min)
      .where.not(user_id: chips.select(:user_id)).group(:user_id).having("count(*) >= ?", target_count).pluck(:user_id)
    User.where(id: users).find_each { |u| award_meeting_maker(u, MeetingJoin.where(user: u, starts_at: ..now).includes(:meeting).order(:starts_at).to_a) }
  end

  def window_label
    starts_on == ends_on ? starts_on.strftime("%b %-d, %Y") : "#{starts_on.strftime('%b %-d')} to #{ends_on.strftime('%b %-d, %Y')}"
  end

  # Claims waiting for `user`: milestone editions in their groups they reached a milestone in
  def self.available_for(user, today = Date.current)
    return [] unless user.sobriety_date

    editions = published.where(kind: "milestone", group_id: user.groups.select(:id)).where.not(how_many: "given_n")
      .where("starts_on <= ?", today).includes(group: { logo_attachment: :blob })
    return [] if editions.empty?

    have = ChipEditionChip.where(user: user, chip_award_id: nil, chip_edition_id: editions.map(&:id)).pluck(:chip_edition_id, :slot)
    editions.flat_map do |e|
      next [] if e.sold_out?

      e.qualifying(user, today).filter_map do |m|
        slot = Chips.round_slot(m[:key], m[:years])
        next if have.include?([e.id, slot])

        label = ChipAward.label_for(m[:key], m[:years])
        { edition_id: e.id, slot: slot, shape: "round", kind: "round", label: label, on: m[:on].iso8601, source: "edition",
          milestone: { key: m[:key], years: m[:years], label: label }.compact, design: e.chip_design,
          group: { title: e.group.title, logo_url: e.logo_url }, edition: e.edition_json(nil).merge(left: e.limited? ? e.limit - e.issued : nil) }
      end
    end
  end

  def logo_url = group.logo.attached? ? Rails.application.routes.url_helpers.rails_storage_proxy_path(group.logo, only_path: true) : nil

  # For the group's dashboard
  def as_api_json
    { id: id, name: name, kind: kind, design: chip_design, stored: design, starts_on: starts_on.iso8601, ends_on: ends_on.iso8601, window: window,
      window_label: window_label, milestones: milestones, meeting_ids: meeting_ids, target_count: target_count, how_many: how_many, limit: limit,
      numbered: numbered, published: published?, locked: locked?, running: running?, issued: issued, sold_out: sold_out? }
  end
end
