# One person's reaction to a timeline note or a comment on one: Like, Love or Hugs. One
# per person on each; reacting again changes it. Only on what they can see (Reactable).
class NoteReaction < ApplicationRecord
  KINDS = %w[like love hugs].freeze

  belongs_to :reactable, polymorphic: true
  belongs_to :user

  validates :kind, inclusion: { in: KINDS }
  validates :user_id, uniqueness: { scope: %i[reactable_type reactable_id] }

  # For the author: "Mo liked your note"
  def self.phrase(kind) = { "like" => "liked", "love" => "loved", "hugs" => "sent hugs for" }.fetch(kind)
end
