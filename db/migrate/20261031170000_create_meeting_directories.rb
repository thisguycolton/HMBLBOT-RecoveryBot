# Local meeting lists (an intergroup's in-person meetings, say) imported next to AA
# Intergroup's online directory. Their listings are OiaaMeeting rows with a
# meeting_directory_id; AA Intergroup's own have none. See MeetingListImport.
class CreateMeetingDirectories < ActiveRecord::Migration[8.0]
  def change
    create_table :meeting_directories do |t|
      t.string :name, null: false
      t.string :key, null: false
      t.string :feed_url
      t.string :website
      t.string :time_zone, null: false, default: "America/Phoenix"
      t.datetime :imported_at
      t.references :imported_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamps
    end
    add_index :meeting_directories, :key, unique: true

    add_reference :oiaa_meetings, :meeting_directory, foreign_key: true
    add_column :oiaa_meetings, :source_slug, :string
    add_column :oiaa_meetings, :location_notes, :text
    # An imported listing an admin took off the list (kept, since groups may link to it)
    add_column :oiaa_meetings, :hidden_at, :datetime
  end
end
