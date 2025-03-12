class CreateQuestPlayers < ActiveRecord::Migration[8.0]
  def change
    create_table :quest_players do |t|
      t.string :screen_name

      t.timestamps
    end
  end
end
