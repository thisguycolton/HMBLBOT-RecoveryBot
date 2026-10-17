# One of a group's meetings: weekly (a weekday and a time) or once (a date and a time).
# A meeting that meets on several days is one weekly meeting per day, the way OIAA and
# the Meeting Guide spec list them. Times are wall-clock times in the meeting's zone.
#
# A meeting linked to OIAA (oiaa_slug) takes its schedule, links and types from OIAA's
# directory (OiaaMeeting) and refreshes when that does; unlinking makes it editable again.
class Meeting < ApplicationRecord
  RECURRENCES = %w[weekly once].freeze
  DAY_MINUTES = 24 * 60
  DAY_NAMES = Date::DAYNAMES
  # Fields that come from OIAA on a linked meeting (the rest, like notes, stay local)
  OIAA_FIELDS = %i[name day_of_week start_minute end_minute time_zone conference_url conference_url_notes
                   conference_phone types oiaa_url].freeze

  belongs_to :group
  has_many :court_verifications, dependent: :nullify
  # Who hosts and co-hosts it (weekly meetings), and who is covering on a given date
  has_many :hosts, class_name: "MeetingHost", dependent: :destroy
  has_many :host_covers, class_name: "MeetingHostCover", dependent: :destroy

  before_validation :tidy

  validates :name, presence: true, length: { maximum: 255 }
  validates :recurrence, inclusion: { in: RECURRENCES }
  validate { errors.add(:time_zone, "isn't a time zone we know") unless ActiveSupport::TimeZone[time_zone.to_s] }
  validates :day_of_week, inclusion: { in: 0..6 }, if: :weekly?
  validates :start_minute, numericality: { only_integer: true, in: 0...DAY_MINUTES }, if: :weekly?
  validates :end_minute, numericality: { only_integer: true, in: 0..DAY_MINUTES }, allow_nil: true, if: :weekly?
  validates :starts_at, presence: true, if: :once?
  validates :conference_url, format: { with: %r{\Ahttps?://}i, message: "must start with http:// or https://" }, allow_blank: true
  validates :oiaa_slug, uniqueness: { scope: %i[group_id day_of_week], message: "is already one of this group's meetings" }, allow_nil: true

  scope :ordered, -> { order(Arel.sql("recurrence DESC, day_of_week, start_minute, starts_at")) }
  scope :weekly, -> { where(recurrence: "weekly") }
  scope :linked_to_oiaa, -> { where.not(oiaa_slug: nil) }

  # The same meeting on its other days (it is stored once per weekday), this one included
  def series
    return group.meetings.where(id: id) unless weekly?

    group.meetings.weekly.where(name: name, start_minute: start_minute, end_minute: end_minute)
  end

  # The assignment in place on `date` (the latest to have started), for "host" or "co_host"
  def host_on(role, date) = hosts.select { |h| h.role == role && h.active_on?(date) }.max_by { |h| [h.starts_on, h.id] }
  def cover_on(role, date) = host_covers.find { |c| c.role == role && c.on == date }

  def weekly? = recurrence == "weekly"
  def once? = recurrence == "once"
  def oiaa_linked? = oiaa_slug.present?
  def zone = ActiveSupport::TimeZone[time_zone] || group&.zone || Time.zone

  # Weekly: the next start at or after `from`. Once: its start (past or not).
  def next_start(from = Time.current)
    return starts_at&.in_time_zone(zone) if once?

    self.class.weekly_start(day_of_week, start_minute, zone, from)
  end

  # The next start at or after `from` of a weekly meeting on `day` at `minute` in `zone`
  def self.weekly_start(day, minute, zone, from)
    local = from.in_time_zone(zone)
    days_ahead = (day - local.wday) % 7
    start = (local.to_date + days_ahead).in_time_zone(zone) + minute.minutes
    start < local ? start + 7.days : start
  end

  def duration_minutes
    return [((ends_at - starts_at) / 60).round, 1].max if once? && starts_at && ends_at
    OiaaMeeting.duration(start_minute, end_minute)
  end

  # The start and end of the meeting on now, or else its next one (nil once it's over)
  def upcoming(now = Time.current)
    start = next_start(now - duration_minutes.minutes)
    return unless start
    finish = start + duration_minutes.minutes
    finish > now ? [start, finish] : nil
  end

  def attendance
    online = conference_url.present?
    in_person = location.present? || formatted_address.present?
    return "hybrid" if online && in_person
    in_person ? "in_person" : "online"
  end

  def place = [location, formatted_address].compact_blank.uniq.join(", ").presence

  # The start on a given calendar day in the meeting's zone, or nil if it doesn't meet then
  def start_on(date)
    if weekly?
      date.wday == day_of_week ? date.in_time_zone(zone) + start_minute.minutes : nil
    else
      local = starts_at.in_time_zone(zone)
      local.to_date == date ? local : nil
    end
  end

  # "Thursdays, 7:00–8:00 PM MST" or "Tue, Oct 20, 2026, 7:00 AM MST"
  def schedule_label
    if weekly?
      sample = next_start
      "#{DAY_NAMES[day_of_week]}s, #{self.class.clock(start_minute)}#{end_minute ? "–#{self.class.clock(end_minute)}" : ""} #{sample.strftime('%Z')}"
    else
      local = starts_at.in_time_zone(zone)
      local.strftime("%a, %b %-d, %Y, %-I:%M %p %Z")
    end
  end

  def self.clock(minutes)
    minutes = minutes.to_i % DAY_MINUTES
    Time.utc(2000, 1, 1).advance(minutes: minutes).strftime("%-I:%M %p")
  end

  # Copy OIAA's listing onto this meeting (for the given weekday, when it lists several)
  def apply_oiaa(record, day: nil)
    day ||= day_of_week.presence_in(record.days) || record.days.first
    self.attributes = record.meeting_attributes(day).slice(*OIAA_FIELDS)
    self.recurrence = "weekly"
    self.oiaa_slug = record.slug
    self.source = "oiaa"
    self.oiaa_synced_at = Time.current
    self.oiaa_missing = false
    self
  end

  def unlink_oiaa
    self.oiaa_slug = nil
    self.oiaa_synced_at = nil
    self.oiaa_missing = false
    self.source = "manual"
    self
  end

  def as_api_json
    nxt = next_start
    now_or_next = upcoming
    {
      id: id, name: name, recurrence: recurrence, day_of_week: day_of_week,
      start_minute: start_minute, end_minute: end_minute, time_zone: time_zone,
      starts_at: starts_at&.in_time_zone(zone)&.strftime("%Y-%m-%dT%H:%M"),
      ends_at: ends_at&.in_time_zone(zone)&.strftime("%Y-%m-%dT%H:%M"),
      next_start: nxt&.iso8601, past: once? && nxt && nxt < Time.current,
      upcoming_start: now_or_next&.first&.iso8601, upcoming_end: now_or_next&.last&.iso8601,
      schedule_label: schedule_label, conference_url: conference_url, conference_url_notes: conference_url_notes,
      conference_phone: conference_phone, location: location, formatted_address: formatted_address,
      types: types, notes: notes, oiaa_slug: oiaa_slug, oiaa_url: oiaa_url, oiaa_missing: oiaa_missing,
      oiaa_synced_at: oiaa_synced_at&.iso8601,
    }
  end

  private

  def tidy
    self.time_zone = group&.time_zone if time_zone.blank?
    self.types = Array(types).map(&:to_s).map(&:strip).reject(&:blank?).uniq
    if once?
      self.day_of_week = self.start_minute = self.end_minute = nil
      self.ends_at ||= starts_at && starts_at + 1.hour
    else
      self.starts_at = self.ends_at = nil
      self.end_minute ||= start_minute && [start_minute + 60, DAY_MINUTES].min
    end
  end
end
