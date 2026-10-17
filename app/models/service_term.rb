# Someone holding a service position from one date to another. The name is plain text (first
# name and last initial); user is only there so they can be told when it's nearly up.
class ServiceTerm < ApplicationRecord
  REMIND_DAYS = 30

  belongs_to :service_position
  belongs_to :user, optional: true

  before_validation { self.name = name.to_s.squish.presence || user&.display_name.to_s }
  before_validation do
    months = service_position&.term_months
    self.ends_on ||= starts_on + months.months - 1.day if starts_on && months
  end

  validates :name, presence: true, length: { maximum: 80 }
  validates :starts_on, presence: true
  validate { errors.add(:ends_on, "can't be before it starts") if starts_on && ends_on && ends_on < starts_on }

  def current?(today) = starts_on <= today && (ends_on.nil? || ends_on >= today)

  # Succeeded by a later term of the same position
  def succeeded?
    service_position.terms.any? { |t| t.id != id && t.starts_on > starts_on }
  end

  def ending_soon?(today) = ends_on.present? && ends_on <= today + REMIND_DAYS && !succeeded?

  def as_api_json
    { id: id, name: name, starts_on: starts_on.iso8601, ends_on: ends_on&.iso8601, linked: user_id.present? }
  end
end
