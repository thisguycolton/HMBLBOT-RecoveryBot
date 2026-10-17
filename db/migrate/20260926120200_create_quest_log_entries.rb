# The journey log: what happened on an ACID QUEST journey, for stats, the Quest Complete
# summary and (later) the post-meeting story. Structured fields only - never free text or
# anything about who shared.
class CreateQuestLogEntries < ActiveRecord::Migration[7.0]
  def change
    create_table :quest_log_entries do |t|
      t.references :quest_session, null: false, foreign_key: true
      t.string :kind, null: false
      t.string :encounter
      t.references :topic, null: true, foreign_key: true
      t.string :sharing_mode_key
      t.string :approach
      t.jsonb :data, null: false, default: {}
      t.timestamps
    end
    add_index :quest_log_entries, [:quest_session_id, :kind]
  end
end
