# Local meeting lists re-import themselves from their feed link once a week
# (MeetingListRefresh): new and changed meetings only. These columns say whether a list
# does, and how its last refresh went, for Site Admin > Meeting lists.
class AddWeeklyRefreshToMeetingDirectories < ActiveRecord::Migration[8.0]
  def change
    change_table :meeting_directories, bulk: true do |t|
      t.boolean :auto_refresh, default: true, null: false
      t.datetime :refresh_started_at
      t.datetime :refreshed_at
      t.string :refresh_status
      t.text :refresh_error
      t.jsonb :refresh_result, default: {}, null: false
    end
  end
end
