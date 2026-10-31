# A service position in a group (chair, secretary, treasurer, GSR, coffee maker...): what it
# involves, how long a term lasts, and who has held it (ServiceTerm).
class ServicePosition < ApplicationRecord
  moderates_language :title, :description
  belongs_to :group
  has_many :terms, -> { order(starts_on: :desc, id: :desc) }, class_name: "ServiceTerm", dependent: :destroy

  before_validation { self.title = title.to_s.squish }
  before_validation(on: :create) { self.position = (group.service_positions.maximum(:position) || 0) + 1 if position.zero? }

  validates :title, presence: true, length: { maximum: 80 }
  validates :description, length: { maximum: 2000 }
  validates :term_months, numericality: { only_integer: true, in: 1..120 }, allow_nil: true
  validates :sobriety_months, numericality: { only_integer: true, in: 0..600 }, allow_nil: true

  scope :ordered, -> { order(:archived, :position, :id) }

  def current_term(today) = terms.find { |t| t.current?(today) }

  # Someone's term is nearly up and nobody comes after them, or nobody holds it
  def rotation(today)
    return if archived

    term = current_term(today)
    return "vacant" unless term
    "due" if term.ending_soon?(today)
  end

  def as_api_json(today:)
    term = current_term(today)
    {
      id: id, title: title, description: description.to_s, term_months: term_months, sobriety_months: sobriety_months,
      position: position, archived: archived, rotation: rotation(today),
      current: term&.as_api_json,
      history: terms.reject { |t| t == term }.first(6).map(&:as_api_json),
    }
  end
end
