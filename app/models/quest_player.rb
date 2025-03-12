class QuestPlayer < ApplicationRecord
  has_many :quest_sessions
  has_many :quest_inventories, through: :quest_sessions
end
