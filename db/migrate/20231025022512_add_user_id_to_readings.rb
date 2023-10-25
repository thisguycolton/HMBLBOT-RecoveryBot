class AddUserIdToReadings < ActiveRecord::Migration[7.0]
  def change
    add_reference :readings, :user, null: false, foreign_key: true
  end
end
