class AddSearchableNumberToTopics < ActiveRecord::Migration[7.0]
  def change
    add_column :topics, :searchable_number, :string
  end
end
