# ACID QUEST content curation: how deep a topic goes. Nullable; unset reads as "standard".
class AddDifficultyToTopics < ActiveRecord::Migration[8.0]
  def change
    add_column :topics, :difficulty, :string
    add_index :topics, :difficulty
  end
end
