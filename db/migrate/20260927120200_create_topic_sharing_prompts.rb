# Per-topic wording for a sharing mode, or switching a mode off for a topic. Only approved
# rows reach the game; drafts (e.g. from the Phase 3 authoring task) wait for a human.
class CreateTopicSharingPrompts < ActiveRecord::Migration[8.0]
  def change
    create_table :topic_sharing_prompts do |t|
      t.references :topic, null: false, foreign_key: true
      t.references :sharing_mode, null: false, foreign_key: true
      t.text :text
      t.string :status, null: false, default: "draft"
      t.string :source, null: false, default: "human"
      t.boolean :enabled, null: false, default: true
      t.timestamps
    end
    add_index :topic_sharing_prompts, [:topic_id, :sharing_mode_id], unique: true
    add_index :topic_sharing_prompts, :status
  end
end
