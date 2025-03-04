class CreateTopicCategories < ActiveRecord::Migration[8.0]
  def change
    create_table :topic_categories do |t|
      t.string :title
      t.string :icon
      t.string :cat

      t.timestamps
    end
  end
end
