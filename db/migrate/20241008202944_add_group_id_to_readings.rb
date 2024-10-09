class AddGroupIdToReadings < ActiveRecord::Migration[7.0]
  def change
    add_reference :readings, :group, null: true, foreign_key: true
  end
end
