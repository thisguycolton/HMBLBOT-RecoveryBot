class AddSubtitleToTopics < ActiveRecord::Migration[7.0]
  def change
    add_column :topics, :subtitle, :string
    add_column :topics, :link, :string
  end
end
