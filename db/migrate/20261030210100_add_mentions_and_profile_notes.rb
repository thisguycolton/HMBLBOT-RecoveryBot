# @ mentions in notes and comments (Mentions), and notes written on someone else's profile
# (profile_id: whose page it's on)
class AddMentionsAndProfileNotes < ActiveRecord::Migration[8.0]
  def change
    change_table :timeline_notes, bulk: true do |t|
      t.references :profile, foreign_key: { to_table: :users, on_delete: :cascade }
      t.jsonb :mentions, null: false, default: {}
      t.bigint :mentioned_user_ids, array: true, null: false, default: []
    end
    change_table :note_comments, bulk: true do |t|
      t.jsonb :mentions, null: false, default: {}
      t.bigint :mentioned_user_ids, array: true, null: false, default: []
    end
  end
end
