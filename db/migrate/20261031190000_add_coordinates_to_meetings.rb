# Where an in-person meeting is on a map (MeetingMap): from its meeting list's feed, or looked
# up from its address the first time its map is drawn.
class AddCoordinatesToMeetings < ActiveRecord::Migration[8.0]
  def change
    %i[meetings oiaa_meetings].each do |table|
      add_column table, :latitude, :decimal, precision: 9, scale: 6
      add_column table, :longitude, :decimal, precision: 9, scale: 6
    end
  end
end
