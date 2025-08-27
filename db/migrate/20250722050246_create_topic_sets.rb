class CreateTopicSets < ActiveRecord::Migration[8.0]
  # lightweight model for use in this migration only
  class TopicSet < ApplicationRecord
    self.table_name = "topic_sets"
  end

  def change
    create_table :topic_sets do |t|
      t.string :name,        null: false
      t.string :description
      t.timestamps
    end
    add_index :topic_sets, :name, unique: true

    reversible do |dir|
      dir.up do
        TopicSet.reset_column_information
        TopicSet.find_or_create_by!(name: "Original Topics") do |ts|
          ts.description = "The topics from v1"
        end
      end
    end
  end
end
