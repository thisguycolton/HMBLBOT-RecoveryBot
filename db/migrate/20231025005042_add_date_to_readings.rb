class AddDateToReadings < ActiveRecord::Migration[7.0]
  def change
    add_column :readings, :meetingDatetime, :timestamp
  end
end
