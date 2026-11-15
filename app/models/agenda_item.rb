# One thing on a business meeting's agenda. A member's suggestion comes in as "suggested" and
# waits for a record keeper to put it on the agenda.
class AgendaItem < ApplicationRecord
  moderates_language :title, :details, :brought_by
  KINDS = %w[report old_business new_business other].freeze
  STATUSES = %w[suggested on_agenda tabled done].freeze

  belongs_to :business_meeting
  belongs_to :submitted_by, class_name: "User", optional: true
  # An earlier motion carried onto this agenda as unfinished business
  belongs_to :motion, optional: true
  has_many :motions, dependent: :nullify

  before_validation { self.title = title.to_s.squish }
  before_validation { self.brought_by = brought_by.to_s.squish.presence }
  before_validation(on: :create) { self.position = (business_meeting.agenda_items.maximum(:position) || 0) + 1 if position.zero? }

  validates :title, presence: true, length: { maximum: 160 }
  validates :details, length: { maximum: 2000 }
  validates :brought_by, length: { maximum: 80 }
  validates :kind, inclusion: { in: KINDS }
  validates :status, inclusion: { in: STATUSES }

  def suggested? = status == "suggested"

  # Who brought it: the name a record keeper typed in for someone, or whoever suggested it here
  def brought_by_name = brought_by.presence || submitted_by&.display_name

  def as_api_json(viewer: nil)
    { id: id, kind: kind, title: title, details: details.to_s, status: status, position: position,
      motion_id: motion_id, submitted_by: brought_by_name, brought_by: brought_by.to_s,
      mine: !!viewer && submitted_by_id == viewer.id }
  end
end
