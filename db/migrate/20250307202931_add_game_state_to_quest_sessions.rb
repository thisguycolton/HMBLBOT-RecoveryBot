class AddGameStateToQuestSessions < ActiveRecord::Migration[8.0]
  def change
    add_column :quest_sessions, :game_state, :jsonb
  end
end
