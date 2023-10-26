class AddMeetingNameToReading < ActiveRecord::Migration[7.0]
  def change
    add_column :readings, :meetingName, :string
    add_column :readings, :meetingUrl, :string
    add_column :readings, :host, :string
  end
end
