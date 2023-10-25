class AddTimeToReadings < ActiveRecord::Migration[7.0]
  def change
    add_column :readings, :meetingTime, :time
  end
end
