class AddQuestFieldsToQuestSessions < ActiveRecord::Migration[7.0]
  def change
    add_reference :quest_sessions, :topic_set, foreign_key: true, null: true
    add_column :quest_sessions, :status, :string, null: false, default: "active"
    add_column :quest_sessions, :completed_at, :datetime
    add_column :quest_sessions, :name, :string
  end
end
