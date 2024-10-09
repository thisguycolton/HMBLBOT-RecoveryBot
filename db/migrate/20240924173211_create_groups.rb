class CreateGroups < ActiveRecord::Migration[7.0]
  def change
    create_table :groups do |t|
      t.string :title
      t.string :description
      t.string :location
      t.string :website
      t.boolean :remote
      t.string :meetingLink

      t.timestamps
    end
  end
end
