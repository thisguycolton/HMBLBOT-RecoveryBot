class CreateQuestSessions < ActiveRecord::Migration[8.0]
  def change
    create_table :quest_sessions do |t|
      t.references :quest_player, null: false, foreign_key: true

      t.timestamps
    end
  end
end
