class CreateTopicSets < ActiveRecord::Migration[8.0]
  def change
    create_table :topic_sets do |t|
      t.string :name
      t.string :description

      t.timestamps
    end

    reversible do |dir|
      dir.up do
        # Define a minimal model for use in migration
        class TopicSet < ActiveRecord::Base; end

        TopicSet.find_or_create_by!(
          name: "Original Topics",
          description: "The topics from v1"
        )
      end
    end
  end
end
