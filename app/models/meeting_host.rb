# Someone hosting (or co-hosting) one of a group's weekly meetings from one date to another,
# until someone else is put in. A one-date swap is a MeetingHostCover.
class MeetingHost < ApplicationRecord
  moderates_language :name
  ROLES = %w[host co_host].freeze
  ROLE_LABELS = { "host" => "Host", "co_host" => "Co-host" }.freeze

  belongs_to :meeting
  belongs_to :user, optional: true

  before_validation { self.name = name.to_s.squish.presence || user&.display_name.to_s }

  validates :role, inclusion: { in: ROLES }
  validates :name, presence: true, length: { maximum: 80 }
  validates :starts_on, presence: true
  validate { errors.add(:ends_on, "can't be before it starts") if starts_on && ends_on && ends_on < starts_on }
  validate { errors.add(:meeting, "has to be a weekly meeting") unless meeting&.weekly? }

  def active_on?(date) = starts_on <= date && (ends_on.nil? || ends_on >= date)

  def as_api_json
    { id: id, role: role, name: name, starts_on: starts_on.iso8601, ends_on: ends_on&.iso8601, linked: user_id.present?, user_id: user_id }
  end
end
