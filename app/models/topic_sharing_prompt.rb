# Curated wording of a sharing mode for one topic ("Tell us about a time you had to let go"),
# or that mode switched off for the topic (enabled: false). Only approved rows reach ACID
# QUEST; drafts (human or, later, AI) wait on the curation page.
class TopicSharingPrompt < ApplicationRecord
  STATUSES = %w[draft approved rejected].freeze
  SOURCES = %w[human ai].freeze

  belongs_to :topic
  belongs_to :sharing_mode

  validates :status, inclusion: { in: STATUSES }
  validates :source, inclusion: { in: SOURCES }
  validates :sharing_mode_id, uniqueness: { scope: :topic_id }
  validates :text, presence: true, if: -> { enabled? }

  scope :approved, -> { where(status: "approved") }

  # What the game needs: { key:, text:, enabled: }
  def as_game_json
    { key: sharing_mode.key, text: enabled? ? text : nil, enabled: enabled? }
  end
end
