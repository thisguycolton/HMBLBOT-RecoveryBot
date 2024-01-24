class CreateTopics < ActiveRecord::Migration[7.0]
  def change
    create_table :topics do |t|
      t.string :title
      t.string :searchable_number
      
      t.timestamps
    end
  end
end
