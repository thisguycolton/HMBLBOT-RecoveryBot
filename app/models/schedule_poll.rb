# A "when should we meet?" poll. The organizer picks a run of days, an event length and
# the times that don't work (daily meetings in the room, one-off conflicts); anyone with
# the link ranks their top few start times on a week grid, and the results show as a
# heat map. Every time is wall-clock time in the poll's time zone (Phoenix by default).
class SchedulePoll < ApplicationRecord
  VISIBILITIES = %w[always after_vote after_close].freeze
  TIME_ZONES = %w[America/Phoenix America/Los_Angeles America/Denver America/Chicago America/New_York].freeze
  MAX_DAYS = 14
  DAY_MINUTES = 24 * 60

  belongs_to :user
  # The event this poll picks a time for (Event#schedule_polls); voting follows the event
  belongs_to :event, optional: true
  has_many :members, class_name: "SchedulePollMember", dependent: :destroy
  has_many :member_users, through: :members, source: :user
  has_many :ballots, class_name: "SchedulePollBallot", dependent: :destroy

  before_validation { self.token ||= SecureRandom.alphanumeric(10).downcase }
  before_validation :normalize_blocks

  validates :title, :token, :starts_on, :ends_on, :closes_at, presence: true
  validates :results_visibility, inclusion: { in: VISIBILITIES }
  validates :time_zone, inclusion: { in: TIME_ZONES }
  validates :duration_minutes, numericality: { only_integer: true, in: 15..(8 * 60) }
  validates :choices_count, numericality: { only_integer: true, in: 1..5 }
  validates :slot_minutes, inclusion: { in: [15, 30, 60] }
  validates :day_start_minute, :day_end_minute, numericality: { only_integer: true, in: 0..DAY_MINUTES }
  validate :sensible_range

  def self.for_user(user)
    where(user: user).or(where(id: SchedulePollMember.where(user: user).select(:schedule_poll_id))).distinct
  end

  def to_param = token

  def zone = ActiveSupport::TimeZone[time_zone]
  def now_local = Time.current.in_time_zone(zone)
  def days = (starts_on..ends_on).to_a

  def closed? = closed_at.present? || Time.current >= closes_at
  def collaborators = member_users.merge(SchedulePollMember.collaborators)

  # The organizer and collaborators: they can do everything but delete (the organizer only)
  def manager?(someone) = someone.present? && (user_id == someone.id || collaborators.exists?(someone.id))
  def deletable_by?(someone) = someone.present? && user_id == someone.id
  def organizers = [user, *collaborators].uniq

  def results_visible_to?(someone, ballot)
    return true if manager?(someone)
    case results_visibility
    when "always" then true
    when "after_vote" then ballot.present? || closed?
    else closed?
    end
  end

  # "2026-10-16T19:00" (wall time in the poll's zone) -> [date, minute of day]
  def self.parse_start(value)
    m = value.to_s.match(/\A(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})\z/) or return
    [Date.iso8601(m[1]), m[2].to_i * 60 + m[3].to_i]
  rescue Date::Error
    nil
  end

  def self.format_start(date, minute) = format("%sT%02d:%02d", date.iso8601, minute / 60, minute % 60)

  # Why a start time can't be picked, or nil when it fits
  def start_problem(value, now: now_local)
    date, minute = self.class.parse_start(value)
    return "isn't a time" unless date
    return "isn't one of the poll's days" unless date.between?(starts_on, ends_on)
    return "doesn't land on the grid" unless (minute % slot_minutes).zero?
    finish = minute + duration_minutes
    return "is outside the hours" if minute < day_start_minute || finish > [day_end_minute, DAY_MINUTES].min
    return "has already passed" if zone.parse(self.class.format_start(date, minute)) <= now
    return "overlaps a time that doesn't work" if blocks_on(date).any? { |b| minute < b["end"] && finish > b["start"] }
    nil
  end

  def blocks_on(date)
    blocks.select { |b| b["kind"] == "daily" || b["date"] == date.iso8601 }
  end

  # Ranked choices count down: with 3 choices, a first choice is worth 3, a third 1.
  def tally
    counts = Hash.new { |h, k| h[k] = { start: k, points: 0, votes: 0, firsts: 0 } }
    ballots.each do |ballot|
      ballot.choices.first(choices_count).each_with_index do |start, rank|
        row = counts[start]
        row[:points] += choices_count - rank
        row[:votes] += 1
        row[:firsts] += 1 if rank.zero?
      end
    end
    counts.values.sort_by { |r| [-r[:points], -r[:firsts], r[:start]] }
  end

  def notify_organizers(kind:, title:, except: nil, body: nil)
    Notification.deliver(organizers - [except].compact, kind: kind, title: title, body: body, url: path)
  end

  def path = "/schedule_polls/#{token}"

  def as_api_json(viewer: nil, ballot: nil, include_results: false)
    {
      token: token, title: title, description: description, time_zone: time_zone,
      zone_label: zone.now.strftime("%Z"),
      starts_on: starts_on.iso8601, ends_on: ends_on.iso8601,
      duration_minutes: duration_minutes, choices_count: choices_count, slot_minutes: slot_minutes,
      day_start_minute: day_start_minute, day_end_minute: day_end_minute,
      results_visibility: results_visibility, blocks: blocks,
      closes_at: closes_at.in_time_zone(zone).strftime("%Y-%m-%dT%H:%M"),
      closed: closed?, closed_early: closed_at.present?,
      now_local: now_local.strftime("%Y-%m-%dT%H:%M"),
      organizer: { name: user.name.presence || user.email.split("@").first },
      ballots_count: ballots.size,
      can_manage: manager?(viewer), can_delete: deletable_by?(viewer),
      members: members.includes(:user).map(&:as_api_json),
      event: event&.published? || event&.editable_by?(viewer) ? { token: event.token, title: event.title, path: event.path } : nil,
    }.tap do |json|
      json[:results] = include_results ? tally : nil
      json[:voters] = ballots.order(:created_at).map(&:as_api_json) if manager?(viewer)
    end
  end

  private

  def normalize_blocks
    self.blocks = Array(blocks).filter_map do |raw|
      b = raw.to_h.stringify_keys
      kind = b["kind"] == "once" ? "once" : "daily"
      start = b["start"].to_i.clamp(0, DAY_MINUTES)
      finish = b["end"].to_i.clamp(0, DAY_MINUTES)
      next if finish <= start
      date = (Date.iso8601(b["date"].to_s).iso8601 rescue nil) if kind == "once"
      next if kind == "once" && date.nil?
      { "kind" => kind, "date" => date, "start" => start, "end" => finish, "label" => b["label"].to_s.strip.first(60) }.compact
    end
  end

  def sensible_range
    return unless starts_on && ends_on
    errors.add(:ends_on, "must be on or after the start date") if ends_on < starts_on
    errors.add(:ends_on, "can be at most #{MAX_DAYS} days after the start") if (ends_on - starts_on).to_i >= MAX_DAYS
    if day_start_minute && day_end_minute && duration_minutes && day_end_minute - day_start_minute < duration_minutes
      errors.add(:base, "The earliest and latest times leave no room for the event")
    end
  end
end
