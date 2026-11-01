# A worksheet a sponsor suggests to a sponsee: a copy of the worksheet only (the built-in one,
# or their own customized copy), never anyone's answers, with an optional note. The sponsee
# chooses whether to start it (it becomes their own StepWork) or set it aside; it never
# replaces work they've started. Ending the sponsorship deletes these with everything else.
class StepSuggestion < ApplicationRecord
  moderates_language :name, :note, :definition

  NOTE_MAX = 500

  belongs_to :sponsorship

  validates :name, presence: true, length: { maximum: 200 }
  validates :note, length: { maximum: NOTE_MAX }
  validates :step, inclusion: { in: StepTool::STEPS }
  validate { errors.add(:definition, "is missing") if definition.blank? }

  before_validation { self.note = note.to_s.strip.presence }

  scope :waiting, -> { where(started_at: nil) }

  def start!(user)
    transaction do
      update!(started_at: Time.current)
      user.step_works.create!(step: step, tool_key: tool_key, name: name, definition: definition, answers: {}, status: "in_progress")
    end
  end

  def as_api_json
    { id: id, name: name, step: step, note: note, started: started_at.present?, created_at: created_at.iso8601,
      sponsor: sponsorship.sponsor.as_person_json, sponsorship_id: sponsorship_id }
  end
end
