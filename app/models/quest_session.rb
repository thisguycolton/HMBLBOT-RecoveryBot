class QuestSession < ApplicationRecord
  belongs_to :quest_player
  belongs_to :topic_set, optional: true
  has_one :quest_inventory, dependent: :destroy
  has_many :quest_log_entries, dependent: :destroy

  validates :join_code, presence: true, uniqueness: true
  validates :status, inclusion: { in: %w[active completed] }

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
