class QuestPlayer < ApplicationRecord
  moderates_language :screen_name
  has_many :quest_sessions
  has_many :quest_inventories, through: :quest_sessions
end
