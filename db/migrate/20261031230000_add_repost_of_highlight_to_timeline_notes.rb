# A repost of someone's shared highlight is a note of the reposter's that shows it, as a
# repost of a note does (TimelineNote#repost_of)
class AddRepostOfHighlightToTimelineNotes < ActiveRecord::Migration[8.0]
  def change
    add_reference :timeline_notes, :repost_of_highlight, foreign_key: { to_table: :user_highlights, on_delete: :cascade }, index: false
    add_index :timeline_notes, %i[repost_of_highlight_id user_id], unique: true, where: "repost_of_highlight_id IS NOT NULL"
  end
end
