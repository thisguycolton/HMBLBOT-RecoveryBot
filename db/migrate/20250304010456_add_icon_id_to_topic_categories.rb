class AddIconIdToTopicCategories < ActiveRecord::Migration[8.0]
  def change
    add_column :topic_categories, :icon_id, :integer
  end
end
