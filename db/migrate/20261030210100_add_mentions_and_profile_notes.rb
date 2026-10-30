# @ mentions in notes and comments (Mentions), and a note's author turning its comments off
class AddMentionsAndProfileNotes < ActiveRecord::Migration[8.0]
  def change
    change_table :timeline_notes, bulk: true do |t|
      t.boolean :comments_off, null: false, default: false
      t.jsonb :mentions, null: false, default: {}
      t.bigint :mentioned_user_ids, array: true, null: false, default: []
    end
    change_table :note_comments, bulk: true do |t|
      t.jsonb :mentions, null: false, default: {}
      t.bigint :mentioned_user_ids, array: true, null: false, default: []
    end
  end
end
