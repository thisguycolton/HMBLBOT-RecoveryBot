# A fictional tale of one ACID QUEST journey (see QuestStoryGenerator)
class QuestStory < ApplicationRecord
  belongs_to :quest_session

  validates :style, inclusion: { in: -> (_) { QuestStoryGenerator::STYLES.keys } }
  validates :body, presence: true

  def as_json(*)
    { id: id, style: style, style_name: QuestStoryGenerator::STYLES.dig(style, :name), title: title, body: body, created_at: created_at }
  end
end
