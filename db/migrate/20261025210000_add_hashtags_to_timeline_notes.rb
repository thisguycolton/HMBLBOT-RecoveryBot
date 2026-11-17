# The #hashtags a note's words hold (TimelineNote::Hashtags), kept in lowercase so the
# #tag page and the note editor's suggestions can find them. Existing notes get theirs here.
class AddHashtagsToTimelineNotes < ActiveRecord::Migration[8.0]
  class Note < ActiveRecord::Base
    self.table_name = "timeline_notes"
  end

  def up
    add_column :timeline_notes, :hashtags, :string, array: true, null: false, default: []
    add_index :timeline_notes, :hashtags, using: :gin

    Note.reset_column_information
    Note.where("body LIKE '%#%'").find_each do |note|
      tags = Hashtags.in(note.body)
      note.update_columns(hashtags: tags) if tags.any?
    end
  end

  def down
    remove_column :timeline_notes, :hashtags
  end
end
