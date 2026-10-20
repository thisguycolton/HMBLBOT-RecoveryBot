# Someone covering the host's (or co-host's) place at one meeting on one date
class MeetingHostCover < ApplicationRecord
  belongs_to :meeting
  belongs_to :user, optional: true

  before_validation { self.name = name.to_s.squish.presence || user&.display_name.to_s }

  validates :role, inclusion: { in: MeetingHost::ROLES }
  validates :name, presence: true, length: { maximum: 80 }
  validates :on, presence: true, uniqueness: { scope: %i[meeting_id role], message: "already has someone covering" }
  validate { errors.add(:on, "isn't a day this meeting meets (#{Date::DAYNAMES[meeting.day_of_week]}s)") if on && meeting&.weekly? && on.wday != meeting.day_of_week }

  def as_api_json
    { id: id, role: role, name: name, on: self.on.iso8601, linked: user_id.present?, user_id: user_id }
  end
end
