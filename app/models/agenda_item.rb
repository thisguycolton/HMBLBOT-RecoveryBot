# One thing on a business meeting's agenda. A member's suggestion comes in as "suggested" and
# waits for a record keeper to put it on the agenda.
class AgendaItem < ApplicationRecord
  KINDS = %w[report old_business new_business other].freeze
  STATUSES = %w[suggested on_agenda tabled done].freeze

  belongs_to :business_meeting
  belongs_to :submitted_by, class_name: "User", optional: true
  has_many :motions, dependent: :nullify

  before_validation { self.title = title.to_s.squish }
  before_validation(on: :create) { self.position = (business_meeting.agenda_items.maximum(:position) || 0) + 1 if position.zero? }

  validates :title, presence: true, length: { maximum: 160 }
  validates :details, length: { maximum: 2000 }
  validates :kind, inclusion: { in: KINDS }
  validates :status, inclusion: { in: STATUSES }

  def suggested? = status == "suggested"

  def as_api_json(viewer: nil)
    { id: id, kind: kind, title: title, details: details.to_s, status: status, position: position,
      submitted_by: submitted_by&.display_name, mine: !!viewer && submitted_by_id == viewer.id }
  end
end
