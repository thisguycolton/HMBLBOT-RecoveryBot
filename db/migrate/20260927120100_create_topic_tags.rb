# Topics share the Tag vocabulary with Readings
class CreateTopicTags < ActiveRecord::Migration[8.0]
  def change
    create_table :topic_tags do |t|
      t.references :topic, null: false, foreign_key: true
      t.references :tag, null: false, foreign_key: true
      t.timestamps
    end
    add_index :topic_tags, [:topic_id, :tag_id], unique: true
  end
end
