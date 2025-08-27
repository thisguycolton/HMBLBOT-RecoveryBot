class AddTopicSetToTopic < ActiveRecord::Migration[8.0]
  def change
    add_reference :topics, :topic_set, null: true, foreign_key: true
    reversible do |dir|
      dir.up do
        Topic.where(topic_set_id: nil).update_all(topic_set_id: 1)
      end
    end
    change_column_null :topics, :topic_set_id, false
  end
end
