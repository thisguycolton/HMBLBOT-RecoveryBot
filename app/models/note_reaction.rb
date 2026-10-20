# One person's reaction to a timeline note: Like, Love or Hugs. One per person per note;
# reacting again changes it. Only on notes they can see (TimelineNote#visible_to?).
class NoteReaction < ApplicationRecord
  KINDS = %w[like love hugs].freeze

  belongs_to :timeline_note
  belongs_to :user

  validates :kind, inclusion: { in: KINDS }
  validates :user_id, uniqueness: { scope: :timeline_note_id }

  # For the note's author: "Mo liked your note"
  def self.phrase(kind) = { "like" => "liked", "love" => "loved", "hugs" => "sent hugs for" }.fetch(kind)
end
