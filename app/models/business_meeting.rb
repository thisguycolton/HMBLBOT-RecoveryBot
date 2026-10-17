# A group's business (group conscience) meeting: when it is, its agenda (AgendaItem), who
# chaired and kept the minutes, and the minutes themselves, which are posted for members when
# they're ready and approved at the next one. Decisions made at it (Motion) link back to it.
# It can have an Event announcing it, so RSVPs, the flyer and a date poll come with Events.
class BusinessMeeting < ApplicationRecord
  STATUSES = %w[planned held cancelled].freeze
  MINUTES_STATUSES = %w[draft posted approved].freeze
  VISIBILITIES = %w[members keepers].freeze
  MINUTES_MAX = 300_000

  belongs_to :group
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :event, optional: true
  belongs_to :meeting, optional: true
  has_many :agenda_items, -> { order(:position, :id) }, dependent: :destroy
  has_many :motions, dependent: :nullify

  before_validation { self.minutes = DocumentHtml.sanitize(minutes) if minutes.present? }
  before_validation { %i[chair_name secretary_name].each { |a| self[a] = self[a].to_s.squish.presence } }
  before_save :stamp_minutes

  validates :held_on, presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :minutes_status, inclusion: { in: MINUTES_STATUSES }
  validates :visibility, inclusion: { in: VISIBILITIES }
  validates :chair_name, :secretary_name, length: { maximum: 80 }
  validates :attendance_count, numericality: { only_integer: true, in: 0..9999 }, allow_nil: true
  validates :minutes, length: { maximum: MINUTES_MAX }
  validate :belongs_with_group

  scope :newest_first, -> { order(held_on: :desc, id: :desc) }

  # Keepers see every meeting; members the ones for members. Nobody else sees any (an
  # announced one is shown through its public Event).
  def self.visible_to(group, user)
    return group.business_meetings if group.records_editable_by?(user)

    group.member_or_site_admin?(user) ? group.business_meetings.where(visibility: "members") : none
  end

  # The next one still ahead (today counts), in the group's own time zone
  def self.next_for(group, user)
    visible_to(group, user).where(status: "planned").where("held_on >= ?", group.zone.today).order(:held_on, :id).first
  end

  def planned? = status == "planned"

  # Motions set aside at earlier meetings (tabled, put off, sent to a committee) and not dealt with
  # since, that aren't on this agenda yet
  def unfinished_business
    on_agenda = agenda_items.where.not(motion_id: nil).select(:motion_id)
    group.motions.unfinished.where.not(id: on_agenda).where("motions.business_meeting_id IS NULL OR motions.business_meeting_id <> ?", id).includes(:business_meeting).newest_first
  end
  def zone = group.zone

  # starts_at in the group's zone as "HH:MM", and back from it
  def starts_time = starts_at&.in_time_zone(zone)&.strftime("%H:%M")

  def called_to_order_time = called_to_order_at&.in_time_zone(zone)&.strftime("%H:%M")
  def adjourned_time = adjourned_at&.in_time_zone(zone)&.strftime("%H:%M")

  # Whether enough people came, by the group's quorum; nil when the group has set none or no one
  # counted
  def quorum_met?
    needed = group.quorum_needed
    needed && attendance_count ? attendance_count >= needed : nil
  end

  def set_times(called_to_order: nil, adjourned: nil)
    self.called_to_order_at = clock(called_to_order, called_to_order_at) unless called_to_order.nil?
    self.adjourned_at = clock(adjourned, adjourned_at) unless adjourned.nil?
  end

  def set_start(time)
    self.starts_at = time.present? && held_on ? zone.parse("#{held_on} #{time}") : nil
  end

  def when_label
    day = held_on.strftime("%a, %b %-d")
    starts_at ? "#{day} · #{starts_at.in_time_zone(zone).strftime("%-l:%M %p %Z")}" : day
  end

  # `keeper`: sees draft minutes. Minutes stay out of the JSON until they're posted.
  def as_api_json(keeper: false, events: false)
    {
      id: id, held_on: held_on.iso8601, starts_at: starts_at&.iso8601, starts_time: starts_time, when_label: when_label,
      status: status, visibility: visibility, chair: chair_name, secretary: secretary_name, attendance_count: attendance_count,
      minutes_status: minutes_status, minutes: (minutes.to_s if keeper || minutes_status != "draft"),
      minutes_posted_at: minutes_posted_at&.iso8601, minutes_approved_at: minutes_approved_at&.iso8601,
      event: event && { token: event.token, title: event.title, status: event.status, path: event.path },
      meeting: meeting && { id: meeting.id, name: meeting.name },
      agenda_count: agenda_items.size, motions_count: motions.size,
      called_to_order_time: called_to_order_time, adjourned_time: adjourned_time,
      quorum_needed: group.quorum_needed, quorum_met: quorum_met?,
    }
  end

  private

  # "19:05" on this meeting's day, in the group's zone; blank clears it
  def clock(time, _was) = time.present? && held_on ? zone.parse("#{held_on} #{time}") : nil

  def belongs_with_group
    errors.add(:event, "must be one of this group's events") if event && event.group_id != group_id
    errors.add(:meeting, "must be one of this group's meetings") if meeting && meeting.group_id != group_id
  end

  def stamp_minutes
    self.minutes_posted_at ||= Time.current if minutes_status.in?(%w[posted approved])
    self.minutes_approved_at ||= Time.current if minutes_status == "approved"
    self.minutes_approved_at = nil if minutes_status != "approved"
  end
end
