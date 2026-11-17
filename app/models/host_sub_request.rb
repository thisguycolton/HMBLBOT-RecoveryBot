# A host coordinator asking the group for someone to fill the host's (or co-host's) place at
# one meeting on one date. Every member is told; the first to take it becomes a
# MeetingHostCover for that date and the request is filled.
class HostSubRequest < ApplicationRecord
  moderates_language :note
  STATUSES = %w[open filled cancelled].freeze

  belongs_to :meeting
  belongs_to :requested_by, class_name: "User", optional: true
  belongs_to :filled_by, class_name: "User", optional: true

  scope :open, -> { where(status: "open") }

  before_validation { self.note = note.to_s.squish.presence }

  validates :role, inclusion: { in: MeetingHost::ROLES }
  validates :status, inclusion: { in: STATUSES }
  validates :on, presence: true
  validates :note, length: { maximum: 300 }
  validate { errors.add(:on, "isn't a day this meeting meets (#{Date::DAYNAMES[meeting.day_of_week]}s)") if on && meeting&.weekly? && on.wday != meeting.day_of_week }
  validate { errors.add(:on, "has already passed") if on && meeting && new_record? && on < meeting.group.zone.today }
  validate(on: :create) { errors.add(:base, "There's already a request out for that date") if meeting && self.class.open.exists?(meeting_id: meeting_id, role: role, on: self.on) }

  def open? = status == "open"
  def place_label = MeetingHost::ROLE_LABELS[role].downcase

  # "Sub needed: host for The Acid Test, Sun Oct 19 at 9:00 AM"
  def headline = "Sub needed: #{place_label} for #{meeting.name}, #{self.on.strftime("%a %b %-d")} at #{Meeting.clock(meeting.start_minute)}"

  def as_api_json
    { id: id, meeting_id: meeting_id, role: role, on: self.on.iso8601, note: note, requested_by: requested_by&.display_name }
  end
end
