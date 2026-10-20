# Reactions (Like, Love, Hugs; one per person per note) and reposts on timeline notes. A
# repost is a note on the reposter's own timeline that points at the original
# (`repost_of_id`) and shows it, so it goes when the original does.
class AddReactionsAndRepostsToTimelineNotes < ActiveRecord::Migration[8.0]
  def change
    create_table :note_reactions do |t|
      t.references :timeline_note, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.string :kind, null: false
      t.timestamps
    end
    add_index :note_reactions, %i[timeline_note_id user_id], unique: true

    add_reference :timeline_notes, :repost_of, foreign_key: { to_table: :timeline_notes, on_delete: :cascade }, index: false
    add_index :timeline_notes, %i[repost_of_id user_id], unique: true, where: "repost_of_id IS NOT NULL"
  end
end
