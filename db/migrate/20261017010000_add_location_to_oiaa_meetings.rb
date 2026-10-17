# Where an AA Intergroup listing meets, for "Find a meeting": the Meeting Guide feed's
# attendance option (online, in_person, hybrid) and, for in-person and hybrid meetings,
# the place. Filled in by the next sync.
class AddLocationToOiaaMeetings < ActiveRecord::Migration[8.0]
  def change
    add_column :oiaa_meetings, :attendance_option, :string
    add_column :oiaa_meetings, :location, :string
    add_column :oiaa_meetings, :formatted_address, :string
    add_column :oiaa_meetings, :region, :string
    add_index :oiaa_meetings, :last_seen_at
  end
end
