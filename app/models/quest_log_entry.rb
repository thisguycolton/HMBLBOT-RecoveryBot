class QuestLogEntry < ApplicationRecord
  KINDS = %w[move encounter draw share pass fork item obstacle help gate].freeze

  belongs_to :quest_session
  belongs_to :topic, optional: true

  validates :kind, inclusion: { in: KINDS }
end
