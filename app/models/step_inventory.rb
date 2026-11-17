# A member's nightly 10th step inventory for one day, the review the Big Book suggests on
# page 86. Only its owner ever sees it (Api::StepInventoriesController). Each question keeps
# a yes or no and a note: answers = { "resentful" => { "answer" => "yes", "note" => "..." } }.
class StepInventory < ApplicationRecord
  moderates_language :answers, :notes
  include RecoveryEntry

  # The Big Book's questions (InventoryQuestions::DEFAULT); a member can change theirs, and each
  # night keeps the set it was written with (`questions`)
  KEYS = InventoryQuestions::DEFAULT.map { |q| q["key"] }.freeze

  validates :notes, length: { maximum: 10_000 }
  before_validation :tidy_answers

  def blank_entry? = notes.blank? && answers.values.all? { |a| a["answer"].blank? && a["note"].blank? }

  def as_api_json = { on: on.iso8601, answers: answers, notes: notes, questions: questions.presence || InventoryQuestions::DEFAULT, updated_at: updated_at&.iso8601 }

  private

  # Only this night's questions (a new night takes the member's current set; one written before
  # questions could change had the Big Book's), "yes"/"no" or nothing, and notes of a sensible length
  def tidy_answers
    self.questions = InventoryQuestions.for(user) if new_record? && questions.blank?
    self.questions = InventoryQuestions::DEFAULT if questions.blank?
    given = answers.is_a?(Hash) ? answers.stringify_keys : {}
    self.answers = questions.map { |q| q["key"] }.each_with_object({}) do |key, out|
      raw = given[key].is_a?(Hash) ? given[key].stringify_keys : {}
      answer = raw["answer"].to_s
      answer = nil unless %w[yes no].include?(answer)
      note = raw["note"].to_s.strip.first(4000)
      out[key] = { "answer" => answer, "note" => note } if answer || note.present?
    end
    self.notes = notes.to_s.strip
  end
end
