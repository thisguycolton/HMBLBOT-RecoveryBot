class QuestSession < ApplicationRecord
  belongs_to :quest_player
  has_one :quest_inventory, dependent: :destroy

  validates :join_code, presence: true, uniqueness: true

  after_create :initialize_inventory

  def initialize_inventory
    self.game_state ||= {
      inventory: {
        items: {},
        slots: Array.new(9, nil)
      }
    }
    self.save
  end
end
