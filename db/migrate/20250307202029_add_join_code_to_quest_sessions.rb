class AddJoinCodeToQuestSessions < ActiveRecord::Migration[8.0]
  def change
    add_column :quest_sessions, :join_code, :string
  end
end
